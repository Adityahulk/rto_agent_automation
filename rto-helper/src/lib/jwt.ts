export type AgentJwtPayload = {
  tenantId: string
  email: string
  businessName: string
  logoUrl: string | null
  iat?: number
  exp?: number
}

export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = payload.length % 4
    if (pad) payload += '='.repeat(4 - pad)
    const json = atob(payload)
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

export function decodeAgentJwtPayload(token: string): AgentJwtPayload | null {
  const data = decodeJwtPayload<AgentJwtPayload>(token)
  if (!data?.tenantId || !data.email || typeof data.businessName !== 'string') {
    return null
  }
  return {
    ...data,
    logoUrl: data.logoUrl ?? null,
  }
}
