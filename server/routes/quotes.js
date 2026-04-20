import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { buildQuotePdfBytes } from '../lib/quotePdf.js'
import { verifyAgentToken } from '../middleware/auth.js'
import { checkSubscription } from '../middleware/checkSubscription.js'

const router = Router()
router.use(verifyAgentToken, checkSubscription)

function formatVehicleType(vt) {
  const map = {
    TWO_W: '2W',
    FOUR_W: '4W',
    COMMERCIAL: 'Commercial',
    EV: 'EV',
  }
  return map[vt] ?? vt
}

/** GET /api/quotes — paginated */
router.get('/', async (req, res) => {
  const tenantId = req.tenant.id
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.pageSize), 10) || 10))
  const skip = (page - 1) * pageSize

  const where = { tenantId }

  const [total, rows] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        calculation: true,
      },
    }),
  ])

  res.json({
    items: rows.map((q) => ({
      id: q.id,
      clientId: q.clientId,
      clientName: q.client.name,
      vehicleType: formatVehicleType(q.calculation.vehicleType),
      vehicleTypeRaw: q.calculation.vehicleType,
      state: q.calculation.state,
      invoicePrice: Number(q.calculation.invoicePrice),
      totalFees: Number(q.calculation.totalFees),
      totalTax: Number(q.calculation.totalTax),
      grandTotal: Number(q.calculation.grandTotal),
      date: q.createdAt.toISOString(),
      sentViaWhatsapp: q.sentViaWhatsapp,
      pdfUrl: q.pdfUrl,
    })),
    total,
    page,
    pageSize,
  })
})

/** GET /api/quotes/:id/pdf */
router.get('/:id/pdf', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params

  const row = await prisma.quote.findFirst({
    where: { id, tenantId },
    include: {
      client: { select: { name: true } },
      calculation: true,
    },
  })
  if (!row) return res.status(404).json({ message: 'Quote not found' })

  const bytes = await buildQuotePdfBytes(row.calculation, row.client.name)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="quote-${id}.pdf"`)
  res.send(Buffer.from(bytes))
})

/** PATCH /api/quotes/:id — e.g. { sentViaWhatsapp: true } */
router.patch('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params
  const row = await prisma.quote.findFirst({
    where: { id, tenantId },
  })
  if (!row) return res.status(404).json({ message: 'Not found' })

  const body = req.body ?? {}
  const data = {}
  if (typeof body.sentViaWhatsapp === 'boolean') {
    data.sentViaWhatsapp = body.sentViaWhatsapp
  }
  if (typeof body.pdfUrl === 'string') data.pdfUrl = body.pdfUrl.trim() || null

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No valid fields' })
  }

  const updated = await prisma.quote.update({
    where: { id: row.id },
    data,
  })

  res.json({
    id: updated.id,
    sentViaWhatsapp: updated.sentViaWhatsapp,
    pdfUrl: updated.pdfUrl,
  })
})

/** DELETE /api/quotes/:id */
router.delete('/:id', async (req, res) => {
  const tenantId = req.tenant.id
  const { id } = req.params
  const row = await prisma.quote.findFirst({
    where: { id, tenantId },
  })
  if (!row) return res.status(404).json({ message: 'Not found' })

  await prisma.quote.delete({ where: { id: row.id } })
  res.status(204).send()
})

export default router
