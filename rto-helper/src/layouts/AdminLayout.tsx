import { Shield, LogOut } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/constants'
import { clearAdminJwt } from '@/lib/auth'
import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent-blue/15 text-accent-blue'
      : 'text-text-secondary hover:bg-bg-app hover:text-text-primary',
  )

const adminNav = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/agents', label: 'Agents' },
  { to: '/admin/fees', label: 'Fee Engine' },
  { to: '/admin/subscriptions', label: 'Subscriptions' },
  { to: '/admin/analytics', label: 'Analytics' },
] as const

export function AdminLayout() {
  const navigate = useNavigate()

  function handleLogout() {
    clearAdminJwt()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex min-h-svh bg-bg-app text-text-primary">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border-card bg-bg-card">
        <div className="flex items-start gap-3 border-b border-border-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-amber/20 text-accent-amber">
            <Shield className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-text-secondary">
              Admin
            </p>
            <p className="truncate text-sm font-semibold text-text-primary">{APP_NAME}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {adminNav.map(({ to, label }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-border-card p-4">
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

      <main className="min-w-0 flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
