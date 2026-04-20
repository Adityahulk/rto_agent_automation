import { useQuery } from '@tanstack/react-query'
import { Building2, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { fetchSubscriptionStatus, subscriptionQueryKeys } from '@/api/subscription'
import { Button } from '@/components/ui/button'
import { APP_NAME, BUSINESS_NAME } from '@/lib/constants'
import { isJwtValid } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent-blue/15 text-accent-blue'
      : 'text-text-secondary hover:bg-bg-app hover:text-text-primary',
  )

const agentNav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/calculator', label: 'Calculator' },
  { to: '/clients', label: 'Clients' },
  { to: '/insurance', label: 'Insurance' },
  { to: '/forms', label: 'Forms' },
  { to: '/quotes', label: 'Quotes' },
  { to: '/revenue', label: 'Revenue' },
  { to: '/reminders', label: 'Reminders' },
  { to: '/settings', label: 'Settings' },
  { to: '/subscription', label: 'Subscription' },
] as const

export function AgentLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage)
  const businessName = useAuthStore((s) => s.businessName)
  const token = useAuthStore((s) => s.token)
  const clearAgentSession = useAuthStore((s) => s.clearAgentSession)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const subscriptionStatusQuery = useQuery({
    queryKey: subscriptionQueryKeys.status,
    queryFn: fetchSubscriptionStatus,
    enabled: Boolean(token && isJwtValid(token)),
  })

  const expiredAt = subscriptionStatusQuery.data?.subscriptionExpiresAt
  const subscriptionExpired =
    subscriptionStatusQuery.data?.status === 'expired' && Boolean(expiredAt)
  const showExpiredOverlay =
    subscriptionExpired && location.pathname !== '/subscription'

  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  function handleLogout() {
    clearAgentSession()
    navigate('/login', { replace: true })
  }

  const displayBusinessName = businessName || BUSINESS_NAME

  const expiredDateLabel = expiredAt
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(expiredAt))
    : ''

  return (
    <div className="relative flex min-h-svh flex-col bg-bg-app text-text-primary md:flex-row">
      {showExpiredOverlay ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-bg-app/95 px-6 text-center backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sub-expired-title"
          aria-describedby="sub-expired-desc"
        >
          <h2 id="sub-expired-title" className="max-w-md text-xl font-semibold text-text-primary">
            Your subscription expired on {expiredDateLabel}. Renew to continue.
          </h2>
          <p id="sub-expired-desc" className="max-w-md text-sm text-text-secondary">
            You can still renew from the subscription page.
          </p>
          <Button type="button" onClick={() => navigate('/subscription')}>
            Renew Now
          </Button>
        </div>
      ) : null}
      <div className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border-card bg-bg-card px-4 md:hidden">
        <p className="text-sm font-semibold">{displayBusinessName}</p>
        <Button type="button" variant="outline" size="icon" onClick={() => setMobileNavOpen((v) => !v)}>
          {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileNavOpen(false)} />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[220px] shrink-0 flex-col border-r border-border-card bg-bg-card transition-transform md:static md:z-auto md:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-start gap-3 border-b border-border-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-blue/20 text-accent-blue">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-text-secondary">
              {APP_NAME}
            </p>
            <p className="truncate text-sm font-semibold text-text-primary">
              {displayBusinessName}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {agentNav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={navLinkClass}
              onClick={() => setMobileNavOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-border-card p-4">
          <div className="inline-flex items-center rounded-full border border-border-card bg-bg-app px-2.5 py-1 text-xs font-medium text-accent-green">
            Active
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full border-border-card text-text-secondary hover:text-text-primary"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
