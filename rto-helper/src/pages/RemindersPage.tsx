import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchReminders, type ReminderItem, type ReminderTypeFilter } from '@/api/reminders'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const TYPE_FILTERS: { key: ReminderTypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'puc', label: 'PUC' },
  { key: 'permit', label: 'Permit' },
]

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function mondayOfWeek(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function endOfWeekSunday(monday: Date) {
  const e = new Date(monday)
  e.setDate(e.getDate() + 6)
  e.setHours(23, 59, 59, 999)
  return e
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso))
}

function reminderMessage(item: ReminderItem, businessName: string) {
  return `Dear ${item.clientName}, reminder: your ${item.reminderType} for vehicle ${item.vehicleNumber} expires on ${formatDate(item.expiryDate)} (${item.daysRemaining} days remaining). Please renew soon. — ${businessName}`
}

type GroupKey = 'thisWeek' | 'nextWeek' | 'thisMonth' | 'other'

function groupReminders(items: ReminderItem[]) {
  const now = new Date()
  const thisWeekStart = mondayOfWeek(now)
  const thisWeekEnd = endOfWeekSunday(thisWeekStart)
  const nextWeekStart = startOfDay(new Date(thisWeekEnd))
  nextWeekStart.setDate(nextWeekStart.getDate() + 1)
  const nextWeekEnd = endOfWeekSunday(nextWeekStart)
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const buckets: Record<GroupKey, ReminderItem[]> = {
    thisWeek: [],
    nextWeek: [],
    thisMonth: [],
    other: [],
  }

  for (const it of items) {
    const d = startOfDay(new Date(it.expiryDate))
    if (d >= thisWeekStart && d <= thisWeekEnd) {
      buckets.thisWeek.push(it)
    } else if (d >= nextWeekStart && d <= nextWeekEnd) {
      buckets.nextWeek.push(it)
    } else if (d >= monthStart && d <= monthEnd) {
      buckets.thisMonth.push(it)
    } else {
      buckets.other.push(it)
    }
  }

  return buckets
}

const GROUP_LABEL: Record<GroupKey, string> = {
  thisWeek: 'This week',
  nextWeek: 'Next week',
  thisMonth: 'This month',
  other: 'Other dates',
}

export function RemindersPage() {
  const businessName = useAuthStore((s) => s.businessName) ?? 'Your agent'
  const [type, setType] = useState<ReminderTypeFilter>('all')
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(() => {
    const t = new Date()
    t.setDate(t.getDate() + 120)
    return t.toISOString().slice(0, 10)
  })
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkSuccess, setBulkSuccess] = useState<number | null>(null)

  const listQuery = useQuery({
    queryKey: ['reminders', type, dateFrom, dateTo],
    queryFn: () =>
      fetchReminders({
        type,
        dateFrom,
        dateTo,
      }),
  })

  const groups = useMemo(() => {
    if (!listQuery.data?.items) return null
    return groupReminders(listQuery.data.items)
  }, [listQuery.data?.items])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleAllInGroup = (items: ReminderItem[], checked: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev)
      for (const it of items) {
        if (checked) n.add(it.id)
        else n.delete(it.id)
      }
      return n
    })
  }

  const sendOne = (item: ReminderItem) => {
    const text = reminderMessage(item, businessName)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const sendBulk = () => {
    const items = listQuery.data?.items.filter((i) => selected.has(i.id)) ?? []
    if (items.length === 0) return
    if (!window.confirm(`Send WhatsApp reminder to ${items.length} client(s)?`)) return
    const lines = items.map(
      (i) =>
        `• ${i.clientName} — ${i.vehicleNumber} — ${i.reminderType} — ${formatDate(i.expiryDate)} (${i.daysRemaining}d)`,
    )
    const text = `RTO reminders (${items.length}):\n${lines.join('\n')}\n— ${businessName}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    setBulkSuccess(items.length)
    setSelected(new Set())
    setTimeout(() => setBulkSuccess(null), 4000)
  }

  const orderedGroups: GroupKey[] = ['thisWeek', 'nextWeek', 'thisMonth', 'other']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Reminders</h1>
        <p className="mt-1 text-sm text-text-secondary">Upcoming insurance, fitness, PUC, and permit expiries.</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium',
                type === t.key
                  ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                  : 'border-border-card bg-bg-card text-text-secondary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-text-secondary">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 block rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="text-xs text-text-secondary">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 block rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary"
            />
          </label>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-blue/30 bg-accent-blue/10 px-4 py-3">
          <Button type="button" className="bg-accent-blue text-white" onClick={sendBulk}>
            Send reminder to selected ({selected.size})
          </Button>
          <button type="button" className="text-sm text-text-secondary underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      ) : null}

      {bulkSuccess != null ? (
        <p className="text-sm font-medium text-accent-green" role="status">
          Prepared WhatsApp for {bulkSuccess} reminder(s).
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <p className="text-sm text-accent-red">Could not load reminders.</p>
      ) : !groups ? null : (
        <div className="space-y-10">
          {!listQuery.data?.items.length ? (
            <p className="text-sm text-text-secondary">No reminders in this range.</p>
          ) : (
            orderedGroups.map((gk) => {
              const list = groups[gk]
              if (!list.length) return null
              const allSelected = list.length > 0 && list.every((i) => selected.has(i.id))
              return (
                <section key={gk}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-text-primary">{GROUP_LABEL[gk]}</h2>
                    <label className="flex items-center gap-2 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleAllInGroup(list, e.target.checked)}
                      />
                      Select all in section
                    </label>
                  </div>
                  <ul className="space-y-3">
                    {list.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-3 rounded-lg border border-border-card bg-bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex gap-3">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selected.has(item.id)}
                            onChange={() => toggle(item.id)}
                            aria-label={`Select ${item.clientName}`}
                          />
                          <div>
                            <p className="font-medium text-text-primary">
                              {item.clientName}{' '}
                              <span className="font-normal text-text-secondary">|</span> {item.vehicleNumber}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {item.reminderType} · expires {formatDate(item.expiryDate)} ·{' '}
                              <span
                                className={cn(
                                  'font-medium',
                                  item.daysRemaining <= 7
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-text-primary',
                                )}
                              >
                                {item.daysRemaining} days left
                              </span>
                            </p>
                          </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => sendOne(item)}>
                          Send WhatsApp
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
