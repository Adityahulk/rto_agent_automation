export const AGENT_JWT_KEY = 'rto_agent_jwt'
export const AGENT_REFRESH_KEY = 'rto_agent_refresh'
export const ADMIN_JWT_KEY = 'rto_admin_jwt'
export const ADMIN_REFRESH_KEY = 'rto_admin_refresh'

export function getAgentJwt(): string | null {
  return localStorage.getItem(AGENT_JWT_KEY)
}

export function getAgentRefresh(): string | null {
  return localStorage.getItem(AGENT_REFRESH_KEY)
}

export function getAdminJwt(): string | null {
  return localStorage.getItem(ADMIN_JWT_KEY)
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = payload.length % 4
    if (pad) payload += '='.repeat(4 - pad)
    const json = atob(payload)
    return JSON.parse(json) as { exp?: number }
  } catch {
    return null
  }
}

export function isJwtValid(token: string | null): boolean {
  if (!token?.trim()) return false
  const payload = decodeJwtPayload(token)
  if (!payload?.exp || typeof payload.exp !== 'number') return false
  return payload.exp * 1000 > Date.now()
}

export function clearAgentJwt(): void {
  localStorage.removeItem(AGENT_JWT_KEY)
  localStorage.removeItem(AGENT_REFRESH_KEY)
}

export function clearAdminJwt(): void {
  localStorage.removeItem(ADMIN_JWT_KEY)
  localStorage.removeItem(ADMIN_REFRESH_KEY)
}
