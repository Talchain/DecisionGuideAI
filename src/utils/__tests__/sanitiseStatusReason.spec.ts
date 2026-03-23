import { describe, it, expect } from 'vitest'
import { sanitiseStatusReason } from '../sanitiseStatusReason'

describe('sanitiseStatusReason', () => {
  it('rewrites "constraint X violated" pattern', () => {
    const result = sanitiseStatusReason('constraint_fac_customer_churn_max violated')
    expect(result).toBe('A model constraint was violated.')
  })

  it('rewrites "node_id X not found" pattern', () => {
    const result = sanitiseStatusReason('node_id fac_revenue_growth not found')
    expect(result).toBe('A referenced element was not found.')
  })

  it('strips fac_ prefixed identifiers from prose', () => {
    const result = sanitiseStatusReason('fac_revenue has missing data')
    expect(result).not.toContain('fac_revenue')
    expect(result).toMatch(/missing data/i)
  })

  it('strips opt_ prefixed identifiers', () => {
    const result = sanitiseStatusReason('opt_option_alpha is invalid for analysis')
    expect(result).not.toContain('opt_option_alpha')
  })

  it('strips 3+ segment snake_case identifiers', () => {
    const result = sanitiseStatusReason('field prior_distribution_alpha is out of range')
    expect(result).not.toContain('prior_distribution_alpha')
    expect(result).toMatch(/out of range/i)
  })

  it('passes through clean user-facing messages unchanged', () => {
    const msg = 'Each option needs intervention values before analysis can run.'
    expect(sanitiseStatusReason(msg)).toBe(msg)
  })

  it('returns input unchanged for falsy values', () => {
    expect(sanitiseStatusReason('')).toBe('')
    expect(sanitiseStatusReason(null as unknown as string)).toBeNull()
    expect(sanitiseStatusReason(undefined as unknown as string)).toBeUndefined()
  })

  it('capitalises first letter of result', () => {
    const result = sanitiseStatusReason('the model has issues with the setup.')
    expect(result.charAt(0)).toBe('T')
  })

  it('provides generic fallback when sanitisation strips everything', () => {
    const result = sanitiseStatusReason('fac_a fac_b fac_c')
    expect(result).toContain('review your setup')
  })

  it('collapses multiple spaces after stripping', () => {
    const result = sanitiseStatusReason('error in  constraint_fac_x_y_z  processing')
    expect(result).not.toMatch(/ {2}/)
  })

  it('adds trailing period when missing', () => {
    const result = sanitiseStatusReason('Something went wrong with analysis')
    expect(result).toMatch(/\.$/)
  })

  it('does not double-add period when already present', () => {
    const result = sanitiseStatusReason('Analysis failed.')
    expect(result).toBe('Analysis failed.')
    expect(result).not.toMatch(/\.\.$/)
  })
})
