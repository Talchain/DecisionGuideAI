/**
 * Runtime CEE glossary guard: unsafe CEE-authored text never renders raw.
 * Covers the live leak observed in local testing ("authority-labelled
 * nodes ... decision graph"), plural and phrase cases, safe passthrough,
 * and proves the fallbacks themselves pass glossary and overclaim checks.
 */

import { describe, it, expect } from 'vitest'
import { guardCeeText, guardCeeTextOrNull, isSafeCeeText } from '../ceeTextGuard'
import { CEE_FALLBACK_COPY, LADDER_COPY } from '../../constants'
import { findBannedTerm } from '../../../../../test/glossaryBannedTerms'

const LIVE_LEAK =
  'One or more authority-labelled nodes are highly connected in the decision graph; this may overweight senior opinions.'

describe('isSafeCeeText — whole-word and phrase matching', () => {
  it.each([
    ['the live staging leak', LIVE_LEAK],
    ['bare singular node', 'a node carries this'],
    ['bare plural nodes', 'several nodes are involved'],
    ['bare edge', 'one edge dominates'],
    ['bare plural edges', 'two edges between factors'],
    ['graph', 'your graph looks thin'],
    ['plural graphs', 'across both graphs'],
    ['phrase decision graph', 'the decision graph is sparse'],
    ['phrase value of information', 'the value of information is high here'],
    ['EVPI', 'EVPI suggests checking this first'],
    ['elasticity', 'high elasticity on this factor'],
  ])('flags unsafe CEE text: %s', (_name, text) => {
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

describe('guardCeeText — degrade, never render raw', () => {
  it('returns the original when safe', () => {
    const safe = 'The core tension is leadership against added capacity.'
    expect(guardCeeText(safe, CEE_FALLBACK_COPY.heroCoaching)).toEqual({
      text: safe,
      degraded: false,
    })
  })

  it('degrades the live leak to the safe coaching fallback', () => {
    const result = guardCeeText(LIVE_LEAK, CEE_FALLBACK_COPY.biasRow)
    expect(result.degraded).toBe(true)
    expect(result.text).toBe(CEE_FALLBACK_COPY.biasRow)
    expect(result.text).not.toContain('node')
  })

  it('guardCeeTextOrNull suppresses unsafe text (deterministic copy renders instead)', () => {
    expect(guardCeeTextOrNull('both options sit in one decision graph')).toBeNull()
    expect(guardCeeTextOrNull('both options are hiring routes')).toBe(
      'both options are hiring routes',
    )
    expect(guardCeeTextOrNull(null)).toBeNull()
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
