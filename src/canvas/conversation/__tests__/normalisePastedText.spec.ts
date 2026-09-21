/**
 * normalisePastedText — UI-SEM-096.
 *
 * The property under test is narrow and deliberately so: a pasted list keeps
 * its shape, a pasted anything-else is returned BY IDENTITY so the caller can
 * hand it straight back to the browser and keep native undo.
 *
 * ⚠ THE IDENTITY CASES ARE NOT PADDING. `AIInputBar.handlePaste` returns early
 * on `normalised === raw`; if this helper ever started returning an equal-but-
 * distinct string, every paste would silently lose one step of undo and no
 * behavioural test would notice. The identity assertions are what make that a
 * RED rather than a shrug.
 */
import { describe, it, expect } from 'vitest'
import { normalisePastedText } from '../normalisePastedText'

describe('a pasted list keeps its shape', () => {
  it.each([
    ['•', '• Raise the price\n• Hold at £49'],
    ['‣', '‣ Raise the price\n‣ Hold at £49'],
    ['◦', '◦ Raise the price\n◦ Hold at £49'],
    ['▪', '▪ Raise the price\n▪ Hold at £49'],
    ['●', '● Raise the price\n● Hold at £49'],
  ])('rewrites the %s glyph to the marker safeRichText understands', (_glyph, pasted) => {
    expect(normalisePastedText(pasted)).toBe('- Raise the price\n- Hold at £49')
  })

  it('keeps the indent, because a nested item is still nested', () => {
    expect(normalisePastedText('  • inner')).toBe('  - inner')
  })

  it('touches only the marker — the item text is returned character for character', () => {
    // Nothing is trimmed, re-cased, re-wrapped or re-punctuated. The one
    // rewrite is the leading glyph.
    expect(normalisePastedText('•   Raise  the   price .')).toBe('-   Raise  the   price .')
  })

  it('normalises CRLF so a Windows paste does not carry a stray CR into every line', () => {
    expect(normalisePastedText('one\r\ntwo\rthree')).toBe('one\ntwo\nthree')
  })

  it('does both at once', () => {
    expect(normalisePastedText('• one\r\n• two')).toBe('- one\n- two')
  })
})

describe('everything else is returned untouched, by identity', () => {
  it.each([
    ['ordinary prose', 'Raise the price to £59 and see what happens.'],
    ['text already using the marker', '- one\n- two'],
    ['a numbered list', '1. one\n2. two'],
    ['bold markers', 'the **leading** option'],
    ['the empty string', ''],
  ])('%s', (_label, raw) => {
    // toBe is reference equality for strings in V8 only when the SAME string
    // object is returned, which is exactly the contract: `handlePaste` compares
    // with === and must take the early return.
    expect(normalisePastedText(raw)).toBe(raw)
  })

  it('a mid-line bullet glyph is a separator, not a list marker', () => {
    // This estate's own copy uses `·` as a separator ("Olumi is open · Focus").
    const raw = 'Olumi is open · Focus'
    expect(normalisePastedText(raw)).toBe(raw)
  })

  it('a glyph with no space after it is not a list marker either', () => {
    const raw = '•tight'
    expect(normalisePastedText(raw)).toBe(raw)
  })

  it('leaves en/em dashes alone — safeRichText already owns that rewrite', () => {
    // Two owners for one transform is the drift class CLAUDE.md calls trap 21.
    const raw = '— a dash-led line\n– another'
    expect(normalisePastedText(raw)).toBe(raw)
  })
})

/**
 * ⭐ THE DRIFT ALARM — this helper exists BECAUSE of what the consumer cannot
 * do, so the consumer's actual behaviour is pinned here rather than described
 * in a comment. The first version of this file asserted, in prose, that a
 * pasted `•` list "renders as run-on prose"; it does not, and no test said so.
 *
 * If `safeRichText` ever widens its bullet class, the second case REDs and the
 * next reader is told — at the exact line — that this helper's glyph list can
 * shrink, instead of both layers quietly doing the same job forever.
 */
describe('cross-check against the consumer this exists for', () => {
  it('safeRichText ALREADY understands • ‣ ◦ — those rewrites are for uniformity, not repair', async () => {
    const { safeRichText } = await import('../../utils/safeRichText')
    for (const glyph of ['•', '‣', '◦']) {
      expect(safeRichText(`${glyph} one\n${glyph} two`)).toContain('<ul>')
    }
  })

  it('safeRichText does NOT understand ▪ ● ○ ■ · — THAT is the repair', async () => {
    const { safeRichText } = await import('../../utils/safeRichText')
    for (const glyph of ['▪', '●', '○', '■', '·']) {
      const raw = `${glyph} one\n${glyph} two`
      expect(safeRichText(raw)).not.toContain('<ul>')
      // …and with the helper in front of it, the same paste becomes a list.
      expect(safeRichText(normalisePastedText(raw))).toContain('<ul>')
    }
  })
})
