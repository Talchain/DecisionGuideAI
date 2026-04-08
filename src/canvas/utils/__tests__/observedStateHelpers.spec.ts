import { describe, it, expect } from 'vitest'
import { isFactorNeedsInput } from '../observedStateHelpers'

describe('isFactorNeedsInput', () => {
  it('returns true when value, raw_value and display_value are all null', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: null, raw_value: null, display_value: null },
      }),
    ).toBe(true)
  })

  it('returns true when observedState is missing entirely', () => {
    expect(isFactorNeedsInput({ category: 'controllable' })).toBe(true)
  })

  it('returns false when only value is set', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: 0.5 },
      }),
    ).toBe(false)
  })

  it('returns false when only raw_value is set (drift guard against value-only check)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: null, raw_value: '£50,000' },
      }),
    ).toBe(false)
  })

  it('returns false when only display_value is set (drift guard against value-only check)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: null, raw_value: null, display_value: 'High' },
      }),
    ).toBe(false)
  })

  it('returns false for external factors regardless of observed state', () => {
    expect(
      isFactorNeedsInput({
        category: 'external',
        observedState: { value: null, raw_value: null, display_value: null },
      }),
    ).toBe(false)
  })

  it('returns false when a prior range is present (parity with legacy isIncomplete)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior: { range_min: 100, range_max: 500 },
        observedState: {},
      }),
    ).toBe(false)
  })

  it('still treats partial prior (one bound only) as needs-input', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        prior: { range_min: 100 },
        observedState: {},
      }),
    ).toBe(true)
  })

  it('treats undefined fields as null (loose equality)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: {},
      }),
    ).toBe(true)
  })

  it('returns false when value is 0 (zero is a valid value for binary factors)', () => {
    expect(
      isFactorNeedsInput({
        category: 'controllable',
        observedState: { value: 0 },
      }),
    ).toBe(false)
  })
})
