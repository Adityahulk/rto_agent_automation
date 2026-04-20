import axios from 'axios'
import { apiClient } from '@/api/client'
import { getAdminJwt } from '@/lib/auth'

function adminHeaders() {
  const token = getAdminJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type AdminStats = {
  totalAgents: number
  active: number
  expired: number
  blocked: number
  totalRevenue: number
  signupsByMonth: { month: string; monthKey: string; count: number }[]
  recentSignups: {
    id: string
    name: string
    businessName: string
    email: string
    joinedAt: string
  }[]
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>('/admin/stats', { headers: adminHeaders() })
  return data
}

export type AdminAgentRow = {
  id: string
  name: string
  businessName: string
  email: string
  joinedAt: string
  subscriptionExpiresAt: string | null
  status: 'active' | 'expired' | 'blocked'
}

export async function fetchAdminAgents(params: {
  q?: string
  status?: string
}): Promise<{ agents: AdminAgentRow[] }> {
  const { data } = await apiClient.get<{ agents: AdminAgentRow[] }>('/admin/agents', {
    headers: adminHeaders(),
    params,
  })
  return data
}

export async function fetchAdminAgentDetail(id: string): Promise<{
  agent: {
    id: string
    name: string
    businessName: string
    email: string
    whatsappNumber: string | null
    joinedAt: string
    subscriptionExpiresAt: string | null
    subscriptionStatus: string
    isBlocked: boolean
    status: AdminAgentRow['status']
  }
  stats: { queryCount: number; clientsCount: number; revenueInr: number }
}> {
  const { data } = await apiClient.get(`/admin/agents/${id}`, { headers: adminHeaders() })
  return data
}

export async function patchAdminAgentBlock(id: string, blocked: boolean): Promise<void> {
  await apiClient.patch(`/admin/agents/${id}/block`, { blocked }, { headers: adminHeaders() })
}

export async function patchAdminExtendSubscription(
  id: string,
  months: number,
): Promise<{ subscriptionExpiresAt: string }> {
  const { data } = await apiClient.patch<{ subscriptionExpiresAt: string }>(
    `/admin/agents/${id}/extend-subscription`,
    { months },
    { headers: adminHeaders() },
  )
  return data
}

export async function deleteAdminAgent(id: string): Promise<void> {
  await apiClient.delete(`/admin/agents/${id}`, { headers: adminHeaders() })
}

export type FeeUploadResponse = {
  filename: string
  rowCount: number
  preview: Record<string, unknown>[]
  rows: {
    state: string
    vehicleType: string
    minPrice: number
    maxPrice: number
    roadTaxPercent: number
    registrationFee: number
    hsrpFee: number
    smartCardFee: number
  }[]
  parseWarnings: string[]
}

export async function uploadAdminFeeExcel(file: File): Promise<FeeUploadResponse> {
  const form = new FormData()
  form.append('file', file)
  const base = apiClient.defaults.baseURL ?? '/api'
  const { data } = await axios.post<FeeUploadResponse>(`${base}/admin/fees/upload`, form, {
    headers: { ...adminHeaders() },
    timeout: 60_000,
  })
  return data
}

export async function applyAdminFeeRows(body: {
  rows: FeeUploadResponse['rows']
  filename: string
}): Promise<{ ok: boolean; saved: number }> {
  const { data } = await apiClient.post<{ ok: boolean; saved: number }>(
    '/admin/fees/apply',
    body,
    { headers: adminHeaders() },
  )
  return data
}

export type FeeHistoryResponse = {
  versions: { id: string; filename: string; rowCount: number; uploadedAt: string }[]
  currentRates: {
    state: string
    vehicleType: string
    roadTaxPercent: number
    minPrice: number
    maxPrice: number
    registrationFee: number
    hsrpFee: number
    smartCardFee: number
  }[]
}

export async function fetchAdminFeeHistory(): Promise<FeeHistoryResponse> {
  const { data } = await apiClient.get<FeeHistoryResponse>('/admin/fees/history', {
    headers: adminHeaders(),
  })
  return data
}

export async function rollbackAdminFeeVersion(versionId: string): Promise<void> {
  await apiClient.post(`/admin/fees/rollback/${versionId}`, {}, { headers: adminHeaders() })
}

export type AdminAnalytics = {
  queriesByVehicleType: { vehicleType: string; count: number }[]
  topStatesByQueries: { state: string; count: number }[]
  dailyActiveAgents: { date: string; count: number }[]
  topAgentsThisMonth: {
    tenantId: string
    name: string
    businessName: string
    queryCount: number
  }[]
}

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const { data } = await apiClient.get<AdminAnalytics>('/admin/analytics', {
    headers: adminHeaders(),
  })
  return data
}

export type AdminSubscriptionsPayload = {
  expiringSoon: {
    id: string
    name: string
    businessName: string
    email: string
    subscriptionExpiresAt: string
  }[]
  agents: { id: string; name: string; businessName: string; email: string }[]
  pricing: { renewalAmount: number; listAmount: number }
}

export async function fetchAdminSubscriptions(): Promise<AdminSubscriptionsPayload> {
  const { data } = await apiClient.get<AdminSubscriptionsPayload>('/admin/subscriptions', {
    headers: adminHeaders(),
  })
  return data
}

export async function postAdminSubscriptionRemind(tenantId: string): Promise<void> {
  await apiClient.post('/admin/subscriptions/remind', { tenantId }, { headers: adminHeaders() })
}

export async function postAdminManualSubscription(body: {
  tenantId: string
  plan: string
  months: number
  amount: number
  paid: boolean
}): Promise<{ subscriptionExpiresAt: string }> {
  const { data } = await apiClient.post<{ subscriptionExpiresAt: string }>(
    '/admin/subscriptions/manual',
    body,
    { headers: adminHeaders() },
  )
  return data
}

export async function putAdminSubscriptionPricing(body: {
  renewalInr: number
  listInr: number
}): Promise<{ renewalAmount: number; listAmount: number }> {
  const { data } = await apiClient.put<{ renewalAmount: number; listAmount: number }>(
    '/admin/subscriptions/pricing',
    body,
    { headers: adminHeaders() },
  )
  return data
}
