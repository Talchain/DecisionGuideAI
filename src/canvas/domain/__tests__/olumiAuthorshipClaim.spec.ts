/**
 * The shared owner of *"may the product claim this element as Olumi's own?"*.
 *
 * ⛔ THE THREE STATES ARE ASSERTED SEPARATELY, AND THAT IS THE POINT. A suite
 * that only checked "Olumi's vs not Olumi's" would pass on an implementation
 * that collapsed *the user's* and *ambiguous* into one answer — which is exactly
 * the collapse that put "Olumi suggested this" on a user's own option. So every
 * block below asserts BOTH predicates, including where both are false.
 */
import { describe, it, expect } from 'vitest'
import {
  mayClaimOlumiAuthorship,
  olumiAuthorshipIsAmbiguous,
  sourceQuoteRecorded,
  readProvenanceLiteral,
} from '../olumiAuthorshipClaim'

/** The user's actual sentence, as it arrives beside a rewritten class. */
const USER_WORDS = 'increase the Pro plan price from £49 to £59 per month'

describe('⭐ Olumi genuinely invented it — the disclosure must survive', () => {
  it('ai_inferred with no quote is claimable', () => {
    const node = { provenance: 'ai_inferred', label: 'Raise Price to £54 (Soft Increase)' }
    expect(mayClaimOlumiAuthorship(node)).toBe(true)
    expect(olumiAuthorshipIsAmbiguous(node)).toBe(false)
  })

  it('reads the literal off `data` as well as the top level', () => {
    const node = { id: 'n1', data: { provenance: 'ai_inferred', label: 'Synthesis' } }
    expect(mayClaimOlumiAuthorship(node)).toBe(true)
  })
})

describe('⛔ the user stated it and the brief check did not confirm — AMBIGUOUS', () => {
  it('ai_inferred BESIDE a recorded quote is neither claimable nor the user\'s', () => {
    const node = { provenance: 'ai_inferred', source_quote: USER_WORDS }
    expect(mayClaimOlumiAuthorship(node)).toBe(false)
    expect(olumiAuthorshipIsAmbiguous(node)).toBe(true)
  })

  it('fires on the canvas spelling `sourceQuote` too', () => {
    const node = { provenance: 'ai_inferred', sourceQuote: USER_WORDS }
    expect(mayClaimOlumiAuthorship(node)).toBe(false)
    expect(olumiAuthorshipIsAmbiguous(node)).toBe(true)
  })

  it('fires when the pair sits on `data` rather than the top level', () => {
    const node = { id: 'n2', data: { provenance: 'ai_inferred', source_quote: USER_WORDS } }
    expect(mayClaimOlumiAuthorship(node)).toBe(false)
    expect(olumiAuthorshipIsAmbiguous(node)).toBe(true)
  })

  it('⚠ RECORDED, not readable: a degraded non-string quote still declines', () => {
    // A JSONB read can hand back `99`. A "is it a non-empty string" gate would
    // NOT fire here and the user would be told their own words were ours.
    for (const degraded of [99, {}, [], true, '']) {
      const node = { provenance: 'ai_inferred', source_quote: degraded }
      expect(mayClaimOlumiAuthorship(node)).toBe(false)
      expect(olumiAuthorshipIsAmbiguous(node)).toBe(true)
    }
  })

  it('an explicitly null quote is NOT a recorded quote', () => {
    // `null` is the producer saying "no quote", not a degraded one.
    const node = { provenance: 'ai_inferred', source_quote: null }
    expect(mayClaimOlumiAuthorship(node)).toBe(true)
    expect(olumiAuthorshipIsAmbiguous(node)).toBe(false)
  })
})

describe('⚠ the user\'s own element — BOTH predicates false, and that is deliberate', () => {
  /**
   * ⛔ THE DISCRIMINATING CASE. If someone ever implements one predicate as `!`
   * the other, these REDs. `from_brief` is not claimable AND not ambiguous: the
   * element is the user's, and saying so is a separate, larger claim this
   * surface deliberately does not make.
   */
  it.each(['from_brief', 'user_set'])('%s is neither Olumi\'s nor ambiguous', (literal) => {
    const withQuote = { provenance: literal, source_quote: USER_WORDS }
    const without = { provenance: literal }
    for (const node of [withQuote, without]) {
      expect(mayClaimOlumiAuthorship(node)).toBe(false)
      expect(olumiAuthorshipIsAmbiguous(node)).toBe(false)
    }
  })
})

describe('unknown and malformed input never produces a claim', () => {
  it.each([
    ['an unrecognised literal', { provenance: 'something_new' }],
    ['a non-string literal', { provenance: 42 }],
    ['no provenance at all', { label: 'bare' }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not a node'],
  ])('%s', (_name, node) => {
    expect(mayClaimOlumiAuthorship(node)).toBe(false)
    expect(olumiAuthorshipIsAmbiguous(node)).toBe(false)
  })
})

describe('the primitives, asked directly', () => {
  it('readProvenanceLiteral prefers the top level and falls back to data', () => {
    expect(readProvenanceLiteral({ provenance: 'ai_inferred' })).toBe('ai_inferred')
    expect(readProvenanceLiteral({ data: { provenance: 'from_brief' } })).toBe('from_brief')
    expect(readProvenanceLiteral({ provenance: 'ai_inferred', data: { provenance: 'from_brief' } }))
      .toBe('ai_inferred')
    expect(readProvenanceLiteral({})).toBeUndefined()
    expect(readProvenanceLiteral(null)).toBeUndefined()
  })

  it('sourceQuoteRecorded is presence, in either spelling and either shape', () => {
    expect(sourceQuoteRecorded({ source_quote: USER_WORDS })).toBe(true)
    expect(sourceQuoteRecorded({ sourceQuote: USER_WORDS })).toBe(true)
    expect(sourceQuoteRecorded({ data: { source_quote: USER_WORDS } })).toBe(true)
    expect(sourceQuoteRecorded({ data: { sourceQuote: USER_WORDS } })).toBe(true)
    expect(sourceQuoteRecorded({ source_quote: 0 })).toBe(true)
    expect(sourceQuoteRecorded({})).toBe(false)
    expect(sourceQuoteRecorded({ source_quote: null })).toBe(false)
    expect(sourceQuoteRecorded(null)).toBe(false)
  })
})
