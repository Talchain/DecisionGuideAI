/**
 * ⛔ AIQ 5903604206 (P0 5903598692): with two user options plus one of Olumi's suggestions, "Comparing 2 of your 3
 * options" calls Olumi's suggestion the user's (false authorship). "your" stays only when every option is the user's.
 */
import { describe, it, expect } from 'vitest'
import { deriveComparisonScope, COMPARISON_SCOPE_COPY } from '../goalAnchorCopy'
import { isUnadoptedOlumiSuggestion } from '../../../../canvas/nodes/shared/analysisParticipation'

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

describe('adoption (P0 #75 5906129633): the origin stays Olumi, participation decides "your"', () => {
  it('RED: an Olumi suggestion CEE stamped `included` on a pressed approval is the user\'s option now', () => {
    expect(isUnadoptedOlumiSuggestion({ proposed_by: 'olumi', analysis_participation: 'included' })).toBe(false)
  })
  it('CONTROL: an unstamped Olumi suggestion (every served read today) stays not-yours', () => {
    expect(isUnadoptedOlumiSuggestion({ proposed_by: 'olumi' })).toBe(true)
    expect(isUnadoptedOlumiSuggestion({ proposed_by: 'olumi', analysis_participation: 'retained_excluded' })).toBe(true)
    expect(isUnadoptedOlumiSuggestion({ proposed_by: 'olumi', analysis_participation: 'partial' })).toBe(true) // unlicensed → not included
  })
  it('CONTROL: the user\'s own option is never a suggestion', () => {
    expect(isUnadoptedOlumiSuggestion({ label: 'Raise to £59' })).toBe(false)
    expect(isUnadoptedOlumiSuggestion(null)).toBe(false)
  })
})
