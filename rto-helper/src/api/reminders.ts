import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

function authHeaders() {
  const token = getAgentJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type ReminderTypeFilter = 'all' | 'insurance' | 'fitness' | 'puc' | 'permit'

export type ReminderItem = {
  id: string
  reminderType: string
  clientName: string
  vehicleNumber: string
  expiryDate: string
  daysRemaining: number
}

export async function fetchReminders(params: {
  type?: ReminderTypeFilter
  dateFrom?: string
  dateTo?: string
}): Promise<{ items: ReminderItem[] }> {
  const { data } = await apiClient.get<{ items: ReminderItem[] }>('/reminders', {
    params: {
      type: params.type === 'all' ? undefined : params.type,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
    },
    headers: authHeaders(),
  })
  return data
}
