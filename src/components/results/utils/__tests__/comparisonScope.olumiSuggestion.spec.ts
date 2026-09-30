/**
 * ⛔ AIQ 5903604206 (P0 5903598692): with two user options plus one of Olumi's suggestions, "Comparing 2 of your 3
 * options" calls Olumi's suggestion the user's (false authorship). "your" stays only when every option is the user's.
 */
import { describe, it, expect } from 'vitest'
import { deriveComparisonScope, COMPARISON_SCOPE_COPY } from '../goalAnchorCopy'

const phrase = (opts: Parameters<typeof deriveComparisonScope>[0]) => {
  const scope = deriveComparisonScope(opts)
  return scope ? COMPARISON_SCOPE_COPY.phrase(scope) : null
}

describe('the comparison scope never counts Olumi\'s suggestion as "your" option', () => {
  it('RED: 2 user options + 1 Olumi suggestion (not compared) → no "your"', () => {
    const p = phrase([{ id: 'a', label: 'Raise to £59' }, { id: 'b', label: 'Hold £49' }, { id: 'o', label: 'Phased GCP', notAnalysed: true, proposedByOlumi: true }])
    expect(p).toBe('Comparing 2 of 3 options')
    expect(p).not.toMatch(/your/)
  })
  it('CONTROL: 3 user options, one not compared → "your" stays', () => {
    expect(phrase([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C', notAnalysed: true }])).toBe('Comparing 2 of your 3 options')
  })
})
