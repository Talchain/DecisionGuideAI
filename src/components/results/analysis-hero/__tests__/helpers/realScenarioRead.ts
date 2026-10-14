import { vi } from 'vitest'
import { fetchScenarioGraph } from '../../../../../adapters/cee/scenarioGraph'
import { useCanvasStore } from '../../../../../canvas/store'
import { identityFromCanvasGraph } from '../../../../../canvas/utils/graphIdentity'
import { applyScenarioAnalysisRead } from '../../../../../canvas/hydrate/applyScenarioAnalysisRead'
import { readProvisionalApplyStore } from '../../../../../canvas/hydrate/provisionalApplyStore'

/** Real adapter → hydration's read applier → mapper → resultsComplete. No report fields are invented. */
export async function applyRealRead(capture: { j: any }) {
  const body = capture.j
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
  const result = await fetchScenarioGraph(body.scenario_id, { retry503: false })
  if (result.status !== 'graph') throw new Error(`Read declined: ${result.status}`)
  const nodes = body.graph.nodes.map((n: any) => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { ...n, type: n.kind } }))
  const edges = body.graph.edges.map((e: any, i: number) => ({ id: `wire-${i}`, source: e.from, target: e.to, data: { ...e } }))
  const ready = body.current_read.analysis_ready
  useCanvasStore.setState({ nodes, edges, currentScenarioId: body.scenario_id,
    ceeAnalysisReady: { ...ready, options: ready.options.map((o: any) => ({ ...o, id: o.option_id ?? o.id })) },
    ceeAnalysisReadyCanvasNodeIds: nodes.map((n: any) => n.id), lastAuthoritativeGraph: identityFromCanvasGraph(nodes, edges),
    results: { status: 'idle', report: null }, analysisStateV1: result.analysisState,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: body.analysis_state.run_state.computed_at },
    analysisFreshnessDirty: false, importPendingServerRegistration: false, hasCompletedFirstRun: true,
    viewMode: 'standard',
  } as never)
  const outcome = applyScenarioAnalysisRead({ analysisState: result.analysisState, analysisResult: result.analysisResult,
    currentReadInputBasis: result.currentReadInputBasis ?? null, limitVerdicts: result.limitVerdicts,
    goalCertainty: result.goalCertainty, optionParticipation: result.optionParticipation,
    runDelta: result.runDelta, delivered: result.delivered,
    // Hydration already proved currency; these are the same two overrides it uses.
    store: { ...readProvisionalApplyStore(), setAnalysisStateV1: () => {}, noteRunCompletedWithoutVerdict: () => {} },
  })
  const STORE = '../../../../../canvas/stores/canonicalAnalysisViewStore'
  const PARSER = '../../../../../canvas/runView/canonicalAnalysisView'
  const modules = await Promise.all([import(STORE).catch(() => null), import(PARSER).catch(() => null)])
  if (modules[0] && modules[1]) modules[0].useCanonicalAnalysisViewStore.getState().adopt(body.scenario_id,
    modules[1].parseCanonicalAnalysisView((result as any).canonicalAnalysisView))
  return { result, outcome, report: useCanvasStore.getState().results.report }
}
