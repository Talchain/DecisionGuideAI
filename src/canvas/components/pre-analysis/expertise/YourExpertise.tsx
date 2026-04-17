/**
 * YourExpertise — Compressed single-row summary with deep-link to Model tab.
 *
 * Pre-analysis only. Brief 4 Task 6: collapse the previous 6-subgroup panel
 * into one row showing counts + a chevron that opens the Model tab where the
 * full factor/relationship audit lives. Progress bar removed (gamification
 * of the wrong thing). Post-analysis does not render this section at all.
 */

import { useMemo } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '@/styles/typography'
import { useUIStore } from '@/stores/uiStore'
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
}

export function YourExpertise({
  improvementsByCategory,
  contestedEdges,
  nodes,
  edges,
  factorInfluenceMap,
  edgeInfluenceMap,
}: YourExpertiseProps) {
  const groups: ExpertiseGroups = useMemo(
    () =>
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

  const briefN = groups.fromBrief.length
  const aiN = groups.aiEstimated.length
  const missingN = groups.missingData.length

  const parts: string[] = []
  if (briefN > 0) parts.push(`${briefN} from brief`)
  if (aiN > 0) parts.push(`${aiN} AI ${aiN === 1 ? 'estimate' : 'estimates'}`)
  if (missingN > 0) parts.push(`${missingN} missing data`)
  const summary = parts.join(', ')
  const hasContent = parts.length > 0

  const handleOpenModelTab = () => {
    useUIStore.getState().setActiveOutputTab('diagnostics')
  }

  return (
    <button
      type="button"
      onClick={handleOpenModelTab}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-panel-border bg-panel hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
      data-testid="your-expertise-section"
      aria-label="Open Model tab to review factors and relationships"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`${typography.panelHeader} text-text-header`}>Your expertise</span>
        <Tooltip
          delay={300}
          content="Review factors and relationships on the Model tab"
        >
          <Info size={14} className="text-text-light" />
        </Tooltip>
        {hasContent ? (
          <span
            className={`${typography.panelMeta} text-text-light truncate`}
            data-testid="expertise-summary"
          >
            {summary}
          </span>
        ) : (
          <span className={`${typography.panelMeta} text-text-light`}>
            Your model looks well-calibrated
          </span>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-text-light flex-shrink-0" aria-hidden="true" />
    </button>
  )
}
