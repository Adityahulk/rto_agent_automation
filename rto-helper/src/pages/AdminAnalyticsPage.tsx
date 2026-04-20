import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchAdminAnalytics } from '@/api/admin'
import { Skeleton } from '@/components/Skeleton'

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#64748b']

export function AdminAnalyticsPage() {
  const analyticsQuery = useQuery({ queryKey: ['admin', 'analytics'], queryFn: fetchAdminAnalytics })

  if (analyticsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (analyticsQuery.isError || !analyticsQuery.data) {
    return <p className="text-sm text-accent-red">Could not load analytics.</p>
  }

  const a = analyticsQuery.data
  const pieData = a.queriesByVehicleType.map((d) => ({
    name: d.vehicleType.replace(/_/g, ' '),
    value: d.count,
  }))

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Analytics</h1>
        <p className="mt-1 text-sm text-text-secondary">Fee calculator usage and agent activity.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border-card bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary">Queries by vehicle type</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border-card bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary">Top 10 states by query count</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={a.topStatesByQueries}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border-card" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="state"
                  width={100}
                  tick={{ fontSize: 11 }}
                  className="fill-text-secondary"
                />
                <Tooltip />
                <Bar dataKey="count" fill="var(--accent-blue)" radius={[0, 4, 4, 0]} name="Queries" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border-card bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary">Daily active agents (last 30 days)</h2>
        <p className="mt-0.5 text-xs text-text-secondary">Distinct agents running at least one fee calculation per day.</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={a.dailyActiveAgents} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border-card" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="var(--accent-green)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border-card bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary">Top 10 agents by queries this month</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border-card text-xs text-text-secondary">
              <tr>
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Agent</th>
                <th className="py-2 pr-4">Business</th>
                <th className="py-2 text-right">Queries</th>
              </tr>
            </thead>
            <tbody>
              {a.topAgentsThisMonth.map((r, i) => (
                <tr key={r.tenantId} className="border-b border-border-card last:border-0">
                  <td className="py-2 pr-4 tabular-nums text-text-secondary">{i + 1}</td>
                  <td className="py-2 pr-4 font-medium">{r.name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{r.businessName}</td>
                  <td className="py-2 text-right tabular-nums">{r.queryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!a.topAgentsThisMonth.length ? (
            <p className="py-4 text-sm text-text-secondary">No fee calculations recorded this month.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
