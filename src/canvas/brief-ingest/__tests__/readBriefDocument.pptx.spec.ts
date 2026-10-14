import { describe, it, expect } from 'vitest'
import { readBriefDocument } from '..'
import { asFile, buildPptx } from './fixtures'

describe('brief upload — slides', () => {
  it('keeps titles and bullets in slide order, excludes notes, and says an image slide was not read', async () => {
    const bytes = await buildPptx([
      { title: 'Context', bullets: ['Revenue £2.1m', 'Churn 4%'], notes: 'SPEAKER NOTE SECRET' },
      { title: 'Options', bullets: ['Raise price', 'Hold price'] },
      { picture: true },
    ])
    const { text, summary } = await readBriefDocument(asFile(bytes, 'deck.pptx'), '')
    expect(text).toContain('[Slide 1] Context\n- Revenue £2.1m\n- Churn 4%')
    expect(text).toContain('[Slide 2] Options\n- Raise price\n- Hold price')
    expect(text.indexOf('[Slide 1]')).toBeLessThan(text.indexOf('[Slide 2]'))
    expect(text).not.toContain('SPEAKER NOTE SECRET')
    expect(text).toContain('(speaker notes were not read)')
    expect(text).toContain('(1 slide is an image; its figures were not read)')
    expect(text).not.toContain('[Slide 3]')
    expect(summary).toBe('Olumi read 2 of 3 slides (1 was an image).')
  })

  it('reads a table row by row, and says a chart was not read', async () => {
    const bytes = await buildPptx([
      { title: 'Figures', table: [['Item', 'Value'], ['Price', '£49']], chart: true },
    ])
    const { text } = await readBriefDocument(asFile(bytes, 't.pptx'), '')
    expect(text).toContain('Table: Item | Value')
    expect(text).toContain('Table row: Item: Price | Value: £49')
    expect(text).toContain('(1 chart on Slide 1 was not read)')
  })

  it('skips hidden slides and says so', async () => {
    const bytes = await buildPptx([{ title: 'Shown' }, { title: 'Hidden one', hidden: true }])
    const { text } = await readBriefDocument(asFile(bytes, 'h.pptx'), '')
    expect(text).not.toContain('Hidden one')
    expect(text).toContain('(1 hidden slide was not read: Slide 2)')
  })

  it('reads slides 1–40 of 45, says how many were not read, and never cuts a slide', async () => {
    const slides = Array.from({ length: 45 }, (_, i) => ({ title: `Title ${i + 1}`, bullets: [`Point ${i + 1}`] }))
    const { text } = await readBriefDocument(asFile(await buildPptx(slides), 'big.pptx'), '')
    expect(text).toContain('[Slide 40] Title 40\n- Point 40')
    expect(text).not.toContain('[Slide 41]')
    expect(text).toContain('(Olumi read slides 1–40 of 45; the rest were not read)')
    for (let i = 1; i <= 40; i++) expect(text).toContain(`[Slide ${i}] Title ${i}\n- Point ${i}`)
  })
})
