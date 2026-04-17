import { describe, it, expect } from 'vitest'
import { resolveEditorRawValue } from '../resolveEditorRawValue'

describe('resolveEditorRawValue — TriageCard inline editor pre-fill (Brief 4 hotfix Task 3)', () => {
  it('returns null when detail is "Not set" (inferred-zero placeholder)', () => {
    expect(
      resolveEditorRawValue({ detail: 'Not set', rawValue: 0, cap: null }),
    ).toBeNull()
  })

  it('pre-fills with cap for brief-extracted factors with zero raw value', () => {
    // Annual Assistant Cost from the hiring bundle: brief-extracted, cap=70000,
    // raw_value=0 because no live baseline was recorded. Input must NOT show
    // "$ 0" — it should pre-fill with 70000 so "$70,000" renders.
    expect(
      resolveEditorRawValue({
        detail: 'Some value',
        rawValue: 0,
        cap: 70000,
        sourceBadge: 'brief',
      }),
    ).toBe(70000)
  })

  it('passes rawValue through unchanged for brief factors with non-zero rawValue', () => {
    expect(
      resolveEditorRawValue({
        detail: '£5000',
        rawValue: 5000,
        cap: 70000,
        sourceBadge: 'brief',
      }),
    ).toBe(5000)
  })

  it('does not use cap for AI-sourced factors (sourceBadge !== brief)', () => {
    expect(
      resolveEditorRawValue({
        detail: 'AI estimate',
        rawValue: 0,
        cap: 70000,
        sourceBadge: 'ai',
      }),
    ).toBe(0)
  })

  it('does not use cap for factors with no sourceBadge', () => {
    expect(
      resolveEditorRawValue({
        detail: 'Some value',
        rawValue: 0,
        cap: 70000,
      }),
    ).toBe(0)
  })

  it('does not use cap when cap is not a number', () => {
    expect(
      resolveEditorRawValue({
        detail: 'Some value',
        rawValue: 0,
        cap: null,
        sourceBadge: 'brief',
      }),
    ).toBe(0)
  })

  it('does not use cap when cap is zero or negative', () => {
    expect(
      resolveEditorRawValue({
        detail: 'Some value',
        rawValue: 0,
        cap: 0,
        sourceBadge: 'brief',
      }),
    ).toBe(0)
    expect(
      resolveEditorRawValue({
        detail: 'Some value',
        rawValue: 0,
        cap: -10,
        sourceBadge: 'brief',
      }),
    ).toBe(0)
  })

  it('returns null when rawValue is null (no value recorded)', () => {
    expect(
      resolveEditorRawValue({
        detail: 'Some value',
        rawValue: null,
        cap: 70000,
        sourceBadge: 'brief',
      }),
    ).toBeNull()
  })
})
