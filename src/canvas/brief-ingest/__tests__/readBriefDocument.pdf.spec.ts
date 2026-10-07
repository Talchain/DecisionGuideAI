import { describe, it, expect } from 'vitest'
import { extractPdf, PDF_NO_TEXT, type PdfReader } from '../extractPdf'
import { assembleBrief } from '../assemble'
import { readBriefDocument } from '..'
import { asFile } from './fixtures'

function fakeReader(pages: Array<{ text: string; pictures?: number }>): (b: ArrayBuffer) => Promise<PdfReader> {
  return async () => ({
    numPages: pages.length,
    pageText: async (n) => pages[n - 1].text,
    pagePictures: async (n) => pages[n - 1].pictures ?? 0,
    destroy: async () => undefined,
  })
}

const bytes = new ArrayBuffer(8)

describe('brief upload — PDF (page logic, fake reader)', () => {
  it('splits by page, keeps line breaks, and says what was not read', async () => {
    const ex = await extractPdf(
      bytes,
      fakeReader([{ text: 'Pricing review\nStarter price £49' }, { text: '   ', pictures: 1 }, { text: 'Churn 4%', pictures: 1 }]),
    )
    const { text, summary } = assembleBrief('', 'r.pdf', ex)
    expect(text).toContain('[Page 1] Pricing review\nStarter price £49')
    expect(text).toContain('[Page 3] Churn 4%')
    expect(text).not.toContain('[Page 2]')
    expect(text).toContain('(1 page has no selectable text and was not read: Page 2)')
    expect(text).toContain('(1 picture or chart on Page 3 was not read)')
    expect(summary).toBe('Olumi read 2 of 3 pages (1 had no selectable text).')
  })

  it('refuses a PDF with no text layer with the exact sentence', async () => {
    await expect(extractPdf(bytes, fakeReader([{ text: '' }, { text: ' ' }]))).rejects.toThrow(PDF_NO_TEXT)
    expect(PDF_NO_TEXT).toBe("This PDF has no selectable text, so Olumi can't read it yet.")
  })

  it('reads pages 1–40 of 52, never opening the rest', async () => {
    const opened: number[] = []
    const ex = await extractPdf(bytes, async () => ({
      numPages: 52,
      pageText: async (n) => (opened.push(n), `Page text ${n}`),
      pagePictures: async () => 0,
      destroy: async () => undefined,
    }))
    const { text } = assembleBrief('', 'big.pdf', ex)
    expect(Math.max(...opened)).toBe(40)
    expect(text).toContain('[Page 40] Page text 40')
    expect(text).toContain('(Olumi read pages 1–40 of 52; the rest were not read)')
  })

  it('errors gracefully on a non-PDF renamed to .pdf, without loading pdf.js', async () => {
    await expect(readBriefDocument(asFile('just some notes', 'notes.pdf'), '')).rejects.toThrow(
      "Olumi couldn't open this file as a PDF.",
    )
  })
})
