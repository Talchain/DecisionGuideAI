/**
 * interventionDisplay tests — single intervention formatter (audit §8 P0-4).
 *
 * Locks the coherence contract:
 *  - "No change" ONLY on exact equality (epsilon ≤ 1e-9)
 *  - increase/decrease arrows from strict comparison
 *  - display units (£ prefix, count units incl. singular "1 engineer")
 *  - the live 0.5→0.6 contradiction case must NEVER say "does not change"
 */
import { describe, it, expect } from 'vitest'
import {
  formatInterventionChange,
  formatInterventionTargetText,
  describeInterventionDirection,
  isInterventionNoChange,
  INTERVENTION_NO_CHANGE_EPSILON,
} from '../interventionDisplay'

describe('isInterventionNoChange', () => {
  it('is true only on exact equality', () => {
    expect(isInterventionNoChange(0.5, 0.5)).toBe(true)
    expect(isInterventionNoChange(0, 0)).toBe(true)
  })

  it('tolerates only float noise (≤ 1e-9)', () => {
    expect(INTERVENTION_NO_CHANGE_EPSILON).toBeLessThanOrEqual(1e-9)
    expect(isInterventionNoChange(0.5, 0.5 + 1e-12)).toBe(true)
    expect(isInterventionNoChange(0.5, 0.5 + 1e-6)).toBe(false)
  })

  it('never claims no-change when a side is unknown', () => {
    expect(isInterventionNoChange(null, 0.5)).toBe(false)
    expect(isInterventionNoChange(0.5, null)).toBe(false)
    expect(isInterventionNoChange(undefined, undefined)).toBe(false)
  })
})

describe('formatInterventionChange — no-change semantics', () => {
  it('reports no change on exact equality', () => {
    const change = formatInterventionChange({
      baselineValue: 0.5,
      targetValue: 0.5,
      label: 'Team seniority',
    })
    expect(change.changed).toBe(false)
    expect(change.arrow).toBeNull()
    expect(change.text).toBe('Does not change Team seniority')
  })

  it('0.5→0.6 must NEVER say no-change (live contradiction case)', () => {
    const change = formatInterventionChange({
      baselineValue: 0.5,
      targetValue: 0.6,
      label: 'Team seniority',
      factorType: 'quality',
    })
    expect(change.changed).toBe(true)
    expect(change.arrow).toBe('up')
    expect(change.text).not.toMatch(/does not change/i)
    // ⚠ KNOWN COARSENING, pinned deliberately so it REDs if it changes.
    // These three previously asserted '60%' / '50%' / 'Team seniority → 60%'.
    // That percentage was fabricated: a unitless qualitative factor has no
    // scale, so 0.6 is an ordinal position, not 60% of anything.
    // Rendering the honest tier word costs resolution — 0.5 and 0.6 both sit in
    // qualitativeTierLabel's `<= 0.6` Medium band, so the change now reads
    // "Medium → Medium". The DIRECTION is not lost: `changed` and `arrow` above
    // are derived from the raw values and still assert up-movement, which is
    // why those assertions are the load-bearing ones in this test.
    // Trade-off accepted: a coarse-but-true label over a precise-but-invented
    // unit. If sub-tier resolution is wanted here, the fix is a real scale on
    // the factor, not a reinstated percentage.
    expect(change.targetText).toBe('Medium')
    expect(change.baselineText).toBe('Medium')
    expect(change.text).toBe('Team seniority → Medium')
  })

  it('small placeholder-scale shifts (old ±0.1 epsilon bug) count as change', () => {
    // The old placeholderDirectionLabel treated |diff| ≤ 0.1 as "does not
    // change" — 0.5→0.6 sat exactly on that boundary and rendered the
    // contradictory copy. Exact-equality semantics kill that class of bug.
    const change = formatInterventionChange({
      baselineValue: 0.5,
      targetValue: 0.55,
      label: 'Team seniority',
      unit: 'scale',
    })
    expect(change.changed).toBe(true)
    expect(change.arrow).toBe('up')
    expect(change.text).not.toMatch(/does not change/i)
  })
})

describe('formatInterventionChange — arrows', () => {
  it('up arrow for increases', () => {
    const change = formatInterventionChange({ baselineValue: 0.2, targetValue: 0.8, label: 'X' })
    expect(change.arrow).toBe('up')
  })

  it('down arrow for decreases', () => {
    const change = formatInterventionChange({ baselineValue: 0.8, targetValue: 0.2, label: 'X' })
    expect(change.arrow).toBe('down')
  })

  it('no arrow (and no no-change claim) when baseline unknown', () => {
    const change = formatInterventionChange({ baselineValue: null, targetValue: 0.6, label: 'X' })
    expect(change.arrow).toBeNull()
    expect(change.changed).toBe(true)
    expect(change.text).not.toMatch(/does not change/i)
  })
})

describe('formatInterventionChange — display units', () => {
  it('formats currency via the option-card chain (£ prefix, denormalised)', () => {
    const change = formatInterventionChange({
      baselineValue: 0.5,
      targetValue: 0.7,
      label: 'Ad spend',
      unit: '£',
      cap: 100000,
    })
    expect(change.targetText).toBe('£70,000')
    expect(change.baselineText).toBe('£50,000')
    expect(change.text).toBe('Ad spend → £70,000')
  })

  it('formats count units with plural ("5 engineers")', () => {
    const change = formatInterventionChange({
      baselineValue: 0.2,
      targetValue: 0.5,
      label: 'Headcount',
      unit: 'engineers',
      cap: 10,
    })
    expect(change.targetText).toBe('5 engineers')
  })

  it('singularises count units at exactly 1 ("1 engineer", not "1 engineers")', () => {
    const change = formatInterventionChange({
      baselineValue: 0,
      targetValue: 0.1,
      label: 'New headcount added',
      unit: 'engineers',
      cap: 10,
    })
    expect(change.targetText).toBe('1 engineer')
    expect(change.text).toBe('New headcount added → 1 engineer')
  })

  it('renders CEE display_value verbatim, without singularisation rewrites', () => {
    const change = formatInterventionChange({
      baselineValue: 0,
      targetValue: 1,
      label: 'Tech lead',
      targetDisplayValue: 'Tech lead hired',
    })
    expect(change.targetText).toBe('Tech lead hired')
  })
})

describe('formatInterventionTargetText', () => {
  it('does not singularise non-count units', () => {
    expect(formatInterventionTargetText({ label: 'Runway', value: 0.1, unit: 'months', cap: 10 })).toBe('1 months')
  })

  // ⚠ This test previously asserted `'60%'` under the name "converts
  // tier-label fallbacks to percentages" — it PINNED THE DEFECT. A factor with
  // no unit, no cap and no raw anchor has an ordinal 0–1 value, not a
  // proportion, so rendering it as a percentage invents a frame. Witnessed on
  // the 14 Aug hiring graph as "Development headcount 0% → 40%".
  it('keeps tier-label fallbacks as tier words (never invents a percentage)', () => {
    // 0.6 → 'Medium' per qualitativeTierLabel's `value <= 0.6` band
    // (labelUtils.ts:262) — derived from the producer, not guessed.
    expect(formatInterventionTargetText({ label: 'Quality', value: 0.6, factorType: 'quality' })).toBe('Medium')
  })

  // Guard the specific witnessed shape: a COUNT factor carrying no frame must
  // never render as a percentage of anything.
  it('renders an unframed count factor as level words, not a percentage', () => {
    const text = formatInterventionTargetText({
      label: 'Development headcount',
      value: 0.4,
      factorType: 'quality',
    })
    expect(text).not.toMatch(/%/)
    expect(text).toBe('Low')
  })

  // The legitimate percentage path must survive: a factor that genuinely
  // carries a unit still denormalises through the trusted chain.
  it('still formats genuinely united factors through the scale path', () => {
    expect(
      formatInterventionTargetText({ label: 'Runway', value: 0.1, unit: 'months', cap: 10 }),
    ).toBe('1 months')
  })
})

describe('describeInterventionDirection', () => {
  it('uses strict comparison (no display epsilon)', () => {
    expect(describeInterventionDirection(0.5, 0.6, 'Team seniority')).toBe('Increases Team seniority')
    expect(describeInterventionDirection(0.6, 0.5, 'Team seniority')).toBe('Decreases Team seniority')
    expect(describeInterventionDirection(0.5, 0.5, 'Team seniority')).toBe('Does not change Team seniority')
  })

  it('makes no directional claim when baseline unknown', () => {
    expect(describeInterventionDirection(null, 0.6, 'Team seniority')).toBe('Changes Team seniority')
  })
})
