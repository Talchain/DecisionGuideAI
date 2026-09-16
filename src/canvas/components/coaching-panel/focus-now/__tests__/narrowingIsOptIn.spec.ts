/**
 * `buildFocusRows`' static-row narrowing is OPT-IN, and an empty list is a real
 * answer.
 *
 * ⚠ THE ASYMMETRY IS THE POINT. Omitting `applicableStaticIds` means SHOW ALL,
 * not show none: the Analysis tab has mounted the six generic rows
 * unconditionally since they shipped, and narrowing them there silently would
 * be a behaviour change smuggled in under a new consumer's requirement. The
 * Reasoning tab asks for the narrowing; ResultsBody does not and is unaffected.
 *
 * Lives in-module because the inertness guard allow-lists importers of
 * `focus-now` — the panel-side rule it serves is pinned separately in
 * `analysisNew/__tests__/focusNowSaysOnlyWhatIsTrue.spec.ts`.
 */
import { describe, it, expect } from 'vitest'
import { buildFocusRows } from '../buildFocusRows'
import { STATIC_HYGIENE_ROWS } from '../focusConstants'
import { ADJUDICABLE_STATIC_IDS } from '../../../../../components/results/analysisNew/focusNowApplicability'

describe('buildFocusRows — the narrowing is opt-in', () => {
  it('⚠ OMITTED means SHOW ALL: the Analysis tab is unchanged', () => {
    expect(buildFocusRows({}).rows.map((r) => r.id)).toEqual(STATIC_HYGIENE_ROWS.map((r) => r.id))
  })

  it('supplied means narrow to exactly those ids', () => {
    expect(buildFocusRows({ applicableStaticIds: ['static:add-risk'] }).rows.map((r) => r.id)).toEqual([
      'static:add-risk',
    ])
  })

  it('an EMPTY list is a real answer — show nothing, not everything', () => {
    // The arm that separates "narrow to none" from "no opinion". A `?? ALL`
    // fallback would pass every other case in this file and fail only here.
    expect(buildFocusRows({ applicableStaticIds: [] }).rows).toEqual([])
  })

  it('every id the panel can adjudicate is a REAL row here — the two lists cannot drift', () => {
    const real = new Set(STATIC_HYGIENE_ROWS.map((r) => r.id))
    expect(ADJUDICABLE_STATIC_IDS.length).toBeGreaterThan(0)
    for (const id of ADJUDICABLE_STATIC_IDS) expect(real.has(id)).toBe(true)
  })
})
