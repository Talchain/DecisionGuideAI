import { describe, it, expect } from 'vitest'
import { resolveEditorRawValue, resolveCapHintSubtitle } from '../resolveEditorRawValue'
import { formatValueWithUnit } from '../../../../utils/formatValueWithUnit'

describe('resolveEditorRawValue — TriageCard inline editor pre-fill (Brief 4 hotfix Task 3)', () => {
  it('returns null when detail is "Not set" (inferred-zero placeholder)', () => {
    expect(
      resolveEditorRawValue({ detail: 'Not set', rawValue: 0, cap: null }),
    ).toBeNull()
  })

  it('returns null for brief-extracted factors with zero raw value and a cap', () => {
    // Annual Assistant Cost from the hiring bundle: brief-extracted, cap=70000,
    // raw_value=0 because no live baseline was recorded. Returning the cap
    // would overwrite a genuine-zero case (e.g. brief that said "0% churn")
    // which is structurally identical from sourceBadge/rawValue/cap alone.
    // Null → empty input with "Set value" placeholder; the "From brief"
    // pill keeps the provenance, user re-enters the figure deliberately.
    expect(
      resolveEditorRawValue({
        detail: 'Some value',
        rawValue: 0,
        cap: 70000,
        sourceBadge: 'brief',
      }),
    ).toBeNull()
  })

  it('genuine-zero scenario is not overwritten (regression for the narrowing)', () => {
    // Simulates a brief that literally said "current churn rate: 0%".
    // Structurally indistinguishable from the previous case — same guard
    // must apply: return null, never the cap. The user reconfirms 0 if
    // that's the true value.
    expect(
      resolveEditorRawValue({
        detail: '0%',
        rawValue: 0,
        cap: 1,
        sourceBadge: 'brief',
      }),
    ).toBeNull()
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

describe('resolveCapHintSubtitle — cap hint for brief-extracted-with-cap cards', () => {
  it('returns a formatted "From brief: …" string when the brief-extracted-with-cap predicate fires', () => {
    const hint = resolveCapHintSubtitle(
      {
        detail: 'Annual Assistant Cost',
        rawValue: 0,
        cap: 70000,
        unit: '£',
        sourceBadge: 'brief',
      },
      formatValueWithUnit,
    )
    expect(hint).toBe('From brief: £70,000')
  })

  it('returns null for AI-sourced factors (no brief provenance)', () => {
    const hint = resolveCapHintSubtitle(
      {
        detail: 'Some value',
        rawValue: 0,
        cap: 70000,
        unit: '£',
        sourceBadge: 'ai',
      },
      formatValueWithUnit,
    )
    expect(hint).toBeNull()
  })

  it('returns null when rawValue is non-zero (cap is not the suggested default)', () => {
    const hint = resolveCapHintSubtitle(
      {
        detail: '£5000',
        rawValue: 5000,
        cap: 70000,
        unit: '£',
        sourceBadge: 'brief',
      },
      formatValueWithUnit,
    )
    expect(hint).toBeNull()
  })

  it('returns null when cap is missing', () => {
    const hint = resolveCapHintSubtitle(
      {
        detail: 'Some value',
        rawValue: 0,
        cap: null,
        unit: '£',
        sourceBadge: 'brief',
      },
      formatValueWithUnit,
    )
    expect(hint).toBeNull()
  })
})
