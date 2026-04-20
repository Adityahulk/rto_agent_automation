import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  deleteAdminAgent,
  fetchAdminAgents,
  patchAdminAgentBlock,
  patchAdminExtendSubscription,
  type AdminAgentRow,
} from '@/api/admin'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso))
}

function StatusPill({ status }: { status: AdminAgentRow['status'] }) {
  const cls =
    status === 'blocked'
      ? 'bg-accent-red/15 text-accent-red'
      : status === 'expired'
        ? 'bg-accent-amber/15 text-accent-amber'
        : 'bg-accent-green/15 text-accent-green'
  const label = status === 'blocked' ? 'Blocked' : status === 'expired' ? 'Expired' : 'Active'
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', cls)}>{label}</span>
}

export function AdminAgentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState('all')
  const [extendAgent, setExtendAgent] = useState<AdminAgentRow | null>(null)
  const [months, setMonths] = useState('3')
  const [deleteAgent, setDeleteAgent] = useState<AdminAgentRow | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const agentsQuery = useQuery({
    queryKey: ['admin', 'agents', debouncedQ, status],
    queryFn: () => fetchAdminAgents({ q: debouncedQ || undefined, status: status === 'all' ? undefined : status }),
  })

  const blockMut = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => patchAdminAgentBlock(id, blocked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] }),
  })

  const extendMut = useMutation({
    mutationFn: ({ id, m }: { id: string; m: number }) => patchAdminExtendSubscription(id, m),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      setExtendAgent(null)
      setFormError(null)
    },
    onError: (e) => {
      setFormError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Failed')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAdminAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setDeleteAgent(null)
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Agents</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage tenant accounts and subscriptions.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="text-xs font-medium text-text-secondary" htmlFor="agent-search">
            Search
          </label>
          <input
            id="agent-search"
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-sm text-text-primary"
            placeholder="Name, business, or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary" htmlFor="agent-status">
            Status
          </label>
          <select
            id="agent-status"
            className="mt-1 block w-40 rounded-md border border-border-card bg-bg-card px-3 py-2 text-sm text-text-primary"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-card bg-bg-card">
        {agentsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : agentsQuery.isError ? (
          <p className="p-6 text-sm text-accent-red">Could not load agents.</p>
        ) : (
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border-card bg-bg-app text-xs font-medium uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3">Agent name</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(agentsQuery.data?.agents ?? []).map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-border-card last:border-0 hover:bg-bg-app/80"
                  onClick={() => navigate(`/admin/agents/${row.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{row.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.businessName}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.email}</td>
                  <td className="px-4 py-3 tabular-nums text-text-secondary">{formatDate(row.joinedAt)}</td>
                  <td className="px-4 py-3 tabular-nums text-text-secondary">
                    {formatDate(row.subscriptionExpiresAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/agents/${row.id}`}>View</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={blockMut.isPending}
                        onClick={() =>
                          blockMut.mutate({ id: row.id, blocked: row.status !== 'blocked' })
                        }
                      >
                        {row.status === 'blocked' ? 'Unblock' : 'Block'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setExtendAgent(row)}>
                        Extend
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteAgent(row)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!extendAgent} onOpenChange={(o) => !o && setExtendAgent(null)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Extend subscription</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Add months to <span className="font-medium text-text-primary">{extendAgent?.name}</span> from current
            expiry (or from today if lapsed).
          </p>
          <label className="mt-2 block text-xs font-medium text-text-secondary" htmlFor="extend-months">
            Months
          </label>
          <input
            id="extend-months"
            type="number"
            min={1}
            max={120}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-sm"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
          {formError ? <p className="mt-2 text-sm text-accent-red">{formError}</p> : null}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setExtendAgent(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={extendMut.isPending}
              onClick={() => {
                const m = Number(months)
                if (!extendAgent || !Number.isFinite(m) || m < 1) return
                extendMut.mutate({ id: extendAgent.id, m })
              }}
            >
              {extendMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteAgent} onOpenChange={(o) => !o && setDeleteAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Permanently delete <span className="font-medium text-text-primary">{deleteAgent?.name}</span> and all
            related data? This cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteAgent(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteAgent && deleteMut.mutate(deleteAgent.id)}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
