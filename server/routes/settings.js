import fs from 'fs/promises'
import path from 'path'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { signAgentAccess } from './auth.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'

const router = Router()
router.use(verifyAgentToken, checkSubscription)

const BRANDING_DIR = path.join(process.cwd(), 'uploads', 'branding')

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(BRANDING_DIR, { recursive: true })
      cb(null, BRANDING_DIR)
    } catch (e) {
      cb(e)
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safe = ext === '.jpeg' || ext === '.jpg' ? '.jpg' : '.png'
    cb(null, `${req.tenant.id}${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(new Error('Only JPG and PNG images are allowed (max 2MB).'))
    }
    cb(null, true)
  },
})

/** GET /api/settings */
router.get('/', async (req, res) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant.id },
    select: {
      email: true,
      businessName: true,
      logoUrl: true,
      whatsappNumber: true,
    },
  })
  if (!tenant) return res.status(404).json({ message: 'Tenant not found' })
  res.json({
    email: tenant.email,
    businessName: tenant.businessName,
    logoUrl: tenant.logoUrl,
    whatsappNumber: tenant.whatsappNumber,
  })
})

/** PUT /api/settings/branding — multipart: logo (optional), businessName */
router.put(
  '/branding',
  (req, res, next) => {
    upload.single('logo')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Upload failed' })
      }
      next()
    })
  },
  async (req, res) => {
    const tenantId = req.tenant.id
    const businessName =
      typeof req.body?.businessName === 'string' ? req.body.businessName.trim() : ''

    if (!businessName) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'businessName is required' })
    }

    let logoUrl = undefined
    if (req.file) {
      logoUrl = `/uploads/branding/${path.basename(req.file.path)}`
    }

    const data = { businessName }
    if (logoUrl != null) data.logoUrl = logoUrl

    await prisma.tenant.update({
      where: { id: tenantId },
      data,
    })

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    const accessToken = signAgentAccess(tenant)

    res.json({
      accessToken,
      businessName: tenant.businessName,
      logoUrl: tenant.logoUrl,
    })
  },
)

/** PUT /api/settings/contact */
router.put('/contact', async (req, res) => {
  const tenantId = req.tenant.id
  const whatsappNumber =
    typeof req.body?.whatsappNumber === 'string' ? req.body.whatsappNumber.trim() || null : null

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { whatsappNumber },
  })

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  const accessToken = signAgentAccess(tenant)

  res.json({
    accessToken,
    whatsappNumber: tenant.whatsappNumber,
  })
})

/** PUT /api/settings/password */
router.put('/password', async (req, res) => {
  const tenantId = req.tenant.id
  const currentPassword =
    typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
  const confirmPassword =
    typeof req.body?.confirmNewPassword === 'string' ? req.body.confirmNewPassword : ''

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' })
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New passwords do not match' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' })
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return res.status(404).json({ message: 'Not found' })

  const ok = await bcrypt.compare(currentPassword, tenant.passwordHash)
  if (!ok) {
    return res.status(400).json({ message: 'Current password is incorrect' })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { passwordHash },
  })

  const fresh = await prisma.tenant.findUnique({ where: { id: tenantId } })
  const accessToken = signAgentAccess(fresh)

  res.json({ accessToken, message: 'Password updated' })
})

export default router
