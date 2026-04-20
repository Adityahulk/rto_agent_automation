import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-bg-app px-4 py-8 text-text-primary">
      <div className="w-full max-w-md rounded-lg border border-border-card bg-bg-card p-8 shadow-lg">
        <Outlet />
      </div>
    </div>
  )
}
