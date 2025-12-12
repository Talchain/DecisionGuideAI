/**
 * ActionsSignal - Unified actions display for Results tab
 *
 * Shows actionable improvements from all sources:
 * - Graph readiness improvements
 * - Validation issues (with auto-fix)
 * - Critique items
 * - Bias findings
 *
 * Features:
 * - Collapsed: shows top N actions (default 3) with expand option
 * - Expanded: shows all actions
 * - Color-coded priority badges
 * - Click to focus affected elements on canvas
 * - Auto-fix button for fixable issues
 */

import { useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Info,
  Wrench,
  Loader2,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { useUnifiedActions, type UnifiedAction, type ActionPriority } from '../hooks/useUnifiedActions'
import { useCanvasStore } from '../store'
import { executeAutoFix, determineFixType, type AutoFixParams } from '../utils/autoFix'
import { trackAutoFixClicked, trackAutoFixSuccess, trackAutoFixFailed } from '../utils/sandboxTelemetry'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { typography } from '../../styles/typography'

interface ActionsSignalProps {
  /** Maximum actions to show when collapsed (default 3) */
  maxCollapsed?: number
  /** Start expanded */
  defaultExpanded?: boolean
}

// Validation suggestion templates based on node label patterns
// These provide actionable validation tips for common factor types
const VALIDATION_TEMPLATES: Record<string, string> = {
  satisfaction: 'Consider: Survey stakeholders before committing',
  market: 'Consider: Customer research before launch',
  cost: 'Consider: Get vendor quotes before budgeting',
  timeline: 'Consider: Expert estimate before planning',
  risk: 'Consider: Risk assessment before proceeding',
  revenue: 'Consider: Market analysis to validate projections',
  adoption: 'Consider: User testing before rollout',
  quality: 'Consider: Define quality metrics upfront',
  resource: 'Consider: Resource availability check',
  compliance: 'Consider: Legal/regulatory review',
}

/**
 * Get validation suggestion for a node based on its label
 */
function getValidationSuggestion(nodeLabel: string): string | null {
  const labelLower = nodeLabel.toLowerCase()
  for (const [keyword, template] of Object.entries(VALIDATION_TEMPLATES)) {
    if (labelLower.includes(keyword)) {
      return template
    }
  }
  return null
}

// Priority styling
const priorityConfig: Record<ActionPriority, {
  icon: typeof AlertTriangle
  iconColor: string
  badgeColor: string
  borderColor: string
  label: string
}> = {
  critical: {
    icon: AlertTriangle,
    iconColor: 'text-carrot-600',
    badgeColor: 'bg-carrot-100 text-carrot-700',
    borderColor: 'border-l-carrot-500',
    label: 'Critical',
  },
  high: {
    icon: AlertCircle,
    iconColor: 'text-banana-600',
    badgeColor: 'bg-banana-100 text-banana-700',
    borderColor: 'border-l-banana-500',
    label: 'High',
  },
  medium: {
    icon: Info,
    iconColor: 'text-sky-600',
    badgeColor: 'bg-sky-100 text-sky-700',
    borderColor: 'border-l-sky-500',
    label: 'Medium',
  },
  low: {
    icon: Info,
    iconColor: 'text-ink-400',
    badgeColor: 'bg-sand-100 text-ink-600',
    borderColor: 'border-l-sand-300',
    label: 'Low',
  },
}

export function ActionsSignal({ maxCollapsed = 3, defaultExpanded = false }: ActionsSignalProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set())
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set())

  const { actions, criticalCount, totalCount, loading } = useUnifiedActions()
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const applyAutoFixChanges = useCanvasStore((s) => s.applyAutoFixChanges)
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)

  // Focus handler
  const handleFocus = useCallback(
    (action: UnifiedAction) => {
      if (action.affectedNodeIds?.length) {
        setHighlightedNodes(action.affectedNodeIds)
        focusNodeById(action.affectedNodeIds[0])
        setTimeout(() => setHighlightedNodes([]), 3000)
      } else if (action.affectedEdgeIds?.length) {
        focusEdgeById(action.affectedEdgeIds[0])
      }
    },
    [setHighlightedNodes]
  )

  // Auto-fix handler
  const handleAutoFix = useCallback(
    async (action: UnifiedAction) => {
      if (!action.autoFixable || !action.code) return

      trackAutoFixClicked()
      setFixingIds((prev) => new Set(prev).add(action.id))

      const fixType = determineFixType(action.code)
      if (!fixType) {
        trackAutoFixFailed()
        setFixingIds((prev) => {
          const next = new Set(prev)
          next.delete(action.id)
          return next
        })
        return
      }

      const params: AutoFixParams = {
        fixType,
        nodeId: action.affectedNodeIds?.[0],
        edgeId: action.affectedEdgeIds?.[0],
      }

      try {
        const result = executeAutoFix(params, nodes, edges)

        if (result.success) {
          // Use store action instead of direct setState (P1 fix - proper history/undo support)
          applyAutoFixChanges({
            nodes: result.updatedNodes,
            edges: result.updatedEdges,
          })

          trackAutoFixSuccess()
          setFixedIds((prev) => new Set(prev).add(action.id))
        } else {
          trackAutoFixFailed()
        }
      } catch {
        trackAutoFixFailed()
      } finally {
        setFixingIds((prev) => {
          const next = new Set(prev)
          next.delete(action.id)
          return next
        })
      }
    },
    [nodes, edges, applyAutoFixChanges]
  )

  // Get status for an action
  const getFixStatus = useCallback(
    (id: string): 'idle' | 'fixing' | 'fixed' => {
      if (fixingIds.has(id)) return 'fixing'
      if (fixedIds.has(id)) return 'fixed'
      return 'idle'
    },
    [fixingIds, fixedIds]
  )

  // Empty state - don't render anything, other signals show model health
  if (totalCount === 0 && !loading) {
    return null
  }

  // Loading state
  if (loading && totalCount === 0) {
    return (
      <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-sand-500 animate-spin" />
          <span className={`${typography.body} text-sand-600`}>Checking for improvements...</span>
        </div>
      </div>
    )
  }

  // Collapsed: show top maxCollapsed items; Expanded: show all
  const visibleActions = isExpanded ? actions : actions.slice(0, maxCollapsed)
  const hasMore = !isExpanded && totalCount > maxCollapsed

  return (
    <div className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden" data-testid="actions-signal">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`${totalCount} actions available. ${isExpanded ? 'Click to collapse' : 'Click to expand'}`}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <span className={`${typography.body} font-medium text-ink-800`}>Actions</span>
          {criticalCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-carrot-100 text-carrot-700">
              {criticalCount} critical
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 text-sand-400 animate-spin" />}
          <span className={`${typography.caption} text-ink-500`}>
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </button>

      {/* Action items - always visible when actions exist */}
      {visibleActions.length > 0 && (
        <div className="border-t border-sand-200 divide-y divide-sand-100">
          {visibleActions.map((action) => (
            <ActionItem
              key={action.id}
              action={action}
              fixStatus={getFixStatus(action.id)}
              onFocus={() => handleFocus(action)}
              onAutoFix={() => handleAutoFix(action)}
              nodes={nodes}
            />
          ))}
          {hasMore && (
            <div className="px-4 py-2 bg-sand-50">
              <span className={`${typography.caption} text-ink-500`}>
                +{totalCount - maxCollapsed} more {totalCount - maxCollapsed === 1 ? 'action' : 'actions'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Individual action item
interface ActionItemProps {
  action: UnifiedAction
  fixStatus: 'idle' | 'fixing' | 'fixed'
  onFocus: () => void
  onAutoFix: () => void
  nodes: Array<{ id: string; data?: { label?: string } }>
}

function ActionItem({ action, fixStatus, onFocus, onAutoFix, nodes }: ActionItemProps) {
  const config = priorityConfig[action.priority]
  const Icon = config.icon
  const hasAffectedElements = (action.affectedNodeIds?.length ?? 0) + (action.affectedEdgeIds?.length ?? 0) > 0
  const canAutoFix = action.autoFixable && fixStatus !== 'fixed'

  // Get validation suggestion for affected node
  const validationSuggestion = (() => {
    if (action.source !== 'validation' || !action.affectedNodeIds?.length) return null
    const nodeId = action.affectedNodeIds[0]
    const node = nodes.find(n => n.id === nodeId)
    const label = node?.data?.label
    if (!label) return null
    return getValidationSuggestion(label)
  })()

  return (
    <div
      className={`px-4 py-3 border-l-4 ${config.borderColor} ${hasAffectedElements ? 'cursor-pointer hover:bg-sand-50' : ''} transition-colors`}
      onClick={hasAffectedElements ? onFocus : undefined}
      role={hasAffectedElements ? 'button' : undefined}
      tabIndex={hasAffectedElements ? 0 : undefined}
      onKeyDown={(e) => {
        if (hasAffectedElements && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onFocus()
        }
      }}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 ${config.iconColor} flex-shrink-0 mt-0.5`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`${typography.body} text-ink-800`}>{action.title}</span>
            <span className={`${typography.caption} px-1.5 py-0.5 rounded ${config.badgeColor}`}>
              {config.label}
            </span>
            {action.source !== 'validation' && (
              <span className={`${typography.caption} text-ink-400`}>
                {action.source}
              </span>
            )}
          </div>
          <p className={`${typography.caption} text-ink-600 mb-2`}>{action.description}</p>

          {/* Validation suggestion tip */}
          {validationSuggestion && (
            <p className={`${typography.caption} text-sky-600 italic mb-2`}>
              {validationSuggestion}
            </p>
          )}

          {/* Effort and impact info */}
          <div className="flex items-center gap-4 flex-wrap">
            {action.effortMinutes && (
              <span className={`${typography.caption} text-ink-400 flex items-center gap-1`}>
                <Clock className="h-3 w-3" />
                ~{action.effortMinutes}m
              </span>
            )}
            {action.qualityImpact && (
              <span className={`${typography.caption} text-mint-600`}>
                +{action.qualityImpact}% quality
              </span>
            )}
            {hasAffectedElements && (
              <span className={`${typography.caption} text-sky-600`}>Click to focus</span>
            )}

            {/* Auto-fix button */}
            {canAutoFix && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAutoFix()
                }}
                disabled={fixStatus === 'fixing'}
                className={`${typography.caption} inline-flex items-center gap-1 px-2 py-1 rounded font-medium transition-colors ${
                  fixStatus === 'fixing'
                    ? 'bg-sand-200 text-ink-500 cursor-not-allowed'
                    : 'bg-mint-500 text-white hover:bg-mint-600'
                }`}
              >
                {fixStatus === 'fixing' ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wrench className="h-3 w-3" />
                    Auto-fix
                  </>
                )}
              </button>
            )}

            {/* Fixed indicator */}
            {fixStatus === 'fixed' && (
              <span className={`${typography.caption} inline-flex items-center gap-1 text-mint-700`}>
                <CheckCircle className="h-3.5 w-3.5" />
                Fixed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
