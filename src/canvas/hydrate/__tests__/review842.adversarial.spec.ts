import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import {
  composeAnalysisState,
  selectAnalysisReadinessAuthority,
} from '../../state/analysisStateSelector'
import { readinessObjectsToRun } from '../../utils/canRunAnalysis'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

function verdict(runState: AnalysisStateV1['run_state']): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: true,
    blocked_unusable: runState.kind === 'blocked',
    contradictions: [],
  } as AnalysisStateV1
}

function response(analysisState: AnalysisStateV1): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      schema: 'scenario_graph.v1',
      scenario_id: SCENARIO_ID,
      graph: {
        nodes: [
          { id: 'unrelated-a', kind: 'factor', label: 'Other' },
          { id: 'unrelated-b', kind: 'goal', label: 'Elsewhere' },
        ],
        edges: [],
      },
      graph_present: true,
      brief_text: null,
      graph_identity_hash: {
        kind: 'graph_identity_hash',
        value: 'c'.repeat(64),
        algorithm: 'sha256',
        projection_version: 'identity.v1',
        graph_schema_version: 'graph_v3',
        normaliser_version: '1',
      },
      layout_present: false,
      request_id: 'review-842',
      analysis_state: analysisState,
    }),
  } as unknown as Response
}

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Spend', kind: 'factor' } },
      { id: 'goal-1', type: 'goal', position: { x: 200, y: 0 }, data: { label: 'Profit', kind: 'goal' } },
    ] as never,
    edges: [] as never,
    analysisStateV1: null,
    analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
    analysisFreshnessDirty: false,
    serverGraphIdentity: null,
    lastAuthoritativeGraph: null,
    history: { past: [], future: [] },
  } as never)
})

afterEach(() => vi.unstubAllGlobals())

describe('PR 842 independent graph-acceptance attack', () => {
  it('restores a verdict even though the graph carrying it is refused as unrelated', async () => {
    const stale = verdict({
      kind: 'complete_stale',
      computed_at: '2026-08-25T09:00:00.000Z',
      cause: 'graph_changed',
    } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(stale)))

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_stale')
  })

  it('lets a non-gating old blocked verdict become the wire authority for the unrelated canvas', async () => {
    const blocked = verdict({ kind: 'blocked', reason_code: 'no_options', blockers: [] } as never)
    expect(readinessObjectsToRun(null, selectAnalysisReadinessAuthority(blocked))).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(blocked)))

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
    const held = useCanvasStore.getState().analysisStateV1
    expect(held?.run_state.kind).toBe('blocked')
    const composed = composeAnalysisState({
      analysisState: held,
      freshness: useCanvasStore.getState().analysisFreshness,
      dirty: false,
      source: 'none',
      resultsStatus: 'complete',
      importHold: false,
      hasReport: true,
      ceeAnalysisReadyStatus: 'ready',
      aiPanelV2On: true,
    })
    expect(composed.authority).toBe('wire')
    expect(composed.runStateKind).toBe('blocked')
    expect(composed.displayState.state).toBe('not_ready')
  })
})
