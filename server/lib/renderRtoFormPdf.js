import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FORMS_DIR = path.join(__dirname, '../public/forms')

function v(data, key) {
  const x = data[key]
  return x == null || x === '' ? '—' : String(x)
}

/** pdf-lib origin: bottom-left; y increases upward */
function drawBlock(page, font, lines, startX, startY, lineGap = 13, size = 9) {
  let y = startY
  for (const line of lines) {
    page.drawText(line, {
      x: startX,
      y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.12),
      maxWidth: 480,
    })
    y -= lineGap
  }
}

async function loadBase(formNum) {
  const filePath = path.join(FORMS_DIR, `form${formNum}.pdf`)
  const bytes = await fs.readFile(filePath)
  return PDFDocument.load(bytes)
}

function drawForm20(page, font, d) {
  const lines = [
    `Form 20 — Application for Registration of Motor Vehicle`,
    `Owner Name: ${v(d, 'ownerName')}`,
    `Father's / Husband's Name: ${v(d, 'fatherOrHusbandName')}`,
    `Full Address: ${v(d, 'fullAddress')}`,
    `PIN Code: ${v(d, 'pinCode')}   State: ${v(d, 'state')}`,
    `Vehicle Make: ${v(d, 'vehicleMake')}   Model: ${v(d, 'model')}   Variant: ${v(d, 'variant')}`,
    `Chassis No.: ${v(d, 'chassisNo')}   Engine No.: ${v(d, 'engineNo')}`,
    `Fuel Type: ${v(d, 'fuelType')}   Color: ${v(d, 'color')}`,
    `Invoice No.: ${v(d, 'invoiceNo')}   Invoice Date: ${v(d, 'invoiceDate')}`,
    `Dealer Name: ${v(d, 'dealerName')}`,
    `Dealer Address: ${v(d, 'dealerAddress')}`,
  ]
  drawBlock(page, font, lines, 56, 780, 14, 10)
}

function drawForm21(page, font, d) {
  const lines = [
    `Form 21 — Sale Certificate`,
    `Dealer Name: ${v(d, 'dealerName')}`,
    `Dealer Address: ${v(d, 'dealerAddress')}`,
    `Buyer Name: ${v(d, 'buyerName')}`,
    `Buyer Address: ${v(d, 'buyerAddress')}`,
    `Vehicle Description: ${v(d, 'vehicleDescription')}`,
    `Chassis No.: ${v(d, 'chassisNo')}   Engine No.: ${v(d, 'engineNo')}`,
    `Sale Price: ${v(d, 'salePrice')}   Sale Date: ${v(d, 'saleDate')}`,
  ]
  drawBlock(page, font, lines, 56, 780, 14, 10)
}

function drawForm29(page, font, d) {
  const hyp = v(d, 'hypothecation')
  const fin = hyp.toLowerCase() === 'yes' ? v(d, 'financerName') : 'N/A'
  const lines = [
    `Form 29 — Notice of Transfer of Ownership`,
    `Seller Name: ${v(d, 'sellerName')}`,
    `Seller Address: ${v(d, 'sellerAddress')}`,
    `Buyer Name: ${v(d, 'buyerName')}`,
    `Buyer Address: ${v(d, 'buyerAddress')}`,
    `Vehicle Registration No.: ${v(d, 'vehicleRegNo')}`,
    `RC Book details: ${v(d, 'rcBookDetails')}`,
    `Hypothecation: ${hyp}   Financer: ${fin}`,
    `Date of Transfer: ${v(d, 'dateOfTransfer')}`,
  ]
  drawBlock(page, font, lines, 56, 780, 14, 10)
}

function drawForm30(page, font, d) {
  const hyp = v(d, 'hypothecation')
  const fin = hyp.toLowerCase() === 'yes' ? v(d, 'financerName') : 'N/A'
  const lines = [
    `Form 30 — Intimation of Transfer of Ownership`,
    `Seller Name: ${v(d, 'sellerName')}`,
    `Seller Address: ${v(d, 'sellerAddress')}`,
    `Buyer Name: ${v(d, 'buyerName')}`,
    `Buyer Address: ${v(d, 'buyerAddress')}`,
    `Vehicle Registration No.: ${v(d, 'vehicleRegNo')}`,
    `RC Book details: ${v(d, 'rcBookDetails')}`,
    `Hypothecation: ${hyp}   Financer: ${fin}`,
    `Date of Transfer: ${v(d, 'dateOfTransfer')}`,
    `Owner's signature date: ${v(d, 'ownerSignatureDate')}`,
    `RTO jurisdiction: ${v(d, 'rtoJurisdiction')}`,
  ]
  drawBlock(page, font, lines, 56, 780, 13, 9)
}

/**
 * @param {string} formType FORM_20 | FORM_21 | FORM_29 | FORM_30
 * @param {Record<string, unknown>} formData
 * @returns {Promise<Uint8Array>}
 */
export async function renderRtoFormPdf(formType, formData) {
  const data = formData && typeof formData === 'object' ? formData : {}
  const num =
    formType === 'FORM_20'
      ? 20
      : formType === 'FORM_21'
        ? 21
        : formType === 'FORM_29'
          ? 29
          : 30
  const pdf = await loadBase(num)
  const page = pdf.getPages()[0]
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  if (formType === 'FORM_20') drawForm20(page, font, data)
  else if (formType === 'FORM_21') drawForm21(page, font, data)
  else if (formType === 'FORM_29') drawForm29(page, font, data)
  else drawForm30(page, font, data)

  return pdf.save()
}

export const ALLOWED_FORM_TYPES = ['FORM_20', 'FORM_21', 'FORM_29', 'FORM_30']
