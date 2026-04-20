import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'

const router = Router()

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfNextDay(d) {
  const x = startOfDay(d)
  x.setDate(x.getDate() + 1)
  return x
}

function startOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfNextMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function daysLeft(expiryDate) {
  const ms = startOfDay(expiryDate).getTime() - startOfDay(new Date()).getTime()
  return Math.ceil(ms / 86400000)
}

function formatVehicleType(vt) {
  const map = {
    TWO_W: '2W',
    FOUR_W: '4W',
    COMMERCIAL: 'Commercial',
    EV: 'EV',
  }
  return map[vt] ?? vt
}

router.get(
  '/stats',
  verifyAgentToken,
  checkSubscription,
  async (req, res) => {
    const tenantId = req.tenant.id
    const now = new Date()
    const dayStart = startOfDay(now)
    const dayEnd = startOfNextDay(now)
    const monthStart = startOfMonth(now)
    const monthEnd = startOfNextMonth(now)
    const horizon30 = new Date(now)
    horizon30.setDate(horizon30.getDate() + 30)

    const [
      feeCalcsToday,
      quotesToday,
      formsToday,
      pendingForms,
      insExp30,
      fitExp30,
      pucExp30,
      monthlyRevenueAgg,
      insurances,
      fitness,
      pucs,
      feeCalcsRecent,
      quotesRecent,
      servicesRecent,
      formsRecent,
    ] = await Promise.all([
      prisma.feeCalculation.count({
        where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.quote.count({
        where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.rtoForm.count({
        where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.rtoForm.count({
        where: { tenantId, OR: [{ pdfUrl: null }, { pdfUrl: '' }] },
      }),
      prisma.insurancePolicy.count({
        where: {
          tenantId,
          expiryDate: { gt: now, lte: horizon30 },
        },
      }),
      prisma.fitnessRecord.count({
        where: {
          tenantId,
          expiryDate: { gt: now, lte: horizon30 },
        },
      }),
      prisma.pUCRecord.count({
        where: {
          tenantId,
          expiryDate: { gt: now, lte: horizon30 },
        },
      }),
      prisma.serviceCharge.aggregate({
        where: {
          tenantId,
          date: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.insurancePolicy.findMany({
        where: { tenantId, expiryDate: { gte: dayStart } },
        include: {
          vehicle: { include: { client: true } },
        },
      }),
      prisma.fitnessRecord.findMany({
        where: { tenantId, expiryDate: { gte: dayStart } },
        include: {
          vehicle: { include: { client: true } },
        },
      }),
      prisma.pUCRecord.findMany({
        where: { tenantId, expiryDate: { gte: dayStart } },
        include: {
          vehicle: { include: { client: true } },
        },
      }),
      prisma.feeCalculation.findMany({
        where: { tenantId },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.quote.findMany({
        where: { tenantId },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.serviceCharge.findMany({
        where: { tenantId },
        include: { client: true },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      prisma.rtoForm.findMany({
        where: { tenantId },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const expiryRows = []

    for (const row of insurances) {
      expiryRows.push({
        id: `ins-${row.id}`,
        clientName: row.vehicle.client.name,
        vehicleNumber: row.vehicle.vehicleNumber,
        type: 'Insurance',
        expiryDate: row.expiryDate.toISOString(),
        daysLeft: daysLeft(row.expiryDate),
        vehicleId: row.vehicleId,
        clientId: row.vehicle.clientId,
      })
    }
    for (const row of fitness) {
      expiryRows.push({
        id: `fit-${row.id}`,
        clientName: row.vehicle.client.name,
        vehicleNumber: row.vehicle.vehicleNumber,
        type: 'Fitness',
        expiryDate: row.expiryDate.toISOString(),
        daysLeft: daysLeft(row.expiryDate),
        vehicleId: row.vehicleId,
        clientId: row.vehicle.clientId,
      })
    }
    for (const row of pucs) {
      expiryRows.push({
        id: `puc-${row.id}`,
        clientName: row.vehicle.client.name,
        vehicleNumber: row.vehicle.vehicleNumber,
        type: 'PUC',
        expiryDate: row.expiryDate.toISOString(),
        daysLeft: daysLeft(row.expiryDate),
        vehicleId: row.vehicleId,
        clientId: row.vehicle.clientId,
      })
    }

    expiryRows.sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
    )

    const upcomingExpiries = expiryRows.slice(0, 7).map(
      ({ id, clientName, vehicleNumber, type, expiryDate, daysLeft, vehicleId, clientId }) => ({
        id,
        clientName,
        vehicleNumber,
        type,
        expiryDate,
        daysLeft,
        vehicleId,
        clientId,
      }),
    )

    const activities = []

    for (const f of feeCalcsRecent) {
      activities.push({
        id: `fee-${f.id}`,
        kind: 'fee',
        icon: 'calculator',
        text: `Fee calculated for ${f.client.name} — ${f.state} ${formatVehicleType(f.vehicleType)}`,
        at: f.createdAt.toISOString(),
      })
    }
    for (const q of quotesRecent) {
      activities.push({
        id: `quote-${q.id}`,
        kind: 'quote',
        icon: 'file',
        text: `Quote generated for ${q.client.name}`,
        at: q.createdAt.toISOString(),
      })
    }
    for (const s of servicesRecent) {
      activities.push({
        id: `svc-${s.id}`,
        kind: 'service',
        icon: 'wallet',
        text: `Service: ${s.service} for ${s.client.name}`,
        at: s.date.toISOString(),
      })
    }
    for (const f of formsRecent) {
      activities.push({
        id: `form-${f.id}`,
        kind: 'form',
        icon: 'clipboard',
        text: `Form ${f.formType} for ${f.client?.name ?? 'Walk-in'}`,
        at: f.createdAt.toISOString(),
      })
    }

    activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    const recentActivity = activities.slice(0, 10)

    const rawRevenue = monthlyRevenueAgg._sum.amount
    const monthlyRevenue =
      rawRevenue != null ? Number(rawRevenue) : 0

    res.json({
      todayQueries: feeCalcsToday + quotesToday + formsToday,
      pendingForms,
      expiringThisMonth: insExp30 + fitExp30 + pucExp30,
      monthlyRevenue,
      upcomingExpiries,
      recentActivity,
    })
  },
)

export default router
