import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

const KEY_RENEWAL = 'subscription.renewal_inr'
const KEY_LIST = 'subscription.list_inr'
const DEFAULT_RENEWAL = '1500'
const DEFAULT_LIST = '2000'

export async function getSubscriptionRenewalDecimal() {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY_RENEWAL } })
  const n = Number(row?.value)
  if (Number.isFinite(n) && n > 0) return new Prisma.Decimal(String(n))
  return new Prisma.Decimal(DEFAULT_RENEWAL)
}

export async function getSubscriptionListDecimal() {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY_LIST } })
  const n = Number(row?.value)
  if (Number.isFinite(n) && n > 0) return new Prisma.Decimal(String(n))
  return new Prisma.Decimal(DEFAULT_LIST)
}

export async function getSubscriptionPricingNumbers() {
  const [renewal, list] = await Promise.all([
    getSubscriptionRenewalDecimal(),
    getSubscriptionListDecimal(),
  ])
  return { renewalAmount: Number(renewal), listAmount: Number(list) }
}
