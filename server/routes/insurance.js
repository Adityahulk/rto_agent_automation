import { Router } from 'express'
import { Prisma } from '@prisma/client'
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
    prisma.insurancePolicy.findMany({
      where,
      include: { vehicle: { include: { client: true } } },
      orderBy: { expiryDate: 'asc' },
    }),
    statsForModel({
      tenantId,
      prismaModel: prisma.insurancePolicy,
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
      policyNumber: row.policyNumber,
      insurer: row.insurer,
      policyType: row.policyType,
      premium: Number(row.premium),
      startDate: row.startDate.toISOString(),
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
  const policyNumber =
    typeof body.policyNumber === 'string' ? body.policyNumber.trim() : ''
  const insurer = typeof body.insurer === 'string' ? body.insurer.trim() : ''
  const policyType = typeof body.policyType === 'string' ? body.policyType.trim() : ''
  const premium = Number(body.premium)
  if (!vehicleId || !policyNumber || !insurer || !policyType || Number.isNaN(premium)) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  const v = await assertVehicleForTenant(vehicleId, tenantId)
  if (!v) return res.status(404).json({ message: 'Vehicle not found' })

  const sd = readIsoDate(body.startDate, 'startDate')
  if (!sd.ok) return res.status(400).json({ message: sd.error })
  const ed = readIsoDate(body.expiryDate, 'expiryDate')
  if (!ed.ok) return res.status(400).json({ message: ed.error })
  const startDate = sd.date
  const expiryDate = ed.date
  const status = statusFromExpiryDate(expiryDate)

  const row = await prisma.insurancePolicy.create({
    data: {
      tenantId,
      vehicleId,
      policyNumber,
      insurer,
      policyType,
      premium: new Prisma.Decimal(String(premium)),
      startDate,
      expiryDate,
      status,
    },
  })

  res.status(201).json({
    id: row.id,
    policyNumber: row.policyNumber,
    expiryDate: row.expiryDate.toISOString(),
    status: statusFromExpiryDate(row.expiryDate),
  })
})

router.put('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params
  const existing = await prisma.insurancePolicy.findFirst({
    where: { id, tenantId },
  })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  const body = req.body ?? {}
  const data = {}

  if (typeof body.policyNumber === 'string') data.policyNumber = body.policyNumber.trim()
  if (typeof body.insurer === 'string') data.insurer = body.insurer.trim()
  if (typeof body.policyType === 'string') data.policyType = body.policyType.trim()
  if (body.premium != null && body.premium !== '') {
    const p = Number(body.premium)
    if (Number.isNaN(p)) return res.status(400).json({ message: 'Invalid premium' })
    data.premium = new Prisma.Decimal(String(p))
  }
  if (body.startDate) {
    const r = readIsoDate(body.startDate, 'startDate')
    if (!r.ok) return res.status(400).json({ message: r.error })
    data.startDate = r.date
  }
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

  if (data.expiryDate || existing.expiryDate) {
    const exp = data.expiryDate ?? existing.expiryDate
    data.status = statusFromExpiryDate(exp)
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' })
  }

  const row = await prisma.insurancePolicy.update({
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
  const existing = await prisma.insurancePolicy.findFirst({
    where: { id, tenantId },
  })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  const r = readIsoDate(req.body?.expiryDate, 'expiryDate')
  if (!r.ok) return res.status(400).json({ message: r.error })
  const expiryDate = r.date
  const status = statusFromExpiryDate(expiryDate)

  const row = await prisma.insurancePolicy.update({
    where: { id: existing.id },
    data: {
      expiryDate,
      status,
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
  const existing = await prisma.insurancePolicy.findFirst({
    where: { id, tenantId },
  })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  await prisma.insurancePolicy.delete({ where: { id: existing.id } })
  res.status(204).send()
})

export default router
