import { apiClient } from '@/api/client'
import { getAgentJwt } from '@/lib/auth'

export type UpcomingExpiryRow = {
  id: string
  clientName: string
  vehicleNumber: string
  type: 'Insurance' | 'Fitness' | 'PUC'
  expiryDate: string
  daysLeft: number
  vehicleId: string
  clientId: string
}

export type RecentActivityItem = {
  id: string
  kind: string
  icon: 'calculator' | 'file' | 'wallet' | 'clipboard'
  text: string
  at: string
}

export type DashboardStats = {
  todayQueries: number
  pendingForms: number
  expiringThisMonth: number
  monthlyRevenue: number
  upcomingExpiries: UpcomingExpiryRow[]
  recentActivity: RecentActivityItem[]
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const token = getAgentJwt()
  const { data } = await apiClient.get<DashboardStats>('/dashboard/stats', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return data
}
