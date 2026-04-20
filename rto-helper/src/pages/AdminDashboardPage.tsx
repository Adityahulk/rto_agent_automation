import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchAdminStats } from '@/api/admin'
import { Skeleton } from '@/components/Skeleton'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-card bg-bg-card p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-border-card bg-bg-card p-4 transition-colors hover:border-accent-blue/40 hover:bg-accent-blue/5"
    >
      <p className="font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-secondary">{desc}</p>
    </Link>
  )
}

export function AdminDashboardPage() {
  const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: fetchAdminStats })

  if (statsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    )
  }
  if (statsQuery.isError || !statsQuery.data) {
    return <p className="text-sm text-accent-red">Could not load admin stats.</p>
  }

  const s = statsQuery.data

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Admin dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Overview of agents and platform revenue.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total agents" value={String(s.totalAgents)} />
        <StatCard label="Active" value={String(s.active)} />
        <StatCard label="Expired" value={String(s.expired)} />
        <StatCard label="Blocked" value={String(s.blocked)} />
        <StatCard label="Total revenue" value={formatInr(s.totalRevenue)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border-card bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary">Monthly new signups</h2>
          <p className="mt-0.5 text-xs text-text-secondary">Last 6 months</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.signupsByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border-card" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-text-secondary" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-text-secondary" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} name="Signups" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border-card bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary">Recent signups</h2>
          <p className="mt-0.5 text-xs text-text-secondary">Latest 5 agents</p>
          <ul className="mt-4 divide-y divide-border-card">
            {s.recentSignups.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0">
                <div>
                  <p className="font-medium text-text-primary">{a.name}</p>
                  <p className="text-xs text-text-secondary">{a.businessName}</p>
                  <p className="text-xs text-text-secondary">{a.email}</p>
                </div>
                <p className="text-xs tabular-nums text-text-secondary">
                  {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(a.joinedAt))}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-primary">Quick links</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to="/admin/agents" title="Agents" desc="Search, block, extend, delete" />
          <QuickLink to="/admin/fees" title="Fee engine" desc="Excel upload & rate matrix" />
          <QuickLink to="/admin/subscriptions" title="Subscriptions" desc="Reminders & manual plans" />
          <QuickLink to="/admin/analytics" title="Analytics" desc="Queries & engagement" />
        </div>
      </div>
    </div>
  )
}
