/**
 * ROADMAP 2.1163 / golden-journey EXT-2 — the refusal SEAM.
 *
 * CEE PR #942 emits, on a refused analyse turn:
 *
 *   analysis_ready: { status: 'blocked', blocked_reason: <specific>, options: [],
 *                     goal_node_id: '', freshness, freshness_reason, computed_at }
 *   stage_indicator: 'analyse'
 *
 * ⚠⚠ THE CONSTRAINT THIS SPEC EXISTS TO PROTECT, AS MUCH AS THE FEATURE.
 * The readiness normaliser REJECTS this carrier (empty goal_node_id / empty
 * options) → `setCeeAnalysisReady(null)` + a deferred
 * `analysis_ready_invalid_shape`. That is CORRECT and must NOT change: a
 * deployed-UI trace (2026-08-14) established the clearing kills two harms and
 * the R1–R3 dynamics are premised on it, and
 * `applyV5State.blockedAnalysisReady.spec.tsx` pins it independently. So the
 * refusal is routed into its OWN slice, and the tests below assert the
 * readiness and freshness behaviour is BYTE-FOR-BYTE what it was.
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
import { AnalysisRefusalNotice } from '../../components/results/AnalysisRefusalNotice'
import {
  ANALYSIS_REFUSAL_HEADLINE,
  ANALYSIS_REFUSAL_REASON_COPY,
} from '../../canvas/store/analysisRefusalNotice'

/** Exact CEE refusal wire shape (buildAnalysisRefusalReadiness + attachComputedAt). */
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
