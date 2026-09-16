/**
 * "Robustness status: Computed" printed on a run whose robustness verdict never
 * arrived, beside four surfaces correctly saying it did not.
 *
 * ## Measured on a real payload
 *
 * Paul's run `f51850fc` (16 Sep). `enrichment.robustness` carries exactly three
 * keys — `near_tie`, `robust_edges` (3), `fragile_edges` (4) — and **no
 * `display_verdict`, no `level`, no `is_robust`, no stability figure**.
 *
 * `robustnessStatus` read the edge lists:
 *
 * ```ts
 * const hasRobustnessData = robustness && (
 *   safeArray(robustness.fragile_edges).length > 0 ||
 *   safeArray(robustness.robust_edges).length > 0 || … )
 * ```
 *
 * — so it answered *"did ANY robustness data arrive?"* and said **computed**,
 * while every consumer reads it as *"did the robustness CHECK produce a
 * verdict?"*. `StressTestSection:444` is explicit about that reading: it maps
 * the field to **"didn't-run vs clean"**. Trap 21, on one word.
 *
 * The contrasting run `1dd2133d` carries `display_verdict: 'fragile'` WITH the
 * edges, so both readings agreed there and the defect was invisible — which is
 * why the corpus here is two real payloads and not one.
 *
 * ## Why `display_verdict`, and not a fourth spelling
 *
 * The estate already ruled which field answers this, in two places:
 * `canvas/nodes/DecisionNode.tsx:523` and `canvas/hooks/useAnalysisMetadata.ts:16`
 * — *"`display_verdict` is the ONLY field licensed to make a robustness claim"*.
 * `level` is that hook's own documented fallback and is kept. Adding a fifth
 * predicate over robustness would be the drift this fixes.
 *
 * ## What this cannot hide, checked before changing it
 *
 * Every consumer of `robustnessStatus` was enumerated. None gates CONTENT on
 * it: `StressTestSection` uses it only inside `fragileCount === 0 &&
 * sensitiveCount === 0`, so it cannot suppress a fragile-edge list;
 * `OutputsDock:3573-3595` uses it for a banner and a label inside that banner.
 * So this changes what the surfaces SAY about the verdict and removes no data —
 * the opposite harm, which cannot share this parameter (trap 22b).
 *
 * ⚠ ROWED, NOT SMUGGLED IN: "some robustness data arrived but no verdict" is a
 * genuine THIRD state and a two-valued field cannot express it. On `f51850fc`
 * the honest reading is "the verdict did not come back, and here are the
 * relationships it did look at". Expressing that needs a third value and a pass
 * over every consumer's boolean. It is not this change.
 */

import { describe, it, expect } from 'vitest'

import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { deriveRobustnessStatus } from '../robustnessStatus'

/** `f51850fc`: edges and a near-tie, and no verdict of any kind. */
const NO_VERDICT = {
  near_tie: { is_tie: false, gap: 0.21, threshold: 0.1 },
  robust_edges: [{ edge_id: 'a->b' }, { edge_id: 'b->c' }, { edge_id: 'c->d' }],
  fragile_edges: [
    { edge_id: 'w->x', switch_probability: 0.19 },
    { edge_id: 'x->y', switch_probability: 0.18 },
    { edge_id: 'y->z', switch_probability: 0.17 },
    { edge_id: 'z->w', switch_probability: 0.16 },
  ],
}

/** `1dd2133d`: the same edge lists PLUS the producer's verdict. */
const WITH_VERDICT = {
  ...NO_VERDICT,
  is_robust: false,
  level: 'low',
  display_verdict: 'fragile',
  display_verdict_reason:
    'small changes to your assumptions could change which option is most likely to achieve your goal',
}

const reportWith = (robustness: Record<string, unknown> | undefined) =>
  mapV5AnalysisToReport({
    type: 'analysis_result',
    summary: 's',
    ...(robustness ? { enrichment: { robustness } } : {}),
  } as never)

describe('robustnessStatus answers the verdict question', () => {
  it('is not computed when the producer sent edges and no verdict', () => {
    expect(deriveRobustnessStatus(reportWith(NO_VERDICT))).toBe('unavailable')
  })

  it('is computed when the producer sent a display verdict', () => {
    expect(deriveRobustnessStatus(reportWith(WITH_VERDICT))).toBe('computed')
  })

  it('pins the discrimination: the two fixtures differ ONLY in the verdict fields', () => {
    // Without this the first two could both be passing for the wrong reason —
    // a fixture that failed to build, or edges that never survived the mapper.
    // The edge lists must be identical and non-empty on both (trap 13b).
    const a = reportWith(NO_VERDICT) as { robustness?: Record<string, unknown> }
    const b = reportWith(WITH_VERDICT) as { robustness?: Record<string, unknown> }
    expect((a.robustness?.fragile_edges as unknown[])?.length).toBe(4)
    expect((b.robustness?.fragile_edges as unknown[])?.length).toBe(4)
    expect(a.robustness?.display_verdict).toBeUndefined()
    expect(b.robustness?.display_verdict).toBe('fragile')
  })

  it('accepts level as the verdict, matching useAnalysisMetadata’s documented fallback', () => {
    const levelOnly = { ...NO_VERDICT, level: 'low' }
    expect(deriveRobustnessStatus(reportWith(levelOnly))).toBe('computed')
  })

  it('is not computed when no robustness block arrived at all', () => {
    expect(deriveRobustnessStatus(reportWith(undefined))).toBe('unavailable')
  })

  it('does not accept an empty or non-string verdict as one', () => {
    expect(deriveRobustnessStatus(reportWith({ ...NO_VERDICT, display_verdict: '   ' }))).toBe(
      'unavailable',
    )
    expect(deriveRobustnessStatus(reportWith({ ...NO_VERDICT, display_verdict: 7 }))).toBe(
      'unavailable',
    )
  })
})
