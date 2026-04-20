import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-xl border border-border-card bg-bg-card p-8 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-text-primary">Page not found</h1>
      <p className="mt-2 text-sm text-text-secondary">
        The page you are looking for does not exist or may have moved.
      </p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  )
}
