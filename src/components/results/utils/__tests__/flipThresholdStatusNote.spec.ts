import { describe, expect, it } from 'vitest'
import { flipThresholdStatusNote } from '../flipThresholdStatusNote'

const note = (status: string | undefined, reason?: string) => flipThresholdStatusNote({
  status,
  reason,
  hasUnresolved: Boolean(reason),
  designationsWithheld: false,
})

const withheld = (status: string, reason?: string, hasUnresolved = false) => flipThresholdStatusNote({
  status, reason, hasUnresolved, designationsWithheld: true,
})
const permitted = (status: string, reason?: string, hasUnresolved = false) => flipThresholdStatusNote({
  status, reason, hasUnresolved, designationsWithheld: false,
})
const WINNER_CLAIM_RE = /highest|top|best|winner|leader|ahead/i

describe('flipThresholdStatusNote — AIQ/Science ruling #2630 6046857688', () => {
  it('W1/W2 keep a withheld variant that makes no winner claim; the permitted variant carries it', () => {
    expect(permitted('all_no_effect')).toBe('No turning point found in this run: across the ranges Olumi checked, no single factor changed which option had the highest average result.')
    expect(withheld('all_no_effect')).toBe('No turning point found in this run across the factor ranges Olumi could check.')
    expect(permitted('partial_no_effect')).toBe('Some factors Olumi checked did not change which option had the highest average result within their current ranges, in this model.')
    expect(withheld('partial_no_effect')).toBe('Some checked factors had no turning point within their current ranges, in this model.')
    expect(withheld('partial_no_effect', undefined, true)).toBe('Some checked factors had no turning point within their current ranges, in this model. Others could not be checked.')
    for (const s of [withheld('all_no_effect'), withheld('partial_no_effect'), withheld('partial_no_effect', 'timeout')]) {
      expect(s).not.toMatch(WINNER_CLAIM_RE)
    }
    // Contrast: the permitted words DO carry the designation the withheld ones must not.
    expect(permitted('all_no_effect')).toMatch(WINNER_CLAIM_RE)
  })

  it('all_no_effect with a failed check or unresolved factors selects the caveated copy, in either verdict state', () => {
    const caveat = 'No turning point was found among the checks that completed. Some factors could not be checked, so this model may have other turning points.'
    expect(permitted('all_no_effect', 'timeout')).toBe(caveat)
    expect(withheld('all_no_effect', 'error')).toBe(caveat)
    expect(permitted('all_no_effect', undefined, true)).toBe(caveat)
    expect(permitted('all_no_effect', 'some_future_token')).toBe(caveat)
    // Only the two substantive no-flip reasons keep the bare finding.
    expect(permitted('all_no_effect', 'structurally_invariant')).toBe('No turning point found in this run: across the ranges Olumi checked, no single factor changed which option had the highest average result.')
    expect(permitted('all_no_effect', 'no_effect_within_bounds')).toBe('No turning point found in this run: across the ranges Olumi checked, no single factor changed which option had the highest average result.')
  })

  it('W4 clauses for precision and grid follow the ruling', () => {
    expect(permitted('unresolved', 'insufficient_precision')).toBe('Turning points not shown for this run: Olumi could not finish checking the factors (at least one turning point could not be located precisely enough).')
    expect(permitted('unresolved', 'non_monotonic_grid')).toBe('Turning points not shown for this run: Olumi could not finish checking the factors (at least one factor did not change consistently enough to locate a turning point).')
  })

  it('unknown status, unavailable, and no status stay silent', () => {
    expect(withheld('unavailable')).toBeNull()
    expect(permitted('new_status')).toBeNull()
  })
})

describe('flipThresholdStatusNote SCI-04 copy', () => {
  it('distinguishes an attested absence from unavailable or unknown states', () => {
    expect(note('all_no_effect')).toBe('No turning point found in this run: across the ranges Olumi checked, no single factor changed which option had the highest average result.')
    expect(note('unavailable')).toBeNull()
    expect(note('new_status')).toBeNull()
    expect(note(undefined)).toBeNull()
  })

  it('maps reasons to ruled clauses without exposing the token', () => {
    expect(note('unresolved', 'timeout')).toBe('Turning points not shown for this run: Olumi could not finish checking the factors (at least one check ran out of time).')
    expect(note('unresolved', 'error')).toBe('Turning points not shown for this run: Olumi could not finish checking the factors.')
    expect(note('unresolved', 'single_option')).toBe('Turning points not shown for this run: there is only one option, so there is nothing to compare.')
  })

  it('keeps the complete visible copy free of forbidden comparative terms', () => {
    const text = [
      note('all_no_effect'), note('partial_no_effect'), note('computed', 'timeout'),
      note('unresolved', 'timeout'), note('unresolved', 'single_option'),
    ].join(' ')
    expect(text).not.toMatch(/best|winner|recommend|ahead|beats|leader|leading|favour/i)
  })
})
