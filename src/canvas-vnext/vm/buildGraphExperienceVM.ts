// Top-level VM assembly — one O(nodes+edges) pass, pure.

import { buildAnalysisContext, type AnalysisContextInputs } from './analysisContext'
import { buildOptionCards } from './buildOptionCard'
import { buildEdgeVisual, buildRelationshipCard } from './buildRelationshipCard'
import {
  buildDecisionCards,
  buildFactorCards,
  buildRiskCards,
  buildOutcomeCards,
  buildGoalCards,
  type NodeCardResultInputs,
} from './buildNodeCards'
import type { FragileEdgeCandidate } from '../../canvas/utils/fragileEdgeMatch'
import type { GraphExperienceVM, VMProvenance, FactorFlag } from './types'

interface MinimalNode {
  id: string
  type?: string
  data?: Record<string, unknown> | undefined
}

interface MinimalEdge {
  id: string
  source: string
  target: string
  data?: Record<string, unknown> | undefined
}

export interface GraphExperienceVMInputs extends AnalysisContextInputs {
  provenance: VMProvenance
  edges: readonly MinimalEdge[]
  ceeAnalysisReady: { options?: { id: string; interventions?: Record<string, unknown> }[] } | null
  prefillChatAvailable: boolean
  /** Stage-3 result context (state headline, driver/evidence signals, hinge).
   * Optional so pure derivation tests that only exercise options/edges can
   * omit it. */
  resultSignals?: Partial<NodeCardResultInputs>
  /** FIXTURE-ONLY factor-flag overrides — the live adapter never passes this
   * (noInventedClaims.spec pins it). */
  fixtureFactorFlags?: Record<string, FactorFlag>
}

const EMPTY_RESULT_SIGNALS: NodeCardResultInputs = {
  stateHeadline: null,
  driverSignals: [],
  evidenceGapSignals: [],
  hingeLabel: null,
}

export function buildGraphExperienceVM(inputs: GraphExperienceVMInputs): GraphExperienceVM {
  const analysis = buildAnalysisContext(inputs)

  const fragileEdges: FragileEdgeCandidate[] = analysis.hasResults
    ? ((inputs.report?.robustness?.fragile_edges as FragileEdgeCandidate[] | undefined) ?? [])
    : []

  const nodesById = new Map<string, MinimalNode>(inputs.nodes.map((n) => [n.id, n]))

  const edgeVisuals: GraphExperienceVM['edgeVisuals'] = {}
  const relationshipCards: GraphExperienceVM['relationshipCards'] = {}
  for (const edge of inputs.edges) {
    edgeVisuals[edge.id] = buildEdgeVisual(edge, nodesById, fragileEdges, analysis)
    relationshipCards[edge.id] = buildRelationshipCard({
      edge,
      nodesById,
      fragileEdges,
      analysis,
      prefillChatAvailable: inputs.prefillChatAvailable,
    })
  }

  const resultSignals: NodeCardResultInputs = { ...EMPTY_RESULT_SIGNALS, ...inputs.resultSignals }

  return {
    provenance: inputs.provenance,
    analysis,
    optionCards: buildOptionCards({
      nodes: inputs.nodes,
      report: inputs.report,
      ceeAnalysisReady: inputs.ceeAnalysisReady,
      analysis,
    }),
    decisionCards: buildDecisionCards(inputs.nodes, inputs.report, analysis, resultSignals),
    factorCards: buildFactorCards(inputs.nodes, analysis, resultSignals, inputs.fixtureFactorFlags),
    riskCards: buildRiskCards(inputs.nodes, inputs.edges, inputs.report, analysis),
    outcomeCards: buildOutcomeCards(inputs.nodes, inputs.edges),
    goalCards: buildGoalCards(inputs.nodes, analysis),
    edgeVisuals,
    relationshipCards,
  }
}
