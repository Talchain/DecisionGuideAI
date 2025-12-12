/**
 * PreAnalysisGuidance - Pre-run guidance section for Results tab
 *
 * Displays all guidance items in the Results tab BEFORE the "Run Analysis" button.
 * This is the natural decision point - users see issues → address them → run confidently.
 *
 * Groups guidance into:
 * - Critical Issues (blockers - must fix before running)
 * - Improvements (warnings/info - optional but recommended)
 * - Coaching Nudges (AI suggestions for better models)
 *
 * Empty state shows "Ready to run!" when no issues detected.
 */

import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { CheckCircle, AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react'
import { useCanvasStore } from '../store'
import { useCEECoaching } from '../hooks/useCEECoaching'
import { useGraphReadiness } from '../hooks/useGraphReadiness'
import { GuidanceCard, type GuidanceItem, type GuidanceSeverity, type AutoFixStatus } from './GuidanceCard'
import { typography } from '../../styles/typography'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { executeAutoFix, determineFixType, type AutoFixParams } from '../utils/autoFix'
import { trackAutoFixClicked, trackAutoFixSuccess, trackAutoFixFailed } from '../utils/sandboxTelemetry'
import { stableImprovementId } from '../utils/stableId'

/**
 * Human-readable titles for validation codes
 * Maps error codes to user-friendly titles
 */
const VALIDATION_TITLE_MAP: Record<string, string> = {
  // Probability issues
  'PROBABILITY_SUM': 'Probability sum must equal 100%',
  'PROBABILITY_ERROR': 'Probability sum must equal 100%',
  'BELIEF_OUT_OF_RANGE': 'Belief value out of range',
  // Graph structure
  'ORPHAN_NODE': 'Disconnected node found',
  'ORPHAN': 'Disconnected node found',
  'DANGLING_EDGE': 'Edge references missing node',
  'DANGLING': 'Edge references missing node',
  'CYCLE_DETECTED': 'Circular dependency detected',
  'CYCLE': 'Circular dependency detected',
  'SELF_LOOP': 'Node connects to itself',
  // Missing elements
  'MISSING_OUTCOME': 'No outcome node defined',
  'NO_OUTCOME_NODE': 'No outcome node defined',
  'MISSING_DECISION': 'No decision node found',
  'MISSING_GOAL': 'No goal node defined',
  'MISSING_LABEL': 'Node or edge missing label',
  'NO_RISK': 'No risk factors identified',
  'NO_FACTOR': 'No influencing factors added',
  // Duplicates
  'DUPLICATE_EDGE': 'Duplicate connection found',
  'DUPLICATE': 'Duplicate connection found',
  // Structure
  'DECISION_AFTER_OUTCOME': 'Decision placed after outcome',
  'UNBALANCED_FACTORS': 'Unbalanced factor weights',
  'MISSING_EVIDENCE': 'Claim needs supporting evidence',
}

/**
 * Get a human-readable title for a validation code
 */
function getValidationTitle(code: string | undefined, fallbackTitle?: string): string {
  if (!code) return fallbackTitle || 'Validation issue'
  const upperCode = code.toUpperCase()
  return VALIDATION_TITLE_MAP[upperCode] || fallbackTitle || code.replace(/_/g, ' ')
}

/**
 * Map validation severity to guidance severity
 */
function mapValidationSeverity(severity: string): GuidanceSeverity {
  switch (severity) {
    case 'error':
    case 'blocker':
      return 'blocker'
    case 'warning':
      return 'warning'
    default:
      return 'info'
  }
}

/**
 * Map bias severity to guidance severity
 */
function mapBiasSeverity(severity: string): GuidanceSeverity {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'blocker'
    case 'warning':
    case 'medium':
      return 'warning'
    default:
      return 'info'
  }
}

interface PreAnalysisGuidanceProps {
  /** Whether blockers are present (controls Run button state) */
  onBlockersChange?: (hasBlockers: boolean) => void
}

export function PreAnalysisGuidance({ onBlockersChange }: PreAnalysisGuidanceProps) {
  // Get coaching state
  const { activeNudge, dismissNudge } = useCEECoaching()

  // Get CEE graph readiness (quality improvements)
  const { readiness } = useGraphReadiness()

  // Get store state
  const graphHealth = useCanvasStore((s) => s.graphHealth)
  const results = useCanvasStore((s) => s.results)
  const runMeta = useCanvasStore((s) => s.runMeta)
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const applyAutoFixChanges = useCanvasStore((s) => s.applyAutoFixChanges)

  // Hover highlight state
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)

  // Auto-fix state management
  const [fixingItems, setFixingItems] = useState<Set<string>>(new Set())
  const [fixedItems, setFixedItems] = useState<Set<string>>(new Set())

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Focus handler for highlighting and centering affected elements
  const handleFocusItem = useCallback(
    (item: GuidanceItem) => {
      // Highlight affected nodes
      if (item.affectedNodes && item.affectedNodes.length > 0) {
        setHighlightedNodes(item.affectedNodes)
        focusNodeById(item.affectedNodes[0])
        setTimeout(() => {
          setHighlightedNodes([])
        }, 3000)
      }
      // Focus edges
      else if (item.affectedEdges && item.affectedEdges.length > 0) {
        focusEdgeById(item.affectedEdges[0])
      }
    },
    [setHighlightedNodes]
  )

  // Hover highlight handler (300ms dwell)
  const handleHoverStart = useCallback(
    (item: GuidanceItem) => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      hoverTimeoutRef.current = window.setTimeout(() => {
        setHoveredItemId(item.id)
        if (item.affectedNodes && item.affectedNodes.length > 0) {
          setHighlightedNodes(item.affectedNodes)
        }
      }, 300)
    },
    [setHighlightedNodes]
  )

  const handleHoverEnd = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredItemId(null)
    setHighlightedNodes([])
  }, [setHighlightedNodes])

  // Auto-fix handler
  const handleAutoFix = useCallback(
    async (item: GuidanceItem): Promise<boolean> => {
      if (!item.code) return false

      trackAutoFixClicked()
      setFixingItems((prev) => new Set(prev).add(item.id))

      const fixType = determineFixType(item.code)
      if (!fixType) {
        console.warn('[PreAnalysisGuidance] No auto-fix available for code:', item.code)
        trackAutoFixFailed()
        setFixingItems((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
        return false
      }

      const params: AutoFixParams = {
        fixType,
        nodeId: item.affectedNodes?.[0],
        edgeId: item.affectedEdges?.[0],
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
          setFixedItems((prev) => new Set(prev).add(item.id))
          setFixingItems((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
          return true
        } else {
          trackAutoFixFailed()
          setFixingItems((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
          return false
        }
      } catch (error) {
        console.error('[PreAnalysisGuidance] Auto-fix error:', error)
        trackAutoFixFailed()
        setFixingItems((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
        return false
      }
    },
    [nodes, edges, applyAutoFixChanges]
  )

  // Get auto-fix status for an item
  const getAutoFixStatus = useCallback(
    (itemId: string): AutoFixStatus => {
      if (fixingItems.has(itemId)) return 'fixing'
      if (fixedItems.has(itemId)) return 'success'
      return 'idle'
    },
    [fixingItems, fixedItems]
  )

  // Build consolidated guidance list
  const { blockers, improvements, coaching } = useMemo(() => {
    const blockersArr: GuidanceItem[] = []
    const improvementsArr: GuidanceItem[] = []
    const coachingArr: GuidanceItem[] = []

    // 1. Coaching nudges
    if (activeNudge) {
      const item: GuidanceItem = {
        id: `coaching-${activeNudge.id}`,
        type: 'coaching',
        severity: activeNudge.severity === 'high' ? 'blocker' : activeNudge.severity === 'medium' ? 'warning' : 'info',
        title: activeNudge.title,
        message: activeNudge.message,
        action: activeNudge.actionLabel
          ? {
              label: activeNudge.actionLabel,
              onClick: () => {
                activeNudge.onAction?.()
                dismissNudge(activeNudge.id)
              },
            }
          : undefined,
      }
      coachingArr.push(item)
    }

    // 2. Validation issues from graphHealth
    if (graphHealth?.issues) {
      for (const issue of graphHealth.issues) {
        const severity = mapValidationSeverity(issue.severity)
        const code = issue.code?.toUpperCase() || issue.type?.toUpperCase()
        // Check if we can auto-fix this issue
        const canAutoFix = !!issue.suggestedFix && !!code && !!determineFixType(code)

        // Use nodeIds array (from graphValidator) for unique ID generation
        // Fallback chain: nodeIds[0] → nodeId → edgeIds[0] → edgeId → 'global'
        const primaryNodeId = issue.nodeIds?.[0] || issue.nodeId
        const primaryEdgeId = issue.edgeIds?.[0] || issue.edgeId
        const uniqueKey = primaryNodeId || primaryEdgeId || 'global'

        const item: GuidanceItem = {
          id: `validation-${issue.code || 'unknown'}-${uniqueKey}`,
          type: 'validation',
          severity,
          title: getValidationTitle(issue.code, issue.title),
          message: issue.message || 'A validation issue was detected',
          affectedNodes: issue.nodeId ? [issue.nodeId] : issue.nodeIds,
          affectedEdges: issue.edgeId ? [issue.edgeId] : issue.edgeIds,
          code,
          auto_fixable: canAutoFix,
          suggested_fix: issue.suggestedFix?.type
            ? `${issue.suggestedFix.type.replace(/_/g, ' ')} (${issue.suggestedFix.targetId})`
            : undefined,
        }

        if (severity === 'blocker') {
          blockersArr.push(item)
        } else {
          improvementsArr.push(item)
        }
      }
    }

    // 3. Weight suggestions from critique (source === 'cee')
    const critique = results?.report?.critique
    if (critique && Array.isArray(critique)) {
      for (const c of critique) {
        if (c.source === 'cee' && !c.message?.includes('auto-applied')) {
          improvementsArr.push({
            id: `weight-${c.edge_id || c.node_id || 'unknown'}`,
            type: 'weight',
            severity: 'info',
            title: 'Refine influence weight',
            message: c.message || 'Consider adjusting this weight',
            affectedEdges: c.edge_id ? [c.edge_id] : undefined,
            affectedNodes: c.node_id ? [c.node_id] : undefined,
            currentValue: c.current_value,
            suggestedValue: c.suggested_value,
            reason: c.reason,
            action: c.suggested_action
              ? {
                  label: c.suggested_action,
                  onClick: () => {
                    console.log('[PreAnalysisGuidance] Apply weight:', c)
                  },
                }
              : undefined,
          })
        }
      }
    }

    // 4. Bias findings from CEE review
    const biasFindings = runMeta?.ceeReview?.bias_findings
    if (biasFindings && Array.isArray(biasFindings)) {
      for (const bias of biasFindings) {
        const severity = mapBiasSeverity(bias.severity || 'info')
        const item: GuidanceItem = {
          id: `bias-${bias.code || bias.type || 'unknown'}`,
          type: 'bias',
          severity,
          title: (bias.code || bias.type || 'Cognitive bias').replace(/_/g, ' '),
          message: bias.message || bias.description || 'A potential bias was detected in your model',
          affectedNodes: bias.affected_node_ids,
          microIntervention: bias.micro_intervention
            ? {
                estimated_minutes: bias.micro_intervention.estimated_minutes || 5,
                steps: bias.micro_intervention.steps || [],
              }
            : undefined,
        }

        if (severity === 'blocker') {
          blockersArr.push(item)
        } else {
          improvementsArr.push(item)
        }
      }
    }

    // 5. CEE Graph Readiness improvements (quality factors)
    // Show High and Medium priority only (skip Low per brief)
    if (readiness?.improvements && Array.isArray(readiness.improvements)) {
      for (const imp of readiness.improvements) {
        // Skip low priority items per Fix 2 requirements
        if (imp.priority === 'low') continue

        const severity: GuidanceSeverity = imp.priority === 'high' ? 'warning' : 'info'

        // Format message with improvement metrics
        const targetText = imp.target_quality !== undefined
          ? ` (→${Math.round(imp.target_quality)}%)`
          : ''
        const impactText = imp.quality_impact !== undefined
          ? ` +${imp.quality_impact}pts`
          : ''
        const message = imp.current_gap
          ? `${imp.current_gap}${impactText}${targetText}`
          : `${imp.action}${impactText}${targetText}`

        improvementsArr.push({
          // P1 fix: Use stable hash-based ID to prevent collisions
          id: stableImprovementId(imp.category, imp.action, imp.affected_nodes),
          type: 'readiness',
          severity,
          title: imp.action,
          message,
          affectedNodes: imp.affected_nodes,
          affectedEdges: imp.affected_edges,
          effortMinutes: imp.effort_minutes,
          suggestedNodeType: imp.suggested_node_type,
        })
      }
    }

    return {
      blockers: blockersArr,
      improvements: improvementsArr,
      coaching: coachingArr,
    }
  }, [activeNudge, dismissNudge, graphHealth, results, runMeta, readiness])

  // Notify parent about blocker state (moved from useMemo to useEffect)
  useEffect(() => {
    onBlockersChange?.(blockers.length > 0)
  }, [blockers.length, onBlockersChange])

  const totalCount = blockers.length + improvements.length + coaching.length

  // Empty state - no validation issues
  if (totalCount === 0) {
    // Different messaging for empty canvas vs populated canvas
    const hasNodes = nodes.length > 0
    return (
      <div className={`flex items-center gap-3 p-4 ${hasNodes ? 'bg-mint-50 border-mint-200' : 'bg-sand-50 border-sand-200'} border rounded-xl`}>
        <CheckCircle className={`h-6 w-6 ${hasNodes ? 'text-mint-600' : 'text-sand-500'} flex-shrink-0`} aria-hidden="true" />
        <div>
          <p className={`${typography.body} font-medium ${hasNodes ? 'text-mint-800' : 'text-sand-700'}`}>
            {hasNodes ? 'Ready to run!' : 'No validation issues'}
          </p>
          <p className={`${typography.caption} ${hasNodes ? 'text-mint-700' : 'text-sand-600'}`}>
            {hasNodes ? 'Your model looks solid.' : 'Add some nodes to get started.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="pre-analysis-guidance">
      {/* Critical Issues Section */}
      {blockers.length > 0 && (
        <section aria-labelledby="blockers-heading">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-carrot-600" aria-hidden="true" />
            <h3 id="blockers-heading" className={`${typography.label} text-carrot-700`}>
              Critical Issues
              <span className="ml-2 text-carrot-500">({blockers.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {blockers.map((item) => (
              <div
                key={item.id}
                onMouseEnter={() => handleHoverStart(item)}
                onMouseLeave={handleHoverEnd}
                className={hoveredItemId === item.id ? 'ring-1 ring-sky-300 rounded-xl' : ''}
              >
                <GuidanceCard
                  item={item}
                  onClick={() => handleFocusItem(item)}
                  onAutoFix={handleAutoFix}
                  autoFixStatus={getAutoFixStatus(item.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Improvements Section */}
      {improvements.length > 0 && (
        <section aria-labelledby="improvements-heading">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-sky-600" aria-hidden="true" />
            <h3 id="improvements-heading" className={`${typography.label} text-sky-700`}>
              Improvements
              <span className="ml-2 text-sky-500">({improvements.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {improvements.map((item) => (
              <div
                key={item.id}
                onMouseEnter={() => handleHoverStart(item)}
                onMouseLeave={handleHoverEnd}
                className={hoveredItemId === item.id ? 'ring-1 ring-sky-300 rounded-xl' : ''}
              >
                <GuidanceCard
                  item={item}
                  onClick={() => handleFocusItem(item)}
                  onAutoFix={handleAutoFix}
                  autoFixStatus={getAutoFixStatus(item.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Coaching Section */}
      {coaching.length > 0 && (
        <section aria-labelledby="coaching-heading">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-sun-600" aria-hidden="true" />
            <h3 id="coaching-heading" className={`${typography.label} text-sun-700`}>
              Coaching Nudges
              <span className="ml-2 text-sun-500">({coaching.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {coaching.map((item) => (
              <div
                key={item.id}
                onMouseEnter={() => handleHoverStart(item)}
                onMouseLeave={handleHoverEnd}
                className={hoveredItemId === item.id ? 'ring-1 ring-sky-300 rounded-xl' : ''}
              >
                <GuidanceCard
                  item={item}
                  onClick={() => handleFocusItem(item)}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
