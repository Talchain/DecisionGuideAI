/**
 * Bundle-level: what `useDebugData` → `buildDebugBundle` actually exports for
 * Paul's 24 Sep selection (exports 2f1b374e / a390efd9, UI a4434670).
 *
 * The trace store is REAL and every turn goes through the real V5 adapter, so
 * the bodies the bundle reads have been parsed, recorded and redacted exactly
 * as in the browser. Only the canvas store is stubbed, carrying the scenario id
 * and the `results.hash` the store would hold after hydrating the analysis
 * (derived with the store's own `mapV5AnalysisToReport`, never typed in).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../../../lib/version-cache', () => ({
  getClientBuild: () => 'test-build',
  getVersionInfo: () => ({ short: 'test-version', branch: 'main' }),
}))
vi.mock('../../../utils/debugLogBuffer', () => ({ getBufferedLogs: () => [] }))
vi.mock('../../../lib/debug-state', () => ({ getUserActions: () => [] }))
vi.mock('../../../lib/gate-state', () => ({
  useGateStore: vi.fn((selector: (s: unknown) => unknown) => selector({ gates: {} })),
}))

const canvasState: Record<string, unknown> = {}
vi.mock('../../../canvas/store', () => {
  const useCanvasStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(canvasState)),
    { getState: () => canvasState },
  )
  return { useCanvasStore }
})

import { useDebugData } from '../hooks/useDebugData'
import { buildDebugBundle } from '../utils/exportBundle'
import { callV5Turn } from '../../../v5/v5Adapter'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { usePayloadTraceStore } from '../../../lib/payload-trace-store'

const SCENARIO = '11014edf-b553-4089-a09c-484a3cf53010'

const ANALYSIS_BLOCK = {
  type: 'analysis_result',
  summary: 'Raise to £59 at Release leads on the MRR goal; the churn limit was not tested.',
  leading_option_id: 'raise_to_59_at_release',
  win_probabilities: { hold_49_pro_price: 0.0285, raise_to_59_at_release: 0.6252, '59_for_new_customers': 0.3463 },
  enrichment: {
    option_comparison: [
      { option_id: 'raise_to_59_at_release', win_probability: 0.6252 },
      { option_id: '59_for_new_customers', win_probability: 0.3463 },
      { option_id: 'hold_49_pro_price', win_probability: 0.0285 },
    ],
  },
}

const body = (assistant_text: string, blocks: unknown[]) => ({
  response_version: 2, assistant_text, blocks, suggested_actions: [], insights: [],
  stage_indicator: blocks.length > 0 ? 'analyse' : 'frame',
})

async function turn(message: string, responseBody: Record<string, unknown>, chip?: { action_type: string }) {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(responseBody), {
    status: 200, headers: { 'content-type': 'application/json', 'x-olumi-response-hash': 'producer-' + message.length },
  }))
  const result = await callV5Turn({
    kind: 'message', turn_id: crypto.randomUUID(), scenario_id: SCENARIO, stage: 'frame', turn_class: 'frame',
    message, source: chip ? 'chip_click' : 'composer', ...(chip ? { chip } : {}),
  } as never, { fetchImpl })
  const traceId = usePayloadTraceStore.getState().payloads[0].id
  let resultsHash: string | null = null
  if (result.kind === 'response') {
    const block = result.response.blocks.find((b) => b.type === 'analysis_result')
    if (block) resultsHash = mapV5AnalysisToReport(block as never).model_card.response_hash
  }
  return { traceId, resultsHash }
}

function exportNow(resultsHash: string) {
  Object.assign(canvasState, {
    ceePipelineTrace: null, nodes: [], edges: [], runMeta: null,
    currentScenarioId: SCENARIO,
    results: { hash: resultsHash, report: null, rawV2Response: null },
    goalConstraints: [], ceeAnalysisReady: null, v5AnalysisFact: null,
  })
  const { result } = renderHook(() => useDebugData())
  return { data: result.current, bundle: buildDebugBundle(result.current) }
}

beforeEach(() => {
  usePayloadTraceStore.getState().clearPayloads()
  for (const k of Object.keys(canvasState)) delete canvasState[k]
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('debug export — earlier refused Run, later free-text turn delivered the displayed analysis', () => {
  it('payloads.cee_* is the turn that delivered the displayed analysis, and no hash mismatch is claimed', async () => {
    await turn('Run analysis', body('I can’t run a meaningful comparison yet.', []), { action_type: 'run_analysis' })
    await turn('Can you update them with sensible default inputs?', body('Defaults are prepared as assumptions.', []))
    const approval = await turn('Yes, please make all of these updates.', body('The analysis has run.', [ANALYSIS_BLOCK]))
    const { data, bundle } = exportNow(approval.resultsHash!)

    expect(bundle.payloads.cee_request).toMatchObject({ message: 'Yes, please make all of these updates.' })
    expect((bundle.payloads.cee_response as { blocks: Array<{ type: string }> }).blocks[0].type).toBe('analysis_result')
    expect(data.conversational_trace_id).toBe(approval.traceId)
    expect(data.cee_capture_response_hash_mismatch).toBe(false)
    expect(data.analysis_evidence_trace_id).toBe(approval.traceId)
  })

  it('analysis_identity names the latest turn and the displayed analysis apart (a390 shape)', async () => {
    await turn('Run analysis', body('I can’t run a meaningful comparison yet.', []), { action_type: 'run_analysis' })
    const approval = await turn('Yes, please make all of these updates.', body('The analysis has run.', [ANALYSIS_BLOCK]))
    const latest = await turn('Can you change pro feature value perception to 50%?', body('Only blank inputs can be filled.', []))
    const { bundle } = exportNow(approval.resultsHash!)

    expect(bundle.analysis_identity).toMatchObject({
      available: true,
      results_hash: approval.resultsHash,
      displayed_analysis_is_from_turn: approval.traceId,
      latest_turn_carried_analysis: false,
      latest_turn_is_displayed_analysis: false,
      latest_conversation_turn: { trace_id: latest.traceId, relation: 'no_analysis_result' },
      analysis_payload: { trace_id: approval.traceId, relation: 'delivered_displayed_analysis' },
    })
    const turns = bundle.recent_conversation_turns.turns
    expect(turns.find((t) => t.trace_id === approval.traceId)).toMatchObject({
      is_analysis_producing: false, carried_analysis_result: true, is_displayed_analysis: true,
    })
    expect(turns.filter((t) => t.is_displayed_analysis).map((t) => t.trace_id)).toEqual([approval.traceId])
  })
})

describe('contrast — the latest turn IS the displayed analysis', () => {
  it('payloads.cee_* stays on the latest typed Run and identity says they are the same turn', async () => {
    await turn('Should we raise the Pro price?', body('I built a comparison model.', []))
    const run = await turn('Run analysis', body('Analysis complete.', [ANALYSIS_BLOCK]), { action_type: 'run_analysis' })
    const { data, bundle } = exportNow(run.resultsHash!)

    expect(bundle.payloads.cee_request).toMatchObject({ message: 'Run analysis', chip: { action_type: 'run_analysis' } })
    expect(data.conversational_trace_id).toBe(run.traceId)
    expect(bundle.analysis_identity).toMatchObject({
      displayed_analysis_is_from_turn: run.traceId,
      latest_turn_carried_analysis: true,
      latest_turn_is_displayed_analysis: true,
      analysis_payload: { trace_id: run.traceId, relation: 'delivered_displayed_analysis' },
    })
  })
})
