/**
 * Runtime CEE glossary guard for panel-only coaching strings. Prefers safe
 * in-place substitution (decision graph → decision model, nodes → factors,
 * edges → connections) so useful meaning survives; falls back to a safe
 * coaching line only when a residual term has no approved substitute
 * (EVPI, value of information, elasticity, …). Matching is whole-word /
 * phrase-aware. Covers the live leak observed in local testing
 * ("authority-labelled nodes ... decision graph").
 */

import { describe, it, expect } from 'vitest'
import {
  guardCeeText,
  guardCeeTextOrNull,
  isSafeCeeText,
  sanitiseCeeText,
  categoriseCoaching,
} from '../ceeTextGuard'
import { CEE_FALLBACK_COPY, LADDER_COPY } from '../../constants'
import { findBannedTerm } from '../../../../../test/glossaryBannedTerms'

const LIVE_LEAK =
  'One or more authority-labelled nodes are highly connected in the decision graph; this may overweight senior opinions.'

// Panel-only coaching fixtures that contain banned terms.
const SANITISABLE = [
  ['the live staging leak', LIVE_LEAK],
  ['bare singular node', 'a node carries this'],
  ['bare plural nodes', 'several nodes are involved'],
  ['bare edge', 'one edge dominates'],
  ['bare plural edges', 'two edges between factors'],
  ['graph', 'your graph looks thin'],
  ['plural graphs', 'across both graphs'],
  ['phrase decision graph', 'the decision graph is sparse'],
] as const

const UNSUBSTITUTABLE = [
  ['phrase value of information', 'the value of information is high here'],
  ['EVPI', 'EVPI suggests checking this first'],
  ['elasticity', 'high elasticity on this factor'],
] as const

describe('isSafeCeeText — whole-word and phrase matching', () => {
  it.each([...SANITISABLE, ...UNSUBSTITUTABLE])('flags unsafe CEE text: %s', (_name, text) => {
    expect(isSafeCeeText(text)).toBe(false)
  })

  it.each([
    ['plain coaching', 'The core tension is leadership against added delivery capacity.'],
    ['legitimate substrings', 'Acknowledge the knowledge gap around hedge funds and telegraphs.'],
    ['options and risks vocabulary', 'Two options are hiring routes; consider a process change.'],
  ])('passes safe CEE text: %s', (_name, text) => {
    expect(isSafeCeeText(text)).toBe(true)
  })
})

describe('sanitiseCeeText — safe whole-word / phrase substitution', () => {
  it.each([
    ['decision graph', 'the decision graph is sparse', 'the decision model is sparse'],
    ['decision graphs', 'across decision graphs', 'across decision models'],
    ['bare graph', 'your graph looks thin', 'your model looks thin'],
    ['plural graphs', 'across both graphs', 'across both models'],
    ['singular node', 'a node carries this', 'a factor carries this'],
    ['plural nodes', 'several nodes are involved', 'several factors are involved'],
    ['singular edge', 'one edge dominates', 'one connection dominates'],
    ['plural edges', 'two edges between factors', 'two connections between factors'],
    ['nodes and edges phrase', 'the nodes and edges', 'the factors and connections'],
  ])('maps %s in place', (_name, input, expected) => {
    expect(sanitiseCeeText(input)).toBe(expected)
  })

  it('preserves capitalisation of the matched token', () => {
    expect(sanitiseCeeText('Nodes matter')).toBe('Factors matter')
    expect(sanitiseCeeText('NODES MATTER')).toBe('FACTORS MATTER')
    expect(sanitiseCeeText('Decision graph review')).toBe('Decision model review')
  })

  it('does not touch legitimate substrings (whole-word only)', () => {
    expect(sanitiseCeeText('telegraph and Anode capacity')).toBe('telegraph and Anode capacity')
  })

  it('renders the live leak safe in place', () => {
    const cleaned = sanitiseCeeText(LIVE_LEAK)
    expect(cleaned).toContain('authority-labelled factors')
    expect(cleaned).toContain('decision model')
    expect(isSafeCeeText(cleaned)).toBe(true)
  })

  it('leaves terms with no approved substitute (still unsafe)', () => {
    expect(isSafeCeeText(sanitiseCeeText('EVPI suggests checking this first'))).toBe(false)
    expect(isSafeCeeText(sanitiseCeeText('high elasticity on this factor'))).toBe(false)
  })
})

describe('guardCeeText — sanitise in place first, fallback only when needed', () => {
  it('returns the original verbatim when already safe', () => {
    const safe = 'The core tension is leadership against added capacity.'
    expect(guardCeeText(safe, CEE_FALLBACK_COPY.heroCoaching)).toEqual({
      text: safe,
      degraded: false,
      sanitised: false,
    })
  })

  it.each(SANITISABLE)('sanitises in place (not fallback): %s', (_name, text) => {
    const result = guardCeeText(text, CEE_FALLBACK_COPY.biasRow)
    expect(result.degraded).toBe(false)
    expect(result.sanitised).toBe(true)
    expect(result.text).not.toBe(CEE_FALLBACK_COPY.biasRow)
    expect(isSafeCeeText(result.text)).toBe(true)
  })

  it('sanitises the live leak in place, preserving meaning', () => {
    const result = guardCeeText(LIVE_LEAK, CEE_FALLBACK_COPY.biasRow)
    expect(result.sanitised).toBe(true)
    expect(result.degraded).toBe(false)
    expect(result.text).toContain('factors')
    expect(result.text).toContain('decision model')
    expect(result.text).toContain('overweight senior opinions')
  })

  it.each(UNSUBSTITUTABLE)('falls back when no safe substitution exists: %s', (_name, text) => {
    const result = guardCeeText(text, CEE_FALLBACK_COPY.biasRow)
    expect(result.degraded).toBe(true)
    expect(result.sanitised).toBe(false)
    expect(result.text).toBe(CEE_FALLBACK_COPY.biasRow)
  })

  it('guardCeeTextOrNull sanitises in place, suppresses only the unsubstitutable', () => {
    expect(guardCeeTextOrNull('both options sit in one decision graph')).toBe(
      'both options sit in one decision model',
    )
    expect(guardCeeTextOrNull('EVPI is high for both options')).toBeNull()
    expect(guardCeeTextOrNull('both options are hiring routes')).toBe('both options are hiring routes')
    expect(guardCeeTextOrNull(null)).toBeNull()
  })
})

describe('categoriseCoaching — theme for category-aware fallback', () => {
  it.each([
    ['framing', 'The framing here is narrow', 'framing'],
    ['reframe', 'consider how you reframe this', 'framing'],
    ['assumption', 'this rests on a key assumption', 'assumption'],
    ['assumes', 'it assumes senior buy-in', 'assumption'],
    ['comparison', 'the comparison between routes is thin', 'comparison'],
    ['alternative', 'consider an alternative route', 'comparison'],
    ['generic', 'the core tension is leadership capacity', 'generic'],
  ])('classifies %s', (_name, text, expected) => {
    expect(categoriseCoaching(text)).toBe(expected)
  })
})

describe('fallback copy is itself safe', () => {
  const OVERCLAIM = /reliably|improves the analysis|biggest|\bcertain\b|\bproves\b|will sharpen/i
  it.each(Object.entries({ ...CEE_FALLBACK_COPY, readiness: LADDER_COPY.readiness_fallback }))(
    '%s passes glossary, guard and overclaim checks',
    (_key, text) => {
      expect(findBannedTerm(text)).toBeNull()
      expect(isSafeCeeText(text)).toBe(true)
      expect(OVERCLAIM.test(text)).toBe(false)
      expect(text.includes('—')).toBe(false)
    },
  )
})
