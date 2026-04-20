import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type RevenueStats = {
  thisMonthRevenue: number
  lastMonthRevenue: number
  totalAllTimeRevenue: number
  avgPerQuery: number
  feeCalculationsThisMonth: number
  chart: { month: string; amount: number }[]
}

export type ServiceChargeRow = {
  id: string
  clientId: string
  clientName: string
  service: string
  amount: number
  date: string
}

export async function fetchRevenueStats(): Promise<RevenueStats> {
  const { data } = await apiClient.get<RevenueStats>('/revenue/stats', { headers: authHeaders() })
  return data
}

export async function fetchServiceCharges(): Promise<{ items: ServiceChargeRow[] }> {
  const { data } = await apiClient.get<{ items: ServiceChargeRow[] }>('/revenue/charges', {
    headers: authHeaders(),
  })
  return data
}

export async function createServiceCharge(body: {
  clientId: string
  service: string
  amount: number
  date?: string
}) {
  const { data } = await apiClient.post('/revenue/charges', body, { headers: authHeaders() })
  return data
}

export async function deleteServiceCharge(id: string) {
  await apiClient.delete(`/revenue/charges/${id}`, { headers: authHeaders() })
}
