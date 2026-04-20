import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

const router = Router()

const ACCESS_TTL = '7d'
const REFRESH_TTL = '30d'

export function signAgentAccess(tenant) {
  const secret = process.env.JWT_AGENT_SECRET
  if (!secret) throw new Error('JWT_AGENT_SECRET is not set')
  return jwt.sign(
    {
      tenantId: tenant.id,
      email: tenant.email,
      businessName: tenant.businessName,
      logoUrl: tenant.logoUrl ?? null,
    },
    secret,
    { expiresIn: ACCESS_TTL },
  )
}

function signAgentRefresh(tenantId) {
  const secret = process.env.JWT_AGENT_REFRESH_SECRET
  if (!secret) throw new Error('JWT_AGENT_REFRESH_SECRET is not set')
  return jwt.sign({ typ: 'refresh', scope: 'agent', tenantId }, secret, {
    expiresIn: REFRESH_TTL,
  })
}

function signAdminAccess(admin) {
  const secret = process.env.JWT_ADMIN_SECRET
  if (!secret) throw new Error('JWT_ADMIN_SECRET is not set')
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      role: 'admin',
    },
    secret,
    { expiresIn: ACCESS_TTL },
  )
}

function signAdminRefresh(adminId) {
  const secret = process.env.JWT_ADMIN_REFRESH_SECRET
  if (!secret) throw new Error('JWT_ADMIN_REFRESH_SECRET is not set')
  return jwt.sign({ typ: 'refresh', scope: 'admin', adminId }, secret, {
    expiresIn: REFRESH_TTL,
  })
}

/** POST /api/auth/agent/login */
router.post('/agent/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const tenant = await prisma.tenant.findUnique({ where: { email } })
  if (!tenant || !(await bcrypt.compare(password, tenant.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  if (tenant.isBlocked || tenant.subscriptionStatus === 'BLOCKED') {
    return res.status(403).json({ message: 'Your account has been blocked' })
  }

  const accessToken = signAgentAccess(tenant)
  const refreshToken = signAgentRefresh(tenant.id)

  return res.json({
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL,
  })
})

/** POST /api/auth/admin/login */
router.post('/admin/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const admin = await prisma.admin.findUnique({ where: { email } })
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const accessToken = signAdminAccess(admin)
  const refreshToken = signAdminRefresh(admin.id)

  return res.json({
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL,
  })
})

/** POST /api/auth/refresh */
router.post('/refresh', async (req, res) => {
  const refreshToken =
    typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : ''

  if (!refreshToken) {
    return res.status(400).json({ message: 'refreshToken is required' })
  }

  let decoded
  try {
    decoded = jwt.decode(refreshToken, { complete: false })
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' })
  }

  if (!decoded || decoded.typ !== 'refresh') {
    return res.status(401).json({ message: 'Invalid refresh token' })
  }

  if (decoded.scope === 'agent') {
    const secret = process.env.JWT_AGENT_REFRESH_SECRET
    if (!secret) {
      return res.status(500).json({ message: 'Server configuration error' })
    }
    try {
      jwt.verify(refreshToken, secret)
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: decoded.tenantId },
    })
    if (!tenant) {
      return res.status(401).json({ message: 'Invalid refresh token' })
    }

    const accessToken = signAgentAccess(tenant)
    return res.json({ accessToken, expiresIn: ACCESS_TTL })
  }

  if (decoded.scope === 'admin') {
    const secret = process.env.JWT_ADMIN_REFRESH_SECRET
    if (!secret) {
      return res.status(500).json({ message: 'Server configuration error' })
    }
    try {
      jwt.verify(refreshToken, secret)
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' })
    }

    const admin = await prisma.admin.findUnique({ where: { id: decoded.adminId } })
    if (!admin) {
      return res.status(401).json({ message: 'Invalid refresh token' })
    }

    const accessToken = signAdminAccess(admin)
    return res.json({ accessToken, expiresIn: ACCESS_TTL })
  }

  return res.status(401).json({ message: 'Invalid refresh token' })
})

export default router
