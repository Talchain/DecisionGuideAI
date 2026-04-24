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
      stage_indicator: { stage: 'ideate', confidence: 'high', source: 'inferred' },
    } as unknown as OlumiResponse

    applyV5State(response, store)
    expect(store.setCeeAnalysisReady).toHaveBeenCalledWith(null)
  })
})

describe('applyV5State — conversational turn preserves ceeAnalysisReady', () => {
  it('does not call setCeeAnalysisReady when analysis_ready is absent on an ideate-stage conversational turn', () => {
    const store = makeStore()
    const response = {
      turn_id: 't',
      assistant_text: 'hi',
      blocks: [],
      stage_indicator: { stage: 'ideate', confidence: 'high', source: 'inferred' },
    } as unknown as OlumiResponse

    applyV5State(response, store)
    expect(store.setCeeAnalysisReady).not.toHaveBeenCalled()
  })
})

describe('applyV5State — stale-turn guard invariant', () => {
  it('drops analysis_ready write when turnClientId does not match currentClientTurnId', () => {
    const store = makeStore()
    const response = {
      turn_id: 't',
      assistant_text: null,
      blocks: [],
      stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
      analysis_ready: readyPayload,
    } as unknown as OlumiResponse

    const result = applyV5State(response, store, {
      turnClientId: 'turn_older',
      currentClientTurnId: 'turn_newer',
    })

    expect(store.setCeeAnalysisReady).not.toHaveBeenCalled()
    expect(result.deferred.some((d) => d.reason === 'analysis_ready_stale_turn')).toBe(true)
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
        stage_indicator: { stage: 'ideate', confidence: 'high', source: 'inferred' },
      } as unknown as OlumiResponse,
      store,
    )
    expect(setCeeAnalysisReady).not.toHaveBeenCalled()

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
