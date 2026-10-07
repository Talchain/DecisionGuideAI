import { describe, expect, it } from 'vitest'
import { flipThresholdStatusNote } from '../flipThresholdStatusNote'

const note = (status: string | undefined, reason?: string) => flipThresholdStatusNote({
  status,
  reason,
  hasUnresolved: Boolean(reason),
  designationsWithheld: false,
})

describe('flipThresholdStatusNote SCI-04 copy', () => {
  it('distinguishes an attested absence from unavailable or unknown states', () => {
    expect(note('all_no_effect')).toBe('No turning point in this run: within its current range, no single factor Olumi checked changes which option has the highest average result in this model.')
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
