import axios from 'axios'
import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type SettingsProfile = {
  email: string
  businessName: string
  logoUrl: string | null
  whatsappNumber: string | null
}

export async function fetchSettings(): Promise<SettingsProfile> {
  const { data } = await apiClient.get<SettingsProfile>('/settings', { headers: authHeaders() })
  return data
}

export async function saveBranding(formData: FormData): Promise<{
  accessToken: string
  businessName: string
  logoUrl: string | null
}> {
  const token = getAgentJwt()
  const base = apiClient.defaults.baseURL ?? '/api'
  const { data } = await axios.put(`${base}/settings/branding`, formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 30_000,
  })
  return data
}

export async function saveContact(body: { whatsappNumber: string | null }): Promise<{
  accessToken: string
  whatsappNumber: string | null
}> {
  const { data } = await apiClient.put('/settings/contact', body, { headers: authHeaders() })
  return data
}

export async function updatePassword(body: {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}): Promise<{ accessToken: string; message?: string }> {
  const { data } = await apiClient.put('/settings/password', body, { headers: authHeaders() })
  return data
}
