import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { fetchAdminAgentDetail } from '@/api/admin'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso))
}

export function AdminAgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const detailQuery = useQuery({
    queryKey: ['admin', 'agent', id],
    queryFn: () => fetchAdminAgentDetail(id!),
    enabled: Boolean(id),
  })

  if (!id) {
    return <p className="text-sm text-accent-red">Missing agent id.</p>
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }
  if (detailQuery.isError || !detailQuery.data) {
    return <p className="text-sm text-accent-red">Agent not found.</p>
  }

  const { agent, stats } = detailQuery.data

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="outline" size="sm" asChild className="mb-3">
            <Link to="/admin/agents">← Back to agents</Link>
          </Button>
          <h1 className="text-2xl font-semibold text-text-primary">{agent.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{agent.businessName}</p>
          <p className="text-sm text-text-secondary">{agent.email}</p>
          {agent.whatsappNumber ? (
            <p className="text-sm text-text-secondary">WhatsApp: {agent.whatsappNumber}</p>
          ) : null}
        </div>
        <div className="text-right text-sm text-text-secondary">
          <p>Joined {formatDate(agent.joinedAt)}</p>
          <p className="mt-1">Subscription {formatDate(agent.subscriptionExpiresAt)}</p>
          <p className="mt-1 capitalize">Status: {agent.status}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border-card bg-bg-card p-4">
          <p className="text-xs font-medium text-text-secondary">Fee queries</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{stats.queryCount}</p>
        </div>
        <div className="rounded-lg border border-border-card bg-bg-card p-4">
          <p className="text-xs font-medium text-text-secondary">Clients</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{stats.clientsCount}</p>
        </div>
        <div className="rounded-lg border border-border-card bg-bg-card p-4">
          <p className="text-xs font-medium text-text-secondary">Service revenue</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
            {formatInr(stats.revenueInr)}
          </p>
        </div>
      </div>
    </div>
  )
}
