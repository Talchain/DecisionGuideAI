/**
 * YourExpertise — Unified section replacing AllImprovements, EdgeAssumptionsTable,
 * WorthInvestigating, and EdgeSummarySection (v6 wireframe).
 *
 * 6 subgroups: Contested relationships, Estimated by AI, Missing data,
 * From your brief (collapsed), Key relationships (collapsed), Edge evidence gaps (collapsed).
 *
 * Progress bar denominator is fixed at the count when panel first renders for a given graph.
 * Resolved items stay in total. Items removed from graph reduce both numerator and denominator.
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Pill } from '../primitives'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '@/styles/typography'
import { ConfidenceSpectrum } from './ConfidenceSpectrum'
import { ContestedRelationships } from './ContestedRelationships'
import { AiEstimated } from './AiEstimated'
import { MissingData } from './MissingData'
import { FromBrief } from './FromBrief'
import { KeyRelationshipsSubgroup } from './KeyRelationshipsSubgroup'
import { EdgeEvidenceGaps } from './EdgeEvidenceGaps'
import { deriveExpertiseGroups, type ExpertiseGroups } from '../hooks/deriveExpertiseGroups'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'
import type { Edge, Node } from '@xyflow/react'

interface YourExpertiseProps {
  improvementsByCategory: Record<string, ImprovementItem[]>
  contestedEdges: Array<{ edge: Edge; validation: unknown }>
  nodes: Node[]
  edges: Edge[]
  factorInfluenceMap?: Map<string, number>
  edgeInfluenceMap?: Map<string, number>
  reviewedCount: number
  totalReviewableCount: number
  /** All improvement items for the confidence spectrum */
  allItems: ImprovementItem[]
  // Action handlers
  onFocusNode?: (nodeId: string) => void
  onFocusEdge?: (edgeId: string) => void
  onConfirm?: (nodeId: string) => void
  onEdit?: (nodeId: string) => void
  onSetValue?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
  onResolveEdge?: (edgeId: string, action: string, customMean?: number) => void
  onUpdateEdgeStrength?: (edgeId: string, value: number) => void
  onAddEvidence?: (edgeId: string, evidence: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

export function YourExpertise({
  improvementsByCategory,
  contestedEdges,
  nodes,
  edges,
  factorInfluenceMap,
  edgeInfluenceMap,
  reviewedCount,
  totalReviewableCount,
  allItems,
  onFocusNode,
  onFocusEdge,
  onConfirm,
  onEdit,
  onSetValue,
  onSendMessage,
  onResolveEdge,
  onUpdateEdgeStrength,
  onAddEvidence,
  onHoverEnter,
  onHoverLeave,
}: YourExpertiseProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Fixed denominator — captured per graph identity.
  // Reset when graph changes (detected by sorted node ID string changing).
  // Items removed from graph reduce both numerator and denominator.
  const graphIdentity = useMemo(
    () => nodes.map(n => n.id).sort().join(','),
    [nodes],
  )
  const fixedDenomRef = useRef<{ graphId: string; value: number } | null>(null)
  useEffect(() => {
    if (fixedDenomRef.current === null || fixedDenomRef.current.graphId !== graphIdentity) {
      // New graph or first render — capture the denominator
      if (totalReviewableCount > 0) {
        fixedDenomRef.current = { graphId: graphIdentity, value: totalReviewableCount }
      }
    }
  }, [graphIdentity, totalReviewableCount])
  // Items removed from graph reduce both — use min of fixed and current
  const denominator = fixedDenomRef.current != null
    ? Math.min(fixedDenomRef.current.value, totalReviewableCount)
    : totalReviewableCount

  const groups: ExpertiseGroups = useMemo(() =>
    deriveExpertiseGroups(
      improvementsByCategory,
      contestedEdges,
      nodes,
      edges,
      factorInfluenceMap,
      edgeInfluenceMap,
    ),
    [improvementsByCategory, contestedEdges, nodes, edges, factorInfluenceMap, edgeInfluenceMap],
  )

  const badgeCount = groups.totalCount
  const allEmpty = groups.contestedCount === 0 &&
    groups.aiEstimated.length === 0 &&
    groups.missingData.length === 0 &&
    groups.fromBrief.length === 0 &&
    groups.keyRelationships.length === 0 &&
    groups.edgeGaps.length === 0

  return (
    <div className="rounded-lg border border-panel-border bg-panel" data-testid="your-expertise-section">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-panel-hover"
      >
        <div className="flex items-center gap-2">
          <span className={`${typography.panelHeader} text-text-header`}>Your expertise</span>
          <Tooltip delay={300} content="Items where your input improves model accuracy, grouped by type and sorted by impact on the decision">
            <Info size={14} className="text-text-light" />
          </Tooltip>
          {badgeCount > 0 && (
            <Pill size="small" variant="default">{badgeCount}</Pill>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-light" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-light" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Progress bar */}
          {denominator > 0 && (
            <div className="space-y-1">
              <p className={`${typography.panelMeta} text-text-light`}>
                You've contributed to {reviewedCount} of {denominator}
              </p>
              <div className="w-full h-1.5 bg-panel-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, denominator > 0 ? (reviewedCount / denominator) * 100 : 0)}%` }}
                />
              </div>
            </div>
          )}

          {/* Confidence spectrum */}
          <ConfidenceSpectrum items={allItems} />

          {/* Empty state */}
          {allEmpty ? (
            <p className={`${typography.panelBody} text-text-light py-2`}>
              No items to review. Your model looks well-calibrated.
            </p>
          ) : (
            <>
              <ContestedRelationships
                contestedEdges={contestedEdges}
                nodes={nodes}
                onFocusEdge={onFocusEdge}
                onResolveEdge={onResolveEdge}
                factorInfluenceMap={factorInfluenceMap}
              />
              <AiEstimated
                items={groups.aiEstimated}
                onFocusNode={onFocusNode}
                onConfirm={onConfirm}
                onEdit={onEdit}
                onSendMessage={onSendMessage}
                factorInfluenceMap={factorInfluenceMap}
                onHoverEnter={onHoverEnter}
                onHoverLeave={onHoverLeave}
              />
              <MissingData
                items={groups.missingData}
                onSetValue={onSetValue}
                onSendMessage={onSendMessage}
                factorInfluenceMap={factorInfluenceMap}
              />
              <FromBrief
                items={groups.fromBrief}
                onFocusNode={onFocusNode}
              />
              <KeyRelationshipsSubgroup
                items={groups.keyRelationships}
                onFocusEdge={onFocusEdge}
                onUpdateEdgeStrength={onUpdateEdgeStrength}
              />
              <EdgeEvidenceGaps
                items={groups.edgeGaps}
                onFocusEdge={onFocusEdge}
                onAddEvidence={onAddEvidence}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
