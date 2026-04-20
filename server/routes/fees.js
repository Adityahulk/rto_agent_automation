import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'

const router = Router()

router.use(verifyAgentToken, checkSubscription)

function normalizeVehicleType(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  const map = {
    '2W': 'TWO_W',
    TWOW: 'TWO_W',
    TWO_W: 'TWO_W',
    '4W': 'FOUR_W',
    FOURW: 'FOUR_W',
    FOUR_W: 'FOUR_W',
    COMMERCIAL: 'COMMERCIAL',
    EV: 'EV',
  }
  return map[s] ?? null
}

function money(v) {
  return new Prisma.Decimal(String(v))
}

/** GET /api/fees/calculate */
router.get('/calculate', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state.trim() : ''
  const priceRaw = req.query.price
  const price = Number.parseFloat(String(priceRaw ?? ''))
  const vehicleType = normalizeVehicleType(req.query.vehicleType)
  const ownerType =
    typeof req.query.ownerType === 'string'
      ? req.query.ownerType.trim().toLowerCase()
      : 'individual'

  if (!state || !vehicleType || Number.isNaN(price) || price <= 0) {
    return res.status(400).json({
      message: 'state, vehicleType (2W|4W|commercial|EV), and positive price are required',
    })
  }

  const allowedOwner = ['individual', 'company']
  const owner = allowedOwner.includes(ownerType) ? ownerType : 'individual'

  const registrationType =
    typeof req.query.registrationType === 'string'
      ? req.query.registrationType.trim().toLowerCase()
      : 'new'
  const fuelType =
    typeof req.query.fuelType === 'string' ? req.query.fuelType.trim().toLowerCase() : ''

  const rate = await prisma.feeRate.findFirst({
    where: {
      state: { equals: state, mode: 'insensitive' },
      vehicleType,
      minPrice: { lte: money(price) },
      maxPrice: { gte: money(price) },
    },
  })

  if (!rate) {
    return res.status(404).json({
      message: `No fee rate found for ${state} / ${vehicleType} in this price band`,
    })
  }

  const pct = Number(rate.roadTaxPercent)
  const roadTaxAmount = Math.round((price * pct) / 100)
  const registrationFee = Number(rate.registrationFee)
  const hsrpFee = Number(rate.hsrpFee)
  const smartCardFee = Number(rate.smartCardFee)
  const handlingCharges = 500
  const agentServiceFeeDefault = 0

  res.json({
    state: rate.state,
    vehicleType: rate.vehicleType,
    invoicePrice: price,
    ownerType: owner,
    registrationType: registrationType === 'transfer' ? 'transfer' : 'new',
    fuelType: fuelType || null,
    roadTax: {
      percent: pct,
      amount: roadTaxAmount,
    },
    registrationFee: { kind: 'flat', amount: registrationFee },
    hsrpFee: { kind: 'flat', amount: hsrpFee },
    smartCardFee: { kind: 'flat', amount: smartCardFee },
    handlingCharges,
    agentServiceFeeDefault,
    feeRateId: rate.id,
  })
})

/** POST /api/fees/save-calculation — persist FeeCalculation for a client */
router.post('/save-calculation', async (req, res) => {
  const tenantId = req.tenant.id
  const {
    clientId,
    state,
    vehicleType: vtRaw,
    invoicePrice,
    roadTaxAmount,
    registrationFee,
    hsrpFee,
    smartCardFee,
    handlingCharges,
    agentServiceFee,
  } = req.body ?? {}

  const vehicleType = normalizeVehicleType(vtRaw)
  if (!clientId || !vehicleType || !state) {
    return res.status(400).json({ message: 'clientId, state, and vehicleType are required' })
  }

  const inv = Number(invoicePrice)
  if (Number.isNaN(inv) || inv <= 0) {
    return res.status(400).json({ message: 'Valid invoicePrice required' })
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId, deletedAt: null },
  })
  if (!client) {
    return res.status(404).json({ message: 'Client not found' })
  }

  const rt = Number(roadTaxAmount ?? 0)
  const rf = Number(registrationFee ?? 0)
  const hsrp = Number(hsrpFee ?? 0)
  const smart = Number(smartCardFee ?? 0)
  const handle = Number(handlingCharges ?? 500)
  const agent = Number(agentServiceFee ?? 0)

  const totalTax = rt
  const totalFees = rf + hsrp + smart + handle + agent
  const grandTotal = inv + totalTax + totalFees

  const row = await prisma.feeCalculation.create({
    data: {
      tenantId,
      clientId,
      state: String(state).trim(),
      vehicleType,
      invoicePrice: money(inv),
      totalTax: money(totalTax),
      totalFees: money(totalFees),
      grandTotal: money(grandTotal),
    },
  })

  res.status(201).json({
    id: row.id,
    grandTotal,
    totalTax,
    totalFees,
  })
})

export default router
