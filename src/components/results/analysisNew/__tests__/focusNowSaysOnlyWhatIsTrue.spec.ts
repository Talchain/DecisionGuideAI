/**
 * Focus Now's generic nudges are narrowed to what is TRUE of this model, and
 * the Analysis tab's behaviour is unchanged.
 *
 * The defect this prevents: mounting `STATIC_HYGIENE_ROWS` on the Reasoning tab
 * would tell a person with a goal, outcomes and risks to "define what success
 * looks like" — a gap the surface never measured.
 */
import { describe, it, expect } from 'vitest'
import { applicableStaticFocusIds } from '../focusNowApplicability'
import { buildFocusRows } from '../../../../canvas/components/coaching-panel/focus-now/buildFocusRows'
import { STATIC_HYGIENE_ROWS } from '../../../../canvas/components/coaching-panel/focus-now/focusConstants'

describe('applicableStaticFocusIds — only a MEASURED absence earns a row', () => {
  it('a complete model earns nothing', () => {
    expect(
      applicableStaticFocusIds({ hasGoalTarget: true, outcomeCount: 2, riskCount: 3 }),
    ).toEqual([])
  })

  it('an unset goal target earns define-success, and nothing else', () => {
    expect(
      applicableStaticFocusIds({ hasGoalTarget: false, outcomeCount: 2, riskCount: 3 }),
    ).toEqual(['static:define-success'])
  })

  it('zero outcomes and zero risks earn their own rows', () => {
    expect(
      applicableStaticFocusIds({ hasGoalTarget: true, outcomeCount: 0, riskCount: 0 }),
    ).toEqual(['static:add-outcome', 'static:add-risk'])
  })

  it('⛔ UNKNOWN IS NOT ABSENT — null earns nothing, in every field', () => {
    expect(
      applicableStaticFocusIds({ hasGoalTarget: null, outcomeCount: null, riskCount: null }),
    ).toEqual([])
  })

  it('every id it can return is a real row in the canonical list', () => {
    const real = new Set(STATIC_HYGIENE_ROWS.map((r) => r.id))
    const produced = applicableStaticFocusIds({
      hasGoalTarget: false,
      outcomeCount: 0,
      riskCount: 0,
    })
    expect(produced.length).toBeGreaterThan(0)
    for (const id of produced) expect(real.has(id)).toBe(true)
  })
})

describe('buildFocusRows — the narrowing is opt-in', () => {
  it('⚠ OMITTED means SHOW ALL: the Analysis tab is unchanged', () => {
    const vm = buildFocusRows({})
    expect(vm.rows.map((r) => r.id)).toEqual(STATIC_HYGIENE_ROWS.map((r) => r.id))
  })

  it('supplied means narrow to exactly those ids', () => {
    const vm = buildFocusRows({ applicableStaticIds: ['static:add-risk'] })
    expect(vm.rows.map((r) => r.id)).toEqual(['static:add-risk'])
  })

  it('an EMPTY list is a real answer — show nothing, not everything', () => {
    // The arm that separates "narrow to none" from "no opinion". A `?? ALL`
    // fallback would pass every other case in this file and fail only here.
    const vm = buildFocusRows({ applicableStaticIds: [] })
    expect(vm.rows).toEqual([])
  })
})
