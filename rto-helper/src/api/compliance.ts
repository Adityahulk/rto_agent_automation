import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type ComplianceTab = 'insurance' | 'fitness' | 'puc' | 'permits'

export type ComplianceStats = {
  totalTracked: number
  expiringThisMonth: number
  expired: number
  renewedThisMonth: number
}

export type InsuranceListItem = {
  id: string
  clientName: string
  vehicleNumber: string
  clientId: string
  vehicleId: string
  policyNumber: string
  insurer: string
  policyType: string
  premium: number
  startDate: string
  expiryDate: string
  status: string
  lastRenewedAt: string | null
}

export type FitnessListItem = {
  id: string
  clientName: string
  vehicleNumber: string
  clientId: string
  vehicleId: string
  certificateNumber: string
  issuedBy: string
  validFrom: string | null
  expiryDate: string
  status: string
  lastRenewedAt: string | null
}

export type PucListItem = {
  id: string
  clientName: string
  vehicleNumber: string
  clientId: string
  vehicleId: string
  pucNumber: string
  testCenter: string
  expiryDate: string
  status: string
  lastRenewedAt: string | null
}

export type PermitListItem = {
  id: string
  clientName: string
  vehicleNumber: string
  clientId: string
  vehicleId: string
  permitType: string
  issuedState: string
  expiryDate: string
  status: string
  lastRenewedAt: string | null
}

export type ComplianceListResponse<T> = {
  stats: ComplianceStats
  items: T[]
}

function pathFor(tab: ComplianceTab) {
  const m: Record<ComplianceTab, string> = {
    insurance: '/insurance',
    fitness: '/fitness',
    puc: '/puc',
    permits: '/permits',
  }
  return m[tab]
}

export async function fetchComplianceList<T>(
  tab: ComplianceTab,
  params: { search?: string; status?: string },
): Promise<ComplianceListResponse<T>> {
  const { data } = await apiClient.get<ComplianceListResponse<T>>(pathFor(tab), {
    params: {
      search: params.search || undefined,
      status: params.status || undefined,
    },
    headers: authHeaders(),
  })
  return data
}

export async function createComplianceRecord(tab: ComplianceTab, body: Record<string, unknown>) {
  const { data } = await apiClient.post(pathFor(tab), body, { headers: authHeaders() })
  return data
}

export async function updateComplianceRecord(
  tab: ComplianceTab,
  id: string,
  body: Record<string, unknown>,
) {
  const { data } = await apiClient.put(`${pathFor(tab)}/${id}`, body, { headers: authHeaders() })
  return data
}

export async function renewComplianceRecord(tab: ComplianceTab, id: string, expiryDate: string) {
  const { data } = await apiClient.patch(
    `${pathFor(tab)}/${id}/renew`,
    { expiryDate },
    { headers: authHeaders() },
  )
  return data
}

export async function deleteComplianceRecord(tab: ComplianceTab, id: string) {
  await apiClient.delete(`${pathFor(tab)}/${id}`, { headers: authHeaders() })
}
