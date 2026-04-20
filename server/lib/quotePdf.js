import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function fmtInr(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function vtLabel(vt) {
  const m = {
    TWO_W: '2-Wheeler',
    FOUR_W: '4-Wheeler',
    COMMERCIAL: 'Commercial',
    EV: 'EV',
  }
  return m[vt] ?? String(vt)
}

/**
 * @param {{ state: string; vehicleType: string; invoicePrice: unknown; totalTax: unknown; totalFees: unknown; grandTotal: unknown }} calc
 * @param {string} clientName
 */
export async function buildQuotePdfBytes(calc, clientName) {
  const inv = Number(calc.invoicePrice)
  const tax = Number(calc.totalTax)
  const fees = Number(calc.totalFees)
  const grand = Number(calc.grandTotal)

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let y = 780
  const line = (text, size = 11, f = font) => {
    page.drawText(text, { x: 50, y, size, font: f, color: rgb(0.1, 0.12, 0.16) })
    y -= size + 8
  }

  line('RTO Fee Quote', 16, bold)
  line(`Client: ${clientName}`, 11)
  line(`${calc.state} · ${vtLabel(calc.vehicleType)}`, 12)
  line(`Invoice price: ₹${fmtInr(inv)}`, 11)
  line(`Road tax: ₹${fmtInr(tax)}`, 11)
  line(`Registration & other fees: ₹${fmtInr(fees)}`, 11)
  line(`TOTAL PAYABLE: ₹${fmtInr(grand)}`, 14, bold)

  const bytes = await pdf.save()
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy
}
