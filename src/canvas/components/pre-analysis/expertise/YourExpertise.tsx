/**
 * YourExpertise — Unified section replacing AllImprovements, EdgeAssumptionsTable,
 * WorthInvestigating, and EdgeSummarySection (v6 wireframe).
 *
 * 6 subgroups: Contested relationships, Estimated, Missing data,
 * From your brief (collapsed), Key relationships (collapsed), Edge evidence gaps (collapsed).
 *
 * Badge and progress denominator = contested + AI-estimated + missing-data (actionable items).
 * Edge gaps, brief items, and key relationships are sub-counts but don't inflate the badge.
 */

import { useState, useMemo } from 'react'
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
  const [isExpanded, setIsExpanded] = useState(false)

  // Denominator is derived from groups.actionableCount after groups are computed below

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

  // Badge and progress use actionableCount: contested + AI-estimated + missing-data
  const badgeCount = groups.actionableCount
  const denominator = groups.actionableCount
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
          {/* Progress bar — numerator counts resolved items within the actionable set */}
          {denominator > 0 && (
            <div className="space-y-1">
              <p className={`${typography.panelMeta} text-text-light`}>
                You've contributed to {Math.min(reviewedCount, denominator)} of {denominator}
              </p>
              <div className="w-full h-1.5 bg-panel-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-300"
                  style={{ width: `${denominator > 0 ? Math.min(100, (Math.min(reviewedCount, denominator) / denominator) * 100) : 0}%` }}
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
                onHoverEnter={onHoverEnter}
                onHoverLeave={onHoverLeave}
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
                onFocusNode={onFocusNode}
                onSetValue={onSetValue}
                onSendMessage={onSendMessage}
                factorInfluenceMap={factorInfluenceMap}
                onHoverEnter={onHoverEnter}
                onHoverLeave={onHoverLeave}
              />
              <FromBrief
                items={groups.fromBrief}
                onFocusNode={onFocusNode}
                onHoverEnter={onHoverEnter}
                onHoverLeave={onHoverLeave}
              />
              <KeyRelationshipsSubgroup
                items={groups.keyRelationships}
                onFocusEdge={onFocusEdge}
                onUpdateEdgeStrength={onUpdateEdgeStrength}
                onHoverEnter={onHoverEnter}
                onHoverLeave={onHoverLeave}
              />
              <EdgeEvidenceGaps
                items={groups.edgeGaps}
                onFocusEdge={onFocusEdge}
                onAddEvidence={onAddEvidence}
                onHoverEnter={onHoverEnter}
                onHoverLeave={onHoverLeave}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
