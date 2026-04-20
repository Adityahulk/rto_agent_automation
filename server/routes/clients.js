import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'

const router = Router()

router.use(verifyAgentToken, checkSubscription)

async function getLastActivity(clientId) {
  const [fc, q, rf, sc] = await Promise.all([
    prisma.feeCalculation.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.quote.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.rtoForm.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.serviceCharge.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
  ])
  const dates = [
    fc?.createdAt,
    q?.createdAt,
    rf?.createdAt,
    sc?.date,
  ].filter(Boolean)
  if (!dates.length) return null
  return new Date(Math.max(...dates.map((d) => new Date(d).getTime())))
}

/** GET /api/clients */
router.get('/', async (req, res) => {
  const tenantId = req.tenant.id
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const state =
    typeof req.query.state === 'string' ? req.query.state.trim() : ''
  const vehicleType =
    typeof req.query.vehicleType === 'string' ? req.query.vehicleType.trim() : ''
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.pageSize), 10) || 10))
  const skip = (page - 1) * pageSize

  const and = [{ tenantId }, { deletedAt: null }]
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ],
    })
  }
  if (state) {
    and.push({ state })
  }
  if (vehicleType) {
    and.push({
      vehicles: { some: { vehicleType } },
    })
  }

  const where = { AND: and }

  const [total, rows, stateRows] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { vehicles: true } },
      },
    }),
    prisma.client.findMany({
      where: { tenantId, deletedAt: null, state: { not: null } },
      distinct: ['state'],
      select: { state: true },
    }),
  ])

  const items = await Promise.all(
    rows.map(async (c) => {
      const lastActivity = await getLastActivity(c.id)
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        vehicleCount: c._count.vehicles,
        state: c.state,
        city: c.city,
        lastActivity: lastActivity?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      }
    }),
  )

  const states = stateRows
    .map((s) => s.state)
    .filter(Boolean)
    .sort()

  res.json({
    items,
    total,
    page,
    pageSize,
    states,
  })
})

/** POST /api/clients */
router.post('/', async (req, res) => {
  const tenantId = req.tenant.id
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : ''
  const state = typeof req.body?.state === 'string' ? req.body.state.trim() : ''
  const alternatePhone =
    typeof req.body?.alternatePhone === 'string'
      ? req.body.alternatePhone.trim() || null
      : null
  const address =
    typeof req.body?.address === 'string' ? req.body.address.trim() || null : null
  const city =
    typeof req.body?.city === 'string' ? req.body.city.trim() || null : null

  if (!name || !phone || !state) {
    return res.status(400).json({ message: 'Name, phone, and state are required' })
  }

  const client = await prisma.client.create({
    data: {
      tenantId,
      name,
      phone,
      alternatePhone,
      address,
      city,
      state,
    },
  })

  res.status(201).json({
    id: client.id,
    name: client.name,
    phone: client.phone,
    alternatePhone: client.alternatePhone,
    address: client.address,
    city: client.city,
    state: client.state,
    notes: client.notes,
    createdAt: client.createdAt.toISOString(),
  })
})

/** GET /api/clients/:id */
router.get('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params

  const client = await prisma.client.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      vehicles: {
        orderBy: { vehicleNumber: 'asc' },
        include: {
          insurancePolicies: { orderBy: { expiryDate: 'asc' } },
        },
      },
      rtoForms: { orderBy: { createdAt: 'desc' }, take: 50 },
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          calculation: true,
        },
      },
    },
  })

  if (!client) {
    return res.status(404).json({ message: 'Client not found' })
  }

  const policies = client.vehicles.flatMap((v) =>
    v.insurancePolicies.map((p) => ({
      id: p.id,
      vehicleId: v.id,
      vehicleNumber: v.vehicleNumber,
      policyNumber: p.policyNumber,
      insurer: p.insurer,
      policyType: p.policyType,
      premium: Number(p.premium),
      startDate: p.startDate.toISOString(),
      expiryDate: p.expiryDate.toISOString(),
      status: p.status,
    })),
  )

  res.json({
    id: client.id,
    name: client.name,
    phone: client.phone,
    alternatePhone: client.alternatePhone,
    address: client.address,
    city: client.city,
    state: client.state,
    notes: client.notes,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    vehicles: client.vehicles.map((v) => ({
      id: v.id,
      vehicleNumber: v.vehicleNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      fuelType: v.fuelType,
      vehicleType: v.vehicleType,
      chassisNumber: v.chassisNumber,
      engineNumber: v.engineNumber,
    })),
    insurancePolicies: policies,
    forms: client.rtoForms.map((f) => ({
      id: f.id,
      formType: f.formType,
      pdfUrl: f.pdfUrl,
      createdAt: f.createdAt.toISOString(),
    })),
    quotes: client.quotes.map((q) => ({
      id: q.id,
      createdAt: q.createdAt.toISOString(),
      pdfUrl: q.pdfUrl,
      sentViaWhatsapp: q.sentViaWhatsapp,
      grandTotal: Number(q.calculation.grandTotal),
      state: q.calculation.state,
      vehicleType: q.calculation.vehicleType,
    })),
  })
})

/** PUT /api/clients/:id */
router.put('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params

  const existing = await prisma.client.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!existing) {
    return res.status(404).json({ message: 'Client not found' })
  }

  const body = req.body ?? {}
  const data = {}

  if (typeof body.name === 'string') data.name = body.name.trim()
  if (typeof body.phone === 'string') data.phone = body.phone.trim() || null
  if (typeof body.alternatePhone === 'string') {
    data.alternatePhone = body.alternatePhone.trim() || null
  }
  if (typeof body.address === 'string') data.address = body.address.trim() || null
  if (typeof body.city === 'string') data.city = body.city.trim() || null
  if (typeof body.state === 'string') data.state = body.state.trim() || null
  if (typeof body.notes === 'string') data.notes = body.notes

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' })
  }

  const client = await prisma.client.update({
    where: { id: existing.id },
    data,
  })

  res.json({
    id: client.id,
    name: client.name,
    phone: client.phone,
    alternatePhone: client.alternatePhone,
    address: client.address,
    city: client.city,
    state: client.state,
    notes: client.notes,
    updatedAt: client.updatedAt.toISOString(),
  })
})

/** DELETE /api/clients/:id */
router.delete('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params

  const existing = await prisma.client.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!existing) {
    return res.status(404).json({ message: 'Client not found' })
  }

  await prisma.client.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  })

  res.status(204).send()
})

/** POST /api/clients/:id/vehicles */
router.post('/:id/vehicles', async (req, res) => {
  const tenantId = req.tenant.id
  const { id: clientId } = req.params

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId, deletedAt: null },
  })
  if (!client) {
    return res.status(404).json({ message: 'Client not found' })
  }

  const {
    vehicleNumber,
    make,
    model,
    year,
    fuelType,
    vehicleType,
    chassisNumber,
    engineNumber,
  } = req.body ?? {}

  if (
    typeof vehicleNumber !== 'string' ||
    !vehicleNumber.trim() ||
    typeof make !== 'string' ||
    !make.trim() ||
    typeof model !== 'string' ||
    !model.trim() ||
    typeof vehicleType !== 'string' ||
    !vehicleType.trim()
  ) {
    return res.status(400).json({
      message: 'vehicleNumber, make, model, and vehicleType are required',
    })
  }

  const allowed = ['TWO_W', 'FOUR_W', 'COMMERCIAL', 'EV']
  if (!allowed.includes(vehicleType)) {
    return res.status(400).json({ message: 'Invalid vehicleType' })
  }

  const yearNum =
    year === undefined || year === null || year === ''
      ? null
      : Number.parseInt(String(year), 10)
  if (yearNum !== null && Number.isNaN(yearNum)) {
    return res.status(400).json({ message: 'Invalid year' })
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      clientId,
      vehicleNumber: vehicleNumber.trim(),
      make: make.trim(),
      model: model.trim(),
      year: yearNum,
      fuelType:
        typeof fuelType === 'string' && fuelType.trim() ? fuelType.trim() : null,
      vehicleType,
      chassisNumber:
        typeof chassisNumber === 'string' && chassisNumber.trim()
          ? chassisNumber.trim()
          : null,
      engineNumber:
        typeof engineNumber === 'string' && engineNumber.trim()
          ? engineNumber.trim()
          : null,
    },
  })

  res.status(201).json({
    id: vehicle.id,
    vehicleNumber: vehicle.vehicleNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    fuelType: vehicle.fuelType,
    vehicleType: vehicle.vehicleType,
    chassisNumber: vehicle.chassisNumber,
    engineNumber: vehicle.engineNumber,
  })
})

export default router
