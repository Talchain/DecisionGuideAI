/** One real pdf.js round-trip on tiny in-test PDFs (the page logic is covered with a fake reader). */
import { describe, it, expect } from 'vitest'
import { extractPdf, PDF_NO_TEXT } from '../extractPdf'
import { buildPdf } from './pdfFixture'

const ab = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

describe('brief upload — PDF smoke (real pdf.js)', () => {
  it('reads a PDF text layer page by page', async () => {
    const ex = await extractPdf(ab(buildPdf([['Pricing review', 'Starter price 49 GBP'], ['Churn 4%']])))
    expect(ex.segments.map((s) => s.marker)).toEqual(['Page 1', 'Page 2'])
    expect(ex.segments[0].text).toContain('Pricing review')
    expect(ex.segments[0].text).toContain('Starter price 49 GBP')
    expect(ex.segments[1].text).toContain('Churn 4%')
  }, 20_000)

  it('refuses a PDF whose pages carry no text layer', async () => {
    await expect(extractPdf(ab(buildPdf([null])))).rejects.toThrow(PDF_NO_TEXT)
  }, 20_000)
})
