/**
 * Lane UI-W5 (feature B): blocked-status handling — CEE #358 defensive leg.
 *
 * On legacy/unparseable reloads CEE's response finaliser synthesises a
 * freshness-only analysis_ready block (olumi-assistants-service
 * src/orchestrator-v5/compose/analysis-ready-emit.ts):
 *
 *   { status: 'blocked', goal_node_id: '', options: [], bias_findings: [] }
 *
 * stamped by attachComputedAt with computed_at + freshness: 'unknown' +
 * freshness_reason ('legacy_fact_missing_hash' | 'current_graph_hash_
 * unavailable'). This spec pins what the live V5 ingestion path
 * (applyV5State step 4) does with that exact wire shape:
 *
 *  1. no crash;
 *  2. the readiness slice is CLEARED (normaliseV5AnalysisReady rejects the
 *     empty goal_node_id / empty options) → no surface can claim readiness
 *     or completeness from it; the rejection is reported honestly as a
 *     deferred 'analysis_ready_invalid_shape';
 *  3. the freshness slice STILL consumes the payload (setAnalysisFreshness
 *     runs before shape validation) → verdict 'unknown' with the reason
 *     preserved — the blocked/unknown state is shown honestly, not
 *     silently dropped;
 *  4. the freshness surface (AnalysisFreshnessNotice) renders the honest
 *     cannot-confirm copy — never "Analysis reflects the current model",
 *     never "Analysis complete".
 */

import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import {
  deriveAnalysisFreshnessUpdate,
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
} from '../../canvas/store/analysisFreshness'
import { AnalysisFreshnessNotice } from '../../components/results/AnalysisFreshnessNotice'

/** Exact CEE wire shape (synthesiseFreshnessOnlyAnalysisReady + attachComputedAt). */
const BLOCKED_ANALYSIS_READY = {
  status: 'blocked',
  goal_node_id: '',
  options: [] as unknown[],
  bias_findings: [] as unknown[],
  computed_at: '2026-07-07T10:00:00.000Z',
  freshness: 'unknown',
  freshness_reason: 'legacy_fact_missing_hash',
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

function makeStore(): {
  store: V5ApplicatorStore
  setCeeAnalysisReady: ReturnType<typeof vi.fn>
  setAnalysisFreshness: ReturnType<typeof vi.fn>
} {
  const setCeeAnalysisReady = vi.fn()
  const setAnalysisFreshness = vi.fn()
  return {
    store: {
      setCurrentStage: vi.fn(),
      updateNode: vi.fn(),
      updateEdgeData: vi.fn(),
      setRunMeta: vi.fn(),
      setCeeAnalysisReady,
      setAnalysisFreshness,
      nodes: [],
      edges: [],
    },
    setCeeAnalysisReady,
    setAnalysisFreshness,
  }
}

function blockedResponse(): OlumiResponse {
  return baseResponse({
    analysis_ready: BLOCKED_ANALYSIS_READY,
  } as unknown as Partial<OlumiResponse>)
}

describe('applyV5State — CEE blocked analysis_ready (empty options, legacy reload)', () => {
  it('does not crash and clears the readiness slice (no readiness/completeness claim survives)', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    const result = applyV5State(blockedResponse(), store)

    // Shape rejected (goal_node_id '' + options []) → store cleared, honestly deferred.
    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
    expect(result.applied).not.toContain('analysis_ready:set')
    expect(
      result.deferred.some((d) => d.reason === 'analysis_ready_invalid_shape'),
    ).toBe(true)
  })

  it('still routes the payload into the freshness slice (blocked state is not silently dropped)', () => {
    const { store, setAnalysisFreshness } = makeStore()
    applyV5State(blockedResponse(), store)

    expect(setAnalysisFreshness).toHaveBeenCalledTimes(1)
    expect(setAnalysisFreshness).toHaveBeenCalledWith(BLOCKED_ANALYSIS_READY)
  })

  it('freshness reducer derives an honest unknown verdict (reason + computed_at preserved)', () => {
    const next = deriveAnalysisFreshnessUpdate(null, BLOCKED_ANALYSIS_READY)

    expect(next).toEqual({
      freshness: 'unknown',
      freshnessReason: 'legacy_fact_missing_hash',
      graphHashAtRun: undefined,
      currentGraphHash: undefined,
      computedAt: '2026-07-07T10:00:00.000Z',
    })
    // Display semantic: cannot-confirm — NEVER 'current', NEVER 'changed'
    // (the user did not edit anything; CEE could not determine freshness).
    expect(classifyFreshnessForDisplay(next, false, false)).toBe('cannot_confirm')
  })

  it('freshness surface renders the honest cannot-confirm copy, not a currentness or completeness claim', () => {
    const state = deriveAnalysisFreshnessUpdate(
      null,
      BLOCKED_ANALYSIS_READY,
    ) as AnalysisFreshnessState

    render(<AnalysisFreshnessNotice state={state} dirty={false} />)

    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice).toHaveAttribute('data-freshness', 'unknown')
    expect(notice).toHaveTextContent('Cannot confirm whether this analysis is current.')
    expect(notice).not.toHaveTextContent('Analysis reflects the current model')
    expect(notice).not.toHaveTextContent(/analysis complete/i)
    // Technical reason rides on a data-attribute only — never user copy.
    expect(notice).toHaveAttribute('data-freshness-reason', 'legacy_fact_missing_hash')
    expect(notice).not.toHaveTextContent('legacy_fact_missing_hash')
  })
})
