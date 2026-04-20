import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'

const router = Router()
router.use(verifyAgentToken, checkSubscription)

function startOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfNextMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function addMonths(d, n) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

function monthLabel(d) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(d)
}

/** GET /api/revenue/stats */
router.get('/stats', async (req, res) => {
  const tenantId = req.tenant.id
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = startOfNextMonth(now)
  const lastMonthStart = startOfMonth(addMonths(now, -1))
  const lastMonthEnd = thisMonthStart

  const sixMonths = []
  for (let i = 5; i >= 0; i--) {
    const start = startOfMonth(addMonths(now, -i))
    const end = startOfNextMonth(addMonths(now, -i))
    sixMonths.push({ start, end, label: monthLabel(start) })
  }

  const [
    thisMonthAgg,
    lastMonthAgg,
    totalAllAgg,
    feeCalcCount,
    feeCalcThisMonth,
    monthlyBars,
  ] = await Promise.all([
    prisma.serviceCharge.aggregate({
      where: { tenantId, date: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { amount: true },
    }),
    prisma.serviceCharge.aggregate({
      where: { tenantId, date: { gte: lastMonthStart, lt: lastMonthEnd } },
      _sum: { amount: true },
    }),
    prisma.serviceCharge.aggregate({
      where: { tenantId },
      _sum: { amount: true },
    }),
    prisma.feeCalculation.count({ where: { tenantId } }),
    prisma.feeCalculation.count({
      where: { tenantId, createdAt: { gte: thisMonthStart, lt: thisMonthEnd } },
    }),
    Promise.all(
      sixMonths.map(({ start, end, label }) =>
        prisma.serviceCharge
          .aggregate({
            where: { tenantId, date: { gte: start, lt: end } },
            _sum: { amount: true },
          })
          .then((agg) => ({
            month: label,
            amount: agg._sum.amount != null ? Number(agg._sum.amount) : 0,
          })),
      ),
    ),
  ])

  const thisMonth = thisMonthAgg._sum.amount != null ? Number(thisMonthAgg._sum.amount) : 0
  const lastMonth = lastMonthAgg._sum.amount != null ? Number(lastMonthAgg._sum.amount) : 0
  const totalAllTime = totalAllAgg._sum.amount != null ? Number(totalAllAgg._sum.amount) : 0
  const avgPerQuery =
    feeCalcCount > 0 ? Math.round((totalAllTime / feeCalcCount) * 100) / 100 : 0

  res.json({
    thisMonthRevenue: thisMonth,
    lastMonthRevenue: lastMonth,
    totalAllTimeRevenue: totalAllTime,
    avgPerQuery,
    feeCalculationsThisMonth: feeCalcThisMonth,
    chart: monthlyBars,
  })
})

/** GET /api/revenue/charges */
router.get('/charges', async (req, res) => {
  const tenantId = req.tenant.id
  const rows = await prisma.serviceCharge.findMany({
    where: { tenantId },
    orderBy: { date: 'desc' },
    take: 200,
    include: {
      client: { select: { id: true, name: true } },
    },
  })

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.client.name,
      service: r.service,
      amount: Number(r.amount),
      date: r.date.toISOString(),
    })),
  })
})

/** POST /api/revenue/charges */
router.post('/charges', async (req, res) => {
  const tenantId = req.tenant.id
  const body = req.body ?? {}
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
  const service = typeof body.service === 'string' ? body.service.trim() : ''
  const amount = Number(body.amount)
  const dateRaw = body.date

  if (!clientId || !service || Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: 'clientId, service, and positive amount are required' })
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId, deletedAt: null },
  })
  if (!client) return res.status(404).json({ message: 'Client not found' })

  let date = new Date()
  if (typeof dateRaw === 'string' && dateRaw.trim()) {
    const d = new Date(dateRaw)
    if (!Number.isNaN(d.getTime())) date = d
  }

  const row = await prisma.serviceCharge.create({
    data: {
      tenantId,
      clientId,
      service,
      amount: new Prisma.Decimal(String(amount)),
      date,
    },
  })

  res.status(201).json({
    id: row.id,
    amount: Number(row.amount),
    date: row.date.toISOString(),
  })
})

/** DELETE /api/revenue/charges/:id */
router.delete('/charges/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params
  const row = await prisma.serviceCharge.findFirst({
    where: { id, tenantId },
  })
  if (!row) return res.status(404).json({ message: 'Not found' })

  await prisma.serviceCharge.delete({ where: { id: row.id } })
  res.status(204).send()
})

export default router
