import fs from 'fs/promises'
import path from 'path'
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { ALLOWED_FORM_TYPES, renderRtoFormPdf } from '../lib/renderRtoFormPdf.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'

const router = Router()
router.use(verifyAgentToken, checkSubscription)

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'rto-forms')

async function tenantUploadDir(tenantId) {
  const dir = path.join(UPLOAD_ROOT, tenantId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

function pdfDiskPath(tenantId, formId) {
  return path.join(UPLOAD_ROOT, tenantId, `${formId}.pdf`)
}

function pdfRelativeKey(tenantId, formId) {
  return `${tenantId}/${formId}.pdf`
}

async function assertClientVehicle(tenantId, clientId, vehicleId) {
  if (clientId) {
    const c = await prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (!c) return { ok: false, message: 'Client not found' }
  }
  if (vehicleId) {
    const v = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        client: { tenantId, deletedAt: null },
      },
      select: { id: true },
    })
    if (!v) return { ok: false, message: 'Vehicle not found' }
  }
  return { ok: true }
}

/** POST /api/forms/generate — returns application/pdf */
router.post('/generate', async (req, res) => {
  const { formType, formData } = req.body ?? {}
  if (!formType || typeof formType !== 'string' || !ALLOWED_FORM_TYPES.includes(formType)) {
    return res.status(400).json({ message: 'formType must be one of FORM_20, FORM_21, FORM_29, FORM_30' })
  }
  if (!formData || typeof formData !== 'object') {
    return res.status(400).json({ message: 'formData object is required' })
  }

  try {
    const bytes = await renderRtoFormPdf(formType, formData)
    const copy = new Uint8Array(bytes.length)
    copy.set(bytes)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="rto-form.pdf"')
    return res.send(Buffer.from(copy))
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Failed to render PDF' })
  }
})

/** GET /api/forms — recent saved forms */
router.get('/', async (req, res) => {
  const tenantId = req.tenant.id
  const take = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit), 10) || 50))

  const rows = await prisma.rtoForm.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      client: { select: { name: true } },
      vehicle: { select: { vehicleNumber: true } },
    },
  })

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      formType: r.formType,
      clientName: r.client?.name ?? null,
      vehicleNumber: r.vehicle?.vehicleNumber ?? null,
      createdAt: r.createdAt.toISOString(),
      hasFile: Boolean(r.pdfUrl),
    })),
  })
})

/** POST /api/forms — persist generated PDF */
router.post('/', async (req, res) => {
  const tenantId = req.tenant.id
  const { formType, formData, clientId, vehicleId } = req.body ?? {}

  if (!formType || typeof formType !== 'string' || !ALLOWED_FORM_TYPES.includes(formType)) {
    return res.status(400).json({ message: 'Invalid formType' })
  }
  if (!formData || typeof formData !== 'object') {
    return res.status(400).json({ message: 'formData is required' })
  }

  const cid = typeof clientId === 'string' && clientId ? clientId : null
  const vid = typeof vehicleId === 'string' && vehicleId ? vehicleId : null

  const chk = await assertClientVehicle(tenantId, cid, vid)
  if (!chk.ok) return res.status(404).json({ message: chk.message })

  if (cid && vid) {
    const v = await prisma.vehicle.findFirst({
      where: { id: vid, clientId: cid },
      select: { id: true },
    })
    if (!v) {
      return res.status(400).json({ message: 'Vehicle does not belong to the selected client' })
    }
  }

  let bytes
  try {
    bytes = await renderRtoFormPdf(formType, formData)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Failed to render PDF' })
  }

  const row = await prisma.rtoForm.create({
    data: {
      tenantId,
      clientId: cid,
      vehicleId: vid,
      formType,
      formData,
      pdfUrl: null,
    },
  })

  await tenantUploadDir(tenantId)
  const diskPath = pdfDiskPath(tenantId, row.id)
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  await fs.writeFile(diskPath, Buffer.from(copy))

  const rel = pdfRelativeKey(tenantId, row.id)
  await prisma.rtoForm.update({
    where: { id: row.id },
    data: { pdfUrl: rel },
  })

  res.status(201).json({
    id: row.id,
    pdfUrl: rel,
  })
})

/** GET /api/forms/:id/file — download/stream PDF */
router.get('/:id/file', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params

  const row = await prisma.rtoForm.findFirst({
    where: { id, tenantId },
    select: { pdfUrl: true },
  })
  if (!row?.pdfUrl) {
    return res.status(404).json({ message: 'Form or PDF not found' })
  }

  const diskPath = path.join(UPLOAD_ROOT, row.pdfUrl)
  try {
    const buf = await fs.readFile(diskPath)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="form-${id}.pdf"`)
    return res.send(buf)
  } catch {
    return res.status(404).json({ message: 'PDF file missing' })
  }
})

/** DELETE /api/forms/:id — remove saved form */
router.delete('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params

  const row = await prisma.rtoForm.findFirst({
    where: { id, tenantId },
    select: { id: true, pdfUrl: true },
  })
  if (!row) {
    return res.status(404).json({ message: 'Form not found' })
  }

  await prisma.rtoForm.delete({ where: { id: row.id } })

  if (row.pdfUrl) {
    const diskPath = path.join(UPLOAD_ROOT, row.pdfUrl)
    try {
      await fs.unlink(diskPath)
    } catch {
      // Ignore missing files.
    }
  }

  res.status(204).end()
})

export default router
