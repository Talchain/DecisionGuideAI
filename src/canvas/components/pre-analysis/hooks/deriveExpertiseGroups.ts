/**
 * deriveExpertiseGroups — Pure helper for the "Your expertise" section.
 *
 * Groups ImprovementItems into 6 subgroups with per-subgroup sort orders.
 * Extracted from usePreAnalysisData for testability and maintainability.
 */

import type { ImprovementItem } from './usePreAnalysisData'
import type { Edge, Node } from '@xyflow/react'

export interface ExpertiseGroups {
  /** Count only — actual contested edges are passed directly to ContestedRelationships */
  contestedCount: number
  aiEstimated: ImprovementItem[]
  missingData: ImprovementItem[]
  fromBrief: ImprovementItem[]
  keyRelationships: EdgeRelationship[]
  edgeGaps: EdgeRelationship[]
  totalCount: number
  /** Contested + AI-estimated + missing-data — the items users can meaningfully contribute to */
  actionableCount: number
}

export interface EdgeRelationship {
  edgeId: string
  sourceLabel: string
  targetLabel: string
  weight?: number
  direction?: string
  beliefExists?: number
  std?: number
  influence?: number
  hasEvidence?: boolean
}

/** Sort helpers */
function sortByInfluenceDesc(
  items: ImprovementItem[],
  influenceMap: Map<string, number> | undefined,
): ImprovementItem[] {
  return [...items].sort((a, b) => {
    const aId = a.focus?.id ?? ''
    const bId = b.focus?.id ?? ''
    const aInf = influenceMap?.get(aId) ?? 0
    const bInf = influenceMap?.get(bId) ?? 0
    if (bInf !== aInf) return bInf - aInf
    return a.label.localeCompare(b.label)
  })
}

function sortEdgesByInfluence(
  items: EdgeRelationship[],
  edgeInfluenceMap: Map<string, number> | undefined,
): EdgeRelationship[] {
  return [...items].sort((a, b) => {
    const aInf = edgeInfluenceMap?.get(a.edgeId) ?? a.influence ?? 0
    const bInf = edgeInfluenceMap?.get(b.edgeId) ?? b.influence ?? 0
    if (bInf !== aInf) return bInf - aInf
    return a.sourceLabel.localeCompare(b.sourceLabel)
  })
}

export function deriveExpertiseGroups(
  improvementItems: Record<string, ImprovementItem[]>,
  contestedEdges: Array<{ edge: Edge; validation: unknown }>,
  nodes: Node[],
  edges: Edge[],
  factorInfluenceMap: Map<string, number> | undefined,
  edgeInfluenceMap: Map<string, number> | undefined,
): ExpertiseGroups {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const getLabel = (id: string) =>
    (nodeMap.get(id)?.data as Record<string, unknown>)?.label as string ?? id

  // 1. Contested relationships — sorted by evoi_impact desc → max_divergence desc → distance_to_goal asc
  // Sorting is done on contestedEdges directly (passed to ContestedRelationships component)
  // We only count them here for the total.
  const verifyItems = improvementItems.verify ?? []
  const contestedCount = contestedEdges.length

  // 2. AI estimated — factors with source AI/cee_inference
  const aiEstimated = sortByInfluenceDesc(
    verifyItems.filter(i => i.subgroup === 'cee_inference' && i.focus?.type === 'node'),
    factorInfluenceMap,
  )

  // 3. Missing data — factors with no observed value
  const missingData: ImprovementItem[] = []
  for (const node of nodes) {
    const nd = node.data as Record<string, unknown>
    if (nd.kind !== 'factor' && node.type !== 'factor') continue
    const os = (nd.observedState ?? nd.observed_state) as Record<string, unknown> | undefined
    if (os?.value == null && os?.raw_value == null) {
      // Check if not already in verify items
      const alreadyTracked = verifyItems.some(i => i.focus?.id === node.id)
      if (!alreadyTracked) {
        missingData.push({
          key: `missing-${node.id}`,
          category: 'verify',
          label: (nd.label as string) ?? node.id,
          detail: 'No observed data',
          focus: { type: 'node', id: node.id, label: (nd.label as string) ?? node.id },
        })
      }
    }
  }
  const sortedMissing = sortByInfluenceDesc(missingData, factorInfluenceMap)

  // 4. From brief — factors with brief_extraction or user_confirmed source
  const fromBrief = sortByInfluenceDesc(
    verifyItems.filter(i => i.subgroup === 'brief_extraction' && i.focus?.type === 'node'),
    factorInfluenceMap,
  )

  // 5. Key relationships — top causal edges by influence
  const isStructural = (e: Edge): boolean => {
    const sKind = (nodeMap.get(e.source)?.data as Record<string, unknown>)?.kind as string
    const tKind = (nodeMap.get(e.target)?.data as Record<string, unknown>)?.kind as string
    return (sKind === 'decision' && tKind === 'option') || (sKind === 'option' && tKind === 'factor')
  }

  const causalEdges = edges.filter(e => !isStructural(e))
  const keyRelationships: EdgeRelationship[] = causalEdges.map(e => {
    const d = e.data as Record<string, unknown> | undefined
    return {
      edgeId: e.id,
      sourceLabel: getLabel(e.source),
      targetLabel: getLabel(e.target),
      weight: d?.weight as number | undefined,
      direction: d?.direction as string | undefined,
      beliefExists: d?.beliefExists as number | undefined,
      std: d?.strength_std as number | undefined,
      influence: edgeInfluenceMap?.get(e.id),
      hasEvidence: !!(d?.evidence as Record<string, unknown> | undefined)?.source,
    }
  })
  const sortedRelationships = sortEdgesByInfluence(keyRelationships, edgeInfluenceMap)

  // 6. Edge evidence gaps — edges without evidence, sorted by influence
  const edgeGaps = sortEdgesByInfluence(
    sortedRelationships.filter(r => !r.hasEvidence),
    edgeInfluenceMap,
  )

  const totalCount = contestedCount + aiEstimated.length + sortedMissing.length +
    fromBrief.length + sortedRelationships.length + edgeGaps.length

  // Actionable = items the user can meaningfully contribute to
  const actionableCount = contestedCount + aiEstimated.length + sortedMissing.length

  return {
    contestedCount,
    aiEstimated,
    missingData: sortedMissing,
    fromBrief,
    keyRelationships: sortedRelationships,
    edgeGaps,
    totalCount,
    actionableCount,
  }
}
