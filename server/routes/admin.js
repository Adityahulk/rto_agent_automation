import { Router } from 'express'
import { Prisma, TenantSubscriptionStatus } from '@prisma/client'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { prisma } from '../lib/prisma.js'
import { getSubscriptionPricingNumbers } from '../lib/subscriptionPricing.js'
import { verifyAdminToken } from '../middleware/auth.js'

const router = Router()
router.use(verifyAdminToken)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

const VEHICLE_MAP = {
  '2W': 'TWO_W',
  TWOW: 'TWO_W',
  TWO_W: 'TWO_W',
  '4W': 'FOUR_W',
  FOURW: 'FOUR_W',
  FOUR_W: 'FOUR_W',
  COMMERCIAL: 'COMMERCIAL',
  EV: 'EV',
}

function normKey(k) {
  return String(k ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/%/g, 'percent')
}

function pick(obj, ...aliases) {
  for (const a of aliases) {
    const nk = normKey(a)
    for (const [key, val] of Object.entries(obj)) {
      if (normKey(key) === nk && val !== '' && val != null) return val
    }
  }
  return undefined
}

function toNum(v) {
  if (v === '' || v == null) return NaN
  const n = Number(String(v).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : NaN
}

function normalizeVehicleType(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
  return VEHICLE_MAP[s] ?? null
}

function isBlockedTenant(t) {
  return t.isBlocked || t.subscriptionStatus === TenantSubscriptionStatus.BLOCKED
}

function isExpiredTenant(t, now = new Date()) {
  return t.subscriptionExpiresAt != null && t.subscriptionExpiresAt <= now
}

function computeAgentStatus(t, now = new Date()) {
  if (isBlockedTenant(t)) return 'blocked'
  if (isExpiredTenant(t, now)) return 'expired'
  return 'active'
}

function money(v) {
  return new Prisma.Decimal(String(v))
}

async function snapshotAllFeeRates() {
  const rows = await prisma.feeRate.findMany()
  return rows.map((r) => ({
    state: r.state,
    vehicleType: r.vehicleType,
    minPrice: r.minPrice.toString(),
    maxPrice: r.maxPrice.toString(),
    roadTaxPercent: r.roadTaxPercent.toString(),
    registrationFee: r.registrationFee.toString(),
    hsrpFee: r.hsrpFee.toString(),
    smartCardFee: r.smartCardFee.toString(),
  }))
}

function parseRowsFromObjects(rows) {
  const out = []
  const errors = []
  rows.forEach((raw, idx) => {
    const state = String(pick(raw, 'state', 'State', 'STATE', 'rto_state') ?? '').trim()
    const vtRaw = pick(raw, 'vehicle_type', 'vehicletype', 'Vehicle Type', 'type', 'vehicle')
    const vehicleType = normalizeVehicleType(vtRaw)
    const minPrice = toNum(pick(raw, 'min_price', 'minprice', 'Min Price', 'min'))
    const maxPrice = toNum(pick(raw, 'max_price', 'maxprice', 'Max Price', 'max'))
    const roadTaxPercent = toNum(
      pick(raw, 'road_tax_percent', 'roadtaxpercent', 'Road Tax %', 'road_tax', 'tax_percent', 'tax'),
    )
    const registrationFee = toNum(
      pick(raw, 'registration_fee', 'registrationfee', 'Registration Fee', 'reg_fee', 'reg'),
    )
    const hsrpFee = toNum(pick(raw, 'hsrp_fee', 'hsrpfee', 'HSRP Fee', 'hsrp'))
    const smartCardFee = toNum(pick(raw, 'smart_card_fee', 'smartcardfee', 'Smart Card Fee', 'smart'))

    const line = idx + 2
    if (!state) {
      errors.push(`Row ${line}: missing state`)
      return
    }
    if (!vehicleType) {
      errors.push(`Row ${line}: invalid vehicle type (${vtRaw})`)
      return
    }
    if ([minPrice, maxPrice, roadTaxPercent, registrationFee, hsrpFee, smartCardFee].some((x) => Number.isNaN(x))) {
      errors.push(`Row ${line}: invalid numeric field`)
      return
    }

    out.push({
      state,
      vehicleType,
      minPrice,
      maxPrice,
      roadTaxPercent,
      registrationFee,
      hsrpFee,
      smartCardFee,
    })
  })
  return { rows: out, errors }
}

/** GET /api/admin/stats */
router.get('/stats', async (_req, res) => {
  const now = new Date()
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      createdAt: true,
      isBlocked: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      name: true,
      businessName: true,
      email: true,
    },
  })

  let active = 0
  let expired = 0
  let blocked = 0
  for (const t of tenants) {
    const s = computeAgentStatus(t, now)
    if (s === 'blocked') blocked += 1
    else if (s === 'expired') expired += 1
    else active += 1
  }

  const [subSum, svcSum] = await Promise.all([
    prisma.subscription.aggregate({ _sum: { amount: true } }),
    prisma.serviceCharge.aggregate({ _sum: { amount: true } }),
  ])
  const totalRevenue =
    Number(subSum._sum.amount ?? 0) + Number(svcSum._sum.amount ?? 0)

  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const signupsByMonth = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo)
    d.setMonth(sixMonthsAgo.getMonth() + i)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const count = tenants.filter((t) => t.createdAt >= start && t.createdAt < end).length
    signupsByMonth.push({
      month: start.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
      monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      count,
    })
  }

  const recentSignups = [...tenants]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      name: t.name,
      businessName: t.businessName,
      email: t.email,
      joinedAt: t.createdAt.toISOString(),
    }))

  res.json({
    totalAgents: tenants.length,
    active,
    expired,
    blocked,
    totalRevenue,
    signupsByMonth,
    recentSignups,
  })
})

/** GET /api/admin/agents */
router.get('/agents', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const statusFilter = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'all'

  const now = new Date()
  const where = {}

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { businessName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      businessName: true,
      email: true,
      createdAt: true,
      subscriptionExpiresAt: true,
      isBlocked: true,
      subscriptionStatus: true,
    },
  })

  const mapped = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    businessName: t.businessName,
    email: t.email,
    joinedAt: t.createdAt.toISOString(),
    subscriptionExpiresAt: t.subscriptionExpiresAt?.toISOString() ?? null,
    status: computeAgentStatus(t, now),
  }))

  const filtered =
    statusFilter === 'all'
      ? mapped
      : mapped.filter((a) => a.status === statusFilter)

  res.json({ agents: filtered })
})

/** GET /api/admin/agents/:id */
router.get('/agents/:id', async (req, res) => {
  const id = req.params.id
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      businessName: true,
      email: true,
      whatsappNumber: true,
      createdAt: true,
      subscriptionExpiresAt: true,
      subscriptionStatus: true,
      isBlocked: true,
    },
  })
  if (!tenant) {
    return res.status(404).json({ message: 'Agent not found' })
  }

  const [feeCalcs, clients, revenue] = await Promise.all([
    prisma.feeCalculation.count({ where: { tenantId: id } }),
    prisma.client.count({ where: { tenantId: id, deletedAt: null } }),
    prisma.serviceCharge.aggregate({
      where: { tenantId: id },
      _sum: { amount: true },
    }),
  ])

  const now = new Date()
  res.json({
    agent: {
      ...tenant,
      joinedAt: tenant.createdAt.toISOString(),
      subscriptionExpiresAt: tenant.subscriptionExpiresAt?.toISOString() ?? null,
      status: computeAgentStatus(tenant, now),
    },
    stats: {
      queryCount: feeCalcs,
      clientsCount: clients,
      revenueInr: Number(revenue._sum.amount ?? 0),
    },
  })
})

/** PATCH /api/admin/agents/:id/block */
router.patch('/agents/:id/block', async (req, res) => {
  const id = req.params.id
  const blocked = Boolean(req.body?.blocked)
  const tenant = await prisma.tenant.update({
    where: { id },
    data: { isBlocked: blocked },
    select: { id: true, isBlocked: true },
  })
  res.json({ id: tenant.id, isBlocked: tenant.isBlocked })
})

/** PATCH /api/admin/agents/:id/extend-subscription */
router.patch('/agents/:id/extend-subscription', async (req, res) => {
  const id = req.params.id
  const months = Number(req.body?.months)
  if (!Number.isFinite(months) || months <= 0 || months > 120) {
    return res.status(400).json({ message: 'months must be between 1 and 120' })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { subscriptionExpiresAt: true },
  })
  if (!tenant) {
    return res.status(404).json({ message: 'Agent not found' })
  }

  const now = new Date()
  const base =
    tenant.subscriptionExpiresAt && tenant.subscriptionExpiresAt > now
      ? tenant.subscriptionExpiresAt
      : now
  const next = new Date(base)
  next.setMonth(next.getMonth() + months)

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      subscriptionExpiresAt: next,
      subscriptionStatus: TenantSubscriptionStatus.ACTIVE,
    },
    select: { subscriptionExpiresAt: true },
  })

  res.json({ subscriptionExpiresAt: updated.subscriptionExpiresAt.toISOString() })
})

/** DELETE /api/admin/agents/:id */
router.delete('/agents/:id', async (req, res) => {
  const id = req.params.id
  await prisma.tenant.delete({ where: { id } })
  res.status(204).end()
})

/** POST /api/admin/fees/upload */
router.post('/fees/upload', upload.single('file'), async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ message: 'file is required (multipart field: file)' })
  }

  let wb
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer' })
  } catch {
    return res.status(400).json({ message: 'Could not read Excel file' })
  }

  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) {
    return res.status(400).json({ message: 'Workbook has no sheets' })
  }

  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const { rows, errors } = parseRowsFromObjects(json)

  if (errors.length && !rows.length) {
    return res.status(400).json({ message: 'Parse errors', errors })
  }

  const filename = req.file.originalname || 'upload.xlsx'
  res.json({
    filename,
    rowCount: rows.length,
    preview: rows.slice(0, 10),
    rows,
    parseWarnings: errors,
  })
})

/** POST /api/admin/fees/apply — bulk upsert parsed rows + version snapshot */
router.post('/fees/apply', async (req, res) => {
  const rows = req.body?.rows
  const filename = typeof req.body?.filename === 'string' ? req.body.filename.trim() : 'import.xlsx'
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'rows array is required' })
  }

  const normalized = []
  for (const r of rows) {
    const state = String(r.state ?? '').trim()
    const vehicleType = normalizeVehicleType(r.vehicleType)
    const minPrice = toNum(r.minPrice)
    const maxPrice = toNum(r.maxPrice)
    const roadTaxPercent = toNum(r.roadTaxPercent)
    const registrationFee = toNum(r.registrationFee)
    const hsrpFee = toNum(r.hsrpFee)
    const smartCardFee = toNum(r.smartCardFee)
    if (!state || !vehicleType || [minPrice, maxPrice, roadTaxPercent, registrationFee, hsrpFee, smartCardFee].some((x) => Number.isNaN(x))) {
      return res.status(400).json({ message: 'Invalid row in payload' })
    }
    normalized.push({
      state,
      vehicleType,
      minPrice,
      maxPrice,
      roadTaxPercent,
      registrationFee,
      hsrpFee,
      smartCardFee,
    })
  }

  await prisma.$transaction(
    normalized.map((r) =>
      prisma.feeRate.upsert({
        where: {
          state_vehicleType: { state: r.state, vehicleType: r.vehicleType },
        },
        create: {
          state: r.state,
          vehicleType: r.vehicleType,
          minPrice: money(r.minPrice),
          maxPrice: money(r.maxPrice),
          roadTaxPercent: money(r.roadTaxPercent),
          registrationFee: money(r.registrationFee),
          hsrpFee: money(r.hsrpFee),
          smartCardFee: money(r.smartCardFee),
        },
        update: {
          minPrice: money(r.minPrice),
          maxPrice: money(r.maxPrice),
          roadTaxPercent: money(r.roadTaxPercent),
          registrationFee: money(r.registrationFee),
          hsrpFee: money(r.hsrpFee),
          smartCardFee: money(r.smartCardFee),
        },
      }),
    ),
  )

  const snapshot = await snapshotAllFeeRates()
  await prisma.feeRateVersion.create({
    data: {
      filename,
      rowCount: normalized.length,
      snapshot,
    },
  })

  const versions = await prisma.feeRateVersion.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    skip: 25,
  })
  if (versions.length) {
    await prisma.feeRateVersion.deleteMany({
      where: { id: { in: versions.map((v) => v.id) } },
    })
  }

  res.json({ ok: true, saved: normalized.length })
})

/** GET /api/admin/fees/history */
router.get('/fees/history', async (_req, res) => {
  const versions = await prisma.feeRateVersion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      filename: true,
      rowCount: true,
      createdAt: true,
    },
  })

  const rates = await prisma.feeRate.findMany({
    orderBy: [{ state: 'asc' }, { vehicleType: 'asc' }],
  })

  res.json({
    versions: versions.map((v) => ({
      id: v.id,
      filename: v.filename,
      rowCount: v.rowCount,
      uploadedAt: v.createdAt.toISOString(),
    })),
    currentRates: rates.map((r) => ({
      state: r.state,
      vehicleType: r.vehicleType,
      roadTaxPercent: Number(r.roadTaxPercent),
      minPrice: Number(r.minPrice),
      maxPrice: Number(r.maxPrice),
      registrationFee: Number(r.registrationFee),
      hsrpFee: Number(r.hsrpFee),
      smartCardFee: Number(r.smartCardFee),
    })),
  })
})

/** POST /api/admin/fees/rollback/:versionId */
router.post('/fees/rollback/:versionId', async (req, res) => {
  const versionId = req.params.versionId
  const ver = await prisma.feeRateVersion.findUnique({ where: { id: versionId } })
  if (!ver) {
    return res.status(404).json({ message: 'Version not found' })
  }

  const snap = ver.snapshot
  if (!Array.isArray(snap)) {
    return res.status(400).json({ message: 'Invalid snapshot' })
  }

  await prisma.$transaction([
    prisma.feeRate.deleteMany(),
    prisma.feeRate.createMany({
      data: snap.map((r) => ({
        state: String(r.state),
        vehicleType: r.vehicleType,
        minPrice: money(r.minPrice),
        maxPrice: money(r.maxPrice),
        roadTaxPercent: money(r.roadTaxPercent),
        registrationFee: money(r.registrationFee),
        hsrpFee: money(r.hsrpFee),
        smartCardFee: money(r.smartCardFee),
      })),
    }),
  ])

  const snapshot = await snapshotAllFeeRates()
  await prisma.feeRateVersion.create({
    data: {
      filename: `rollback-${ver.filename}`,
      rowCount: snapshot.length,
      snapshot,
    },
  })

  res.json({ ok: true, restoredRows: snap.length })
})

/** GET /api/admin/analytics */
router.get('/analytics', async (_req, res) => {
  const byVehicle = await prisma.feeCalculation.groupBy({
    by: ['vehicleType'],
    _count: { id: true },
  })

  const byState = await prisma.feeCalculation.groupBy({
    by: ['state'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  const since = new Date()
  since.setDate(since.getDate() - 30)
  since.setHours(0, 0, 0, 0)

  const dailyRows = await prisma.$queryRaw`
    SELECT DATE("createdAt") AS d, COUNT(DISTINCT "tenantId")::int AS c
    FROM "FeeCalculation"
    WHERE "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const topAgents = await prisma.feeCalculation.groupBy({
    by: ['tenantId'],
    where: { createdAt: { gte: monthStart } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  const tenantIds = topAgents.map((t) => t.tenantId)
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true, businessName: true },
  })
  const tmap = Object.fromEntries(tenants.map((t) => [t.id, t]))

  res.json({
    queriesByVehicleType: byVehicle.map((r) => ({
      vehicleType: r.vehicleType,
      count: r._count.id,
    })),
    topStatesByQueries: byState.map((r) => ({
      state: r.state,
      count: r._count.id,
    })),
    dailyActiveAgents: dailyRows.map((row) => {
      const d = row.d
      const dateStr =
        d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)
      return { date: dateStr, count: Number(row.c) }
    }),
    topAgentsThisMonth: topAgents.map((r) => ({
      tenantId: r.tenantId,
      name: tmap[r.tenantId]?.name ?? '—',
      businessName: tmap[r.tenantId]?.businessName ?? '—',
      queryCount: r._count.id,
    })),
  })
})

/** GET /api/admin/subscriptions */
router.get('/subscriptions', async (_req, res) => {
  const now = new Date()
  const in30 = new Date(now)
  in30.setDate(in30.getDate() + 30)

  const tenants = await prisma.tenant.findMany({
    where: {
      subscriptionExpiresAt: { gt: now, lte: in30 },
      isBlocked: false,
      subscriptionStatus: { not: TenantSubscriptionStatus.BLOCKED },
    },
    orderBy: { subscriptionExpiresAt: 'asc' },
    select: {
      id: true,
      name: true,
      businessName: true,
      email: true,
      subscriptionExpiresAt: true,
    },
  })

  const allAgents = await prisma.tenant.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, businessName: true, email: true },
  })

  const pricing = await getSubscriptionPricingNumbers()

  res.json({
    expiringSoon: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      businessName: t.businessName,
      email: t.email,
      subscriptionExpiresAt: t.subscriptionExpiresAt.toISOString(),
    })),
    agents: allAgents,
    pricing,
  })
})

/** POST /api/admin/subscriptions/remind */
router.post('/subscriptions/remind', async (req, res) => {
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : ''
  if (!tenantId) {
    return res.status(400).json({ message: 'tenantId is required' })
  }
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { email: true, name: true },
  })
  if (!t) {
    return res.status(404).json({ message: 'Agent not found' })
  }
  console.info(`[admin] Subscription reminder stub → ${t.email} (${t.name})`)
  res.json({ ok: true, message: `Reminder queued for ${t.email} (email not configured)` })
})

/** POST /api/admin/subscriptions/manual */
router.post('/subscriptions/manual', async (req, res) => {
  const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : ''
  const plan = typeof req.body?.plan === 'string' ? req.body.plan.trim() : ''
  const months = Number(req.body?.months)
  const amount = Number(req.body?.amount)
  const paid = Boolean(req.body?.paid)

  if (!tenantId || !plan) {
    return res.status(400).json({ message: 'tenantId and plan are required' })
  }
  if (!Number.isFinite(months) || months <= 0 || months > 120) {
    return res.status(400).json({ message: 'months must be 1–120' })
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ message: 'amount is required' })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionExpiresAt: true },
  })
  if (!tenant) {
    return res.status(404).json({ message: 'Agent not found' })
  }

  const now = new Date()
  const base =
    tenant.subscriptionExpiresAt && tenant.subscriptionExpiresAt > now
      ? tenant.subscriptionExpiresAt
      : now
  const next = new Date(base)
  next.setMonth(next.getMonth() + months)

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionExpiresAt: next,
        subscriptionStatus: TenantSubscriptionStatus.ACTIVE,
      },
    }),
    ...(paid
      ? [
          prisma.subscription.create({
            data: {
              tenantId,
              plan,
              amount: money(amount),
              startDate: now,
              endDate: next,
              paymentId: 'manual_admin',
            },
          }),
        ]
      : []),
  ])

  res.json({ subscriptionExpiresAt: next.toISOString() })
})

/** PUT /api/admin/subscriptions/pricing */
router.put('/subscriptions/pricing', async (req, res) => {
  const renewalInr = Number(req.body?.renewalInr)
  const listInr = Number(req.body?.listInr)
  if (!Number.isFinite(renewalInr) || renewalInr <= 0 || !Number.isFinite(listInr) || listInr <= 0) {
    return res.status(400).json({ message: 'renewalInr and listInr must be positive numbers' })
  }

  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: 'subscription.renewal_inr' },
      create: { key: 'subscription.renewal_inr', value: String(renewalInr) },
      update: { value: String(renewalInr) },
    }),
    prisma.appSetting.upsert({
      where: { key: 'subscription.list_inr' },
      create: { key: 'subscription.list_inr', value: String(listInr) },
      update: { value: String(listInr) },
    }),
  ])

  const pricing = await getSubscriptionPricingNumbers()
  res.json(pricing)
})

export default router
