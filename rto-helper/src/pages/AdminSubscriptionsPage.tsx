import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import {
  fetchAdminSubscriptions,
  postAdminManualSubscription,
  postAdminSubscriptionRemind,
  putAdminSubscriptionPricing,
} from '@/api/admin'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso))
}

export function AdminSubscriptionsPage() {
  const queryClient = useQueryClient()
  const subsQuery = useQuery({ queryKey: ['admin', 'subscriptions'], queryFn: fetchAdminSubscriptions })

  const [tenantId, setTenantId] = useState('')
  const [plan, setPlan] = useState('RTO Helper Pro — 1 Year')
  const [months, setMonths] = useState('12')
  const [amount, setAmount] = useState('')
  const [paid, setPaid] = useState(true)
  const [manualError, setManualError] = useState<string | null>(null)

  const [renewalInr, setRenewalInr] = useState('')
  const [listInr, setListInr] = useState('')
  const [pricingTouched, setPricingTouched] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)

  const remindMut = useMutation({
    mutationFn: (id: string) => postAdminSubscriptionRemind(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }),
  })

  const manualMut = useMutation({
    mutationFn: postAdminManualSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      setManualError(null)
    },
    onError: (e) => {
      setManualError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Failed')
    },
  })

  const pricingMut = useMutation({
    mutationFn: putAdminSubscriptionPricing,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
      setRenewalInr(String(data.renewalAmount))
      setListInr(String(data.listAmount))
      setPricingTouched(false)
      setPricingError(null)
    },
    onError: (e) => {
      setPricingError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Failed')
    },
  })

  const data = subsQuery.data

  useEffect(() => {
    if (!data?.pricing || pricingTouched) return
    setRenewalInr(String(data.pricing.renewalAmount))
    setListInr(String(data.pricing.listAmount))
  }, [data?.pricing, pricingTouched])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Subscriptions</h1>
        <p className="mt-1 text-sm text-text-secondary">Reminders, manual grants, and public renewal pricing.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Expiring in 30 days</h2>
        {subsQuery.isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-card bg-bg-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border-card bg-bg-app text-xs text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {(data?.expiringSoon ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border-card last:border-0">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.businessName}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.email}</td>
                    <td className="px-4 py-3 tabular-nums text-text-secondary">
                      {formatDate(r.subscriptionExpiresAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={remindMut.isPending}
                        onClick={() => remindMut.mutate(r.id)}
                      >
                        Send email reminder
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.expiringSoon.length ? (
              <p className="p-4 text-sm text-text-secondary">No subscriptions expiring in the next 30 days.</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-border-card bg-bg-card p-5">
          <h2 className="text-sm font-semibold text-text-primary">Manual subscription</h2>
          <p className="mt-1 text-xs text-text-secondary">Extend an agent&apos;s plan; optionally record a payment.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-text-secondary">Agent</label>
              <select
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              >
                <option value="">Select…</option>
                {(data?.agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">Plan name</label>
              <input
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary">Duration (months)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Amount (INR)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              Mark as paid (creates invoice row)
            </label>
            {manualError ? <p className="text-sm text-accent-red">{manualError}</p> : null}
            <Button
              type="button"
              disabled={manualMut.isPending || !tenantId}
              onClick={() => {
                const m = Number(months)
                const amt = Number(amount)
                if (!Number.isFinite(m) || m < 1 || !Number.isFinite(amt)) {
                  setManualError('Enter valid months and amount')
                  return
                }
                manualMut.mutate({
                  tenantId,
                  plan,
                  months: m,
                  amount: amt,
                  paid,
                })
              }}
            >
              {manualMut.isPending ? 'Applying…' : 'Apply'}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border-card bg-bg-card p-5">
          <h2 className="text-sm font-semibold text-text-primary">Plan pricing (agent /subscription page)</h2>
          <p className="mt-1 text-xs text-text-secondary">Renewal amount must match Razorpay checkout for renewals.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-text-secondary">Renewal price (INR)</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                value={renewalInr}
                onChange={(e) => {
                  setPricingTouched(true)
                  setRenewalInr(e.target.value)
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">List / strikethrough price (INR)</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                value={listInr}
                onChange={(e) => {
                  setPricingTouched(true)
                  setListInr(e.target.value)
                }}
              />
            </div>
            {pricingError ? <p className="text-sm text-accent-red">{pricingError}</p> : null}
            <Button
              type="button"
              disabled={pricingMut.isPending}
              onClick={() => {
                const r = Number(renewalInr)
                const l = Number(listInr)
                pricingMut.mutate({ renewalInr: r, listInr: l })
              }}
            >
              {pricingMut.isPending ? 'Saving…' : 'Save pricing'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
