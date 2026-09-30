/**
 * ⭐⭐ PAUL'S SERVED RUN 4276f3f9 — the seed for CURRENT-READ-v1 row 9 on the Analysis and Reasoning tabs
 * (AIQ #75 5912710392). One harness for the three win-share specs, so the replay cannot drift between them.
 *
 * DATA: `e2e/geometry/fixtures/securing-funding-4276f3f9.fixture.json`, his live test of 30 Sep 2026 (debug export
 * 4276f3f9, staging UI 5562c08d), the served `cee_response` of Run 3 of 3. `analysis_state.leader_claim` was
 * `{permitted: false, withheld_reason: 'constraint_verdict_withheld'}`.
 *
 * The seed pattern is COPIED from `src/canvas/nodes/__tests__/OptionNode.winSharesFollowLeaderClaim.spec.tsx`: the
 * block is mapped through the product mapper (`mapV5AnalysisToReport`), and the producer's permission is stamped on
 * `results.report.producer_leader_permission`, the persisted stamp `winShareGate` reads.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useCanvasStore } from '../../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'

interface FxNode { id: string; kind: string; label: string }
interface FxEdge { from: string; to: string }

export const fx = JSON.parse(
  readFileSync(resolve(process.cwd(), 'e2e/geometry/fixtures/securing-funding-4276f3f9.fixture.json'), 'utf8'),
) as {
  draft: { nodes: FxNode[]; edges: FxEdge[] }
  analysis_ready: { options: Array<Record<string, unknown>> }
  analysis_block: unknown
  analysis_state: { leader_claim: { permitted: boolean; withheld_reason: string } }
}

export const report = mapV5AnalysisToReport(fx.analysis_block as never) as unknown as {
  option_probabilities: Record<string, { win_probability?: number }>
}

const nodes = fx.draft.nodes.map((n) => ({
  id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label, type: n.kind, kind: n.kind },
}))
const edges = fx.draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to }))

/** The three options the Run scored, with the label the draft gives each. */
export const SCORED = fx.draft.nodes
  .filter((n) => n.kind === 'option' && typeof report.option_probabilities[n.id]?.win_probability === 'number')
  .map((n) => ({ id: n.id, label: n.label }))

/** Convertible bridge from existing supporters: 80% on the served cards (finding 9). */
export const CONVERTIBLE = '10979ab0'
export const CONVERTIBLE_LABEL = fx.draft.nodes.find((n) => n.id === CONVERTIBLE)!.label

const ceeAnalysisReady = {
  ...fx.analysis_ready,
  options: fx.analysis_ready.options.map((o): Record<string, unknown> => ({ ...o, id: o.id ?? o.option_id })),
}

/** The stamp the served Run carried, as the product stores it. */
export const SERVED_STAMP = {
  permitted: fx.analysis_state.leader_claim.permitted,
  withheld_reason: 'leader_claim_withheld',
  producer_cause: fx.analysis_state.leader_claim.withheld_reason,
}
/** ROW 3's control: withheld for ANOTHER reason. */
export const OTHER_CAUSE_STAMP = {
  permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'separation_unavailable',
}
/** ROW 2's control: a permitted Run. */
export const PERMITTED_STAMP = { permitted: true }

export function seedPaulRun(stamp: Record<string, unknown> | null): void {
  useCanvasStore.setState({
    nodes, edges, ceeAnalysisReady, viewMode: 'standard', analysisStateV1: null,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-30T13:29:05.105Z' },
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'securing-funding-4276f3f9',
    v5AnalysisFact: { scenarioId: 'securing-funding-4276f3f9', analysisHash: 'run-4276', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-4276', report: { ...report, ...(stamp ? { producer_leader_permission: stamp } : {}) } },
  } as never)
}

export function resetPaulRun(): void {
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, ceeAnalysisReady: null,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
    nodes: [], edges: [],
  } as never)
}
