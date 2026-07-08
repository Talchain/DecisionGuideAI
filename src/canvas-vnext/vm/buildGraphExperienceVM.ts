// Top-level VM assembly — one O(nodes+edges) pass, pure.

import { buildAnalysisContext, type AnalysisContextInputs } from './analysisContext'
import { buildOptionCards } from './buildOptionCard'
import { buildEdgeVisual, buildRelationshipCard } from './buildRelationshipCard'
import type { FragileEdgeCandidate } from '../../canvas/utils/fragileEdgeMatch'
import type { GraphExperienceVM, VMProvenance } from './types'

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

  return {
    provenance: inputs.provenance,
    analysis,
    optionCards: buildOptionCards({
      nodes: inputs.nodes,
      report: inputs.report,
      ceeAnalysisReady: inputs.ceeAnalysisReady,
      analysis,
    }),
    edgeVisuals,
    relationshipCards,
  }
}
