import { describe, it, expect } from 'vitest'
import { strengthenWhyLine } from '../analysisNewCopy'
import { truncateAtWordBoundary } from '../../../../utils/text'

/**
 * Two render defects measured at the DOM on the deployed A/B surface
 * (UI `429519be`, re-derived at `842f5267`). Both assertions bind to the
 * PROPERTY, never to the measured numbers: the witness saw 413 characters for a
 * ~205-character sentence, and a two-character drift in that sentence must not
 * be able to make these pass or fail for the wrong reason.
 */
describe('strengthenWhyLine — the sentence is printed once', () => {
  const BODY =
    'Your model leans on one early estimate, and later factors inherit it without independent support, so the result can look steadier than the evidence behind it actually is.'

  it('prints an identical signal and whyNow ONCE, not twice', () => {
    const line = strengthenWhyLine(BODY, BODY)
    // Bound by IDENTITY: count occurrences of the sentence itself. A length
    // assertion would pass or fail on the producer rewording by two characters.
    expect(line.split(BODY).length - 1).toBe(1)
    expect(line).toBe(BODY)
  })

  it('still joins two DIFFERENT sentences — the dedupe must not swallow real prose', () => {
    const why = 'It matters now because the leading option is close.'
    const line = strengthenWhyLine(BODY, why)
    expect(line.split(BODY).length - 1).toBe(1)
    expect(line.split(why).length - 1).toBe(1)
    expect(line).toBe(`${BODY} ${why}`)
  })

  it('renders the signal alone when there is no whyNow', () => {
    expect(strengthenWhyLine(BODY, undefined)).toBe(BODY)
    expect(strengthenWhyLine(BODY, '')).toBe(BODY)
  })
})

describe('truncateAtWordBoundary — never cuts a word in half', () => {
  const TEXT =
    'If the adoption rate changes significantly then the ordering of the two options changes with it'

  it('does not end mid-word, and marks that it was cut', () => {
    const out = truncateAtWordBoundary(TEXT, 80)
    expect(out.length).toBeLessThanOrEqual(80)
    expect(out.endsWith('…')).toBe(true)
    // The property: whatever survives is a whole word of the original.
    const lastWord = out.slice(0, -1).trimEnd().split(' ').pop()!
    expect(TEXT.split(' ')).toContain(lastWord)
  })

  it('leaves a short string completely alone — no suffix on an uncut string', () => {
    expect(truncateAtWordBoundary('Short enough', 80)).toBe('Short enough')
    expect(truncateAtWordBoundary('Short enough', 80)).not.toContain('…')
  })

  it('does not collapse a single very long token to just the suffix', () => {
    const out = truncateAtWordBoundary('a'.repeat(200), 80)
    expect(out.length).toBeGreaterThan(10)
    expect(out.endsWith('…')).toBe(true)
  })
})
