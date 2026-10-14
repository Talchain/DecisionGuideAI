import { canonicalTestCellsOf } from '../../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { runViewOf } from '../../../runView/runView'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import type { ResultsSectionDataReturn } from '../../../../components/results/useResultsSectionData'

/** SELF-AUTHORED cells for synthetic licence controls, never served evidence. */
export function canonicalBriefFixture(body: {
  analysis_result: { computed_against_hash: string }
  graph: { nodes: readonly { id: string; kind: string; label: string }[] }
  analysis_state: { run_state: { computed_at: string } }
}) {
  const view = runViewOf(mapV5AnalysisToReport(body.analysis_result as never))
  return canonicalTestCellsOf({ runView: view, goalChanceLicence: view.goalChance,
    recommendation: { allOptions: body.graph.nodes.filter(n => n.kind === 'option').map(n => ({ id: n.id, label: n.label })) },
  } as ResultsSectionDataReturn, { run_id: null, graph_hash_at_run: body.analysis_result.computed_against_hash,
    computed_at: body.analysis_state.run_state.computed_at })
}
