import { useMutation } from '@tanstack/react-query'
import axios, { isAxiosError } from 'axios'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ADMIN_JWT_KEY, ADMIN_REFRESH_KEY } from '@/lib/auth'
import { cn } from '@/lib/utils'

type AdminLoginResponse = {
  accessToken: string
  refreshToken: string
  expiresIn?: string
}

async function postAdminLogin(body: { email: string; password: string }) {
  const { data } = await axios.post<AdminLoginResponse>(
    `${import.meta.env.VITE_API_URL ?? '/api'}/auth/admin/login`,
    body,
  )
  return data
}

export function AdminLoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const loginMutation = useMutation({
    mutationFn: postAdminLogin,
    onSuccess: (data) => {
      localStorage.setItem(ADMIN_JWT_KEY, data.accessToken)
      localStorage.setItem(ADMIN_REFRESH_KEY, data.refreshToken)
      navigate('/admin/dashboard', { replace: true })
    },
  })

  const errorMessage =
    loginMutation.isError && isAxiosError(loginMutation.error)
      ? (loginMutation.error.response?.data as { message?: string })?.message ??
        loginMutation.error.message
      : loginMutation.isError
        ? 'Something went wrong. Please try again.'
        : null

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    loginMutation.mutate({ email: email.trim(), password })
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-accent-amber">
          Admin Panel
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          India&apos;s smartest RTO tool
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              'w-full rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-secondary/70',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/40',
            )}
            placeholder="admin@rtohelper.in"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary" htmlFor="admin-password">
            Password
          </label>
          <div className="relative">
            <input
              id="admin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'w-full rounded-md border border-border-card bg-bg-app py-2 pl-3 pr-11 text-sm text-text-primary',
                'placeholder:text-text-secondary/70',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/40',
              )}
              placeholder="••••••••"
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-secondary hover:bg-bg-card hover:text-text-primary"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loginMutation.isPending}
          className="h-11 w-full bg-accent-blue text-white hover:bg-accent-blue/90"
        >
          {loginMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            'Login to Dashboard'
          )}
        </Button>
      </form>

      {errorMessage ? (
        <div
          className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <p className="text-center text-sm text-text-secondary">
        Agent?{' '}
        <Link
          className="font-medium text-accent-blue hover:underline"
          to="/login"
        >
          Login here
        </Link>
      </p>
    </div>
  )
}
