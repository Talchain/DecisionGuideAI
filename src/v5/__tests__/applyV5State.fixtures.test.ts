/**
 * Phase 4 — fixture-driven integration tests for applyV5State + the
 * downstream null-probability / BoundaryError contracts.
 *
 * Fixtures at `src/fixtures/v5/` encode every state permutation the UI
 * must consume:
 *   - analysis_ready present (ready / not_ready) → store writes or hides
 *   - analysis_ready missing on analyse turn → explicit-unknown clear
 *   - run success (full probs / null probs) → guard gates "Analysis complete"
 *   - boundary error → no success state
 *   - conversational chips only → slice preserved
 *   - reproduction of the recent failing trace (null probs + stale ready)
 *
 * These pin the whole data-flow chain end-to-end without needing the real
 * orchestrator.
 */
import { describe, it, expect, vi } from 'vitest'

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

import readyFixture from '../../fixtures/v5/analysis_ready_ready.json'
import notReadyFixture from '../../fixtures/v5/analysis_ready_not_ready.json'
import missingFixture from '../../fixtures/v5/analysis_ready_missing.json'
import boundaryErrorFixture from '../../fixtures/v5/run_boundary_error.json'
import conversationalFixture from '../../fixtures/v5/conversational_chips_only.json'

function makeStore(init?: Partial<V5ApplicatorStore>): V5ApplicatorStore {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    nodes: [],
    edges: [],
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    ...init,
  }
}

describe('applyV5State fixture-driven integration', () => {
  it('ready fixture writes ceeAnalysisReady with status=ready', () => {
    const store = makeStore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyV5State(readyFixture as any, store)
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        goal_node_id: 'goal_hiring_success',
      }),
    )
    expect(store.setCurrentStage).toHaveBeenCalled()
  })

  it('not_ready fixture writes ceeAnalysisReady with non-ready status', () => {
    const store = makeStore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyV5State(notReadyFixture as any, store)
    const call = (store.setCeeAnalysisReady as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call).toBeDefined()
    expect(call![0]).toMatchObject({ status: 'needs_user_input' })
    expect(call![0].status).not.toBe('ready')
  })

  it('missing-on-analyse-turn fixture clears ceeAnalysisReady (explicit-unknown)', () => {
    const store = makeStore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyV5State(missingFixture as any, store)
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(null)
  })

  it('conversational fixture preserves ceeAnalysisReady (no setter call)', () => {
    const store = makeStore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyV5State(conversationalFixture as any, store)
    expect(store.setCeeAnalysisReady).not.toHaveBeenCalled()
  })

  it('boundary-error fixture does not write analysis_ready', () => {
    const store = makeStore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = applyV5State(boundaryErrorFixture as any, store)
    // No analysis_ready field on the response → analyse-shaped (stage=analyse)
    // triggers explicit-unknown clear. This is correct: BoundaryError means
    // whatever readiness was there before must not be trusted.
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(null)
    // The applied list reflects the clear, NOT a ready write.
    expect(result.applied).toContain('analysis_ready:cleared_on_analyse_turn')
    expect(result.applied).not.toContain('analysis_ready:set')
  })
})

// Null-probability guard fixture coverage lives in a canvas-scoped test
// (src/canvas/ui/inspector-v2/__tests__/report-fixtures.spec.ts) to keep
// the v5-scoped typecheck from expanding across the canvas/ tree.

describe('stale-turn invariant with fixture', () => {
  it('older response with ready payload does not write any slice when a newer turn is active', () => {
    // The ready fixture carries stage=analyse, an analysis_result block,
    // and analysis_ready. Under the stale guard, none of those should
    // reach the store.
    const store = makeStore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyV5State(readyFixture as any, store, {
      turnClientId: 'turn_older',
      currentClientTurnId: 'turn_newer',
    })
    expect(store.setCurrentStage).not.toHaveBeenCalled()
    expect(store.setRunMeta).not.toHaveBeenCalled()
    expect(store.setCeeAnalysisReady).not.toHaveBeenCalled()
  })
})
