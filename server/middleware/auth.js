import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

function getBearerToken(req) {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return null
  return h.slice(7).trim() || null
}

export async function verifyAgentToken(req, res, next) {
  try {
    const token = getBearerToken(req)
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const secret = process.env.JWT_AGENT_SECRET
    if (!secret) {
      return res.status(500).json({ message: 'Server configuration error' })
    }

    const decoded = jwt.verify(token, secret)
    const tenantId = decoded.tenantId
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const { passwordHash: _ph, ...tenantSafe } = tenant
    req.tenant = tenantSafe
    next()
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
    next(err)
  }
}

export async function verifyAdminToken(req, res, next) {
  try {
    const token = getBearerToken(req)
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const secret = process.env.JWT_ADMIN_SECRET
    if (!secret) {
      return res.status(500).json({ message: 'Server configuration error' })
    }

    const decoded = jwt.verify(token, secret)
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }

    if (!decoded.adminId || typeof decoded.adminId !== 'string') {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const admin = await prisma.admin.findUnique({ where: { id: decoded.adminId } })
    if (!admin) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      createdAt: admin.createdAt,
    }
    req.adminClaims = decoded
    next()
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
    next(err)
  }
}
