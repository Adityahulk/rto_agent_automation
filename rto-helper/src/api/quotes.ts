import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type QuoteListItem = {
  id: string
  clientId: string
  clientName: string
  vehicleType: string
  vehicleTypeRaw: string
  state: string
  invoicePrice: number
  totalFees: number
  totalTax: number
  grandTotal: number
  date: string
  sentViaWhatsapp: boolean
  pdfUrl: string | null
}

export type QuotesListResponse = {
  items: QuoteListItem[]
  total: number
  page: number
  pageSize: number
}

export async function fetchQuotes(params: {
  page?: number
  pageSize?: number
}): Promise<QuotesListResponse> {
  const { data } = await apiClient.get<QuotesListResponse>('/quotes', {
    params: { page: params.page ?? 1, pageSize: params.pageSize ?? 10 },
    headers: authHeaders(),
  })
  return data
}

export async function deleteQuote(id: string) {
  await apiClient.delete(`/quotes/${id}`, { headers: authHeaders() })
}

export async function patchQuote(id: string, body: { sentViaWhatsapp?: boolean; pdfUrl?: string | null }) {
  const { data } = await apiClient.patch<{ id: string; sentViaWhatsapp: boolean; pdfUrl: string | null }>(
    `/quotes/${id}`,
    body,
    { headers: authHeaders() },
  )
  return data
}

export async function downloadQuotePdf(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/quotes/${id}/pdf`, {
    responseType: 'blob',
    headers: authHeaders(),
  })
  return data
}
