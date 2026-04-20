import { Router } from 'express'
import { TenantSubscriptionStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import {
  getSubscriptionPricingNumbers,
  getSubscriptionRenewalDecimal,
} from '../lib/subscriptionPricing.js'
import { verifyAgentToken } from '../middleware/auth.js'

const router = Router()
router.use(verifyAgentToken)

const PLAN_NAME = 'RTO Helper Pro — 1 Year'

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** GET /api/subscription/status */
router.get('/status', async (req, res) => {
  const tenantId = req.tenant.id
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      subscriptionExpiresAt: true,
      subscriptionStatus: true,
    },
  })

  const latest = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { startDate: 'desc' },
  })

  const exp = tenant.subscriptionExpiresAt
  const now = new Date()

  const pricing = await getSubscriptionPricingNumbers()

  if (!exp) {
    return res.json({
      planName: PLAN_NAME,
      status: 'active',
      subscriptionExpiresAt: null,
      subscriptionStatus: tenant.subscriptionStatus,
      progressPercent: 0,
      daysUntilExpiry: null,
      showExpiryWarning: false,
      renewalAmount: pricing.renewalAmount,
      listAmount: pricing.listAmount,
    })
  }

  let periodStart = latest?.startDate ?? null
  if (!periodStart) {
    periodStart = new Date(exp)
    periodStart.setFullYear(periodStart.getFullYear() - 1)
  }

  const totalMs = Math.max(0, exp.getTime() - periodStart.getTime())
  const elapsedMs = Math.min(Math.max(0, now.getTime() - periodStart.getTime()), totalMs)
  const progressPercent = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 100

  const todayStart = startOfDay(now)
  const expStart = startOfDay(exp)
  const daysUntilExpiry = Math.ceil((expStart.getTime() - todayStart.getTime()) / 86400000)

  const expired = exp <= now
  let status = 'active'
  if (expired) {
    status = 'expired'
  } else if (daysUntilExpiry >= 0 && daysUntilExpiry < 30) {
    status = 'expiring_soon'
  }

  res.json({
    planName: PLAN_NAME,
    status,
    subscriptionExpiresAt: exp.toISOString(),
    subscriptionStatus: tenant.subscriptionStatus,
    progressPercent,
    daysUntilExpiry: Math.max(0, daysUntilExpiry),
    showExpiryWarning: !expired && daysUntilExpiry >= 0 && daysUntilExpiry < 30,
    renewalAmount: pricing.renewalAmount,
    listAmount: pricing.listAmount,
  })
})

/** POST /api/subscription/renew */
router.post('/renew', async (req, res) => {
  const tenantId = req.tenant.id
  const paymentId =
    typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : ''
  const amountRaw = req.body?.amount
  const amountNum = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw)

  if (!paymentId) {
    return res.status(400).json({ message: 'paymentId is required' })
  }
  const renewalAmt = await getSubscriptionRenewalDecimal()
  if (!Number.isFinite(amountNum) || amountNum !== Number(renewalAmt)) {
    return res.status(400).json({ message: 'Invalid amount' })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionExpiresAt: true },
  })

  const now = new Date()
  const currentExp = tenant.subscriptionExpiresAt
  const base =
    currentExp && currentExp > now ? currentExp : now
  const newExpiry = new Date(base)
  newExpiry.setFullYear(newExpiry.getFullYear() + 1)

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionExpiresAt: newExpiry,
        subscriptionStatus: TenantSubscriptionStatus.ACTIVE,
      },
    }),
    prisma.subscription.create({
      data: {
        tenantId,
        plan: PLAN_NAME,
        amount: renewalAmt,
        startDate: now,
        endDate: newExpiry,
        paymentId,
      },
    }),
  ])

  res.json({
    subscriptionExpiresAt: newExpiry.toISOString(),
    message: 'Subscription renewed',
  })
})

/** GET /api/subscription/invoices */
router.get('/invoices', async (req, res) => {
  const tenantId = req.tenant.id
  const rows = await prisma.subscription.findMany({
    where: { tenantId },
    orderBy: { startDate: 'desc' },
  })

  res.json({
    invoices: rows.map((s) => ({
      id: s.id,
      invoiceNumber: `INV-${s.id.slice(0, 8).toUpperCase()}`,
      plan: s.plan,
      amount: Number(s.amount),
      paymentDate: s.startDate.toISOString(),
      paymentId: s.paymentId ?? '',
    })),
  })
})

export default router
