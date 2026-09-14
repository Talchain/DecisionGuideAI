/**
 * A model is named after what it is about, not "Untitled model".
 *
 * The auto-title that derives a name from the framing goal is gated on
 * persistence — Supabase users only — so a GUEST's model kept the generic
 * fallback forever while its goal sat in the same store. The name is the first
 * thing a reader sees and the thing a shared model is identified by.
 *
 * ⚠ PRECEDENCE IS THE WHOLE CONTRACT and each rung is asserted separately: a
 * chosen name must beat a derivation, and a derivation must beat the generic
 * fallback. A test that only checked the derived case would pass on an
 * implementation that ignored a stored title entirely.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveModelDisplayName,
  deriveModelNameFromGoal,
  UNNAMED_MODEL_FALLBACK,
  DERIVED_NAME_MAX,
} from '../modelDisplayName'

describe('deriveModelNameFromGoal', () => {
  it('uses the goal verbatim when it fits', () => {
    expect(deriveModelNameFromGoal('Cut Customer Support Response Times'))
      .toBe('Cut Customer Support Response Times')
  })

  it('elides a long goal to the cap, ellipsis included in the budget', () => {
    const goal = 'x'.repeat(200)
    const out = deriveModelNameFromGoal(goal)!
    // The ellipsis is INSIDE the cap, not appended past it — a name that
    // overflows its own limit would be clipped by the column instead.
    expect(out).toHaveLength(DERIVED_NAME_MAX)
    expect(out.endsWith('...')).toBe(true)
  })

  it('returns null — never an empty string — when the goal cannot name anything', () => {
    // `null` means "no derivation available". Returning '' would let a caller
    // render a blank title by forgetting to check.
    expect(deriveModelNameFromGoal(undefined)).toBeNull()
    expect(deriveModelNameFromGoal(null)).toBeNull()
    expect(deriveModelNameFromGoal('   ')).toBeNull()
    expect(deriveModelNameFromGoal(42)).toBeNull()
  })
})

describe('resolveModelDisplayName — precedence', () => {
  it('1. a name someone CHOSE always wins over the goal', () => {
    expect(resolveModelDisplayName('Q3 support plan', 'Cut Customer Support Response Times'))
      .toBe('Q3 support plan')
  })

  it('2. with no stored title, the goal names the model — the defect this fixes', () => {
    expect(resolveModelDisplayName(undefined, 'Cut Customer Support Response Times'))
      .toBe('Cut Customer Support Response Times')
    expect(resolveModelDisplayName(undefined, 'Cut Customer Support Response Times'))
      .not.toBe(UNNAMED_MODEL_FALLBACK)
  })

  it('3. with neither, it tells the truth about being unnamed', () => {
    // ⛔ The fallback is NOT removed. `ScenarioSwitcher.commitRename` rules that
    // "a model with no name is worse than one called 'Untitled model'"; this
    // keeps that answer for the case it was written about.
    expect(resolveModelDisplayName(undefined, undefined)).toBe(UNNAMED_MODEL_FALLBACK)
    expect(resolveModelDisplayName('   ', '   ')).toBe(UNNAMED_MODEL_FALLBACK)
  })

  it('a whitespace-only stored title does not beat a usable goal', () => {
    // The escape: treating any non-undefined title as "chosen" would let a
    // blank string suppress the derivation and reinstate the generic name.
    expect(resolveModelDisplayName('   ', 'Cut Customer Support Response Times'))
      .toBe('Cut Customer Support Response Times')
  })
})
