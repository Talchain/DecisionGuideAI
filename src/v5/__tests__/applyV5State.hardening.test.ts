/**
 * Phase 2.1 — analysis_ready consumption hardening.
 *
 * Contracts pinned here:
 *   - Analyse-shaped turn + missing analysis_ready → store cleared
 *     (explicit-unknown, not silent no-op).
 *   - Conversational turn + missing analysis_ready → store preserved.
 *   - Stale-turn guard: response.turnClientId !== store.currentClientTurnId
 *     drops all V5 writes, even for otherwise-valid ready payloads.
 *   - Hydration sequence: sessionStorage restore → conversational turn →
 *     analyse turn with missing analysis_ready → slice clears.
 */
import { describe, expect, it, vi } from 'vitest'

import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

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

const readyPayload = {
  goal_node_id: 'goal_1',
  status: 'ready',
  options: [
    { id: 'opt_1', label: 'A', status: 'ready', interventions: {} },
  ],
}

describe('applyV5State — analyse-turn with missing analysis_ready', () => {
  it('clears ceeAnalysisReady when stage is analyse and key is absent', () => {
    const store = makeStore()
    const response = {
      turn_id: 't',
      assistant_text: null,
      blocks: [],
      stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
    } as unknown as OlumiResponse

    const result = applyV5State(response, store)
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(null)
    expect(result.applied).toContain('analysis_ready:cleared_on_analyse_turn')
  })

  it('clears ceeAnalysisReady when an analysis_result block is present but analysis_ready is absent', () => {
    const store = makeStore()
    const response = {
      turn_id: 't',
      assistant_text: null,
      blocks: [
        { type: 'analysis_result', block_id: 'b1', enrichment: {} } as unknown as OlumiResponse['blocks'][number],
      ],
      // Non-analyse stage (canonical wire vocab: frame|analyse|decide|review) — a
      // deliberate distractor. This test proves the analysis_result BLOCK drives the
      // clear, independent of stage. (Was 'ideate' — retired UI/DB vocab that
      // normaliseStage rejects, so it silently exercised the unrecognised-stage path.)
      stage_indicator: { stage: 'frame', confidence: 'high', source: 'inferred' },
    } as unknown as OlumiResponse

    applyV5State(response, store)
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(null)
  })
})

describe('applyV5State — conversational turn preserves ceeAnalysisReady', () => {
  it('does not call setCeeAnalysisReady when analysis_ready is absent on a frame-stage conversational turn', () => {
    const store = makeStore()
    const response = {
      turn_id: 't',
      assistant_text: 'hi',
      blocks: [],
      // Canonical non-analyse wire stage. Was 'ideate' (retired UI/DB vocab):
      // normaliseStage rejected it, so the turn was treated as an *unrecognised*
      // stage rather than a *recognised conversational* one — the intended path
      // was never exercised.
      stage_indicator: { stage: 'frame', confidence: 'high', source: 'inferred' },
    } as unknown as OlumiResponse

    applyV5State(response, store)
    expect(store.setCeeAnalysisReady).not.toHaveBeenCalled()
    // The stage is now genuinely recognised and applied — this is what the
    // fixture always intended. Reverting to 'ideate' makes normaliseStage return
    // null, this assertion fails, and the vacuous unrecognised-stage path returns.
    expect(store.setCurrentStage).toHaveBeenCalledWith('frame')
  })
})

describe('applyV5State — stale-turn guard invariant', () => {
  it('drops ALL writes (stage, graph_patch, runMeta, analysis_ready) when turnClientId is stale', () => {
    // The invariant pinned here covers every slice the response touches,
    // not just readiness. Stage, graph_patch (node + edge), and runMeta
    // (from analysis_result enrichment) must all be gated by the same
    // turn-id comparison. This is improvement I-1 from the ChatGPT review.
    const store = makeStore({
      nodes: [{ id: 'n1', type: 'factor', data: {}, position: { x: 0, y: 0 } } as unknown as never],
      edges: [{ id: 'e1', source: 'a', target: 'b', data: {} } as unknown as never],
    })
    const response = {
      turn_id: 't',
      assistant_text: null,
      blocks: [
        {
          type: 'graph_patch',
          block_id: 'b1',
          status: 'applied',
          operation: 'set_factor_value',
          target_id: 'n1',
          after: { value: 0.9 },
        },
        {
          type: 'graph_patch',
          block_id: 'b2',
          status: 'applied',
          operation: 'adjust_edge_strength',
          target_id: 'e1',
          after: { weight: 0.7, direction: 'positive' },
        },
        {
          type: 'analysis_result',
          block_id: 'b3',
          enrichment: {
            decision_review: { version: 1, overall: 'strong', rubric: {} },
          },
        },
      ],
      stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
      analysis_ready: readyPayload,
    } as unknown as OlumiResponse

    const result = applyV5State(response, store, {
      turnClientId: 'turn_older',
      currentClientTurnId: 'turn_newer',
    })

    expect(store.setCurrentStage).not.toHaveBeenCalled()
    expect(store.updateNode).not.toHaveBeenCalled()
    expect(store.updateEdgeData).not.toHaveBeenCalled()
    expect(store.setRunMeta).not.toHaveBeenCalled()
    expect(store.setCeeAnalysisReady).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'stale_turn_all_writes_skipped')).toBe(true)
    expect(result.applied).toEqual([])
  })

  it('three-step invariant: newer ready applied → older missing arrives → state remains ready', () => {
    // Step 1: apply newer ready. Store setter records it.
    const store = makeStore()
    applyV5State(
      {
        turn_id: 'turn_newer',
        assistant_text: null,
        blocks: [],
        stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
        analysis_ready: readyPayload,
      } as unknown as OlumiResponse,
      store,
      { turnClientId: 'turn_newer', currentClientTurnId: 'turn_newer' },
    )
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' }),
    )

    // Step 2: the newer turn has already overwritten the active turn id when
    // the older analyse-shaped response (missing analysis_ready) lands.
    const olderResponse = {
      turn_id: 'turn_older',
      assistant_text: null,
      blocks: [],
      stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
      // analysis_ready absent
    } as unknown as OlumiResponse
    ;(store.setCeeAnalysisReady as ReturnType<typeof vi.fn>).mockClear()

    applyV5State(olderResponse, store, {
      turnClientId: 'turn_older',
      currentClientTurnId: 'turn_newer',
    })

    // Step 3: because the older response is stale, neither the explicit-unknown
    // clear nor anything else fired. The ready state stays.
    expect(store.setCeeAnalysisReady).not.toHaveBeenCalled()
  })

  it('writes when turnClientId matches current (not stale)', () => {
    const store = makeStore()
    applyV5State(
      {
        turn_id: 'turn_x',
        assistant_text: null,
        blocks: [],
        stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
        analysis_ready: readyPayload,
      } as unknown as OlumiResponse,
      store,
      { turnClientId: 'turn_x', currentClientTurnId: 'turn_x' },
    )
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' }),
    )
  })

  it('writes when staleness options are absent (backwards compatible)', () => {
    const store = makeStore()
    applyV5State(
      {
        turn_id: 'turn_x',
        assistant_text: null,
        blocks: [],
        stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
        analysis_ready: readyPayload,
      } as unknown as OlumiResponse,
      store,
    )
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' }),
    )
  })
})

describe('applyV5State — hidden / system turn stale-guard regression', () => {
  // P1-1 regression: the stale-turn invariant must compare against the
  // most-recently-dispatched V5 turn id of ANY kind (visible, hidden,
  // system), not just the last visible user input. A hidden or system
  // turn that dispatched AFTER a visible user turn must have its response
  // accepted, not dropped as stale.
  it('hidden turn dispatched after a visible user turn → its response writes state', () => {
    // Simulate: user sent visible turn A (clientTurnId='user_A'), then a
    // hidden turn B dispatched (clientTurnId='hidden_B'), then hidden
    // turn B's response lands. Under the correct guard, currentClientTurnId
    // reflects the most-recent dispatch (hidden_B), so the response with
    // turnClientId='hidden_B' is accepted.
    const store = makeStore()
    const response = {
      turn_id: 'hidden_B',
      assistant_text: null,
      blocks: [],
      stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
      analysis_ready: readyPayload,
    } as unknown as OlumiResponse

    const result = applyV5State(response, store, {
      turnClientId: 'hidden_B',
      currentClientTurnId: 'hidden_B', // activeV5TurnIdRef was updated on dispatch
    })

    expect(store.setCurrentStage).toHaveBeenCalled()
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' }),
    )
    expect(result.applied).toContain('analysis_ready:set')
    expect(result.deferred.some((d) => d.reason === 'stale_turn_all_writes_skipped')).toBe(false)
  })

  it('system turn dispatched after a visible user turn → response writes state', () => {
    // Same shape as the hidden case. The invariant does not distinguish
    // hidden from system — only dispatch order matters.
    const store = makeStore()
    const response = {
      turn_id: 'system_C',
      assistant_text: null,
      blocks: [
        {
          type: 'analysis_result',
          block_id: 'br',
          enrichment: { decision_review: { version: 1, overall: 'strong' } },
        },
      ],
      stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
    } as unknown as OlumiResponse

    applyV5State(response, store, {
      turnClientId: 'system_C',
      currentClientTurnId: 'system_C',
    })

    expect(store.setCurrentStage).toHaveBeenCalled()
    expect(store.setRunMeta).toHaveBeenCalled()
  })

  it('but: hidden turn response IS dropped if a newer turn dispatched after it', () => {
    // The invariant still holds: dispatch order wins. If hidden turn B
    // dispatched, then visible turn D dispatched (activeV5TurnIdRef now
    // 'user_D'), then hidden turn B's response arrives, it is stale.
    const store = makeStore()
    const response = {
      turn_id: 'hidden_B',
      assistant_text: null,
      blocks: [],
      stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
      analysis_ready: readyPayload,
    } as unknown as OlumiResponse

    applyV5State(response, store, {
      turnClientId: 'hidden_B',
      currentClientTurnId: 'user_D',
    })

    expect(store.setCurrentStage).not.toHaveBeenCalled()
    expect(store.setCeeAnalysisReady).not.toHaveBeenCalled()
  })
})

describe('applyV5State — hydration regression', () => {
  it('ready hydrated → conversational turn preserves → analyse-missing turn clears', () => {
    // Simulate the hydrate: the store already holds ready state.
    const setCeeAnalysisReady = vi.fn()
    const store = makeStore({ setCeeAnalysisReady })

    // 1. Conversational turn with no analysis_ready → no write.
    applyV5State(
      {
        turn_id: 'turn_conv',
        assistant_text: 'thinking through it',
        blocks: [],
        // Canonical non-analyse wire stage (was 'ideate' — retired UI/DB vocab
        // that normaliseStage rejects, silently exercising the unrecognised path).
        stage_indicator: { stage: 'frame', confidence: 'high', source: 'inferred' },
      } as unknown as OlumiResponse,
      store,
    )
    expect(setCeeAnalysisReady).not.toHaveBeenCalled()
    // The conversational stage is recognised and applied. Reverting to 'ideate'
    // drops this write and re-introduces the vacuous unrecognised-stage path.
    expect(store.setCurrentStage).toHaveBeenCalledWith('frame')

    // 2. Analyse-shaped turn with no analysis_ready → explicit clear.
    applyV5State(
      {
        turn_id: 'turn_ana',
        assistant_text: null,
        blocks: [],
        stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
      } as unknown as OlumiResponse,
      store,
    )
    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
  })
})
