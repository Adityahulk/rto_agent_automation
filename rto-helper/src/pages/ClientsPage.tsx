import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Plus, Search, Users } from 'lucide-react'
import { startTransition, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createClient,
  deleteClient,
  fetchClient,
  fetchClients,
  updateClient,
} from '@/api/clients'
import type { ClientListItem } from '@/api/clients'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { INDIAN_STATES, VEHICLE_TYPE_OPTIONS } from '@/lib/indianStates'
import { cn } from '@/lib/utils'

function formatActivity(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function ClientsPage() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editId, setEditId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ClientListItem | null>(null)

  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAltPhone, setFormAltPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formState, setFormState] = useState('')
  const prevEditModalOpen = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    startTransition(() => setPage(1))
  }, [debouncedSearch, stateFilter, vehicleTypeFilter])

  const listQuery = useQuery({
    queryKey: ['clients', debouncedSearch, stateFilter, vehicleTypeFilter, page],
    queryFn: () =>
      fetchClients({
        search: debouncedSearch,
        state: stateFilter || undefined,
        vehicleType: vehicleTypeFilter || undefined,
        page,
        pageSize,
      }),
  })

  const editQuery = useQuery({
    queryKey: ['client', editId],
    queryFn: () => fetchClient(editId!),
    enabled: modalOpen && modalMode === 'edit' && !!editId,
  })

  const createMut = useMutation({
    mutationFn: () =>
      createClient({
        name: formName.trim(),
        phone: formPhone.trim(),
        state: formState.trim(),
        alternatePhone: formAltPhone.trim() || null,
        address: formAddress.trim() || null,
        city: formCity.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setModalOpen(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: () =>
      updateClient(editId!, {
        name: formName.trim(),
        phone: formPhone.trim(),
        state: formState.trim(),
        alternatePhone: formAltPhone.trim() || null,
        address: formAddress.trim() || null,
        city: formCity.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client', editId] })
      setModalOpen(false)
      setEditId(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setPendingDelete(null)
    },
  })

  function openAdd() {
    setFormName('')
    setFormPhone('')
    setFormAltPhone('')
    setFormAddress('')
    setFormCity('')
    setFormState('')
    setModalMode('add')
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(c: ClientListItem) {
    setModalMode('edit')
    setEditId(c.id)
    setModalOpen(true)
  }

  useEffect(() => {
    const isEditOpen = modalOpen && modalMode === 'edit'
    const c = editQuery.data
    if (isEditOpen && !prevEditModalOpen.current && c) {
      startTransition(() => {
        setFormName(c.name)
        setFormPhone(c.phone ?? '')
        setFormAltPhone(c.alternatePhone ?? '')
        setFormAddress(c.address ?? '')
        setFormCity(c.city ?? '')
        setFormState(c.state ?? '')
      })
    }
    prevEditModalOpen.current = isEditOpen
  }, [modalOpen, modalMode, editQuery.data])

  function onSubmitModal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!formName.trim() || !formPhone.trim() || !formState.trim()) return
    if (modalMode === 'add') createMut.mutate()
    else updateMut.mutate()
  }

  function onDelete(c: ClientListItem) {
    setPendingDelete(c)
  }

  const modalError =
    (createMut.isError && isAxiosError(createMut.error)
      ? createMut.error.response?.data
      : null) ??
    (updateMut.isError && isAxiosError(updateMut.error)
      ? updateMut.error.response?.data
      : null)
  const modalErrorMsg =
    modalError && typeof modalError === 'object' && 'message' in modalError
      ? String((modalError as { message: string }).message)
      : null

  const totalPages = listQuery.data
    ? Math.max(1, Math.ceil(listQuery.data.total / pageSize))
    : 1

  const stateOptions = listQuery.data?.states?.length
    ? [...new Set([...INDIAN_STATES, ...listQuery.data.states])].sort()
    : INDIAN_STATES

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">My Clients</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage your client records</p>
        </div>
        <Button
          type="button"
          className="shrink-0 bg-accent-blue text-white hover:bg-accent-blue/90"
          onClick={openAdd}
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border-card bg-bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-medium text-text-secondary" htmlFor="client-search">
            Search
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              id="client-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name or phone"
              className={cn(
                'w-full rounded-md border border-border-card bg-bg-app py-2 pl-9 pr-3 text-sm text-text-primary',
                'placeholder:text-text-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40',
              )}
            />
          </div>
        </div>
        <div className="w-full sm:w-44">
          <label className="text-xs font-medium text-text-secondary" htmlFor="state-filter">
            State
          </label>
          <select
            id="state-filter"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40"
          >
            <option value="">All states</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-44">
          <label className="text-xs font-medium text-text-secondary" htmlFor="vt-filter">
            Vehicle type
          </label>
          <select
            id="vt-filter"
            value={vehicleTypeFilter}
            onChange={(e) => setVehicleTypeFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40"
          >
            {VEHICLE_TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-card bg-bg-card">
        {listQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-10 w-full" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="p-8 text-center text-sm text-accent-red">Failed to load clients</div>
        ) : listQuery.data && listQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-20 w-20" strokeWidth={1} />}
            title="No clients yet"
            description="Start building your client base by adding the first customer."
            action={
              <Button type="button" className="bg-accent-blue text-white hover:bg-accent-blue/90" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add First Client
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-card text-xs uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Vehicle Count</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium">Last Activity</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data?.items.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border-card/80 last:border-0 hover:bg-bg-app/40"
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{c.phone ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-text-primary">{c.vehicleCount}</td>
                      <td className="px-4 py-3 text-text-secondary">{c.state ?? '—'}</td>
                      <td className="px-4 py-3 text-text-secondary">{formatActivity(c.lastActivity)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="text-xs font-medium text-accent-blue hover:underline"
                            to={`/clients/${c.id}`}
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            className="text-xs font-medium text-text-secondary hover:text-text-primary"
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-accent-red hover:underline"
                            onClick={() => onDelete(c)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listQuery.data && listQuery.data.total > pageSize ? (
              <div className="flex items-center justify-between border-t border-border-card px-4 py-3 text-sm text-text-secondary">
                <span>
                  Page {page} of {totalPages} ({listQuery.data.total} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border-card"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border-card"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border-card bg-bg-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{modalMode === 'add' ? 'Add client' : 'Edit client'}</DialogTitle>
          </DialogHeader>
          {modalMode === 'edit' && editQuery.isLoading ? <Skeleton className="h-8 w-full" /> : null}
          {modalMode === 'edit' && editQuery.isError ? (
            <p className="text-sm text-accent-red">Could not load client for editing</p>
          ) : null}
          {modalMode === 'add' || (modalMode === 'edit' && editQuery.data) ? (
          <form className="space-y-3" onSubmit={onSubmitModal}>
            <div>
              <label className="text-xs font-medium text-text-secondary" htmlFor="c-name">
                Full name *
              </label>
              <input
                id="c-name"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary" htmlFor="c-phone">
                Phone number *
              </label>
              <input
                id="c-phone"
                required
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary" htmlFor="c-alt">
                Alternate phone
              </label>
              <input
                id="c-alt"
                value={formAltPhone}
                onChange={(e) => setFormAltPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary" htmlFor="c-addr">
                Address
              </label>
              <textarea
                id="c-addr"
                rows={2}
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-text-secondary" htmlFor="c-city">
                  City
                </label>
                <input
                  id="c-city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary" htmlFor="c-state">
                  State *
                </label>
                <select
                  id="c-state"
                  required
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {modalErrorMsg ? (
              <p className="text-sm text-accent-red" role="alert">
                {modalErrorMsg}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="border-border-card"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-accent-blue text-white hover:bg-accent-blue/90"
                disabled={createMut.isPending || updateMut.isPending}
              >
                {modalMode === 'add' ? 'Save client' : 'Update client'}
              </Button>
            </DialogFooter>
          </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This will permanently remove ${pendingDelete.name} and related records.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
