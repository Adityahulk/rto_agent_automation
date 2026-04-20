import { Navigate, Outlet } from 'react-router-dom'
import { getAdminJwt, getAgentJwt, isJwtValid } from '@/lib/auth'

type PrivateRouteProps = {
  role: 'agent' | 'admin'
}

export function PrivateRoute({ role }: PrivateRouteProps) {
  const token = role === 'agent' ? getAgentJwt() : getAdminJwt()
  const redirectTo = role === 'agent' ? '/login' : '/admin/login'

  if (!isJwtValid(token)) {
    return <Navigate to={redirectTo} replace />
  }

  return <Outlet />
}
