import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'
import { openV5TurnStream, recordStreamedTerminalIngest } from '../../v5/streamedTurnTransport'
import { callV5Turn } from '../../v5/v5Adapter'
import { usePayloadTraceStore } from '../payload-trace-store'
import { matchingScenarioAnalysisReads, findLatestAnalysisProducingCeeTurn } from '../analysisProducingCeeTurn'
import { findLatestEvidenceBearingCeeTurn } from '../evidenceBearingCeeTurn'
import { selectRecentConversationTurns } from '../recentConversationTurns'
import { resolveScientificEvidence } from '../v5EmbeddedEvidence'
import { classifyV5CanonicalAnalysisDiagnostic } from '../v5CanonicalAnalysisDiagnostics'
import { classifyV5CapturePipelineStatus } from '../v5CapturePipelineStatus'

const scenarioId = '11111111-2222-4333-8444-555555555555'
const otherScenario = '22222222-2222-4333-8444-555555555555'
const block = {
  type: 'analysis_result' as const,
  summary: 'Illustrative comparison',
  win_probabilities: { option_a: 0.6, option_b: 0.4 },
  enrichment: { option_comparison: [{ option_id: 'option_a', win_probability: 0.6 }] },
}
const reportHash = mapV5AnalysisToReport(block as never).model_card.response_hash
const readBody = {
  schema: 'scenario_graph.v1', scenario_id: scenarioId, request_id: 'server-read-1',
  graph_present: true, graph: { nodes: [], edges: [] },
  analysis_result: block,
}

beforeEach(() => { usePayloadTraceStore.getState().clearPayloads() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('stream and read-delivered evaluation capture', () => {
  it('records the actual stream duration once and counts paired open and terminal receipts as one user turn', async () => {
    const start = Date.parse('2026-09-19T18:16:01.789Z')
    await openV5TurnStream({ kind: 'message', scenario_id: scenarioId, message: 'A brief' } as never, {
      headers: { 'X-Request-ID': 'server-draft-1' },
      fetchImpl: vi.fn().mockResolvedValue(new Response('', { status: 200 })),
    })
    recordStreamedTerminalIngest({
      payload: { kind: 'message', scenario_id: scenarioId, message: 'A brief' } as never,
      parsed: { kind: 'response', response: { assistant_text: 'A draft', blocks: [] } as never },
      statusCode: 200, startedAt: start, completedAt: start + 48_980,
      headers: { 'X-Request-ID': 'server-draft-1' },
    })
    const [receipt] = usePayloadTraceStore.getState().payloads
    expect(receipt.endpoint).toMatch(/\/turn\/stream$/)
    expect(receipt.timestamp + receipt.duration!).toBe(start + 48_980)
    expect(receipt.completedAt).toBe(start + 48_980)
    const ledger = selectRecentConversationTurns(usePayloadTraceStore.getState().payloads)
    expect(ledger.turn_record_count).toBe(1)
    expect(ledger.answered_count).toBe(1)
    expect(ledger.user_authored_count).toBe(1)
    expect(ledger.transport_leg_count).toBe(1)
    expect(ledger.turns[0]).toMatchObject({
      transport_kind: 'streamed_terminal_ingest', request_id: 'server-draft-1',
      timestamp: start, completed_at: start + 48_980,
    })
  })

  it('carries an actual read response through evidence selection without inventing a conversational fact', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(readBody), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const result = await fetchScenarioGraph(scenarioId)
    expect(result.status).toBe('graph')
    expect(fetch).toHaveBeenCalledTimes(1)
    const traces = usePayloadTraceStore.getState().payloads
    const [read] = matchingScenarioAnalysisReads(traces, scenarioId, reportHash)
    expect(read.capture).toMatchObject({ kind: 'scenario_graph_read', requestId: 'server-read-1' })
    expect(read.response?.body).toEqual(readBody)
    expect(findLatestAnalysisProducingCeeTurn(traces, scenarioId, reportHash).selected).toBeUndefined()
    expect(selectRecentConversationTurns(traces).turn_record_count).toBe(0)
    const evidence = findLatestEvidenceBearingCeeTurn(traces, scenarioId, reportHash)
    expect(evidence.selected).toBe(read)
    const resolved = resolveScientificEvidence({ plot_request: null, plot_response: null, isl_request: null, isl_response: null }, evidence.selected?.response?.body, 'analysis_evidence_trace.response_body')
    expect(resolved.bodies.plot_response).toEqual(block.enrichment)
    expect(resolved.resolution.plot_response.path).toContain('.analysis_result.enrichment')
    const diagnostic = classifyV5CanonicalAnalysisDiagnostic({
      canonicalFlagOn: true, analysisStateSource: 'orphaned_plot_result',
      factPresentForScenario: false, ceeResponseHasAnalysisResult: false,
      v5Capture: null, hasResultsReport: true, plotRequestCaptured: false,
      analysisResultRead: {
        evidence_status: 'acquired', trace_id: read.id!, request_id: 'server-read-1', scenario_id: scenarioId,
        endpoint: read.endpoint!, request_started_at: read.timestamp!,
        response_completed_at: read.completedAt!, response_hash: reportHash, response_body: read.response?.body,
      },
    })
    expect(diagnostic.debug_capture_status).toBe('complete')
    const pipelineInputs = {
      analysisResultRead: diagnostic.analysis_result_read, v5Capture: null,
      hasResultsReport: true, rawV2ResponsePresent: false,
      failedHttpRecord: { present: false, source: null }, serviceMetadataV5Failure: false,
      analysisStateSource: diagnostic.analysis_state_source, effectiveCeeResponseSource: 'none' as const,
      analysisFactPresent: false, scenarioIdConflictCount: 0, legacyPipelineStatus: null,
      ceeCaptureResponseHashMismatch: false, invalidSelectedTraceId: false,
    }
    expect(classifyV5CapturePipelineStatus(pipelineInputs)).toEqual({
      capture_pipeline_status: 'complete', coherence: { state: 'complete', issues: [] },
    })
    expect(classifyV5CapturePipelineStatus({ ...pipelineInputs,
      failedHttpRecord: { present: true, source: 'preflight_or_network' },
    }).capture_pipeline_status).toBe('proxy_or_network_failure')
    expect(diagnostic.analysis_state_source).toBe('scenario_graph_read')
    expect(diagnostic.analysis_fact_status).toBe('not_applicable_read_capture')
    expect(diagnostic.analysis_result_read?.response_body).toEqual(readBody)
    expect(diagnostic.analysis_result_read?.evidence_status).toBe('acquired')
    expect(diagnostic.analysis_result_read).not.toHaveProperty('resultsHydrated')
  })

  it('rejects another scenario even with the same report hash, and rejects another report in this scenario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(readBody), { status: 200 })))
    await fetchScenarioGraph(scenarioId)
    const traces = usePayloadTraceStore.getState().payloads
    for (const [scenario, hash] of [[otherScenario, reportHash], [scenarioId, 'different-report']]) {
      expect(matchingScenarioAnalysisReads(traces, scenario, hash)).toEqual([])
      expect(findLatestEvidenceBearingCeeTurn(traces, scenario, hash).selected).toBeUndefined()
    }
    const contradictory = [{ ...traces[0], response: { ...traces[0].response!, body: { ...readBody, scenario_id: otherScenario } } }]
    expect(matchingScenarioAnalysisReads(contradictory, scenarioId, reportHash)).toEqual([])
  })

  it('does not spend trace capacity on empty polls and preserves genuine buffered calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...readBody, analysis_result: null }), { status: 200 })))
    await fetchScenarioGraph(scenarioId)
    expect(usePayloadTraceStore.getState().payloads).toEqual([])
    const bufferedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response_version: 2, assistant_text: 'Reply', blocks: [] }), { status: 200 }))
    await callV5Turn({ kind: 'message', scenario_id: scenarioId, message: 'Reply' } as never, { fetchImpl: bufferedFetch })
    expect(bufferedFetch).toHaveBeenCalledTimes(1)
    const ledger = selectRecentConversationTurns(usePayloadTraceStore.getState().payloads)
    expect(ledger.turn_record_count).toBe(1)
    expect(ledger.turns[0].transport_kind).toBe('buffered_turn')
  })
})
