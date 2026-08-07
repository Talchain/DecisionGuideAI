/**
 * F1 (Paul's #1, answer-shape progressive disclosure) — parse + wire accessor.
 *
 * parseAnswerShape validates A1's stated shape { headline, bullets, detail },
 * fail-closed. extractAnswerShapeSidecar is the single wire binding: it reads
 * the sidecar from a formal top-level field OR the additive-extensions sidecar
 * the parser demotes unknown keys into, mirroring extractReasoningSidecar.
 *
 * ⚠ The exact wire field NAME is unconfirmed pending A1's contract test — these
 * tests pin the DEFENSIVE behaviour (fail-closed on absent/malformed, positive
 * control both ways), not a promise about the final field name.
 */
import { describe, it, expect } from 'vitest'
import { parseAnswerShape, extractAnswerShapeSidecar, type AnswerShape } from '../answerShape'
import { ADDITIVE_EXTENSIONS_KEY } from '../../../v5/responseParser'

describe('parseAnswerShape — defensive validation', () => {
  it('accepts a well-formed shape (headline + bullets + detail)', () => {
    const parsed = parseAnswerShape({
      headline: 'Option B is the strongest bet.',
      bullets: ['Best expected outcome', 'Robust to your key uncertainty'],
      detail: 'Across 10,000 simulations Option B led in 71% of runs...',
    })
    expect(parsed).toEqual<AnswerShape>({
      headline: 'Option B is the strongest bet.',
      bullets: ['Best expected outcome', 'Robust to your key uncertainty'],
      detail: 'Across 10,000 simulations Option B led in 71% of runs...',
    })
  })

  // Contract: bullets MAY be empty → headline + Show-more detail, no bullet list.
  it('accepts headline + detail with empty/absent bullets (bullets → [])', () => {
    expect(parseAnswerShape({ headline: 'H', detail: 'more' })).toEqual({
      headline: 'H',
      bullets: [],
      detail: 'more',
    })
    expect(parseAnswerShape({ headline: 'H', bullets: [], detail: 'more' })).toEqual({
      headline: 'H',
      bullets: [],
      detail: 'more',
    })
  })

  it('trims headline/bullets/detail and drops blank/non-string bullets', () => {
    const parsed = parseAnswerShape({
      headline: '  Trim me  ',
      bullets: ['  keep  ', '', '   ', 42, null, 'also'],
      detail: '  d  ',
    })
    expect(parsed).toEqual({ headline: 'Trim me', bullets: ['keep', 'also'], detail: 'd' })
  })

  // detail is required + non-blank (no-content-loss gate): without the full
  // explanation the structured view must NOT replace the free-text body.
  it('returns null when detail is missing/blank/non-string (detail is required)', () => {
    expect(parseAnswerShape({ headline: 'H', bullets: ['a'] })).toBeNull()
    expect(parseAnswerShape({ headline: 'H', bullets: ['a'], detail: '' })).toBeNull()
    expect(parseAnswerShape({ headline: 'H', bullets: ['a'], detail: '   ' })).toBeNull()
    expect(parseAnswerShape({ headline: 'H', bullets: ['a'], detail: 42 })).toBeNull()
    expect(parseAnswerShape({ headline: 'Just a headline' })).toBeNull()
  })

  it('returns null when headline is missing/empty/non-string', () => {
    expect(parseAnswerShape({ bullets: ['a'], detail: 'd' })).toBeNull()
    expect(parseAnswerShape({ headline: '', detail: 'd' })).toBeNull()
    expect(parseAnswerShape({ headline: '   ', detail: 'd' })).toBeNull()
    expect(parseAnswerShape({ headline: 123, detail: 'd' })).toBeNull()
  })

  it('returns null for non-object / nullish inputs (never throws)', () => {
    expect(parseAnswerShape(null)).toBeNull()
    expect(parseAnswerShape(undefined)).toBeNull()
    expect(parseAnswerShape('string')).toBeNull()
    expect(parseAnswerShape(42)).toBeNull()
    expect(parseAnswerShape([])).toBeNull()
  })
})

describe('extractAnswerShapeSidecar — wire binding (fail-closed)', () => {
  const good = { headline: 'H', bullets: ['a', 'b'], detail: 'd' }
  const expected = { headline: 'H', bullets: ['a', 'b'], detail: 'd' }

  // The confirmed home on the UI side: the parser demotes the top-level
  // `_answer_shape` into the additive-extensions sidecar (like `_reasoning`).
  it('reads _answer_shape from the additive-extensions sidecar', () => {
    const response = { assistant_text: 'hi', [ADDITIVE_EXTENSIONS_KEY]: { _answer_shape: good } }
    expect(extractAnswerShapeSidecar(response)).toEqual(expected)
  })

  // Future-proofing: a formal top-level field (schema promotion) also lights up.
  it('reads a formal top-level _answer_shape field', () => {
    expect(extractAnswerShapeSidecar({ _answer_shape: good })).toEqual(expected)
  })

  // Positive control (absence branch): a response with no sidecar → null, so
  // the caller renders the free-text body. Proven distinct from the present
  // branch above — the accessor genuinely reads the field, it is not vacuously
  // returning null for everything.
  it('returns null when no answer-shape sidecar is present', () => {
    expect(extractAnswerShapeSidecar({ assistant_text: 'hi', suggested_actions: [] })).toBeNull()
  })

  it('returns null for a malformed sidecar (no detail / wrong types)', () => {
    expect(extractAnswerShapeSidecar({ _answer_shape: { headline: 'H', bullets: ['a'] } })).toBeNull()
    expect(extractAnswerShapeSidecar({ _answer_shape: 'not-an-object' })).toBeNull()
    expect(extractAnswerShapeSidecar({ _answer_shape: null })).toBeNull()
  })

  it('returns null for non-object responses (never throws)', () => {
    expect(extractAnswerShapeSidecar(null)).toBeNull()
    expect(extractAnswerShapeSidecar(undefined)).toBeNull()
    expect(extractAnswerShapeSidecar('x')).toBeNull()
  })
})
