/**
 * YourExpertise — Brief 5 Task 1: expand-in-place on the Analysis tab.
 *
 * The row collapsed by default is the same compact summary Brief 4 Task 6
 * introduced. Clicking the row (or the chevron) now expands an inline
 * expertise surface on the Analysis tab so users can Confirm / Set value /
 * Discuss without switching to the Model tab. The Model-tab deep-link is
 * preserved as the bottom link inside the expanded surface — it uses the
 * existing `useUIStore.setActiveOutputTab('diagnostics')` call exactly as-is.
 *
 * Empty-model case (aiN === 0 && missingN === 0): no chevron, no click
 * handler, static summary "Your model is fully calibrated". Per Brief 5.
 *
 * Action parity: Confirm / Set value / Discuss route through the same
 * handler callbacks used by TriageCard. Parity is asserted by a
 * behavioural test in YourExpertise.parity.spec.tsx.
 */

import { useMemo, useState, useCallback, useEffect, type KeyboardEvent } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '@/styles/typography'
import { useUIStore } from '@/stores/uiStore'
import { deriveExpertiseGroups, type ExpertiseGroups } from '../hooks/deriveExpertiseGroups'
import { AiEstimated } from './AiEstimated'
import { MissingData } from './MissingData'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'
import type { Edge, Node } from '@xyflow/react'

interface YourExpertiseProps {
  improvementsByCategory: Record<string, ImprovementItem[]>
  contestedEdges: Array<{ edge: Edge; validation: unknown }>
  nodes: Node[]
  edges: Edge[]
  factorInfluenceMap?: Map<string, number>
  edgeInfluenceMap?: Map<string, number>
  /** Shared with TriageCard — confirms a factor's AI-assigned value. */
  onConfirm?: (nodeId: string) => void
  /** Shared with TriageCard — open the inline editor for a factor. */
  onEdit?: (nodeId: string) => void
  /** Shared with MissingData — open the editor for a missing-value factor. */
  onSetValue?: (nodeId: string) => void
  /**
   * Brief 5.1 follow-up P0 #1: direct value-commit handler used by the
   * inline editor inside AiEstimated / MissingData rows. When provided,
   * the Pencil / Set-value actions open an inline ScientificEditor and
   * route save → (nodeId, rawValue) through this callback instead of
   * focusing the inspector.
   */
  onCommitValue?: (nodeId: string, rawValue: number) => void
  /** Focus-node helper for inline factor links. */
  onFocusNode?: (nodeId: string) => void
  /** Hover handlers for graph cross-highlight. */
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  /**
   * Changes when a new analysis run completes (e.g. response hash). Used to
   * collapse the expanded state on run transitions — per Brief 5 rule
   * "Persistence: expansion state does not persist across analysis runs."
   */
  analysisRunKey?: string
  /**
   * Brief 5.2 Task 8d follow-up (ChatGPT P1 #1): forwarded to MissingData
   * so technique hints become click-to-chat buttons when a chat send
   * handler is wired. Leaving this undefined keeps the hint-only fallback.
   */
  onSendMessage?: (text: string) => void
}

export function YourExpertise({
  improvementsByCategory,
  contestedEdges,
  nodes,
  edges,
  factorInfluenceMap,
  edgeInfluenceMap,
  onConfirm,
  onEdit,
  onSetValue,
  onCommitValue,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  analysisRunKey,
  onSendMessage,
}: YourExpertiseProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Brief 5.1 follow-up P0 #1: one-active-editor invariant across the
  // expanded surface. A single key identifies which row is currently in
  // edit mode — opening a second row via onRequestEdit automatically
  // collapses the first to its compact view.
  const [activeEditorKey, setActiveEditorKey] = useState<string | null>(null)

  const handleRequestEdit = useCallback((itemKey: string) => {
    setActiveEditorKey(prev => (prev === itemKey ? null : itemKey))
  }, [])
  const handleCancelEdit = useCallback(() => setActiveEditorKey(null), [])

  // Brief 5 Task 1: collapse on analysis-run transition so expansion state
  // does not leak across runs. `useEffect` fires on initial mount (already
  // collapsed, no-op) and on every subsequent key change. The inline
  // editor also closes — stale rawValue input would otherwise persist.
  useEffect(() => {
    setIsExpanded(false)
    setActiveEditorKey(null)
  }, [analysisRunKey])

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

  // Expansion is only offered when there is something actionable inside
  // (AI estimates to confirm or missing data to fill). Brief-only items are
  // display-only so a "from brief"-only row does not grow a chevron.
  const canExpand = aiN > 0 || missingN > 0

  const openModelTab = useCallback(() => {
    useUIStore.getState().setActiveOutputTab('diagnostics')
  }, [])

  const handleHeaderClick = useCallback(() => {
    if (canExpand) setIsExpanded(e => !e)
  }, [canExpand])

  const handleHeaderKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!canExpand) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsExpanded(x => !x)
      }
    },
    [canExpand],
  )

  // Static empty-model case — Paul's copy, no chevron, no click.
  if (!canExpand && briefN === 0) {
    return (
      <div
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-panel-border bg-panel"
        data-testid="your-expertise-section"
      >
        <span className={`${typography.panelHeader} text-text-header`}>Your expertise</span>
        <Tooltip delay={300} content="Review factors and relationships on the Model tab">
          <Info size={14} className="text-text-light" />
        </Tooltip>
        <span className={`${typography.panelMeta} text-text-light`}>
          Your model is fully calibrated
        </span>
      </div>
    )
  }

  // Brief-only case — nothing actionable to expand into, but the user still
  // needs a way to audit factors on the Model tab. Preserve the pre-Brief-5
  // deep-link behaviour: the whole row is a button that opens the Model tab.
  // No chevron (no expansion affordance) but the click target + aria-label
  // make the navigation intent explicit.
  if (!canExpand) {
    return (
      <button
        type="button"
        onClick={openModelTab}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-panel-border bg-panel hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
        data-testid="your-expertise-section"
        aria-label="Open Model tab to audit factors and relationships"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`${typography.panelHeader} text-text-header`}>Your expertise</span>
          <Tooltip delay={300} content="Review factors and relationships on the Model tab">
            <Info size={14} className="text-text-light" />
          </Tooltip>
          <span
            className={`${typography.panelMeta} text-text-light truncate`}
            data-testid="expertise-summary"
          >
            {summary}
          </span>
        </div>
        <span
          className={`${typography.panelMeta} text-info flex-shrink-0`}
          data-testid="your-expertise-model-link"
        >
          Audit in Model tab →
        </span>
      </button>
    )
  }

  return (
    <div data-testid="your-expertise-section">
      <button
        type="button"
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKey}
        aria-expanded={isExpanded}
        aria-controls="your-expertise-expanded"
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-panel-border bg-panel hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
        data-testid="your-expertise-header"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`${typography.panelHeader} text-text-header`}>Your expertise</span>
          <Tooltip delay={300} content="Confirm AI estimates, fill missing data, or review every relationship on the Model tab.">
            <Info size={14} className="text-text-light" />
          </Tooltip>
          <span
            className={`${typography.panelMeta} text-text-light truncate`}
            data-testid="expertise-summary"
          >
            {summary}
          </span>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-text-light flex-shrink-0 transition-transform duration-150 ${
            isExpanded ? 'rotate-90' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div
          id="your-expertise-expanded"
          className="mt-2 px-3 py-2 rounded-lg border border-panel-border bg-panel max-h-[60vh] overflow-y-auto"
          data-testid="your-expertise-expanded"
        >
          {aiN > 0 && (
            <AiEstimated
              items={groups.aiEstimated}
              onFocusNode={onFocusNode}
              onConfirm={onConfirm}
              onEdit={onEdit}
              factorInfluenceMap={factorInfluenceMap}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              activeEditorKey={activeEditorKey}
              onRequestEdit={handleRequestEdit}
              onCommitValue={onCommitValue}
              onCancelEdit={handleCancelEdit}
            />
          )}
          {missingN > 0 && (
            <MissingData
              items={groups.missingData}
              onFocusNode={onFocusNode}
              onSetValue={onSetValue}
              factorInfluenceMap={factorInfluenceMap}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              activeEditorKey={activeEditorKey}
              onRequestEdit={handleRequestEdit}
              onCommitValue={onCommitValue}
              onCancelEdit={handleCancelEdit}
              onSendMessage={onSendMessage}
            />
          )}
          <div className="mt-3 pt-2 border-t border-panel-border">
            <button
              type="button"
              onClick={openModelTab}
              className={`${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 rounded cursor-pointer`}
              data-testid="your-expertise-model-link"
            >
              Audit all relationships in Model tab →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
