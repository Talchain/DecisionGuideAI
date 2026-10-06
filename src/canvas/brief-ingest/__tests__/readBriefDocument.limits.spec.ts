import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { readBriefDocument, BriefIngestError } from '..'
import { assembleBrief } from '../assemble'
import { BRIEF_CHAR_BUDGET } from '../limits'
import { cleanFilename } from '../cleanFilename'
import { asFile, buildDocx } from './fixtures'
import type { Extraction } from '../types'

const rows = (n: number, width = 60): Extraction => ({
  segments: Array.from({ length: n }, (_, i) => ({
    marker: `Paragraph ${i + 1}`,
    text: `Row ${i + 1} ${'x'.repeat(width)}`,
    countable: true,
  })),
  notes: [],
  noun: 'paragraphs',
  total: n,
})

describe('brief upload — limits and authorship', () => {
  it('refuses a file over 10 MB with a message', async () => {
    const big = asFile('x', 'big.xlsx')
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    await expect(readBriefDocument(big, '')).rejects.toThrow('This file is over 10 MB, so Olumi can’t read it.')
  })

  it('refuses a zip that declares more than 50 MB of contents', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', '<w:document/>')
    zip.file('word/media/huge.bin', new Uint8Array(51 * 1024 * 1024))
    const bytes = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
    expect(bytes.byteLength).toBeLessThan(10 * 1024 * 1024)
    await expect(readBriefDocument(asFile(bytes, 'bomb.docx'), '')).rejects.toThrow('expands to more than 50 MB')
  })

  it('caps the whole brief at 7,500 characters, cutting only at a segment boundary, and says so', () => {
    const existing = 'My own words. '.repeat(100)
    const { text, summary } = assembleBrief(existing, 'long.docx', rows(400))
    expect(text.length).toBeLessThanOrEqual(BRIEF_CHAR_BUDGET)
    expect(text.startsWith(existing)).toBe(true)
    const lines = text.slice(existing.length).trim().split('\n')
    const body = lines.filter((l) => l.startsWith('[Paragraph'))
    body.forEach((l, i) => expect(l).toBe(`[Paragraph ${i + 1}] Row ${i + 1} ${'x'.repeat(60)}`))
    expect(text).toContain(`(Olumi read up to [Paragraph ${body.length}]; the rest of the file was not read, because a brief holds up to 7,500 characters)`)
    expect(summary).toBe(`Olumi read ${body.length} of 400 paragraphs.`)
  })

  it('refuses when the brief has no room left', () => {
    expect(() => assembleBrief('y'.repeat(7400), 'a.docx', rows(3))).toThrow(BriefIngestError)
    expect(() => assembleBrief('y'.repeat(7400), 'a.docx', rows(3))).toThrow('no room to add this file')
  })

  it('appends to the user’s text and never replaces it', async () => {
    const existing = 'Should we expand to Leeds?'
    const { text, added } = await readBriefDocument(asFile(await buildDocx(['Rent £4k a month']), 'notes.docx'), existing)
    expect(text).toBe(`${existing}\n\nFrom notes.docx:\n[Paragraph 1] Rent £4k a month`)
    expect(added).toBe('\n\nFrom notes.docx:\n[Paragraph 1] Rent £4k a month')
  })

  it('cleans the filename before it goes in the brief', () => {
    expect(cleanFilename('C:\\Users\\me\\[Slide 9] plan\u202e.xlsx')).toBe('Slide 9 plan.xlsx')
    expect(cleanFilename('a\nb.csv')).toBe('ab.csv')
  })

  it('errors gracefully on a file that is not what its name says', async () => {
    await expect(readBriefDocument(asFile('plain text', 'fake.pptx'), '')).rejects.toThrow("Olumi couldn't open this file.")
    await expect(readBriefDocument(asFile('x', 'notes.txt'), '')).rejects.toThrow('Olumi can read .xlsx, .csv, .pptx and .docx files.')
  })
})
