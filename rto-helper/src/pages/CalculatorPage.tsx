import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchClients } from '@/api/clients'
import { fetchFeeCalculate, saveFeeCalculation } from '@/api/fees'
import type { FeeCalculateResponse } from '@/api/fees'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { INDIA_STATES_AND_UTS } from '@/lib/indiaRegions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const VEHICLE_CATS = [
  { key: 'TWO_W', label: '2-Wheeler' },
  { key: 'FOUR_W', label: '4-Wheeler' },
  { key: 'COMMERCIAL', label: 'Commercial' },
  { key: 'EV', label: 'EV' },
] as const

const FUELS = [
  { key: 'petrol', label: 'Petrol' },
  { key: 'diesel', label: 'Diesel' },
  { key: 'cng', label: 'CNG' },
  { key: 'electric', label: 'Electric' },
] as const

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function parseInvoiceInput(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, '').replace(/^\s*₹?\s*/, ''))
  return Number.isFinite(n) ? n : 0
}

function vehicleTypeQueryParam(v: string) {
  if (v === 'FOUR_W') return '4W'
  if (v === 'TWO_W') return '2W'
  return v
}

function waVehicleLabel(vt: string) {
  const m: Record<string, string> = {
    TWO_W: '2-Wheeler',
    FOUR_W: '4-Wheeler',
    COMMERCIAL: 'Commercial',
    EV: 'EV',
  }
  return m[vt] ?? vt
}

function ToggleRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { key: string; label: string }[]
  value: string
  onChange: (k: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              'rounded-md border px-3 py-2 text-sm font-medium transition',
              value === o.key
                ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                : 'border-border-card bg-bg-app text-text-secondary hover:border-border-card hover:text-text-primary',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CalculatorPage() {
  const businessName = useAuthStore((s) => s.businessName)
  const queryClient = useQueryClient()

  const [stateQ, setStateQ] = useState('')
  const [stateOpen, setStateOpen] = useState(false)
  const [stateVal, setStateVal] = useState('')
  const stateWrapRef = useRef<HTMLDivElement>(null)

  const [vehicleCat, setVehicleCat] = useState<string>('FOUR_W')
  const [fuel, setFuel] = useState('petrol')
  const [invoiceDisplay, setInvoiceDisplay] = useState('')
  const [regType, setRegType] = useState<'new' | 'transfer'>('new')
  const [ownerType, setOwnerType] = useState<'individual' | 'company'>('individual')

  const [result, setResult] = useState<FeeCalculateResponse | null>(null)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [agentFee, setAgentFee] = useState(0)

  const [saveOpen, setSaveOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [clientSearch])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!stateWrapRef.current?.contains(e.target as Node)) setStateOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filteredStates = useMemo(() => {
    const q = stateQ.trim().toLowerCase()
    if (!q) return INDIA_STATES_AND_UTS
    return INDIA_STATES_AND_UTS.filter((s) => s.toLowerCase().includes(q))
  }, [stateQ])

  const calcMut = useMutation({
    mutationFn: () => {
      const price = parseInvoiceInput(invoiceDisplay)
      return fetchFeeCalculate({
        state: stateVal,
        vehicleType: vehicleTypeQueryParam(vehicleCat),
        price,
        ownerType: ownerType,
        registrationType: regType,
        fuelType: fuel,
      })
    },
    onSuccess: (data) => {
      setResult(data)
      setAgentFee(data.agentServiceFeeDefault ?? 0)
      setCalcError(null)
    },
    onError: (e) => {
      setResult(null)
      setCalcError(
        isAxiosError(e)
          ? String((e.response?.data as { message?: string })?.message ?? e.message)
          : 'Calculation failed',
      )
    },
  })

  const clientsQuery = useQuery({
    queryKey: ['clients', 'picker', debouncedClientSearch],
    queryFn: () =>
      fetchClients({ search: debouncedClientSearch, page: 1, pageSize: 50 }),
    enabled: saveOpen,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      if (!result || !selectedClientId) throw new Error('Missing data')
      const price = result.invoicePrice
      return saveFeeCalculation({
        clientId: selectedClientId,
        state: result.state,
        vehicleType: result.vehicleType,
        invoicePrice: price,
        roadTaxAmount: result.roadTax.amount,
        registrationFee: result.registrationFee.amount,
        hsrpFee: result.hsrpFee.amount,
        smartCardFee: result.smartCardFee.amount,
        handlingCharges: result.handlingCharges,
        agentServiceFee: agentFee,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client'] })
      setSaveOpen(false)
      setSelectedClientId('')
      setClientSearch('')
    },
  })

  const handling = 500
  const subtotalFees = result
    ? result.registrationFee.amount +
      result.hsrpFee.amount +
      result.smartCardFee.amount +
      handling +
      agentFee
    : 0
  const grandTotal = result ? result.invoicePrice + result.roadTax.amount + subtotalFees : 0

  const buildPdf = useCallback(async () => {
    if (!result) return
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([595, 842])
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    let y = 780
    const line = (text: string, size = 11, f = font) => {
      page.drawText(text, { x: 50, y, size, font: f, color: rgb(0.1, 0.12, 0.16) })
      y -= size + 10
    }
    line('RTO Fee Quote', 16, bold)
    line(`${result.state} · ${waVehicleLabel(result.vehicleType)}`, 12)
    line(`Invoice price: ₹${formatInr(result.invoicePrice)}`, 11)
    line(`Road tax (${result.roadTax.percent}%): ₹${formatInr(result.roadTax.amount)}`, 11)
    line(`Registration: ₹${formatInr(result.registrationFee.amount)}`, 11)
    line(`HSRP: ₹${formatInr(result.hsrpFee.amount)}`, 11)
    line(`Smart card: ₹${formatInr(result.smartCardFee.amount)}`, 11)
    line(`Handling: ₹${formatInr(handling)}`, 11)
    line(`Agent service: ₹${formatInr(agentFee)}`, 11)
    line(`TOTAL: ₹${formatInr(grandTotal)}`, 14, bold)
    const bytes = await pdf.save()
    const copy = new Uint8Array(bytes.length)
    copy.set(bytes)
    const blob = new Blob([copy], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rto-quote-${Date.now()}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }, [result, agentFee, grandTotal, handling])

  const openWhatsApp = useCallback(() => {
    if (!result) return
    const biz = businessName ?? 'Your agent'
    const vt = waVehicleLabel(result.vehicleType)
    const text = `RTO Fee Quote for ${vt} - ${result.state}
Invoice: ₹${formatInr(result.invoicePrice)} | Road Tax: ₹${formatInr(result.roadTax.amount)} | Total: ₹${formatInr(grandTotal)}
Contact: ${biz}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }, [result, grandTotal, businessName])

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6 rounded-lg border border-border-card bg-bg-card p-6">
        <h1 className="text-xl font-semibold text-text-primary">Fee calculator</h1>

        <div ref={stateWrapRef} className="relative space-y-2">
          <label className="text-xs font-medium text-text-secondary">State</label>
          <input
            value={stateOpen ? stateQ : stateVal}
            onChange={(e) => {
              setStateQ(e.target.value)
              setStateOpen(true)
            }}
            onFocus={() => {
              setStateQ(stateVal)
              setStateOpen(true)
            }}
            placeholder="Search state or UT…"
            className="w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40"
          />
          {stateOpen ? (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border-card bg-bg-card py-1 shadow-lg">
              {filteredStates.slice(0, 80).map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-app"
                    onClick={() => {
                      setStateVal(s)
                      setStateQ('')
                      setStateOpen(false)
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))}
              {filteredStates.length === 0 ? (
                <li className="px-3 py-2 text-sm text-text-secondary">No match</li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <ToggleRow
          label="Vehicle category"
          options={VEHICLE_CATS}
          value={vehicleCat}
          onChange={setVehicleCat}
        />

        <ToggleRow label="Fuel type" options={FUELS} value={fuel} onChange={setFuel} />

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">Invoice price</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">
              ₹
            </span>
            <input
              inputMode="decimal"
              value={invoiceDisplay}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.,]/g, '')
                const n = parseInvoiceInput(raw)
                setInvoiceDisplay(n > 0 ? formatInr(n) : raw.replace(/,/g, ''))
              }}
              onBlur={() => {
                const n = parseInvoiceInput(invoiceDisplay)
                if (n > 0) setInvoiceDisplay(formatInr(n))
              }}
              className="w-full rounded-md border border-border-card bg-bg-app py-2 pl-8 pr-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/40"
              placeholder="8,00,000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">Registration type</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRegType('new')}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium',
                regType === 'new'
                  ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                  : 'border-border-card bg-bg-app text-text-secondary',
              )}
            >
              New Registration
            </button>
            <button
              type="button"
              onClick={() => setRegType('transfer')}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium',
                regType === 'transfer'
                  ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                  : 'border-border-card bg-bg-app text-text-secondary',
              )}
            >
              Transfer of Ownership
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">Owner type</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOwnerType('individual')}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium',
                ownerType === 'individual'
                  ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                  : 'border-border-card bg-bg-app text-text-secondary',
              )}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setOwnerType('company')}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium',
                ownerType === 'company'
                  ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                  : 'border-border-card bg-bg-app text-text-secondary',
              )}
            >
              Company / Firm
            </button>
          </div>
        </div>

        <Button
          type="button"
          className="h-11 w-full bg-accent-blue text-white hover:bg-accent-blue/90"
          disabled={calcMut.isPending || !stateVal || parseInvoiceInput(invoiceDisplay) <= 0}
          onClick={() => calcMut.mutate()}
        >
          {calcMut.isPending ? 'Calculating…' : 'Calculate Fees'}
        </Button>
      </div>

      <div className="rounded-lg border border-border-card bg-bg-card p-6">
        {!result && !calcError ? (
          <p className="text-sm text-text-secondary">
            Run a calculation to see the fee breakdown here.
          </p>
        ) : null}
        {calcError ? (
          <p className="text-sm text-accent-red" role="alert">
            {calcError}
          </p>
        ) : null}
        {result ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">Results</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border-card">
                <tr>
                  <td className="py-2 text-text-secondary">Road Tax</td>
                  <td className="py-2 text-right text-text-secondary">{result.roadTax.percent}%</td>
                  <td className="py-2 text-right font-medium text-text-primary">
                    ₹{formatInr(result.roadTax.amount)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-text-secondary">Registration Fee</td>
                  <td className="py-2 text-right text-text-secondary">flat</td>
                  <td className="py-2 text-right font-medium text-text-primary">
                    ₹{formatInr(result.registrationFee.amount)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-text-secondary">HSRP Charges</td>
                  <td className="py-2 text-right text-text-secondary">flat</td>
                  <td className="py-2 text-right font-medium text-text-primary">
                    ₹{formatInr(result.hsrpFee.amount)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-text-secondary">Smart Card Fee</td>
                  <td className="py-2 text-right text-text-secondary">flat</td>
                  <td className="py-2 text-right font-medium text-text-primary">
                    ₹{formatInr(result.smartCardFee.amount)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-text-secondary">Handling Charges</td>
                  <td className="py-2 text-right text-text-secondary">flat</td>
                  <td className="py-2 text-right font-medium text-text-primary">₹500</td>
                </tr>
                <tr>
                  <td className="py-2 text-text-secondary">Agent Service Fee</td>
                  <td className="py-2 text-right text-text-secondary">editable</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={agentFee}
                      onChange={(e) => setAgentFee(Number(e.target.value) || 0)}
                      className="w-28 rounded border border-border-card bg-bg-app px-2 py-1 text-right text-sm text-text-primary"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="border-t border-border-card pt-4">
              <div className="flex items-center justify-between rounded-lg bg-accent-blue/15 px-4 py-4">
                <span className="text-base font-bold text-accent-blue">TOTAL</span>
                <span className="text-2xl font-bold tabular-nums text-accent-blue">
                  ₹{formatInr(grandTotal)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="border-border-card"
                onClick={() => void buildPdf()}
              >
                Generate Quote PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-border-card"
                onClick={openWhatsApp}
              >
                Send on WhatsApp
              </Button>
              <Button
                type="button"
                className="bg-accent-green text-white hover:bg-accent-green/90"
                onClick={() => setSaveOpen(true)}
              >
                Save to Client
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="border-border-card bg-bg-card text-text-primary sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save calculation to client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs text-text-secondary">Search client</label>
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Name or phone"
              className="w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
            />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm"
            >
              <option value="">Select client…</option>
              {clientsQuery.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone ?? 'no phone'}
                </option>
              ))}
            </select>
            {saveMut.isError && isAxiosError(saveMut.error) ? (
              <p className="text-sm text-accent-red">
                {(saveMut.error.response?.data as { message?: string })?.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-accent-blue text-white"
              disabled={!selectedClientId || saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
