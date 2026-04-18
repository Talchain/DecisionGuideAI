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
  it('returns a formatted "Brief suggests up to: …" string when the brief-extracted-with-cap predicate fires', () => {
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
    expect(hint).toBe('Brief suggests up to: £70,000')
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

  it('returns neutral no-figure copy when unit is missing (bare numeric cap is misleading)', () => {
    // Prevents the card from falling back to "0 of N" body text from the
    // upstream formatObservedStateDetail — which would conflict with the
    // empty editor the isBriefExtractedWithCap predicate forces.
    const hint = resolveCapHintSubtitle(
      {
        detail: 'Some value',
        rawValue: 0,
        cap: 70000,
        unit: null,
        sourceBadge: 'brief',
      },
      formatValueWithUnit,
    )
    expect(hint).toBe('Brief suggests a value. Set it to confirm.')
  })

  it('returns neutral no-figure copy when unit is an empty string', () => {
    const hint = resolveCapHintSubtitle(
      {
        detail: 'Some value',
        rawValue: 0,
        cap: 70000,
        unit: '',
        sourceBadge: 'brief',
      },
      formatValueWithUnit,
    )
    expect(hint).toBe('Brief suggests a value. Set it to confirm.')
  })

  it('returns neutral no-figure copy when unit is whitespace-only', () => {
    const hint = resolveCapHintSubtitle(
      {
        detail: 'Some value',
        rawValue: 0,
        cap: 70000,
        unit: '   ',
        sourceBadge: 'brief',
      },
      formatValueWithUnit,
    )
    expect(hint).toBe('Brief suggests a value. Set it to confirm.')
  })

  // Genuine-zero regression: brief literally said "0% churn". The hint
  // copy "Brief suggests up to: X" is defensible for this case too — the
  // cap is still the upper bound the brief allows, and the hedged wording
  // never claims the brief stated X as the current value.
  it('renders defensible copy even in the genuine-zero-from-brief case', () => {
    const hint = resolveCapHintSubtitle(
      {
        detail: '0%',
        rawValue: 0,
        cap: 5,
        unit: '%',
        sourceBadge: 'brief',
      },
      formatValueWithUnit,
    )
    expect(hint).toBe('Brief suggests up to: 5%')
    // Critically, the copy never says "the brief said 5%" — only that
    // the brief allows up to 5%, which is true whether the current value
    // is genuinely 0 or just not recorded.
    expect(hint).not.toMatch(/^From brief:/)
  })

  // Up-to-limit positive case: mirror of the genuine-zero assertion above.
  // The brief said "up to £70,000" — structurally identical to the
  // genuine-zero case, rendered identically by design. Locks the hint copy
  // so a future change can't accidentally diverge the two cases.
  it('renders the hint copy verbatim for the up-to-limit-from-brief case', () => {
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
    expect(hint).toBe('Brief suggests up to: £70,000')
  })

  // P0: placeholder units (scale, index, score, norm, normalised, normalized)
  // must not render the numeric hint. "Brief suggests up to: 70 score" is
  // meaningless — the figure has no real-world scale. Mirrors the
  // placeholder-unit suppression in InlineValueControls. Return neutral
  // no-figure copy rather than null, so the card never falls back to the
  // "0 of N" body text when the editor is forced empty.
  const placeholderUnits = ['scale', 'index', 'score', 'norm', 'normalised', 'normalized']
  for (const unit of placeholderUnits) {
    it(`returns neutral no-figure copy for placeholder unit "${unit}" (no real-world scale)`, () => {
      const hint = resolveCapHintSubtitle(
        {
          detail: 'Some value',
          rawValue: 0,
          cap: 70,
          unit,
          sourceBadge: 'brief',
        },
        formatValueWithUnit,
      )
      expect(hint).toBe('Brief suggests a value. Set it to confirm.')
    })
  }

  it('returns a hint for non-placeholder "other" units (e.g. "months")', () => {
    const hint = resolveCapHintSubtitle(
      {
        detail: 'Some value',
        rawValue: 0,
        cap: 12,
        unit: 'months',
        sourceBadge: 'brief',
      },
      formatValueWithUnit,
    )
    // "months" classifies as `other`, which is allowed.
    expect(hint).toMatch(/^Brief suggests up to:/)
  })
})
