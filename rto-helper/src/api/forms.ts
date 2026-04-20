import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type FormType = 'FORM_20' | 'FORM_21' | 'FORM_29' | 'FORM_30'

export type SavedFormListItem = {
  id: string
  formType: string
  clientName: string | null
  vehicleNumber: string | null
  createdAt: string
  hasFile: boolean
}

export async function fetchRecentForms(limit = 50): Promise<{ items: SavedFormListItem[] }> {
  const { data } = await apiClient.get<{ items: SavedFormListItem[] }>('/forms', {
    params: { limit },
    headers: authHeaders(),
  })
  return data
}

/** Returns raw PDF bytes */
export async function generateFormPdf(formType: FormType, formData: Record<string, string>) {
  const { data, headers } = await apiClient.post<ArrayBuffer>(
    '/forms/generate',
    { formType, formData },
    {
      responseType: 'arraybuffer',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    },
  )
  const ct = String(headers['content-type'] ?? '')
  if (ct.includes('application/json')) {
    const msg = JSON.parse(new TextDecoder().decode(data)) as { message?: string }
    throw new Error(msg.message ?? 'Generate failed')
  }
  return data
}

export async function saveFormRecord(body: {
  formType: FormType
  formData: Record<string, string>
  clientId?: string | null
  vehicleId?: string | null
}) {
  const { data } = await apiClient.post<{ id: string; pdfUrl: string }>('/forms', body, {
    headers: authHeaders(),
  })
  return data
}

export async function downloadSavedFormPdf(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/forms/${id}/file`, {
    responseType: 'blob',
    headers: authHeaders(),
  })
  return data
}

export async function deleteSavedForm(id: string) {
  await apiClient.delete(`/forms/${id}`, { headers: authHeaders() })
}
