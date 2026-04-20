import { create } from 'zustand'
import {
  AGENT_JWT_KEY,
  AGENT_REFRESH_KEY,
  getAgentJwt,
  getAgentRefresh,
  isJwtValid,
} from '@/lib/auth'
import { decodeAgentJwtPayload } from '@/lib/jwt'

type AuthState = {
  token: string | null
  tenantId: string | null
  businessName: string | null
  logoUrl: string | null
  setAgentSession: (accessToken: string, refreshToken: string) => boolean
  applyAccessToken: (accessToken: string) => boolean
  clearAgentSession: () => void
  hydrateFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  tenantId: null,
  businessName: null,
  logoUrl: null,

  setAgentSession: (accessToken, refreshToken) => {
    const payload = decodeAgentJwtPayload(accessToken)
    if (!payload) return false

    localStorage.setItem(AGENT_JWT_KEY, accessToken)
    localStorage.setItem(AGENT_REFRESH_KEY, refreshToken)

    set({
      token: accessToken,
      tenantId: payload.tenantId,
      businessName: payload.businessName,
      logoUrl: payload.logoUrl,
    })
    return true
  },

  applyAccessToken: (accessToken) => {
    const refresh = getAgentRefresh()
    if (!refresh) return false
    const payload = decodeAgentJwtPayload(accessToken)
    if (!payload) return false
    localStorage.setItem(AGENT_JWT_KEY, accessToken)
    set({
      token: accessToken,
      tenantId: payload.tenantId,
      businessName: payload.businessName,
      logoUrl: payload.logoUrl ?? null,
    })
    return true
  },

  clearAgentSession: () => {
    localStorage.removeItem(AGENT_JWT_KEY)
    localStorage.removeItem(AGENT_REFRESH_KEY)
    set({
      token: null,
      tenantId: null,
      businessName: null,
      logoUrl: null,
    })
  },

  hydrateFromStorage: () => {
    const accessToken = getAgentJwt()
    if (!accessToken || !isJwtValid(accessToken)) return
    const payload = decodeAgentJwtPayload(accessToken)
    if (!payload) return
    set({
      token: accessToken,
      tenantId: payload.tenantId,
      businessName: payload.businessName,
      logoUrl: payload.logoUrl,
    })
  },
}))
