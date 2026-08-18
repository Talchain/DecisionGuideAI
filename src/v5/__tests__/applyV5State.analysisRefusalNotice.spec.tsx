/**
 * ROADMAP 2.1163 / golden-journey EXT-2 — the refusal SEAM.
 *
 * CEE PR #942 emits, on a refused analyse turn:
 *
 *   analysis_ready: { status: 'blocked', blocked_reason: <specific>, options: [],
 *                     goal_node_id: '', freshness, freshness_reason, computed_at }
 *   stage_indicator: 'analyse'
 *
 * ⚠⚠ THERE ARE NOW TWO REFUSAL CARRIERS, AND THIS COMMENT USED TO DESCRIBE
 * ONLY ONE. It read: *"The readiness normaliser REJECTS this carrier (empty
 * goal_node_id / empty options) ... That is CORRECT and must NOT change."*
 * That is TRUE OF THE EMPTY CARRIER AND FALSE AS A GENERAL STATEMENT, because
 * CEE #1023 (merged 2026-08-18) deliberately made the OTHER arm ACCEPTED.
 * `buildAnalysisRefusalReadiness` (`analysis-ready-helper.ts:1427-1472` at CEE
 * `293da078`) now takes the turn's structural projection and PRESERVES the
 * model's identity when that projection is not `ready`:
 *
 *   ARM A — EMPTY   `{ status:'blocked', blocked_reason, options:[],
 *                       goal_node_id:'' }`. Returned byte-identically to before
 *                       when the structural projection is `ready`, absent, or
 *                       degenerate, and on the chip-click arm which passes
 *                       nothing. The normaliser REJECTS it →
 *                       `setCeeAnalysisReady(null)` + a deferred
 *                       `analysis_ready_invalid_shape`. That rejection is
 *                       correct and must not change: a deployed-UI trace
 *                       (2026-08-14) established the clearing kills two harms,
 *                       the R1–R3 dynamics are premised on it, and
 *                       `applyV5State.blockedAnalysisReady.spec.tsx` pins it.
 *
 *   ARM B — IDENTITY-PRESERVING `{ status:'blocked', blocked_reason,
 *                       options:[…non-empty], goal_node_id:'…' }`. The
 *                       normaliser ACCEPTS it — CEE copied the UI's own accept
 *                       predicate verbatim as its degeneracy guard — so this
 *                       arm produces `analysis_ready:set`, NOT a clear.
 *
 * Both arms set the refusal notice, because `deriveAnalysisRefusalNoticeUpdate`
 * keys on `status` + a non-empty `blocked_reason` and nothing else. Arm B is
 * pinned end to end in its own describe below; the arm-A tests keep asserting
 * the readiness and freshness behaviour is BYTE-FOR-BYTE what it was.
 *
 * The three-valued update is the point of the seam:
 *   set    — blocked + non-empty blocked_reason
 *   clear  — an accepted analysis_ready, or a completed analysis_result
 *   retain — everything else (setter NOT called), so the notice survives the
 *            conversational turns that follow a refusal.
 */

import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import { deriveAnalysisDisplayState } from '../../canvas/utils/deriveAnalysisDisplayState'
import { AnalysisRefusalNotice } from '../../components/results/AnalysisRefusalNotice'
import {
  ANALYSIS_REFUSAL_HEADLINE,
  ANALYSIS_REFUSAL_REASON_COPY,
} from '../../canvas/store/analysisRefusalNotice'

/**
 * ARM A — the EMPTY refusal carrier, exact CEE wire shape
 * (`buildAnalysisRefusalReadiness` with no/ready/degenerate structural
 * projection, + attachComputedAt). Still emitted; still rejected by the
 * readiness normaliser.
 */
const REFUSAL_ANALYSIS_READY = {
  status: 'blocked',
  blocked_reason: 'options_not_configured',
  options: [] as unknown[],
  goal_node_id: '',
  freshness: 'stale',
  freshness_reason: 'graph_changed_since_run',
  computed_at: '2026-08-14T10:00:00.000Z',
}

/**
 * Exact CEE LEGACY carrier (synthesiseFreshnessOnlyAnalysisReady) — blocked,
 * but with NO blocked_reason. Emitted on legacy/unparseable reloads. It is the
 * opposite-direction twin: same `status`, and it must produce NO notice.
 */
const LEGACY_FRESHNESS_ONLY_ANALYSIS_READY = {
  status: 'blocked',
  goal_node_id: '',
  options: [] as unknown[],
  bias_findings: [] as unknown[],
  computed_at: '2026-07-07T10:00:00.000Z',
  freshness: 'unknown',
  freshness_reason: 'legacy_fact_missing_hash',
}

/**
 * ARM B — the IDENTITY-PRESERVING refusal carrier (CEE #1023, merged
 * 2026-08-18). Shape derived from the PRODUCER, not from the name:
 * `buildAnalysisRefusalReadiness` returns `{ ...refusal, goal_node_id, options }`
 * where both come straight off the turn's structural projection
 * (`analysis-ready-helper.ts:1471` at CEE `293da078`), and the option entries
 * are `OptionForAnalysis` (`src/schemas/analysis-ready.ts:83-101`: id, label,
 * status, interventions). The function writes NO per-option status of its own.
 *
 * `MISSING_OPTION_VALUE` is the code the P0 that motivated #1023 was measured
 * on, against deployed staging.
 */
const IDENTITY_PRESERVING_REFUSAL_ANALYSIS_READY = {
  status: 'blocked',
  blocked_reason: 'MISSING_OPTION_VALUE',
  goal_node_id: '378f195a',
  options: [
    { id: 'opt_expand_eu', label: 'Expand into the EU', status: 'needs_encoding', interventions: {} },
    { id: 'opt_hold', label: 'Hold position', status: 'needs_encoding', interventions: {} },
  ] as unknown[],
  freshness: 'unknown',
  freshness_reason: 'no_successful_run_analysis_fact',
  computed_at: '2026-08-18T05:00:00.000Z',
}

const ACCEPTED_ANALYSIS_READY = {
  status: 'ready',
  goal_node_id: 'goal_1',
  options: [{ id: 'opt_1', interventions: {}, status: 'ready' }],
  computed_at: '2026-08-14T11:00:00.000Z',
}

function baseResponse(overrides: Partial<OlumiResponse> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  }
}

function makeStore() {
  const setCeeAnalysisReady = vi.fn()
  const setAnalysisFreshness = vi.fn()
  const setAnalysisRefusalNotice = vi.fn()
  const store: V5ApplicatorStore = {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady,
    setAnalysisFreshness,
    setAnalysisRefusalNotice,
    nodes: [],
    edges: [],
  }
  return { store, setCeeAnalysisReady, setAnalysisFreshness, setAnalysisRefusalNotice }
}

describe('applyV5State — CEE typed analysis refusal (EXT-2)', () => {
  it('routes the refusal into its OWN slice, with the specific blocked_reason', () => {
    const { store, setAnalysisRefusalNotice } = makeStore()

    const result = applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: REFUSAL_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(setAnalysisRefusalNotice).toHaveBeenCalledTimes(1)
    expect(setAnalysisRefusalNotice).toHaveBeenCalledWith({
      blockedReason: 'options_not_configured',
      computedAt: '2026-08-14T10:00:00.000Z',
    })
    expect(result.applied).toContain('analysis_refusal_notice:set')
  })

  it('LEAVES THE ACCEPTANCE GATE UNCHANGED — the readiness slice is still cleared and still deferred', () => {
    // The gate rejects this carrier BY DESIGN. Routing the refusal elsewhere
    // must not have softened it.
    const { store, setCeeAnalysisReady } = makeStore()

    const result = applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: REFUSAL_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
    expect(result.applied).not.toContain('analysis_ready:set')
    expect(
      result.deferred.some((d) => d.reason === 'analysis_ready_invalid_shape'),
    ).toBe(true)
  })

  it('LEAVES THE FRESHNESS SLICE UNCHANGED — it still consumes the raw payload', () => {
    const { store, setAnalysisFreshness } = makeStore()

    applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: REFUSAL_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(setAnalysisFreshness).toHaveBeenCalledTimes(1)
    expect(setAnalysisFreshness).toHaveBeenCalledWith(REFUSAL_ANALYSIS_READY)
  })

  it('OPPOSITE-DIRECTION TWIN: the legacy freshness-only blocked carrier sets NO notice', () => {
    // Same `status: 'blocked'`, no `blocked_reason`. Keying on status alone
    // would fabricate a refusal on every legacy reload.
    const { store, setAnalysisRefusalNotice, setCeeAnalysisReady } = makeStore()

    const result = applyV5State(
      baseResponse({
        analysis_ready: LEGACY_FRESHNESS_ONLY_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(setAnalysisRefusalNotice).not.toHaveBeenCalled()
    expect(result.applied).not.toContain('analysis_refusal_notice:set')
    expect(result.applied).not.toContain('analysis_refusal_notice:cleared')
    // ...and the pre-existing behaviour for that carrier is untouched.
    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
  })

  it('CLEARS on the next accepted analysis_ready', () => {
    const { store, setAnalysisRefusalNotice } = makeStore()

    const result = applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: ACCEPTED_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(setAnalysisRefusalNotice).toHaveBeenCalledWith(null)
    expect(result.applied).toContain('analysis_refusal_notice:cleared')
  })

  it('CLEARS on a successful analysis_result turn that carries no analysis_ready', () => {
    const { store, setAnalysisRefusalNotice } = makeStore()

    applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        blocks: [{ type: 'analysis_result' }],
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(setAnalysisRefusalNotice).toHaveBeenCalledWith(null)
  })

  it('RETAINS across an ordinary conversational turn — the setter is not called at all', () => {
    // If this turn cleared, the notice would vanish before the user read it.
    const { store, setAnalysisRefusalNotice } = makeStore()

    const result = applyV5State(
      baseResponse({ stage_indicator: 'frame', assistant_text: 'Tell me more.' }),
      store,
    )

    expect(setAnalysisRefusalNotice).not.toHaveBeenCalled()
    expect(result.applied).not.toContain('analysis_refusal_notice:cleared')
  })

  it('WIRE→DOM: a refused turn produces the rendered notice with its specific reason', () => {
    // The whole point of the row: blocked_reason reaches a surface.
    const { store, setAnalysisRefusalNotice } = makeStore()

    applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: REFUSAL_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    const routed = setAnalysisRefusalNotice.mock.calls[0]?.[0]
    render(<AnalysisRefusalNotice notice={routed} />)

    const el = screen.getByTestId('analysis-refusal-notice')
    expect(el).toHaveTextContent(ANALYSIS_REFUSAL_HEADLINE)
    expect(el).toHaveTextContent(
      ANALYSIS_REFUSAL_REASON_COPY.options_not_configured,
    )
    expect(el).toHaveAttribute('data-blocked-reason', 'options_not_configured')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ARM B — the newly reachable accepted carrier, end to end.
//
// ⚠ THIS ARM HAD ZERO COVERAGE. Every test above and in
// `applyV5State.blockedAnalysisReady.spec.tsx` drives the EMPTY carrier, so the
// suite was fully green about a wire shape the deployed producer now emits and
// the normaliser now ACCEPTS. A green suite is not evidence about a branch no
// test reaches.
//
// The end-to-end claim is the point (P2 — check the MOUNTED consumer, not the
// producer bytes): a refusal that is ACCEPTED into the readiness slice must
// still reach the user as "not ready", never as a green completion. The chain
// pinned here is `applyV5State` → the readiness status it wrote →
// `deriveAnalysisDisplayState`, which is the canonical mapper the analysis
// surfaces consume through `useAnalysisState().displayState`.
// ═══════════════════════════════════════════════════════════════════════════

describe('applyV5State — ARM B: the IDENTITY-PRESERVING refusal carrier (CEE #1023)', () => {
  it('is ACCEPTED into the readiness slice — analysis_ready:set, not cleared', () => {
    const { store, setCeeAnalysisReady } = makeStore()

    const result = applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: IDENTITY_PRESERVING_REFUSAL_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(result.applied).toContain('analysis_ready:set')
    expect(setCeeAnalysisReady).not.toHaveBeenCalledWith(null)
    expect(
      result.deferred.some((d) => d.reason === 'analysis_ready_invalid_shape'),
    ).toBe(false)
  })

  it("preserves the model's IDENTITY into the slice — the goal and both option ids, by identity", () => {
    const { store, setCeeAnalysisReady } = makeStore()

    applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: IDENTITY_PRESERVING_REFUSAL_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    const written = setCeeAnalysisReady.mock.calls.at(-1)?.[0] as
      | { status?: string; goal_node_id?: string; options?: { id: string }[] }
      | null
    // Bound by IDENTITY (the exact ids CEE preserved), never by a count — a
    // count is satisfied by any two options.
    expect(written?.goal_node_id).toBe('378f195a')
    expect(written?.options?.map((o) => o.id)).toEqual([
      'opt_expand_eu',
      'opt_hold',
    ])
    expect(written?.status).toBe('blocked')
  })

  it('STILL sets the refusal notice — acceptance into readiness does not consume the refusal', () => {
    const { store, setAnalysisRefusalNotice } = makeStore()

    const result = applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: IDENTITY_PRESERVING_REFUSAL_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(setAnalysisRefusalNotice).toHaveBeenCalledTimes(1)
    expect(setAnalysisRefusalNotice).toHaveBeenCalledWith({
      blockedReason: 'MISSING_OPTION_VALUE',
      computedAt: '2026-08-18T05:00:00.000Z',
    })
    expect(result.applied).toContain('analysis_refusal_notice:set')
  })

  it('END TO END: the accepted refusal renders as NOT READY, even with a prior report in hand', () => {
    const { store, setCeeAnalysisReady } = makeStore()

    applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: IDENTITY_PRESERVING_REFUSAL_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    const written = setCeeAnalysisReady.mock.calls.at(-1)?.[0] as
      | { status?: string }
      | null
    // The status the applicator actually wrote is what the mapper receives —
    // not a status this test chose, which is the difference between pinning the
    // chain and pinning a fixture (trap 16: a fixture you wrote yourself is not
    // evidence about the wire).
    const view = deriveAnalysisDisplayState({
      ceeAnalysisReadyStatus: written?.status,
      // The hostile case: a populated prior report would render a green
      // "Analysis complete" if the refusal status did not override it.
      hasReport: true,
      analysisChanged: false,
    })

    expect(view.state).toBe('not_ready')
  })

  it("OPPOSITE-DIRECTION TWIN: an ACCEPTED 'ready' carrier is not_ready's opposite — it clears the notice and renders complete", () => {
    const { store, setAnalysisRefusalNotice, setCeeAnalysisReady } = makeStore()

    const result = applyV5State(
      baseResponse({
        stage_indicator: 'analyse',
        analysis_ready: ACCEPTED_ANALYSIS_READY,
      } as unknown as Partial<OlumiResponse>),
      store,
    )

    expect(setAnalysisRefusalNotice).toHaveBeenCalledWith(null)
    expect(result.applied).toContain('analysis_refusal_notice:cleared')

    const written = setCeeAnalysisReady.mock.calls.at(-1)?.[0] as
      | { status?: string }
      | null
    const view = deriveAnalysisDisplayState({
      ceeAnalysisReadyStatus: written?.status,
      hasReport: true,
      analysisChanged: false,
    })
    // Proves the previous test's `not_ready` is the refusal's doing and not a
    // constant this harness always produces.
    expect(view.state).toBe('complete')
  })
})
