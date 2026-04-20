import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useState } from 'react'
import {
  fetchSubscriptionInvoices,
  fetchSubscriptionStatus,
  renewSubscription,
  subscriptionQueryKeys,
} from '@/api/subscription'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'
import { cn } from '@/lib/utils'

const DEFAULT_RENEWAL_INR = 1500
const DEFAULT_LIST_INR = 2000
const DEFAULT_RAZORPAY_KEY = 'rzp_test_1DP5mmOlF5G5ag'

function formatValidUntil(iso) {
  const d = new Date(iso)
  return `Valid until ${new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)}`
}

function formatPaymentDate(iso) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function formatInr(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Razorpay'))
    document.body.appendChild(s)
  })
}

function StatusBadge({ status }) {
  if (status === 'expired') {
    return (
      <span className="inline-flex rounded-full bg-accent-red/15 px-3 py-1 text-xs font-semibold text-accent-red">
        Expired
      </span>
    )
  }
  if (status === 'expiring_soon') {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-400">
        Expiring Soon
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-accent-green/15 px-3 py-1 text-xs font-semibold text-accent-green">
      Active
    </span>
  )
}

function downloadInvoice(row) {
  const lines = [
    `Invoice: ${row.invoiceNumber}`,
    `Plan: ${row.plan}`,
    `Amount: ${formatInr(row.amount)}`,
    `Payment date: ${formatPaymentDate(row.paymentDate)}`,
    `Payment ID: ${row.paymentId || '—'}`,
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${row.invoiceNumber}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export function SubscriptionPage() {
  const queryClient = useQueryClient()
  const [successOpen, setSuccessOpen] = useState(false)
  const [successExpiry, setSuccessExpiry] = useState('')
  const [checkoutError, setCheckoutError] = useState('')

  const statusQuery = useQuery({
    queryKey: subscriptionQueryKeys.status,
    queryFn: fetchSubscriptionStatus,
  })

  const invoicesQuery = useQuery({
    queryKey: subscriptionQueryKeys.invoices,
    queryFn: async () => (await fetchSubscriptionInvoices()).invoices,
  })

  const renewMutation = useMutation({
    mutationFn: renewSubscription,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status })
      await queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.invoices })
      setSuccessExpiry(
        new Intl.DateTimeFormat('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(data.subscriptionExpiresAt)),
      )
      setSuccessOpen(true)
    },
  })

  const openCheckout = useCallback(async () => {
    setCheckoutError('')
    try {
      await loadRazorpayScript()
    } catch {
      setCheckoutError('Payment could not load. Try again.')
      return
    }

    const renewalInr = statusQuery.data?.renewalAmount ?? DEFAULT_RENEWAL_INR

    const key = import.meta.env.VITE_RAZORPAY_KEY_ID ?? DEFAULT_RAZORPAY_KEY

    const options = {
      key,
      amount: Math.round(renewalInr * 100),
      currency: 'INR',
      name: 'RTO Helper',
      description: 'RTO Helper Pro — 1 Year',
      handler(response) {
        const paymentId = response?.razorpay_payment_id
        if (!paymentId) {
          setCheckoutError('No payment id returned.')
          return
        }
        renewMutation.mutate({ paymentId, amount: renewalInr })
      },
      theme: { color: '#2563eb' },
    }

    const rzp = new window.Razorpay(options)
    rzp.open()
  }, [renewMutation, statusQuery.data?.renewalAmount])

  const s = statusQuery.data
  const progress = s?.progressPercent ?? 0
  const renewalInr = s?.renewalAmount ?? DEFAULT_RENEWAL_INR
  const listInr = s?.listAmount ?? DEFAULT_LIST_INR

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Subscription</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your plan and payment history.</p>
      </div>

      {s?.showExpiryWarning ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">Your plan expires soon</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
            Renew within {s.daysUntilExpiry} day{s.daysUntilExpiry === 1 ? '' : 's'} to avoid interruption.
          </p>
        </div>
      ) : null}

      <div className="flex justify-center">
        <div className="w-full max-w-lg rounded-xl border border-border-card bg-bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <p className="text-lg font-semibold text-text-primary">{s?.planName ?? 'RTO Helper Pro — 1 Year'}</p>
            <div className="mt-4">{s ? <StatusBadge status={s.status} /> : null}</div>
            {s?.subscriptionExpiresAt ? (
              <p className="mt-4 text-sm text-text-secondary">{formatValidUntil(s.subscriptionExpiresAt)}</p>
            ) : (
              <p className="mt-4 text-sm text-text-secondary">No expiry date on file.</p>
            )}

            <div className="mt-8 w-full">
              <div className="mb-2 flex justify-between text-xs text-text-secondary">
                <span>Time on plan</span>
                <span>{Math.round(progress)}% elapsed</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-bg-app">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    s?.status === 'expired' ? 'bg-accent-red' : 'bg-accent-blue',
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-text-secondary">
                Bar shows elapsed time in the current billing period (start → expiry).
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border-card bg-bg-card p-6">
        <h2 className="text-base font-semibold text-text-primary">Renew</h2>
        <p className="mt-1 text-sm text-text-secondary">Extend access for one year.</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums text-text-primary">{formatInr(renewalInr)}</p>
            <p className="text-sm text-text-secondary">per year</p>
            <p className="mt-1 text-sm text-text-secondary line-through">{formatInr(listInr)}</p>
          </div>
          <Button
            type="button"
            className="shrink-0"
            onClick={() => void openCheckout()}
            disabled={renewMutation.isPending}
          >
            {renewMutation.isPending ? 'Processing…' : 'Renew Now'}
          </Button>
        </div>
        {checkoutError ? <p className="mt-3 text-sm text-accent-red">{checkoutError}</p> : null}
        {renewMutation.isError ? (
          <p className="mt-3 text-sm text-accent-red">
            {isAxiosError(renewMutation.error)
              ? renewMutation.error.response?.data?.message ?? renewMutation.error.message
              : 'Renewal failed.'}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-base font-semibold text-text-primary">Invoice history</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border-card bg-bg-card">
          {invoicesQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : !invoicesQuery.data?.length ? (
            <p className="p-6 text-center text-sm text-text-secondary">No payments yet</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border-card bg-bg-app text-xs font-medium uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment date</th>
                  <th className="px-4 py-3">Payment ID</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {invoicesQuery.data.map((row) => (
                  <tr key={row.id} className="border-b border-border-card last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{row.invoiceNumber}</td>
                    <td className="px-4 py-3">{row.plan}</td>
                    <td className="px-4 py-3 tabular-nums">{formatInr(row.amount)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatPaymentDate(row.paymentDate)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{row.paymentId || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => downloadInvoice(row)}>
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment successful</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Your subscription is active until{' '}
            <span className="font-medium text-text-primary">{successExpiry}</span>.
          </p>
          <DialogFooter>
            <Button type="button" onClick={() => setSuccessOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
