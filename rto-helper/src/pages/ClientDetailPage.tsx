import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ClipboardList, FileText, Pencil, Plus } from 'lucide-react'
import { startTransition, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createVehicle,
  fetchClient,
  updateClient,
} from '@/api/clients'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'
import { INDIAN_STATES, formatVehicleType } from '@/lib/indianStates'
import { timeAgo } from '@/lib/timeAgo'
import { cn } from '@/lib/utils'

const tabs = ['Vehicles', 'Insurance', 'Forms', 'Quotes', 'Notes'] as const

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<(typeof tabs)[number]>('Vehicles')

  const detail = useQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id!),
    enabled: !!id,
  })

  const [notes, setNotes] = useState('')
  const notesSeededForClient = useRef<string | null>(null)

  useEffect(() => {
    if (!id || !detail.data || detail.data.id !== id) return
    if (notesSeededForClient.current === id) return
    setNotes(detail.data.notes ?? '')
    notesSeededForClient.current = id
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per client id + server notes snapshot
  }, [id, detail.data?.id, detail.data?.notes])

  useEffect(() => {
    notesSeededForClient.current = null
  }, [id])

  useEffect(() => {
    if (!id || !detail.data) return
    const server = detail.data.notes ?? ''
    if (notes === server) return
    const h = setTimeout(() => {
      updateClient(id, { notes })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['client', id] })
        })
        .catch(() => {})
    }, 800)
    return () => clearTimeout(h)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, id, detail.data?.notes, queryClient])

  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [vn, setVn] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [fuel, setFuel] = useState('')
  const [vt, setVt] = useState('FOUR_W')
  const [chassis, setChassis] = useState('')
  const [engine, setEngine] = useState('')

  const vehicleMut = useMutation({
    mutationFn: () =>
      createVehicle(id!, {
        vehicleNumber: vn.trim(),
        make: make.trim(),
        model: model.trim(),
        year: year.trim() ? Number.parseInt(year, 10) : null,
        fuelType: fuel.trim() || null,
        vehicleType: vt,
        chassisNumber: chassis.trim() || null,
        engineNumber: engine.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setVehicleOpen(false)
      setVn('')
      setMake('')
      setModel('')
      setYear('')
      setFuel('')
      setVt('FOUR_W')
      setChassis('')
      setEngine('')
    },
  })

  const [editOpen, setEditOpen] = useState(false)
  const [efName, setEfName] = useState('')
  const [efPhone, setEfPhone] = useState('')
  const [efAlt, setEfAlt] = useState('')
  const [efAddr, setEfAddr] = useState('')
  const [efCity, setEfCity] = useState('')
  const [efState, setEfState] = useState('')
  const prevEditOpen = useRef(false)

  useEffect(() => {
    if (!editOpen || !detail.data) {
      prevEditOpen.current = editOpen
      return
    }
    const c = detail.data
    if (editOpen && !prevEditOpen.current) {
      startTransition(() => {
        setEfName(c.name)
        setEfPhone(c.phone ?? '')
        setEfAlt(c.alternatePhone ?? '')
        setEfAddr(c.address ?? '')
        setEfCity(c.city ?? '')
        setEfState(c.state ?? '')
      })
    }
    prevEditOpen.current = editOpen
  }, [editOpen, detail.data])

  const editMut = useMutation({
    mutationFn: () =>
      updateClient(id!, {
        name: efName.trim(),
        phone: efPhone.trim(),
        alternatePhone: efAlt.trim() || null,
        address: efAddr.trim() || null,
        city: efCity.trim() || null,
        state: efState.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setEditOpen(false)
    },
  })

  if (!id) return null

  if (detail.isLoading || !detail.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (detail.isError) {
    return (
      <div className="text-sm text-accent-red">
        {isAxiosError(detail.error) && detail.error.response?.status === 404
          ? 'Client not found'
          : 'Could not load client'}
      </div>
    )
  }

  const c = detail.data
  const editErr =
    editMut.isError && isAxiosError(editMut.error)
      ? String((editMut.error.response?.data as { message?: string })?.message ?? '')
      : ''
  const vehErr =
    vehicleMut.isError && isAxiosError(vehicleMut.error)
      ? String((vehicleMut.error.response?.data as { message?: string })?.message ?? '')
      : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{c.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">Client profile</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-border-card shrink-0"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className="rounded-lg border border-border-card bg-bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Contact
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">Phone</dt>
            <dd className="font-medium text-text-primary">{c.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Alternate phone</dt>
            <dd className="font-medium text-text-primary">{c.alternatePhone ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-text-secondary">Address</dt>
            <dd className="font-medium text-text-primary">{c.address ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">City</dt>
            <dd className="font-medium text-text-primary">{c.city ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">State</dt>
            <dd className="font-medium text-text-primary">{c.state ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="border-b border-border-card">
        <nav className="-mb-px flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition',
                tab === t
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'Vehicles' ? (
        <section className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-accent-blue text-white hover:bg-accent-blue/90"
              onClick={() => setVehicleOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add vehicle
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border-card bg-bg-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-card text-xs uppercase text-text-secondary">
                  <th className="px-4 py-2 font-medium">Number</th>
                  <th className="px-4 py-2 font-medium">Make / Model</th>
                  <th className="px-4 py-2 font-medium">Year</th>
                  <th className="px-4 py-2 font-medium">Fuel</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Chassis</th>
                  <th className="px-4 py-2 font-medium">Engine</th>
                </tr>
              </thead>
              <tbody>
                {c.vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                      No vehicles yet
                    </td>
                  </tr>
                ) : (
                  c.vehicles.map((v) => (
                    <tr key={v.id} className="border-b border-border-card/80 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{v.vehicleNumber}</td>
                      <td className="px-4 py-2 text-text-primary">
                        {v.make} {v.model}
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{v.year ?? '—'}</td>
                      <td className="px-4 py-2 text-text-secondary">{v.fuelType ?? '—'}</td>
                      <td className="px-4 py-2 text-text-secondary">
                        {formatVehicleType(v.vehicleType)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-text-secondary">
                        {v.chassisNumber ?? '—'}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-text-secondary">
                        {v.engineNumber ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'Insurance' ? (
        <section className="space-y-3">
          <p className="text-sm text-text-secondary">
            <Link className="font-medium text-accent-blue hover:underline" to="/insurance">
              Open insurance workspace
            </Link>{' '}
            for renewals and tracking.
          </p>
          <ul className="space-y-2 rounded-lg border border-border-card bg-bg-card p-4">
            {c.insurancePolicies.length === 0 ? (
              <li className="text-sm text-text-secondary">No policies linked to this client</li>
            ) : (
              c.insurancePolicies.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 border-b border-border-card/80 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-text-primary">
                      {p.insurer} · {p.policyNumber}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {p.vehicleNumber} · {p.policyType} · Expires{' '}
                      {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(
                        new Date(p.expiryDate),
                      )}
                    </p>
                  </div>
                  <Link
                    className="text-xs font-medium text-accent-blue hover:underline"
                    to={`/insurance?policyId=${encodeURIComponent(p.id)}`}
                  >
                    View in Insurance
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === 'Forms' ? (
        <section className="rounded-lg border border-border-card bg-bg-card p-4">
          <ul className="divide-y divide-border-card">
            {c.forms.length === 0 ? (
              <li className="py-6 text-center text-sm text-text-secondary">No forms yet</li>
            ) : (
              c.forms.map((f) => (
                <li key={f.id} className="flex items-start gap-3 py-3">
                  <ClipboardList className="mt-0.5 h-4 w-4 text-accent-amber" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{f.formType}</p>
                    <p className="text-xs text-text-secondary">{timeAgo(f.createdAt)}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === 'Quotes' ? (
        <section className="rounded-lg border border-border-card bg-bg-card p-4">
          <ul className="divide-y divide-border-card">
            {c.quotes.length === 0 ? (
              <li className="py-6 text-center text-sm text-text-secondary">No quotes yet</li>
            ) : (
              c.quotes.map((q) => (
                <li key={q.id} className="flex items-start gap-3 py-3">
                  <FileText className="mt-0.5 h-4 w-4 text-accent-blue" />
                  <div>
                    <p className="text-sm text-text-primary">
                      {formatVehicleType(q.vehicleType)} · {q.state} · Grand total{' '}
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                      }).format(q.grandTotal)}
                    </p>
                    <p className="text-xs text-text-secondary">{timeAgo(q.createdAt)}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === 'Notes' ? (
        <section className="rounded-lg border border-border-card bg-bg-card p-4">
          <label className="text-sm font-medium text-text-primary" htmlFor="notes-area">
            Notes
          </label>
          <p className="mt-1 text-xs text-text-secondary">Auto-saved after you stop typing</p>
          <textarea
            id="notes-area"
            rows={10}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-3 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40"
            placeholder="Internal notes about this client…"
          />
        </section>
      ) : null}

      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border-card bg-bg-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add vehicle</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              vehicleMut.mutate()
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-text-secondary">Vehicle number *</label>
                <input
                  required
                  value={vn}
                  onChange={(e) => setVn(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Make *</label>
                <input
                  required
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Model *</label>
                <input
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Year</label>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Fuel type</label>
                <input
                  value={fuel}
                  onChange={(e) => setFuel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Vehicle type *</label>
                <select
                  required
                  value={vt}
                  onChange={(e) => setVt(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                >
                  <option value="TWO_W">Two wheeler</option>
                  <option value="FOUR_W">Four wheeler</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="EV">Electric</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-text-secondary">Chassis no.</label>
                <input
                  value={chassis}
                  onChange={(e) => setChassis(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-text-secondary">Engine no.</label>
                <input
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
            </div>
            {vehErr ? <p className="text-sm text-accent-red">{vehErr}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVehicleOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-accent-blue text-white"
                disabled={vehicleMut.isPending}
              >
                Save vehicle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-border-card bg-bg-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!efName.trim() || !efPhone.trim() || !efState.trim()) return
              editMut.mutate()
            }}
          >
            <div>
              <label className="text-xs text-text-secondary">Full name *</label>
              <input
                required
                value={efName}
                onChange={(e) => setEfName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Phone *</label>
              <input
                required
                value={efPhone}
                onChange={(e) => setEfPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Alternate phone</label>
              <input
                value={efAlt}
                onChange={(e) => setEfAlt(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Address</label>
              <textarea
                rows={2}
                value={efAddr}
                onChange={(e) => setEfAddr(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-text-secondary">City</label>
                <input
                  value={efCity}
                  onChange={(e) => setEfCity(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">State *</label>
                <select
                  required
                  value={efState}
                  onChange={(e) => setEfState(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                >
                  <option value="">Select</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {editErr ? <p className="text-sm text-accent-red">{editErr}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-accent-blue text-white" disabled={editMut.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
