import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type SubscriptionStatusPayload = {
  planName: string
  status: 'active' | 'expired' | 'expiring_soon'
  subscriptionExpiresAt: string | null
  subscriptionStatus: string
  progressPercent: number
  daysUntilExpiry: number | null
  showExpiryWarning: boolean
  renewalAmount: number
  listAmount: number
}

export type SubscriptionInvoice = {
  id: string
  invoiceNumber: string
  plan: string
  amount: number
  paymentDate: string
  paymentId: string
}

export const subscriptionQueryKeys = {
  status: ['subscription', 'status'] as const,
  invoices: ['subscription', 'invoices'] as const,
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatusPayload> {
  const { data } = await apiClient.get<SubscriptionStatusPayload>('/subscription/status', {
    headers: authHeaders(),
  })
  return data
}

export async function fetchSubscriptionInvoices(): Promise<{ invoices: SubscriptionInvoice[] }> {
  const { data } = await apiClient.get<{ invoices: SubscriptionInvoice[] }>(
    '/subscription/invoices',
    { headers: authHeaders() },
  )
  return data
}

export async function renewSubscription(body: {
  paymentId: string
  amount: number
}): Promise<{ subscriptionExpiresAt: string; message: string }> {
  const { data } = await apiClient.post<{ subscriptionExpiresAt: string; message: string }>(
    '/subscription/renew',
    body,
    { headers: authHeaders() },
  )
  return data
}
