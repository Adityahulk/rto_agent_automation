import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  createServiceCharge,
  deleteServiceCharge,
  fetchRevenueStats,
  fetchServiceCharges,
} from '@/api/revenue'
import { fetchClients } from '@/api/clients'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    n || 0,
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-card bg-bg-card p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}

export function RevenuePage() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [service, setService] = useState('')
  const [amount, setAmount] = useState('')
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10))
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(clientSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [clientSearch])

  const statsQuery = useQuery({
    queryKey: ['revenue', 'stats'],
    queryFn: fetchRevenueStats,
  })

  const chargesQuery = useQuery({
    queryKey: ['revenue', 'charges'],
    queryFn: fetchServiceCharges,
  })

  const clientsQuery = useQuery({
    queryKey: ['clients', 'revenue-picker', debouncedSearch],
    queryFn: () => fetchClients({ search: debouncedSearch, page: 1, pageSize: 40 }),
    enabled: addOpen,
  })

  const createMut = useMutation({
    mutationFn: (payload: { clientId: string; service: string; amount: number; date: string }) =>
      createServiceCharge(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue'] })
      setAddOpen(false)
      setClientId('')
      setClientSearch('')
      setService('')
      setAmount('')
      setDateStr(new Date().toISOString().slice(0, 10))
      setFormError(null)
    },
    onError: (e) => {
      setFormError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Failed')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteServiceCharge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue'] })
    },
  })

  const stats = statsQuery.data

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Revenue</h1>
        <p className="mt-1 text-sm text-text-secondary">Service charges and monthly performance.</p>
      </div>

      {statsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : statsQuery.isError ? (
        <p className="text-sm text-accent-red">Could not load revenue stats.</p>
      ) : stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="This month revenue" value={formatInr(stats.thisMonthRevenue)} />
          <StatCard label="Last month revenue" value={formatInr(stats.lastMonthRevenue)} />
          <StatCard label="Total all time" value={formatInr(stats.totalAllTimeRevenue)} />
          <StatCard label="Avg per query" value={formatInr(stats.avgPerQuery)} />
        </div>
      ) : null}

      {stats?.chart ? (
        <div className="rounded-lg border border-border-card bg-bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Monthly revenue (service charges)</h2>
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border-card" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-text-secondary" />
                <YAxis
                  tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  width={72}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [
                    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
                      Number(value ?? 0),
                    ),
                    'Revenue',
                  ]}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--border-card, #e5e7eb)',
                  }}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Service charges</h2>
          <Button
            type="button"
            className="bg-accent-blue text-white hover:bg-accent-blue/90"
            onClick={() => {
              setFormError(null)
              setAddOpen(true)
            }}
          >
            Add charge
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border-card bg-bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border-card bg-bg-app text-xs font-medium uppercase text-text-secondary">
              <tr>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {chargesQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                    <div className="space-y-2 p-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : (
                chargesQuery.data?.items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-medium text-text-primary">{row.clientName}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.service}</td>
                    <td className="px-3 py-2 tabular-nums text-text-primary">{formatInr(row.amount)}</td>
                    <td className="px-3 py-2 tabular-nums text-text-secondary">
                      {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(row.date))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-accent-red hover:bg-accent-red/10"
                        disabled={deleteMut.isPending}
                        onClick={() => {
                          if (window.confirm('Delete this service charge?')) deleteMut.mutate(row.id)
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="border-border-card bg-bg-card text-text-primary sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add service charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs text-text-secondary">Client</label>
              <input
                value={clientId ? (clientsQuery.data?.items.find((c) => c.id === clientId)?.name ?? '') : clientSearch}
                onChange={(e) => {
                  setClientId('')
                  setClientSearch(e.target.value)
                }}
                placeholder="Search name or phone…"
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
              />
              {!clientId && debouncedSearch ? (
                <ul className="mt-1 max-h-36 overflow-auto rounded border border-border-card bg-bg-app py-1">
                  {clientsQuery.data?.items.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-bg-card"
                        onClick={() => {
                          setClientId(c.id)
                          setClientSearch('')
                        }}
                      >
                        {c.name} — {c.phone ?? ''}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <label className="text-xs text-text-secondary">Service description</label>
              <input
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Amount (₹)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Date</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
              />
            </div>
            {formError ? <p className="text-sm text-accent-red">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-accent-blue text-white"
              disabled={!clientId || !service.trim() || createMut.isPending}
              onClick={() => {
                setFormError(null)
                const n = Number(amount.replace(/,/g, ''))
                if (Number.isNaN(n) || n <= 0) {
                  setFormError('Enter a valid amount')
                  return
                }
                createMut.mutate({
                  clientId,
                  service: service.trim(),
                  amount: n,
                  date: dateStr,
                })
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
