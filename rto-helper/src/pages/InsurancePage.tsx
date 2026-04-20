import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createComplianceRecord,
  deleteComplianceRecord,
  fetchComplianceList,
  renewComplianceRecord,
  updateComplianceRecord,
  type ComplianceTab,
  type FitnessListItem,
  type InsuranceListItem,
  type PermitListItem,
  type PucListItem,
} from '@/api/compliance'
import { fetchClient, fetchClients } from '@/api/clients'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const TABS: { key: ComplianceTab; label: string }[] = [
  { key: 'insurance', label: 'Insurance' },
  { key: 'fitness', label: 'Fitness Certificate' },
  { key: 'puc', label: 'PUC' },
  { key: 'permits', label: 'Permit' },
]

function formatDisplayDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso))
}

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  if (s === 'EXPIRED') {
    return (
      <span className="inline-flex rounded-full bg-accent-red/15 px-2.5 py-0.5 text-xs font-medium text-accent-red">
        Expired
      </span>
    )
  }
  if (s === 'EXPIRING_SOON') {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        Expiring Soon
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-accent-green/15 px-2.5 py-0.5 text-xs font-medium text-accent-green">
      Active
    </span>
  )
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'amber' | 'red' | 'green'
}) {
  const valCls =
    tone === 'amber'
      ? 'text-amber-700 dark:text-amber-400'
      : tone === 'red'
        ? 'text-accent-red'
        : tone === 'green'
          ? 'text-accent-green'
          : 'text-text-primary'
  return (
    <div className="rounded-lg border border-border-card bg-bg-card p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', valCls)}>{value}</p>
    </div>
  )
}

function reminderMessage(
  tab: ComplianceTab,
  row: { clientName: string; vehicleNumber: string; expiryDate: string },
  agentName: string,
) {
  const d = formatDisplayDate(row.expiryDate)
  const c = row.clientName
  const v = row.vehicleNumber
  if (tab === 'insurance') {
    return `Dear ${c}, your vehicle ${v} insurance expires on ${d}. Please renew soon. - ${agentName}`
  }
  if (tab === 'fitness') {
    return `Dear ${c}, your vehicle ${v} fitness certificate expires on ${d}. Please renew soon. - ${agentName}`
  }
  if (tab === 'puc') {
    return `Dear ${c}, your vehicle ${v} PUC expires on ${d}. Please renew soon. - ${agentName}`
  }
  return `Dear ${c}, your vehicle ${v} permit expires on ${d}. Please renew soon. - ${agentName}`
}

export function InsurancePage() {
  const queryClient = useQueryClient()
  const businessName = useAuthStore((s) => s.businessName)
  const agentName = businessName ?? 'Your agent'

  const [tab, setTab] = useState<ComplianceTab>('insurance')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [renewId, setRenewId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [clientSearch, setClientSearch] = useState('')
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [vehicleId, setVehicleId] = useState('')

  const [insPolicyNumber, setInsPolicyNumber] = useState('')
  const [insInsurer, setInsInsurer] = useState('')
  const [insPolicyType, setInsPolicyType] = useState<'Third Party' | 'Comprehensive'>('Comprehensive')
  const [insPremium, setInsPremium] = useState('')
  const [insStart, setInsStart] = useState('')
  const [insExpiry, setInsExpiry] = useState('')

  const [fitCert, setFitCert] = useState('')
  const [fitIssuedBy, setFitIssuedBy] = useState('')
  const [fitValidFrom, setFitValidFrom] = useState('')
  const [fitValidTo, setFitValidTo] = useState('')

  const [pucNum, setPucNum] = useState('')
  const [pucCenter, setPucCenter] = useState('')
  const [pucUntil, setPucUntil] = useState('')

  const [permitType, setPermitType] = useState('')
  const [permitState, setPermitState] = useState('')
  const [permitUntil, setPermitUntil] = useState('')

  const [renewDate, setRenewDate] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [clientSearch])

  const listQuery = useQuery({
    queryKey: ['compliance', tab, debouncedSearch, statusFilter],
    queryFn: () =>
      fetchComplianceList<
        InsuranceListItem | FitnessListItem | PucListItem | PermitListItem
      >(tab, {
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      }),
  })

  const clientsPicker = useQuery({
    queryKey: ['clients', 'insurance-picker', debouncedClientSearch],
    queryFn: () =>
      fetchClients({ search: debouncedClientSearch, page: 1, pageSize: 40 }),
    enabled: addOpen || editOpen,
  })

  const clientDetail = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClient(clientId),
    enabled: !!clientId && (addOpen || editOpen),
  })

  const stats = listQuery.data?.stats

  const resetForms = useCallback(() => {
    setClientId('')
    setVehicleId('')
    setClientSearch('')
    setInsPolicyNumber('')
    setInsInsurer('')
    setInsPolicyType('Comprehensive')
    setInsPremium('')
    setInsStart('')
    setInsExpiry('')
    setFitCert('')
    setFitIssuedBy('')
    setFitValidFrom('')
    setFitValidTo('')
    setPucNum('')
    setPucCenter('')
    setPucUntil('')
    setPermitType('')
    setPermitState('')
    setPermitUntil('')
    setFormError(null)
  }, [])

  const openAdd = () => {
    resetForms()
    setEditId(null)
    setAddOpen(true)
  }

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['compliance', tab] })

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => createComplianceRecord(tab, body),
    onSuccess: () => {
      setFormError(null)
      invalidate()
      setAddOpen(false)
      resetForms()
    },
    onError: (e) => {
      setFormError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Failed')
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      updateComplianceRecord(tab, id, body),
    onSuccess: () => {
      setFormError(null)
      invalidate()
      setEditOpen(false)
      setEditId(null)
      resetForms()
    },
    onError: (e) => {
      setFormError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Failed')
    },
  })

  const renewMut = useMutation({
    mutationFn: ({ id, expiryDate }: { id: string; expiryDate: string }) =>
      renewComplianceRecord(tab, id, expiryDate),
    onSuccess: () => {
      invalidate()
      setRenewOpen(false)
      setRenewId(null)
      setRenewDate('')
      setFormError(null)
    },
    onError: (e) => {
      setFormError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Failed')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteComplianceRecord(tab, id),
    onSuccess: () => {
      invalidate()
      setPendingDeleteId(null)
    },
    onError: (e) => {
      setFormError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Failed')
      setPendingDeleteId(null)
    },
  })

  useEffect(() => {
    setAddOpen(false)
    setEditOpen(false)
    setRenewOpen(false)
    setEditId(null)
    setRenewId(null)
    resetForms()
  }, [tab, resetForms])

  const openEdit = (row: InsuranceListItem | FitnessListItem | PucListItem | PermitListItem) => {
    setFormError(null)
    setEditId(row.id)
    setClientId(row.clientId)
    setVehicleId(row.vehicleId)
    setClientSearch('')
    if (tab === 'insurance') {
      const r = row as InsuranceListItem
      setInsPolicyNumber(r.policyNumber)
      setInsInsurer(r.insurer)
      setInsPolicyType(r.policyType.includes('Third') ? 'Third Party' : 'Comprehensive')
      setInsPremium(String(r.premium))
      setInsStart(r.startDate.slice(0, 10))
      setInsExpiry(r.expiryDate.slice(0, 10))
    } else if (tab === 'fitness') {
      const r = row as FitnessListItem
      setFitCert(r.certificateNumber)
      setFitIssuedBy(r.issuedBy)
      setFitValidFrom(r.validFrom ? r.validFrom.slice(0, 10) : '')
      setFitValidTo(r.expiryDate.slice(0, 10))
    } else if (tab === 'puc') {
      const r = row as PucListItem
      setPucNum(r.pucNumber)
      setPucCenter(r.testCenter)
      setPucUntil(r.expiryDate.slice(0, 10))
    } else {
      const r = row as PermitListItem
      setPermitType(r.permitType)
      setPermitState(r.issuedState)
      setPermitUntil(r.expiryDate.slice(0, 10))
    }
    setEditOpen(true)
  }

  const openRenew = (id: string, currentExpiry: string) => {
    setFormError(null)
    setRenewId(id)
    setRenewDate(currentExpiry.slice(0, 10))
    setRenewOpen(true)
  }

  const sendReminder = (
    row: InsuranceListItem | FitnessListItem | PucListItem | PermitListItem,
  ) => {
    const text = reminderMessage(tab, row, agentName)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const submitAdd = () => {
    setFormError(null)
    if (!clientId || !vehicleId) {
      setFormError('Select client and vehicle')
      return
    }
    if (tab === 'insurance') {
      const p = Number(insPremium.replace(/,/g, ''))
      if (!insPolicyNumber.trim() || !insInsurer.trim() || Number.isNaN(p)) {
        setFormError('Fill policy details and premium')
        return
      }
      createMut.mutate({
        vehicleId,
        policyNumber: insPolicyNumber.trim(),
        insurer: insInsurer.trim(),
        policyType: insPolicyType,
        premium: p,
        startDate: insStart,
        expiryDate: insExpiry,
      })
    } else if (tab === 'fitness') {
      if (!fitCert.trim() || !fitIssuedBy.trim() || !fitValidTo) {
        setFormError('Fill certificate details and valid to date')
        return
      }
      createMut.mutate({
        vehicleId,
        certificateNumber: fitCert.trim(),
        issuedBy: fitIssuedBy.trim(),
        validFrom: fitValidFrom || undefined,
        expiryDate: fitValidTo,
      })
    } else if (tab === 'puc') {
      if (!pucNum.trim() || !pucCenter.trim() || !pucUntil) {
        setFormError('Fill PUC details')
        return
      }
      createMut.mutate({
        vehicleId,
        pucNumber: pucNum.trim(),
        testCenter: pucCenter.trim(),
        expiryDate: pucUntil,
      })
    } else {
      if (!permitType.trim() || !permitState.trim() || !permitUntil) {
        setFormError('Fill permit details')
        return
      }
      createMut.mutate({
        vehicleId,
        permitType: permitType.trim(),
        issuedState: permitState.trim(),
        expiryDate: permitUntil,
      })
    }
  }

  const submitEdit = () => {
    if (!editId) return
    setFormError(null)
    if (!vehicleId) {
      setFormError('Select vehicle')
      return
    }
    if (tab === 'insurance') {
      const p = Number(insPremium.replace(/,/g, ''))
      if (Number.isNaN(p)) {
        setFormError('Invalid premium')
        return
      }
      updateMut.mutate({
        id: editId,
        body: {
          vehicleId,
          policyNumber: insPolicyNumber.trim(),
          insurer: insInsurer.trim(),
          policyType: insPolicyType,
          premium: p,
          startDate: insStart,
          expiryDate: insExpiry,
        },
      })
    } else if (tab === 'fitness') {
      updateMut.mutate({
        id: editId,
        body: {
          vehicleId,
          certificateNumber: fitCert.trim(),
          issuedBy: fitIssuedBy.trim(),
          validFrom: fitValidFrom || null,
          expiryDate: fitValidTo,
        },
      })
    } else if (tab === 'puc') {
      updateMut.mutate({
        id: editId,
        body: {
          vehicleId,
          pucNumber: pucNum.trim(),
          testCenter: pucCenter.trim(),
          expiryDate: pucUntil,
        },
      })
    } else {
      updateMut.mutate({
        id: editId,
        body: {
          vehicleId,
          permitType: permitType.trim(),
          issuedState: permitState.trim(),
          expiryDate: permitUntil,
        },
      })
    }
  }

  const addTitle = useMemo(() => {
    if (tab === 'insurance') return 'Add policy'
    if (tab === 'fitness') return 'Add fitness certificate'
    if (tab === 'puc') return 'Add PUC'
    return 'Add permit'
  }, [tab])

  const vehicles = clientDetail.data?.vehicles ?? []
  const tableColSpan = tab === 'insurance' || tab === 'fitness' ? 8 : 7

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Insurance</h1>
        <Button
          type="button"
          className="bg-accent-blue text-white hover:bg-accent-blue/90 sm:self-start"
          onClick={openAdd}
        >
          {tab === 'insurance' ? 'Add policy' : 'Add record'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border-card pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition',
              tab === t.key
                ? 'bg-accent-blue/15 text-accent-blue'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Tracked" value={stats.totalTracked} />
          <StatCard label="Expiring This Month" value={stats.expiringThisMonth} tone="amber" />
          <StatCard label="Expired" value={stats.expired} tone="red" />
          <StatCard label="Renewed This Month" value={stats.renewedThisMonth} tone="green" />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Search</label>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Client or vehicle number…"
            className="w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40"
          />
        </div>
        <div className="w-full md:w-48">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-card bg-bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border-card bg-bg-app text-xs font-medium uppercase tracking-wide text-text-secondary">
            {tab === 'insurance' ? (
              <tr>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Vehicle</th>
                <th className="px-3 py-3">Policy No.</th>
                <th className="px-3 py-3">Insurer</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Expiry</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            ) : tab === 'fitness' ? (
              <tr>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Vehicle</th>
                <th className="px-3 py-3">Certificate</th>
                <th className="px-3 py-3">Issued By</th>
                <th className="px-3 py-3">Valid From</th>
                <th className="px-3 py-3">Valid To</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            ) : tab === 'puc' ? (
              <tr>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Vehicle</th>
                <th className="px-3 py-3">PUC No.</th>
                <th className="px-3 py-3">Test Center</th>
                <th className="px-3 py-3">Valid Until</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            ) : (
              <tr>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Vehicle</th>
                <th className="px-3 py-3">Permit Type</th>
                <th className="px-3 py-3">Issued State</th>
                <th className="px-3 py-3">Valid Until</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-border-card">
            {listQuery.isLoading ? (
              <tr>
                <td colSpan={tableColSpan} className="px-3 py-8 text-center text-text-secondary">
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                </td>
              </tr>
            ) : listQuery.isError ? (
              <tr>
                <td colSpan={tableColSpan} className="px-3 py-8 text-center text-accent-red">
                  {isAxiosError(listQuery.error)
                    ? String((listQuery.error.response?.data as { message?: string })?.message)
                    : 'Could not load data'}
                </td>
              </tr>
            ) : !listQuery.data?.items.length ? (
              <tr>
                <td colSpan={tableColSpan} className="px-3 py-8 text-center text-text-secondary">
                  <EmptyState
                    icon={<ShieldAlert className="h-16 w-16" strokeWidth={1.2} />}
                    title={tab === 'insurance' ? 'No policies tracked' : 'No records yet'}
                    description={
                      tab === 'insurance'
                        ? 'Add your first insurance policy to start tracking renewals.'
                        : 'Add your first record to start compliance tracking.'
                    }
                    action={<Button onClick={openAdd}>{tab === 'insurance' ? 'Add Policy' : 'Add Record'}</Button>}
                  />
                </td>
              </tr>
            ) : tab === 'insurance' ? (
              (listQuery.data.items as InsuranceListItem[]).map((row) => (
                <tr key={row.id} className="text-text-primary">
                  <td className="px-3 py-2 font-medium">{row.clientName}</td>
                  <td className="px-3 py-2">{row.vehicleNumber}</td>
                  <td className="px-3 py-2">{row.policyNumber}</td>
                  <td className="px-3 py-2">{row.insurer}</td>
                  <td className="px-3 py-2">{row.policyType}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDisplayDate(row.expiryDate)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => sendReminder(row)}>
                        Send Reminder
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRenew(row.id, row.expiryDate)}
                      >
                        Mark as Renewed
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-accent-red hover:bg-accent-red/10"
                        onClick={() => setPendingDeleteId(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : tab === 'fitness' ? (
              (listQuery.data.items as FitnessListItem[]).map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-medium">{row.clientName}</td>
                  <td className="px-3 py-2">{row.vehicleNumber}</td>
                  <td className="px-3 py-2">{row.certificateNumber}</td>
                  <td className="px-3 py-2">{row.issuedBy}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.validFrom ? formatDisplayDate(row.validFrom) : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatDisplayDate(row.expiryDate)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => sendReminder(row)}>
                        Send Reminder
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRenew(row.id, row.expiryDate)}
                      >
                        Mark as Renewed
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-accent-red hover:bg-accent-red/10"
                        onClick={() => setPendingDeleteId(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : tab === 'puc' ? (
              (listQuery.data.items as PucListItem[]).map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-medium">{row.clientName}</td>
                  <td className="px-3 py-2">{row.vehicleNumber}</td>
                  <td className="px-3 py-2">{row.pucNumber}</td>
                  <td className="px-3 py-2">{row.testCenter}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDisplayDate(row.expiryDate)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => sendReminder(row)}>
                        Send Reminder
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRenew(row.id, row.expiryDate)}
                      >
                        Mark as Renewed
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-accent-red hover:bg-accent-red/10"
                        onClick={() => setPendingDeleteId(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              (listQuery.data.items as PermitListItem[]).map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-medium">{row.clientName}</td>
                  <td className="px-3 py-2">{row.vehicleNumber}</td>
                  <td className="px-3 py-2">{row.permitType}</td>
                  <td className="px-3 py-2">{row.issuedState}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDisplayDate(row.expiryDate)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => sendReminder(row)}>
                        Send Reminder
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRenew(row.id, row.expiryDate)}
                      >
                        Mark as Renewed
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-accent-red hover:bg-accent-red/10"
                        onClick={() => setPendingDeleteId(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) resetForms()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border-card bg-bg-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{addTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs text-text-secondary">Client</label>
              <input
                value={clientId ? (clientsPicker.data?.items.find((c) => c.id === clientId)?.name ?? '') : clientSearch}
                onChange={(e) => {
                  setClientId('')
                  setVehicleId('')
                  setClientSearch(e.target.value)
                }}
                placeholder="Search name or phone…"
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
              />
              {!clientId && debouncedClientSearch ? (
                <ul className="mt-1 max-h-36 overflow-auto rounded border border-border-card bg-bg-app py-1">
                  {clientsPicker.data?.items.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-bg-card"
                        onClick={() => {
                          setClientId(c.id)
                          setVehicleId('')
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
            {clientId ? (
              <div>
                <label className="text-xs text-text-secondary">Vehicle</label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                >
                  <option value="">Select vehicle…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} — {v.make} {v.model}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {tab === 'insurance' ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-text-secondary">Policy number</label>
                    <input
                      value={insPolicyNumber}
                      onChange={(e) => setInsPolicyNumber(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Insurer</label>
                    <input
                      value={insInsurer}
                      onChange={(e) => setInsInsurer(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary">Policy type</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(['Third Party', 'Comprehensive'] as const).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setInsPolicyType(pt)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs font-medium',
                          insPolicyType === pt
                            ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                            : 'border-border-card',
                        )}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Premium (₹)</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">₹</span>
                    <input
                      value={insPremium}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.,]/g, '')
                        const n = Number(raw.replace(/,/g, ''))
                        setInsPremium(Number.isFinite(n) && n > 0 ? formatInr(n) : raw)
                      }}
                      className="w-full rounded-md border border-border-card bg-bg-app py-2 pl-8 pr-3"
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-text-secondary">Start date</label>
                    <input
                      type="date"
                      value={insStart}
                      onChange={(e) => setInsStart(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Expiry date</label>
                    <input
                      type="date"
                      value={insExpiry}
                      onChange={(e) => setInsExpiry(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                </div>
              </>
            ) : tab === 'fitness' ? (
              <>
                <div>
                  <label className="text-xs text-text-secondary">Certificate number</label>
                  <input
                    value={fitCert}
                    onChange={(e) => setFitCert(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Issued by (RTO)</label>
                  <input
                    value={fitIssuedBy}
                    onChange={(e) => setFitIssuedBy(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-text-secondary">Valid from</label>
                    <input
                      type="date"
                      value={fitValidFrom}
                      onChange={(e) => setFitValidFrom(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Valid to</label>
                    <input
                      type="date"
                      value={fitValidTo}
                      onChange={(e) => setFitValidTo(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                </div>
              </>
            ) : tab === 'puc' ? (
              <>
                <div>
                  <label className="text-xs text-text-secondary">PUC number</label>
                  <input
                    value={pucNum}
                    onChange={(e) => setPucNum(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Test center</label>
                  <input
                    value={pucCenter}
                    onChange={(e) => setPucCenter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Valid until</label>
                  <input
                    type="date"
                    value={pucUntil}
                    onChange={(e) => setPucUntil(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs text-text-secondary">Permit type</label>
                  <input
                    value={permitType}
                    onChange={(e) => setPermitType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Issued state</label>
                  <input
                    value={permitState}
                    onChange={(e) => setPermitState(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Valid until</label>
                  <input
                    type="date"
                    value={permitUntil}
                    onChange={(e) => setPermitUntil(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
              </>
            )}

            {formError ? <p className="text-sm text-accent-red">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-accent-blue text-white"
              disabled={createMut.isPending}
              onClick={submitAdd}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (!o) {
            setEditId(null)
            resetForms()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border-card bg-bg-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit record</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs text-text-secondary">Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleNumber} — {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            {tab === 'insurance' ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-text-secondary">Policy number</label>
                    <input
                      value={insPolicyNumber}
                      onChange={(e) => setInsPolicyNumber(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Insurer</label>
                    <input
                      value={insInsurer}
                      onChange={(e) => setInsInsurer(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-xs text-text-secondary">Policy type</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(['Third Party', 'Comprehensive'] as const).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setInsPolicyType(pt)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs font-medium',
                          insPolicyType === pt
                            ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                            : 'border-border-card',
                        )}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Premium (₹)</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">₹</span>
                    <input
                      value={insPremium}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.,]/g, '')
                        const n = Number(raw.replace(/,/g, ''))
                        setInsPremium(Number.isFinite(n) && n > 0 ? formatInr(n) : raw)
                      }}
                      className="w-full rounded-md border border-border-card bg-bg-app py-2 pl-8 pr-3"
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-text-secondary">Start date</label>
                    <input
                      type="date"
                      value={insStart}
                      onChange={(e) => setInsStart(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Expiry date</label>
                    <input
                      type="date"
                      value={insExpiry}
                      onChange={(e) => setInsExpiry(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                </div>
              </>
            ) : tab === 'fitness' ? (
              <>
                <div>
                  <label className="text-xs text-text-secondary">Certificate number</label>
                  <input
                    value={fitCert}
                    onChange={(e) => setFitCert(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Issued by</label>
                  <input
                    value={fitIssuedBy}
                    onChange={(e) => setFitIssuedBy(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-text-secondary">Valid from</label>
                    <input
                      type="date"
                      value={fitValidFrom}
                      onChange={(e) => setFitValidFrom(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Valid to</label>
                    <input
                      type="date"
                      value={fitValidTo}
                      onChange={(e) => setFitValidTo(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                    />
                  </div>
                </div>
              </>
            ) : tab === 'puc' ? (
              <>
                <div>
                  <label className="text-xs text-text-secondary">PUC number</label>
                  <input
                    value={pucNum}
                    onChange={(e) => setPucNum(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Test center</label>
                  <input
                    value={pucCenter}
                    onChange={(e) => setPucCenter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Valid until</label>
                  <input
                    type="date"
                    value={pucUntil}
                    onChange={(e) => setPucUntil(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs text-text-secondary">Permit type</label>
                  <input
                    value={permitType}
                    onChange={(e) => setPermitType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Issued state</label>
                  <input
                    value={permitState}
                    onChange={(e) => setPermitState(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary">Valid until</label>
                  <input
                    type="date"
                    value={permitUntil}
                    onChange={(e) => setPermitUntil(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
                  />
                </div>
              </>
            )}
            {formError ? <p className="text-sm text-accent-red">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-accent-blue text-white"
              disabled={updateMut.isPending}
              onClick={submitEdit}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renewOpen}
        onOpenChange={(o) => {
          setRenewOpen(o)
          if (!o) {
            setRenewId(null)
            setRenewDate('')
            setFormError(null)
          }
        }}
      >
        <DialogContent className="border-border-card bg-bg-card text-text-primary sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as renewed</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="text-xs text-text-secondary">New expiry date</label>
            <input
              type="date"
              value={renewDate}
              onChange={(e) => setRenewDate(e.target.value)}
              className="w-full rounded-md border border-border-card bg-bg-app px-3 py-2"
            />
            {formError ? <p className="text-sm text-accent-red">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenewOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-accent-green text-white"
              disabled={renewMut.isPending || !renewId || !renewDate}
              onClick={() => {
                setFormError(null)
                if (renewId) renewMut.mutate({ id: renewId, expiryDate: renewDate })
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeleteId)} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected compliance record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDeleteId && deleteMut.mutate(pendingDeleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
