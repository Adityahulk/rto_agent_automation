import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useMemo, useState } from 'react'
import {
  applyAdminFeeRows,
  fetchAdminFeeHistory,
  rollbackAdminFeeVersion,
  uploadAdminFeeExcel,
  type FeeUploadResponse,
} from '@/api/admin'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'

const VEHICLE_COLS = ['TWO_W', 'FOUR_W', 'COMMERCIAL', 'EV'] as const

export function AdminFeesPage() {
  const queryClient = useQueryClient()
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<FeeUploadResponse | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [rollbackId, setRollbackId] = useState<string | null>(null)

  const historyQuery = useQuery({
    queryKey: ['admin', 'fees', 'history'],
    queryFn: fetchAdminFeeHistory,
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadAdminFeeExcel(file),
    onSuccess: (data) => {
      setParsed(data)
      setUploadError(null)
    },
    onError: (e) => {
      setParsed(null)
      setUploadError(
        isAxiosError(e)
          ? String((e.response?.data as { message?: string })?.message ?? e.message)
          : 'Upload failed',
      )
    },
  })

  const applyMut = useMutation({
    mutationFn: () => {
      if (!parsed?.rows.length) throw new Error('Nothing to save')
      return applyAdminFeeRows({ rows: parsed.rows, filename: parsed.filename })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fees', 'history'] })
      setParsed(null)
    },
  })

  const rollbackMut = useMutation({
    mutationFn: (versionId: string) => rollbackAdminFeeVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fees', 'history'] })
      setRollbackId(null)
    },
  })

  const onFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0]
      if (!f) return
      uploadMut.mutate(f)
    },
    [uploadMut],
  )

  const matrix = useMemo(() => {
    const rates = historyQuery.data?.currentRates ?? []
    const states = [...new Set(rates.map((r) => r.state))].sort((a, b) => a.localeCompare(b))
    const map = new Map<string, Record<string, number>>()
    for (const r of rates) {
      if (!map.has(r.state)) map.set(r.state, {})
      map.get(r.state)![r.vehicleType] = r.roadTaxPercent
    }
    return { states, map }
  }, [historyQuery.data?.currentRates])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Fee engine</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload Excel with columns: State, Vehicle Type (2W/4W/COMMERCIAL/EV), Min Price, Max Price, Road Tax %,
          Registration Fee, HSRP Fee, Smart Card Fee.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Excel upload</h2>
        <div
          className={`rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragOver ? 'border-accent-blue bg-accent-blue/5' : 'border-border-card bg-bg-card'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            onFiles(e.dataTransfer.files)
          }}
        >
          <p className="text-sm text-text-secondary">Drag and drop an .xlsx file here, or choose a file.</p>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="mt-4 block w-full max-w-xs mx-auto text-sm text-text-secondary file:mr-3 file:rounded-md file:border file:border-border-card file:bg-bg-app file:px-3 file:py-2"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
        {uploadMut.isPending ? <p className="text-sm text-text-secondary">Parsing…</p> : null}
        {uploadError ? <p className="text-sm text-accent-red">{uploadError}</p> : null}
        {parsed?.parseWarnings?.length ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-medium">Parse warnings</p>
            <ul className="mt-1 list-inside list-disc">
              {parsed.parseWarnings.slice(0, 8).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {parsed ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Preview ({parsed.filename}) — first 10 rows
            </h2>
            <Button
              type="button"
              disabled={!parsed.rows.length || applyMut.isPending}
              onClick={() => applyMut.mutate()}
            >
              {applyMut.isPending ? 'Saving…' : 'Save rates'}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border-card bg-bg-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border-card bg-bg-app text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Min</th>
                  <th className="px-3 py-2">Max</th>
                  <th className="px-3 py-2">Tax %</th>
                  <th className="px-3 py-2">Reg</th>
                  <th className="px-3 py-2">HSRP</th>
                  <th className="px-3 py-2">Smart</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-border-card last:border-0">
                    <td className="px-3 py-2">{row.state}</td>
                    <td className="px-3 py-2">{row.vehicleType}</td>
                    <td className="px-3 py-2 tabular-nums">{row.minPrice}</td>
                    <td className="px-3 py-2 tabular-nums">{row.maxPrice}</td>
                    <td className="px-3 py-2 tabular-nums">{row.roadTaxPercent}</td>
                    <td className="px-3 py-2 tabular-nums">{row.registrationFee}</td>
                    <td className="px-3 py-2 tabular-nums">{row.hsrpFee}</td>
                    <td className="px-3 py-2 tabular-nums">{row.smartCardFee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-secondary">Total parsed rows: {parsed.rowCount}</p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Version history</h2>
        {historyQuery.isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-card bg-bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-card bg-bg-app text-xs text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Rows</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {(historyQuery.data?.versions ?? []).map((v) => (
                  <tr key={v.id} className="border-b border-border-card last:border-0">
                    <td className="px-4 py-3">{v.filename}</td>
                    <td className="px-4 py-3 tabular-nums text-text-secondary">
                      {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
                        new Date(v.uploadedAt),
                      )}
                    </td>
                    <td className="px-4 py-3">{v.rowCount}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => setRollbackId(v.id)}>
                        Rollback
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!historyQuery.data?.versions.length ? (
              <p className="p-4 text-sm text-text-secondary">No uploads yet. Save rates to create a version.</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Current road tax % by state &amp; vehicle type</h2>
        <div className="overflow-x-auto rounded-xl border border-border-card bg-bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border-card bg-bg-app text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">State</th>
                {VEHICLE_COLS.map((vt) => (
                  <th key={vt} className="px-3 py-2">
                    {vt}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.states.map((st) => (
                <tr key={st} className="border-b border-border-card last:border-0">
                  <td className="px-3 py-2 font-medium">{st}</td>
                  {VEHICLE_COLS.map((vt) => (
                    <td key={vt} className="px-3 py-2 tabular-nums text-text-secondary">
                      {matrix.map.get(st)?.[vt] != null ? `${matrix.map.get(st)![vt]}%` : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!matrix.states.length ? (
            <p className="p-4 text-sm text-text-secondary">No fee rates in database.</p>
          ) : null}
        </div>
      </section>

      <Dialog open={!!rollbackId} onOpenChange={(o) => !o && setRollbackId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback fee version?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            This replaces all current fee rates with the snapshot from the selected upload. A new version record will
            be created after rollback.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRollbackId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={rollbackMut.isPending}
              onClick={() => rollbackId && rollbackMut.mutate(rollbackId)}
            >
              {rollbackMut.isPending ? 'Rolling back…' : 'Confirm rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
