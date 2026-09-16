/**
 * Focus Now's generic nudges are narrowed to what is TRUE of this model.
 *
 * The defect this prevents: mounting `STATIC_HYGIENE_ROWS` unchanged on the
 * Reasoning tab would tell a person with a goal, outcomes and risks to "define
 * what success looks like" — a gap the surface never measured, in the slot the
 * prototype reserves for the panel's one primary action.
 *
 * ⚠ THIS FILE IMPORTS NOTHING FROM `focus-now`, DELIBERATELY. That module's
 * inertness guard is an allow-list of importers, and it caught this spec when it
 * reached in for `buildFocusRows`. The rule under test here is the PANEL's — the
 * narrowing behaviour is the module's own and is pinned in
 * `focus-now/__tests__/narrowingIsOptIn.spec.ts`, where the import is in-module
 * and legitimate. Two questions, two homes.
 */
import { describe, it, expect } from 'vitest'
import { applicableStaticFocusIds, ADJUDICABLE_STATIC_IDS } from '../focusNowApplicability'

describe('applicableStaticFocusIds — only a MEASURED absence earns a row', () => {
  it('a complete model earns nothing', () => {
    expect(applicableStaticFocusIds({ hasGoalTarget: true, outcomeCount: 2, riskCount: 3 })).toEqual([])
  })

  it('an unset goal target earns define-success, and nothing else', () => {
    expect(applicableStaticFocusIds({ hasGoalTarget: false, outcomeCount: 2, riskCount: 3 })).toEqual([
      'static:define-success',
    ])
  })

  it('zero outcomes and zero risks earn their own rows', () => {
    expect(applicableStaticFocusIds({ hasGoalTarget: true, outcomeCount: 0, riskCount: 0 })).toEqual([
      'static:add-outcome',
      'static:add-risk',
    ])
  })

  it('⛔ UNKNOWN IS NOT ABSENT — null earns nothing, in every field', () => {
    // The arm that matters on an unloaded canvas: "no outcome row" and "no
    // model" are indistinguishable from the rows alone, so the caller passes
    // null and this must stay silent rather than demand an outcome.
    expect(applicableStaticFocusIds({ hasGoalTarget: null, outcomeCount: null, riskCount: null })).toEqual([])
  })

  it('never returns an id outside the set it declares it can adjudicate', () => {
    const declared = new Set<string>(ADJUDICABLE_STATIC_IDS)
    const produced = applicableStaticFocusIds({ hasGoalTarget: false, outcomeCount: 0, riskCount: 0 })
    expect(produced.length).toBe(ADJUDICABLE_STATIC_IDS.length)
    for (const id of produced) expect(declared.has(id)).toBe(true)
  })
})
