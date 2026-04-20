import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { FileText } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchClient, fetchClients } from '@/api/clients'
import {
  deleteSavedForm,
  downloadSavedFormPdf,
  fetchRecentForms,
  generateFormPdf,
  saveFormRecord,
  type FormType,
} from '@/api/forms'
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

const FORM_CARDS: {
  type: FormType
  num: string
  title: string
  description: string
}[] = [
  {
    type: 'FORM_20',
    num: '20',
    title: 'Application for Registration of Motor Vehicle',
    description: 'New vehicle registration application with owner and vehicle particulars.',
  },
  {
    type: 'FORM_21',
    num: '21',
    title: 'Sale Certificate',
    description: 'Certificate of sale from dealer to buyer including vehicle identity.',
  },
  {
    type: 'FORM_29',
    num: '29',
    title: 'Notice of Transfer of Ownership',
    description: 'Seller notice to RTO regarding transfer of ownership.',
  },
  {
    type: 'FORM_30',
    num: '30',
    title: 'Intimation of Transfer of Ownership',
    description: 'Buyer intimation to RTO; includes signature date and jurisdiction.',
  },
]

const ALL_KEYS = [
  'ownerName',
  'fatherOrHusbandName',
  'fullAddress',
  'pinCode',
  'state',
  'vehicleMake',
  'model',
  'variant',
  'chassisNo',
  'engineNo',
  'fuelType',
  'color',
  'invoiceNo',
  'invoiceDate',
  'dealerName',
  'dealerAddress',
  'buyerName',
  'buyerAddress',
  'vehicleDescription',
  'salePrice',
  'saleDate',
  'sellerName',
  'sellerAddress',
  'vehicleRegNo',
  'rcBookDetails',
  'hypothecation',
  'financerName',
  'dateOfTransfer',
  'ownerSignatureDate',
  'rtoJurisdiction',
] as const

type FieldKey = (typeof ALL_KEYS)[number]

function emptyFields(): Record<FieldKey, string> {
  const o = {} as Record<FieldKey, string>
  for (const k of ALL_KEYS) o[k] = ''
  o.hypothecation = 'no'
  return o
}

const F20_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'ownerName', label: 'Owner Name' },
  { key: 'fatherOrHusbandName', label: "Father's / Husband's Name" },
  { key: 'fullAddress', label: 'Full Address' },
  { key: 'pinCode', label: 'PIN Code' },
  { key: 'state', label: 'State' },
  { key: 'vehicleMake', label: 'Vehicle Make' },
  { key: 'model', label: 'Model' },
  { key: 'variant', label: 'Variant' },
  { key: 'chassisNo', label: 'Chassis No.' },
  { key: 'engineNo', label: 'Engine No.' },
  { key: 'fuelType', label: 'Fuel Type' },
  { key: 'color', label: 'Color' },
  { key: 'invoiceNo', label: 'Invoice No.' },
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'dealerName', label: 'Dealer Name' },
  { key: 'dealerAddress', label: 'Dealer Address' },
]

const F21_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'dealerName', label: 'Dealer Name' },
  { key: 'dealerAddress', label: 'Dealer Address' },
  { key: 'buyerName', label: 'Buyer Name' },
  { key: 'buyerAddress', label: 'Buyer Address' },
  { key: 'vehicleDescription', label: 'Vehicle Description' },
  { key: 'chassisNo', label: 'Chassis No.' },
  { key: 'engineNo', label: 'Engine No.' },
  { key: 'salePrice', label: 'Sale Price' },
  { key: 'saleDate', label: 'Sale Date' },
]

const F29_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'sellerName', label: 'Seller Name' },
  { key: 'sellerAddress', label: 'Seller Address' },
  { key: 'buyerName', label: 'Buyer Name' },
  { key: 'buyerAddress', label: 'Buyer Address' },
  { key: 'vehicleRegNo', label: 'Vehicle Registration No.' },
  { key: 'rcBookDetails', label: 'RC Book details' },
  { key: 'dateOfTransfer', label: 'Date of Transfer' },
]

const F30_EXTRA: { key: FieldKey; label: string }[] = [
  { key: 'ownerSignatureDate', label: "Owner's signature date" },
  { key: 'rtoJurisdiction', label: 'RTO jurisdiction' },
]

function fieldsForForm(t: FormType): { key: FieldKey; label: string }[] {
  if (t === 'FORM_20') return F20_FIELDS
  if (t === 'FORM_21') return F21_FIELDS
  if (t === 'FORM_29') return F29_FIELDS
  return [...F29_FIELDS, ...F30_EXTRA]
}

function formatFormLabel(ft: string) {
  const m: Record<string, string> = {
    FORM_20: 'Form 20',
    FORM_21: 'Form 21',
    FORM_29: 'Form 29',
    FORM_30: 'Form 30',
  }
  return m[ft] ?? ft
}

export function FormsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [activeType, setActiveType] = useState<FormType>('FORM_20')
  const [values, setValues] = useState<Record<FieldKey, string>>(emptyFields)

  const [clientSearch, setClientSearch] = useState('')
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [vehicleId, setVehicleId] = useState('')

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [hasPreview, setHasPreview] = useState(false)
  const previewBlobRef = useRef<Blob | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [clientSearch])

  const clientsQuery = useQuery({
    queryKey: ['clients', 'forms-picker', debouncedClientSearch],
    queryFn: () => fetchClients({ search: debouncedClientSearch, page: 1, pageSize: 40 }),
    enabled: modalOpen,
  })

  const clientDetail = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClient(clientId),
    enabled: modalOpen && !!clientId,
  })

  const formsQuery = useQuery({
    queryKey: ['forms', 'recent'],
    queryFn: () => fetchRecentForms(40),
  })

  const revokePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    previewBlobRef.current = null
    setHasPreview(false)
  }, [])

  const openGenerate = (t: FormType) => {
    revokePreview()
    setActiveType(t)
    setValues(emptyFields())
    setClientId('')
    setVehicleId('')
    setClientSearch('')
    setPreviewError(null)
    setSaveError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    revokePreview()
    setModalOpen(false)
  }

  const setField = (key: FieldKey, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  const vehicles = clientDetail.data?.vehicles ?? []

  useEffect(() => {
    if (!clientId || !vehicleId || !clientDetail.data) return
    const c = clientDetail.data
    const v = clientDetail.data.vehicles.find((x) => x.id === vehicleId)
    if (!v) return
    const addr = [c.address, c.city, c.state].filter(Boolean).join(', ')

    setValues((prev) => {
      const next = { ...prev }
      if (activeType === 'FORM_20') {
        next.ownerName = c.name
        next.fatherOrHusbandName = ''
        next.fullAddress = addr
        next.pinCode = ''
        next.state = c.state ?? ''
        next.vehicleMake = v.make
        next.model = v.model
        next.variant = ''
        next.chassisNo = v.chassisNumber ?? ''
        next.engineNo = v.engineNumber ?? ''
        next.fuelType = v.fuelType ?? ''
        next.color = ''
      } else if (activeType === 'FORM_21') {
        next.buyerName = c.name
        next.buyerAddress = addr
        next.vehicleDescription = `${v.make} ${v.model}`.trim()
        next.chassisNo = v.chassisNumber ?? ''
        next.engineNo = v.engineNumber ?? ''
      } else if (activeType === 'FORM_29' || activeType === 'FORM_30') {
        next.buyerName = c.name
        next.buyerAddress = addr
        next.vehicleRegNo = v.vehicleNumber
        next.rcBookDetails = ''
      }
      return next
    })
  }, [clientId, vehicleId, clientDetail.data, activeType])

  const fieldRows = useMemo(() => fieldsForForm(activeType), [activeType])

  const buildPayload = useCallback(() => {
    const o: Record<string, string> = {}
    for (const k of ALL_KEYS) o[k] = values[k] ?? ''
    if (activeType === 'FORM_29' || activeType === 'FORM_30') {
      o.financerName = values.hypothecation === 'yes' ? values.financerName : ''
    }
    return o
  }, [values, activeType])

  const runPreview = async () => {
    setPreviewError(null)
    setPreviewLoading(true)
    revokePreview()
    try {
      const buf = await generateFormPdf(activeType, buildPayload())
      const copy = new Uint8Array(buf.byteLength)
      copy.set(new Uint8Array(buf))
      const blob = new Blob([copy], { type: 'application/pdf' })
      previewBlobRef.current = blob
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setHasPreview(true)
    } catch (e) {
      let msg = 'Failed to render PDF'
      if (isAxiosError(e) && e.response?.data instanceof ArrayBuffer) {
        try {
          const j = JSON.parse(new TextDecoder().decode(e.response.data)) as { message?: string }
          msg = j.message ?? msg
        } catch {
          msg = e.message
        }
      } else if (e instanceof Error) msg = e.message
      setPreviewError(msg)
    } finally {
      setPreviewLoading(false)
    }
  }

  const saveMut = useMutation({
    mutationFn: () =>
      saveFormRecord({
        formType: activeType,
        formData: buildPayload(),
        clientId: clientId || null,
        vehicleId: vehicleId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      setSaveError(null)
      closeModal()
    },
    onError: (e) => {
      setSaveError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Save failed')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSavedForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      setPendingDeleteId(null)
    },
    onError: () => {
      setPendingDeleteId(null)
    },
  })

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPreview = () => {
    const b = previewBlobRef.current
    if (!b) return
    downloadBlob(b, `${activeType.toLowerCase()}.pdf`)
  }

  const downloadRow = async (id: string) => {
    const blob = await downloadSavedFormPdf(id)
    downloadBlob(blob, `form-${id}.pdf`)
  }

  const cardTitle = FORM_CARDS.find((c) => c.type === activeType)?.title ?? 'Form'

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">RTO forms</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Generate filled PDFs from templates. Optionally link a client to autofill details.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FORM_CARDS.map((c) => (
          <div
            key={c.type}
            className="flex flex-col rounded-lg border border-border-card bg-bg-card p-5 shadow-sm"
          >
            <p className="text-4xl font-bold tabular-nums text-accent-blue">{c.num}</p>
            <h2 className="mt-2 text-base font-semibold text-text-primary">{c.title}</h2>
            <p className="mt-2 flex-1 text-sm text-text-secondary">{c.description}</p>
            <Button
              type="button"
              className="mt-4 w-full bg-accent-blue text-white hover:bg-accent-blue/90"
              onClick={() => openGenerate(c.type)}
            >
              Generate
            </Button>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Recent forms</h2>
        <div className="overflow-x-auto rounded-lg border border-border-card bg-bg-card">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border-card bg-bg-app text-xs font-medium uppercase text-text-secondary">
              <tr>
                <th className="px-3 py-3">Form type</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Vehicle</th>
                <th className="px-3 py-3">Generated on</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {formsQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : formsQuery.data?.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                    <EmptyState
                      icon={<FileText className="h-16 w-16" strokeWidth={1.2} />}
                      title="No forms generated"
                      description="Create and save your first RTO form from the generator above."
                      action={
                        <Button type="button" onClick={() => openGenerate('FORM_20')}>
                          Generate a Form
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                formsQuery.data?.items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-medium text-text-primary">{formatFormLabel(row.formType)}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.clientName ?? '—'}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.vehicleNumber ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-text-secondary">
                      {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
                        new Date(row.createdAt),
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!row.hasFile}
                          onClick={() => void downloadRow(row.id)}
                        >
                          Download
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
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
      >
        <DialogContent className="max-h-[95vh] max-w-4xl overflow-y-auto border-border-card bg-bg-card text-text-primary">
          <DialogHeader>
            <DialogTitle>Generate {formatFormLabel(activeType)}</DialogTitle>
            <p className="text-sm text-text-secondary">{cardTitle}</p>
          </DialogHeader>

          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-text-primary">1. Select client (optional)</h3>
              <div className="mt-2 space-y-2">
                <input
                  value={clientId ? (clientsQuery.data?.items.find((x) => x.id === clientId)?.name ?? '') : clientSearch}
                  onChange={(e) => {
                    setClientId('')
                    setVehicleId('')
                    setClientSearch(e.target.value)
                  }}
                  placeholder="Search client by name or phone…"
                  className="w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                />
                {!clientId && debouncedClientSearch ? (
                  <ul className="max-h-36 overflow-auto rounded-md border border-border-card bg-bg-app py-1 text-sm">
                    {clientsQuery.data?.items.map((c) => (
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
                {clientId ? (
                  <div>
                    <label className="text-xs text-text-secondary">Vehicle (for autofill)</label>
                    <select
                      value={vehicleId}
                      onChange={(e) => setVehicleId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
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
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-text-primary">2. Form fields</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {fieldRows.map((f) => (
                  <label key={f.key} className="block text-xs">
                    <span className="text-text-secondary">{f.label}</span>
                    <input
                      value={values[f.key]}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary"
                    />
                  </label>
                ))}
              </div>
              {(activeType === 'FORM_29' || activeType === 'FORM_30') && (
                <div className="mt-4 space-y-3">
                  <div>
                    <span className="text-xs font-medium text-text-secondary">Hypothecation</span>
                    <div className="mt-1 flex gap-2">
                      {(['no', 'yes'] as const).map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setField('hypothecation', h)}
                          className={cn(
                            'rounded-md border px-3 py-1.5 text-xs font-medium',
                            values.hypothecation === h
                              ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                              : 'border-border-card text-text-secondary',
                          )}
                        >
                          {h === 'yes' ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {values.hypothecation === 'yes' ? (
                    <label className="block text-xs sm:col-span-2">
                      <span className="text-text-secondary">Financer name</span>
                      <input
                        value={values.financerName}
                        onChange={(e) => setField('financerName', e.target.value)}
                        className="mt-1 w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
                      />
                    </label>
                  ) : null}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-2 border-t border-border-card pt-4">
              <Button type="button" variant="outline" disabled={previewLoading} onClick={() => void runPreview()}>
                {previewLoading ? 'Rendering…' : 'Preview PDF'}
              </Button>
              <Button type="button" variant="outline" disabled={!hasPreview} onClick={downloadPreview}>
                Download PDF
              </Button>
              <Button
                type="button"
                className="bg-accent-green text-white hover:bg-accent-green/90"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                Save to Client
              </Button>
            </div>
            {previewError ? <p className="text-sm text-accent-red">{previewError}</p> : null}
            {saveError ? <p className="text-sm text-accent-red">{saveError}</p> : null}

            {previewUrl ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-text-secondary">Preview</p>
                <iframe title="PDF preview" src={previewUrl} className="h-[min(520px,55vh)] w-full rounded-md border border-border-card bg-bg-app" />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeleteId)} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved form?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved record and file. This action cannot be undone.
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
