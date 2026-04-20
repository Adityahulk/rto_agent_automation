import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Banknote,
  Calculator,
  ClipboardList,
  FileText,
  MessageSquare,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchDashboardStats } from '@/api/dashboard'
import type { RecentActivityItem } from '@/api/dashboard'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/timeAgo'

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function daysLeftClass(days: number) {
  if (days < 7) return 'font-semibold text-accent-red'
  if (days < 30) return 'font-semibold text-accent-amber'
  return 'font-medium text-accent-green'
}

function ActivityIcon({ item }: { item: RecentActivityItem }) {
  const common = 'h-4 w-4 shrink-0'
  switch (item.icon) {
    case 'calculator':
      return <Calculator className={cn(common, 'text-accent-blue')} aria-hidden />
    case 'file':
      return <FileText className={cn(common, 'text-text-secondary')} aria-hidden />
    case 'wallet':
      return <Wallet className={cn(common, 'text-accent-green')} aria-hidden />
    case 'clipboard':
      return <ClipboardList className={cn(common, 'text-accent-amber')} aria-hidden />
    default:
      return <FileText className={common} aria-hidden />
  }
}

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchDashboardStats,
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-bg-card" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border border-border-card bg-bg-card"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-lg border border-border-card bg-bg-card" />
          <div className="h-64 animate-pulse rounded-lg border border-border-card bg-bg-card" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-accent-red/40 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
        <p className="font-medium">Could not load dashboard</p>
        <p className="mt-1 text-text-secondary">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button
          type="button"
          className="mt-3 rounded-md bg-accent-red px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-red/90"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    )
  }

  const stats = [
    {
      label: "Today's Queries",
      value: String(data.todayQueries),
      icon: MessageSquare,
      iconClass: 'text-accent-blue bg-accent-blue/15',
    },
    {
      label: 'Pending Forms',
      value: String(data.pendingForms),
      icon: ClipboardList,
      iconClass: 'text-accent-amber bg-accent-amber/15',
    },
    {
      label: 'Expiring This Month',
      value: String(data.expiringThisMonth),
      icon: AlertTriangle,
      iconClass: 'text-accent-red bg-accent-red/15',
    },
    {
      label: 'Monthly Revenue',
      value: formatInr(data.monthlyRevenue),
      icon: Banknote,
      iconClass: 'text-accent-green bg-accent-green/15',
    },
  ] as const

  const quickActions = [
    { to: '/calculator', label: 'New Calculation', icon: Calculator },
    { to: '/clients', label: 'Add Client', icon: ClipboardList },
    { to: '/forms', label: 'Generate Form', icon: FileText },
    { to: '/insurance', label: 'Track Insurance', icon: AlertTriangle },
  ] as const

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Overview of your RTO desk</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex gap-4 rounded-lg border border-border-card bg-bg-card p-4 shadow-sm"
          >
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                s.iconClass,
              )}
            >
              <s.icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                {s.label}
              </p>
              <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-text-primary">
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border-card bg-bg-card">
          <div className="border-b border-border-card px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Upcoming Expiries</h2>
            <p className="text-xs text-text-secondary">Next 7 items by expiry date</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-card text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Vehicle No.</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Expiry Date</th>
                  <th className="px-4 py-2 font-medium">Days Left</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingExpiries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      No upcoming expiries
                    </td>
                  </tr>
                ) : (
                  data.upcomingExpiries.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border-card/80 last:border-0 hover:bg-bg-app/50"
                    >
                      <td className="px-4 py-2.5 text-text-primary">{row.clientName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">
                        {row.vehicleNumber}
                      </td>
                      <td className="px-4 py-2.5 text-text-primary">{row.type}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{formatDate(row.expiryDate)}</td>
                      <td className={cn('px-4 py-2.5 tabular-nums', daysLeftClass(row.daysLeft))}>
                        {row.daysLeft}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          className="text-xs font-medium text-accent-blue hover:underline"
                          to={`/reminders?clientId=${encodeURIComponent(row.clientId)}&vehicleId=${encodeURIComponent(row.vehicleId)}&type=${encodeURIComponent(row.type)}`}
                        >
                          Send Reminder
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-border-card bg-bg-card">
          <div className="border-b border-border-card px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Recent Activity</h2>
            <p className="text-xs text-text-secondary">Last 10 actions</p>
          </div>
          <ul className="divide-y divide-border-card">
            {data.recentActivity.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-text-secondary">No recent activity</li>
            ) : (
              data.recentActivity.map((item) => (
                <li key={item.id} className="flex gap-3 px-4 py-3">
                  <div className="mt-0.5">
                    <ActivityIcon item={item} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">{item.text}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{timeAgo(item.at)}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex flex-col items-center gap-3 rounded-lg border border-border-card bg-bg-card px-4 py-6 text-center shadow-sm transition hover:border-accent-blue/40 hover:bg-bg-app/80"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                <a.icon className="h-6 w-6" aria-hidden />
              </div>
              <span className="text-sm font-medium text-text-primary">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
