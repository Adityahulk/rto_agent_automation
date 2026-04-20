import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type ClientListItem = {
  id: string
  name: string
  phone: string | null
  vehicleCount: number
  state: string | null
  city: string | null
  lastActivity: string | null
  createdAt: string
}

export type ClientsListResponse = {
  items: ClientListItem[]
  total: number
  page: number
  pageSize: number
  states: string[]
}

export async function fetchClients(params: {
  search?: string
  state?: string
  vehicleType?: string
  page?: number
  pageSize?: number
}): Promise<ClientsListResponse> {
  const { data } = await apiClient.get<ClientsListResponse>('/clients', {
    params: {
      search: params.search || undefined,
      state: params.state || undefined,
      vehicleType: params.vehicleType || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
    },
    headers: authHeaders(),
  })
  return data
}

export type ClientDetail = {
  id: string
  name: string
  phone: string | null
  alternatePhone: string | null
  address: string | null
  city: string | null
  state: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  vehicles: {
    id: string
    vehicleNumber: string
    make: string
    model: string
    year: number | null
    fuelType: string | null
    vehicleType: string
    chassisNumber: string | null
    engineNumber: string | null
  }[]
  insurancePolicies: {
    id: string
    vehicleId: string
    vehicleNumber: string
    policyNumber: string
    insurer: string
    policyType: string
    premium: number
    startDate: string
    expiryDate: string
    status: string
  }[]
  forms: { id: string; formType: string; pdfUrl: string | null; createdAt: string }[]
  quotes: {
    id: string
    createdAt: string
    pdfUrl: string | null
    sentViaWhatsapp: boolean
    grandTotal: number
    state: string
    vehicleType: string
  }[]
}

export async function fetchClient(id: string): Promise<ClientDetail> {
  const { data } = await apiClient.get<ClientDetail>(`/clients/${id}`, {
    headers: authHeaders(),
  })
  return data
}

export async function createClient(body: {
  name: string
  phone: string
  alternatePhone?: string | null
  address?: string | null
  city?: string | null
  state: string
}) {
  const { data } = await apiClient.post('/clients', body, { headers: authHeaders() })
  return data
}

export async function updateClient(
  id: string,
  body: Partial<{
    name: string
    phone: string
    alternatePhone: string | null
    address: string | null
    city: string | null
    state: string
    notes: string
  }>,
) {
  const { data } = await apiClient.put(`/clients/${id}`, body, { headers: authHeaders() })
  return data
}

export async function deleteClient(id: string) {
  await apiClient.delete(`/clients/${id}`, { headers: authHeaders() })
}

export async function createVehicle(
  clientId: string,
  body: {
    vehicleNumber: string
    make: string
    model: string
    year?: number | null
    fuelType?: string | null
    vehicleType: string
    chassisNumber?: string | null
    engineNumber?: string | null
  },
) {
  const { data } = await apiClient.post(`/clients/${clientId}/vehicles`, body, {
    headers: authHeaders(),
  })
  return data
}
