import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'
import {
  prismaStatusWhere,
  readIsoDate,
  searchVehicleClientOr,
  statsForModel,
  statusFromExpiryDate,
} from '../lib/complianceExpiry.js'
import { assertVehicleForTenant } from '../lib/vehicleTenant.js'

const router = Router()
router.use(verifyAgentToken, checkSubscription)

router.get('/', async (req, res) => {
  const tenantId = req.tenant.id
  const search = typeof req.query.search === 'string' ? req.query.search : ''
  const status = typeof req.query.status === 'string' ? req.query.status : ''

  const parts = [{ tenantId }, { vehicle: { client: { deletedAt: null } } }]
  const sw = searchVehicleClientOr(search)
  if (sw) parts.push(sw)
  const pw = prismaStatusWhere(status)
  if (Object.keys(pw).length) parts.push(pw)
  const where = { AND: parts }

  const [rows, stats] = await Promise.all([
    prisma.pUCRecord.findMany({
      where,
      include: { vehicle: { include: { client: true } } },
      orderBy: { expiryDate: 'asc' },
    }),
    statsForModel({
      tenantId,
      prismaModel: prisma.pUCRecord,
      extraWhere: { vehicle: { client: { deletedAt: null } } },
    }),
  ])

  res.json({
    stats,
    items: rows.map((row) => ({
      id: row.id,
      clientName: row.vehicle.client.name,
      vehicleNumber: row.vehicle.vehicleNumber,
      clientId: row.vehicle.clientId,
      vehicleId: row.vehicleId,
      pucNumber: row.pucNumber,
      testCenter: row.testCenter,
      expiryDate: row.expiryDate.toISOString(),
      status: statusFromExpiryDate(row.expiryDate),
      lastRenewedAt: row.lastRenewedAt?.toISOString() ?? null,
    })),
  })
})

router.post('/', async (req, res) => {
  const tenantId = req.tenant.id
  const body = req.body ?? {}
  const vehicleId = typeof body.vehicleId === 'string' ? body.vehicleId.trim() : ''
  const pucNumber = typeof body.pucNumber === 'string' ? body.pucNumber.trim() : ''
  const testCenter = typeof body.testCenter === 'string' ? body.testCenter.trim() : ''
  if (!vehicleId || !pucNumber || !testCenter) {
    return res.status(400).json({ message: 'vehicleId, pucNumber, and testCenter are required' })
  }

  const v = await assertVehicleForTenant(vehicleId, tenantId)
  if (!v) return res.status(404).json({ message: 'Vehicle not found' })

  const ed = readIsoDate(body.expiryDate, 'expiryDate')
  if (!ed.ok) return res.status(400).json({ message: ed.error })

  const row = await prisma.pUCRecord.create({
    data: {
      tenantId,
      vehicleId,
      pucNumber,
      testCenter,
      expiryDate: ed.date,
    },
  })

  res.status(201).json({
    id: row.id,
    expiryDate: row.expiryDate.toISOString(),
    status: statusFromExpiryDate(row.expiryDate),
  })
})

router.put('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params
  const existing = await prisma.pUCRecord.findFirst({
    where: { id, tenantId },
  })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  const body = req.body ?? {}
  const data = {}

  if (typeof body.pucNumber === 'string') data.pucNumber = body.pucNumber.trim()
  if (typeof body.testCenter === 'string') data.testCenter = body.testCenter.trim()
  if (body.expiryDate) {
    const r = readIsoDate(body.expiryDate, 'expiryDate')
    if (!r.ok) return res.status(400).json({ message: r.error })
    data.expiryDate = r.date
  }
  if (typeof body.vehicleId === 'string' && body.vehicleId.trim()) {
    const v = await assertVehicleForTenant(body.vehicleId.trim(), tenantId)
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    data.vehicleId = v.id
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' })
  }

  const row = await prisma.pUCRecord.update({
    where: { id: existing.id },
    data,
  })

  res.json({
    id: row.id,
    expiryDate: row.expiryDate.toISOString(),
    status: statusFromExpiryDate(row.expiryDate),
  })
})

router.patch('/:id/renew', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params
  const existing = await prisma.pUCRecord.findFirst({
    where: { id, tenantId },
  })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  const r = readIsoDate(req.body?.expiryDate, 'expiryDate')
  if (!r.ok) return res.status(400).json({ message: r.error })

  const row = await prisma.pUCRecord.update({
    where: { id: existing.id },
    data: {
      expiryDate: r.date,
      lastRenewedAt: new Date(),
    },
  })

  res.json({
    id: row.id,
    expiryDate: row.expiryDate.toISOString(),
    status: statusFromExpiryDate(row.expiryDate),
    lastRenewedAt: row.lastRenewedAt?.toISOString() ?? null,
  })
})

router.delete('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params
  const existing = await prisma.pUCRecord.findFirst({
    where: { id, tenantId },
  })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  await prisma.pUCRecord.delete({ where: { id: existing.id } })
  res.status(204).send()
})

export default router
