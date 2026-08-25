/**
 * ROADMAP 2.1271 — THE OPEN QUESTION, SETTLED BY RENDERING.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE QUESTION (it gates CEE #1068)
 * ═══════════════════════════════════════════════════════════════════════════
 *   Does a MISLEADING freshness string actually RENDER when the provisional
 *   delivery applies a `complete_stale` or `refused` verdict that carries NO
 *   report?
 *
 * Static reading could not settle it, and the static chain that was handed to
 * this lane was stale in two places (see the corrections below), so the answer
 * here is taken from the DOM.
 *
 * ⚠ TWO CORRECTIONS TO THE INHERITED PREMISE, both derived at this tip:
 *
 *  1. `useAnalysisRunState()` is NOT "blind to the wire". That guard
 *     (`composed.authority === 'wire' ? composed.runStateKind : null`) has been
 *     DELETED; the hook now reads `composed.runStateKind` directly
 *     (`useAnalysisRunState.ts:247`). So the region IS driven by the verdict
 *     this delivery writes — which is exactly why the question is live.
 *  2. The cited copy source `copy/freshnessReasons.ts:28` does not exist at
 *     this tip. The stale line is `FRESHNESS_COPY.stale`
 *     (`AnalysisFreshnessNotice.tsx:45`): "Model changed since this analysis.
 *     Re-run to update."
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE VERDICT IS WRITTEN THROUGH THE REAL APPLIER
 * ═══════════════════════════════════════════════════════════════════════════
 * A test that calls `setAnalysisStateV1` by hand would prove something about
 * the store, not about this delivery. These cases drive
 * `applyScenarioAnalysisRead` — the delivery's own writer — against the REAL
 * canvas store, with `analysisResult: null`, which is what CEE ships on both of
 * these verdicts (the applier's header: "CEE ships no result block on this
 * verdict — those numbers describe a graph the user has since changed").
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { useCanvasStore } from '../../store'
import { readProvisionalApplyStore } from '../useProvisionalAnalysisDelivery'
import { applyScenarioAnalysisRead } from '../../hydrate/applyScenarioAnalysisRead'
import { AnalysisStateRegion } from '../../../components/results/analysisState/AnalysisStateRegion'
import { useAnalysisRunState } from '../../../components/results/analysisState/useAnalysisRunState'
import { AnalysisFreshnessNotice, FRESHNESS_COPY } from '../../../components/results/AnalysisFreshnessNotice'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

function verdict(runState: AnalysisStateV1['run_state']): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

/**
 * The surface as the region's real caller composes it: the run state comes from
 * `useAnalysisRunState()`, never from a prop the test chose.
 */
function Surface() {
  const runState = useAnalysisRunState()
  // `hasReport={false}` is the case under test: a terminal verdict arrived and
  // there are no numbers to show.
  return <AnalysisStateRegion runState={runState} hasReport={false} />
}

beforeEach(() => {
  useCanvasStore.getState().resultsReset()
  useCanvasStore.getState().setAnalysisStateV1(null)
})

describe('a RESULTLESS terminal delivery — what does the user actually read?', () => {
  it('PRECONDITION: the applier really does write these verdicts with no report', () => {
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_stale', computed_at: '2026-08-17T09:15:50.000Z', cause: 'graph_changed' }),
      analysisResult: null,
      store: readProvisionalApplyStore(),
    })
    // Pin the precondition in-test: if the applier ever stopped applying this
    // kind, the render assertions below would pass for the wrong reason.
    expect(outcome).toEqual({ outcome: 'applied', kind: 'complete_stale', resultsHydrated: false })
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_stale')
  })

  it('⭐ complete_stale + no report', () => {
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_stale', computed_at: '2026-08-17T09:15:50.000Z', cause: 'graph_changed' }),
      analysisResult: null,
      store: readProvisionalApplyStore(),
    })
    render(<Surface />)

    const region = screen.getByTestId('analysis-state-region')
    const banner = region.getAttribute('data-truth-banner')
    const presentation = region.getAttribute('data-body-presentation')
    const notice = screen.queryByTestId('analysis-freshness-notice')
    console.log(
      JSON.stringify({
        CASE: 'complete_stale/no-report',
        run_state: region.getAttribute('data-run-state'),
        truth_banner: banner,
        body_presentation: presentation,
        freshness_notice_mounted: notice !== null,
        freshness_attr: notice?.getAttribute('data-freshness') ?? null,
        rendered_text: notice?.textContent?.trim() ?? null,
        stale_copy_present: (notice?.textContent ?? '').includes(FRESHNESS_COPY.stale),
      }),
    )

    // The verdict reaches the region (correction 1 above).
    expect(region.getAttribute('data-run-state')).toBe('complete_stale')
    // And there is no body to accompany whatever the banner says.
    expect(presentation).toBe('hidden')
    // The finding itself is recorded as an explicit expectation below, in the
    // assertion the suite would RED on if this behaviour changed.
    expect(banner).toBe('freshness')
  })

  it('⭐ refused + no report', () => {
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'refused', reason_code: 'analysis_refused_unspecified' }),
      analysisResult: null,
      store: readProvisionalApplyStore(),
    })
    render(<Surface />)

    const region = screen.getByTestId('analysis-state-region')
    const notice = screen.queryByTestId('analysis-freshness-notice')
    const refusal = screen.queryByTestId('analysis-refusal-notice')
    console.log(
      JSON.stringify({
        CASE: 'refused/no-report',
        run_state: region.getAttribute('data-run-state'),
        truth_banner: region.getAttribute('data-truth-banner'),
        body_presentation: region.getAttribute('data-body-presentation'),
        freshness_notice_mounted: notice !== null,
        refusal_notice_mounted: refusal !== null,
        rendered_text: (notice ?? refusal)?.textContent?.trim() ?? null,
        stale_copy_present: (notice?.textContent ?? '').includes(FRESHNESS_COPY.stale),
      }),
    )

    expect(region.getAttribute('data-run-state')).toBe('refused')
    // ⭐ THE ANSWER FOR `refused`: the refusal notice owns this state's single
    // truth slot, so the freshness strip — and therefore the stale copy — is
    // structurally unreachable here. Bound to the region's own table
    // (`analysisStateContract.ts:107`), not to an incidental absence.
    expect(region.getAttribute('data-truth-banner')).toBe('refusal')
    expect(notice).toBeNull()
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CONTROLS — without these the two absences above prove NOTHING (trap 13)
 * ═══════════════════════════════════════════════════════════════════════════
 * Both cases above report "the stale copy did not render". That is only
 * evidence if this harness is CAPABLE of rendering it, and if the detector can
 * SEE it. A component that null-renders for an unrelated reason — a missing
 * provider, a store slice the harness never populates — produces exactly the
 * same clean output as a component that correctly declined to speak.
 */
describe('CONTROLS for the two absence claims above', () => {
  it('POSITIVE CONTROL — the stale copy IS renderable in this harness, and the detector sees it', () => {
    render(<AnalysisFreshnessNotice state={{ freshness: 'stale' }} />)
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice.getAttribute('data-freshness')).toBe('stale')
    // The same detector the absence claims use, now firing on a PRESENCE.
    expect(notice.textContent ?? '').toContain(FRESHNESS_COPY.stale)
  })

  it('CONTRAST CONTROL — a `fresh` verdict renders a DIFFERENT string, so the detector discriminates', () => {
    render(<AnalysisFreshnessNotice state={{ freshness: 'fresh' }} />)
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice.textContent ?? '').toContain(FRESHNESS_COPY.fresh)
    // A detector that matched anything would fail here.
    expect(notice.textContent ?? '').not.toContain(FRESHNESS_COPY.stale)
  })

  it('⭐⭐ THE RISK CASE — a user who ALREADY has a freshness verdict, then a resultless `complete_stale`', () => {
    // This is the combination the open question was really about, and it is the
    // one the first two cases could NOT reach: they started from a store with no
    // legacy `analysisFreshness` slice, which is why the strip stayed silent.
    // Here the user has had an analysis, so the strip has standing permission to
    // speak — and THEN the read leg delivers a resultless `complete_stale`.
    useCanvasStore.getState().setAnalysisFreshness({
      freshness: 'stale',
      freshness_reason: 'graph_hash_mismatch',
      computed_at: new Date().toISOString(),
    })
    // PRECONDITION, pinned: the strip now has something to say.
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('stale')

    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_stale', computed_at: '2026-08-17T09:15:50.000Z', cause: 'graph_changed' }),
      analysisResult: null,
      store: readProvisionalApplyStore(),
    })
    render(<Surface />)

    const region = screen.getByTestId('analysis-state-region')
    const notice = screen.queryByTestId('analysis-freshness-notice')
    const text = notice?.textContent ?? ''
    console.log(
      JSON.stringify({
        CASE: 'RISK: prior-verdict + complete_stale/no-report',
        run_state: region.getAttribute('data-run-state'),
        truth_banner: region.getAttribute('data-truth-banner'),
        body_presentation: region.getAttribute('data-body-presentation'),
        freshness_notice_mounted: notice !== null,
        freshness_attr: notice?.getAttribute('data-freshness') ?? null,
        rendered_text: text.trim() || null,
        stale_copy_present: text.includes(FRESHNESS_COPY.stale),
      }),
    )

    expect(region.getAttribute('data-run-state')).toBe('complete_stale')
    expect(region.getAttribute('data-body-presentation')).toBe('hidden')
    // ⭐ THE ANSWER. Recorded as an assertion so a future change to this
    // behaviour REDs here rather than shipping silently.
    expect(notice).not.toBeNull()
    expect(text).toContain(FRESHNESS_COPY.stale)
  })

  it('⭐⭐ ATTRIBUTION — the DELIVERY is what makes that line appear, not the prior verdict alone', () => {
    // The case above establishes that the line renders. It does NOT establish
    // that this slice caused it: the legacy `analysisFreshness` slice was
    // already 'stale', so the line might have been on screen regardless.
    // Without this control the finding would be an unattributed correlation —
    // and CEE #1068 turns on WHICH change is responsible.
    useCanvasStore.getState().setAnalysisFreshness({
      freshness: 'stale',
      freshness_reason: 'graph_hash_mismatch',
      computed_at: new Date().toISOString(),
    })
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('stale')

    // NO delivery. Same legacy slice, same `hasReport={false}`.
    const before = render(<Surface />)
    const regionBefore = screen.getByTestId('analysis-state-region')
    const runStateBefore = regionBefore.getAttribute('data-run-state')
    const bannerBefore = regionBefore.getAttribute('data-truth-banner')
    const noticeBefore = screen.queryByTestId('analysis-freshness-notice')
    console.log(
      JSON.stringify({
        CASE: 'ATTRIBUTION: prior-verdict, NO delivery',
        run_state: runStateBefore,
        truth_banner: bannerBefore,
        freshness_notice_mounted: noticeBefore !== null,
        stale_copy_present: (noticeBefore?.textContent ?? '').includes(FRESHNESS_COPY.stale),
      }),
    )

    // The line is NOT on screen before the delivery — so the prior verdict alone
    // does not produce it, and the delivery is the cause.
    expect(bannerBefore).toBe('none')
    expect(noticeBefore).toBeNull()
    before.unmount()

    // Now the delivery, and only the delivery, changes.
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_stale', computed_at: '2026-08-17T09:15:50.000Z', cause: 'graph_changed' }),
      analysisResult: null,
      store: readProvisionalApplyStore(),
    })
    render(<Surface />)
    expect(screen.getByTestId('analysis-state-region').getAttribute('data-truth-banner')).toBe(
      'freshness',
    )
    expect(screen.getByTestId('analysis-freshness-notice').textContent ?? '').toContain(
      FRESHNESS_COPY.stale,
    )
  })
})
