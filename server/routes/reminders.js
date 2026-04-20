import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'

const router = Router()
router.use(verifyAgentToken, checkSubscription)

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function daysRemaining(expiryDate) {
  const ms = startOfDay(expiryDate).getTime() - startOfDay(new Date()).getTime()
  return Math.ceil(ms / 86400000)
}

function parseDateOnly(s) {
  if (typeof s !== 'string' || !s.trim()) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const vehicleClientWhere = {
  client: { deletedAt: null },
}

/** GET /api/reminders?type=&dateFrom=&dateTo= */
router.get('/', async (req, res) => {
  const tenantId = req.tenant.id
  const typeRaw = typeof req.query.type === 'string' ? req.query.type.trim().toLowerCase() : 'all'
  const dateFrom = parseDateOnly(req.query.dateFrom)
  const dateTo = parseDateOnly(req.query.dateTo)

  const now = new Date()
  const defaultFrom = startOfDay(now)
  const defaultTo = new Date(now)
  defaultTo.setDate(defaultTo.getDate() + 120)
  defaultTo.setHours(23, 59, 59, 999)

  const from = dateFrom ? startOfDay(dateFrom) : defaultFrom
  const to = dateTo ? (() => {
    const x = startOfDay(dateTo)
    x.setHours(23, 59, 59, 999)
    return x
  })() : defaultTo

  const want = (t) => typeRaw === 'all' || typeRaw === t

  const items = []

  const push = (row) => {
    const dr = daysRemaining(row.expiryDate)
    items.push({
      id: row.id,
      reminderType: row.reminderType,
      clientName: row.clientName,
      vehicleNumber: row.vehicleNumber,
      expiryDate: row.expiryDate.toISOString(),
      daysRemaining: dr,
    })
  }

  if (want('insurance')) {
    const rows = await prisma.insurancePolicy.findMany({
      where: {
        tenantId,
        expiryDate: { gte: from, lte: to },
        vehicle: vehicleClientWhere,
      },
      include: {
        vehicle: { include: { client: { select: { name: true } } } },
      },
    })
    for (const r of rows) {
      push({
        id: `ins-${r.id}`,
        reminderType: 'Insurance',
        clientName: r.vehicle.client.name,
        vehicleNumber: r.vehicle.vehicleNumber,
        expiryDate: r.expiryDate,
      })
    }
  }

  if (want('fitness')) {
    const rows = await prisma.fitnessRecord.findMany({
      where: {
        tenantId,
        expiryDate: { gte: from, lte: to },
        vehicle: vehicleClientWhere,
      },
      include: {
        vehicle: { include: { client: { select: { name: true } } } },
      },
    })
    for (const r of rows) {
      push({
        id: `fit-${r.id}`,
        reminderType: 'Fitness',
        clientName: r.vehicle.client.name,
        vehicleNumber: r.vehicle.vehicleNumber,
        expiryDate: r.expiryDate,
      })
    }
  }

  if (want('puc')) {
    const rows = await prisma.pUCRecord.findMany({
      where: {
        tenantId,
        expiryDate: { gte: from, lte: to },
        vehicle: vehicleClientWhere,
      },
      include: {
        vehicle: { include: { client: { select: { name: true } } } },
      },
    })
    for (const r of rows) {
      push({
        id: `puc-${r.id}`,
        reminderType: 'PUC',
        clientName: r.vehicle.client.name,
        vehicleNumber: r.vehicle.vehicleNumber,
        expiryDate: r.expiryDate,
      })
    }
  }

  if (want('permit')) {
    const rows = await prisma.permitRecord.findMany({
      where: {
        tenantId,
        expiryDate: { gte: from, lte: to },
        vehicle: vehicleClientWhere,
      },
      include: {
        vehicle: { include: { client: { select: { name: true } } } },
      },
    })
    for (const r of rows) {
      push({
        id: `perm-${r.id}`,
        reminderType: 'Permit',
        clientName: r.vehicle.client.name,
        vehicleNumber: r.vehicle.vehicleNumber,
        expiryDate: r.expiryDate,
      })
    }
  }

  items.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())

  res.json({ items })
})

export default router
