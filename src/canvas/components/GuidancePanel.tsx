/**
 * GuidancePanel - Unified guidance display
 *
 * Consolidates all guidance sources into a single view:
 * - Coaching nudges (from useCEECoaching)
 * - Validation issues (from graphHealth)
 * - Weight suggestions (from critique where source === 'cee')
 * - Bias findings (from runMeta.ceeReview.bias_findings)
 *
 * Items are sorted by severity: blockers → warnings → info
 */

import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { useCanvasStore } from '../store'
import { useCEECoaching } from '../hooks/useCEECoaching'
import { GuidanceCard, type GuidanceItem, type GuidanceSeverity } from './GuidanceCard'
import { typography } from '../../styles/typography'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'

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

export function GuidancePanel() {
  // Get coaching state
  const { activeNudge, dismissNudge } = useCEECoaching()

  // Get store state
  const graphHealth = useCanvasStore((s) => s.graphHealth)
  const results = useCanvasStore((s) => s.results)
  const runMeta = useCanvasStore((s) => s.runMeta)
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)
  const nodes = useCanvasStore((s) => s.nodes)

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  // Focus handler for highlighting and centering affected elements
  const handleFocusItem = useCallback(
    (item: GuidanceItem) => {
      // Highlight affected nodes (store expects string[], not Set)
      if (item.affectedNodes && item.affectedNodes.length > 0) {
        setHighlightedNodes(item.affectedNodes)
        // Center viewport on first affected node
        focusNodeById(item.affectedNodes[0])
        // Clear highlight after 3s
        setTimeout(() => {
          setHighlightedNodes([])
        }, 3000)
      }
      // Focus edges via focusEdgeById (centers viewport, selects edge)
      else if (item.affectedEdges && item.affectedEdges.length > 0) {
        focusEdgeById(item.affectedEdges[0])
      }
    },
    [setHighlightedNodes]
  )

  // Build consolidated guidance list
  const allGuidance = useMemo(() => {
    const items: GuidanceItem[] = []

    // 1. Coaching nudges
    if (activeNudge) {
      items.push({
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
      })
    }

    // 2. Validation issues from graphHealth
    if (graphHealth?.issues) {
      for (const issue of graphHealth.issues) {
        items.push({
          id: `validation-${issue.code || 'unknown'}-${issue.nodeId || issue.edgeId || 'global'}`,
          type: 'validation',
          severity: mapValidationSeverity(issue.severity),
          title: issue.title || (issue.code ? issue.code.replace(/_/g, ' ') : 'Validation issue'),
          message: issue.message || 'A validation issue was detected',
          affectedNodes: issue.nodeId ? [issue.nodeId] : undefined,
          affectedEdges: issue.edgeId ? [issue.edgeId] : undefined,
        })
      }
    }

    // 3. Weight suggestions from critique (source === 'cee')
    const critique = results?.report?.critique
    if (critique && Array.isArray(critique)) {
      for (const item of critique) {
        if (item.source === 'cee' && !item.message?.includes('auto-applied')) {
          items.push({
            id: `weight-${item.edge_id || item.node_id || 'unknown'}`,
            type: 'weight',
            severity: 'info',
            title: 'Weight suggestion',
            message: item.message || 'Consider adjusting this weight',
            affectedEdges: item.edge_id ? [item.edge_id] : undefined,
            affectedNodes: item.node_id ? [item.node_id] : undefined,
            action: item.suggested_action
              ? {
                  label: item.suggested_action,
                  onClick: () => {
                    // Weight application would be handled here
                    console.log('[GuidancePanel] Apply weight:', item)
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
        items.push({
          id: `bias-${bias.code || bias.type || 'unknown'}`,
          type: 'bias',
          severity: mapBiasSeverity(bias.severity || 'info'),
          title: (bias.code || bias.type || 'Cognitive bias').replace(/_/g, ' '),
          message: bias.message || bias.description || 'A potential bias was detected in your model',
          affectedNodes: bias.affected_node_ids,
          microIntervention: bias.micro_intervention
            ? {
                estimated_minutes: bias.micro_intervention.estimated_minutes || 5,
                steps: bias.micro_intervention.steps || [],
              }
            : undefined,
        })
      }
    }

    // Sort: blockers → warnings → info
    const severityOrder: Record<GuidanceSeverity, number> = {
      blocker: 0,
      warning: 1,
      info: 2,
    }
    return items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  }, [activeNudge, dismissNudge, graphHealth, results, runMeta])

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (allGuidance.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => {
            const next = prev < allGuidance.length - 1 ? prev + 1 : 0
            cardRefs.current[next]?.focus()
            return next
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : allGuidance.length - 1
            cardRefs.current[next]?.focus()
            return next
          })
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < allGuidance.length) {
            handleFocusItem(allGuidance[focusedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setFocusedIndex(-1)
          listRef.current?.focus()
          break
      }
    },
    [allGuidance, focusedIndex, handleFocusItem]
  )

  // Reset focused index when guidance list changes
  useEffect(() => {
    setFocusedIndex(-1)
  }, [allGuidance.length])

  // Empty state
  if (allGuidance.length === 0) {
    return (
      <div className="p-12 text-center">
        <CheckCircle className="h-12 w-12 text-mint-500 mx-auto mb-3" aria-hidden="true" />
        <h3 className={`${typography.h4} text-ink-900 mb-1`}>Looking good!</h3>
        <p className={`${typography.body} text-ink-600`}>
          No issues detected in your model.
        </p>
        {nodes.length === 0 && (
          <p className={`${typography.caption} text-ink-500 mt-2`}>
            Add some nodes to get started.
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className="p-4 space-y-4"
      role="listbox"
      aria-label="Model guidance"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className={`${typography.caption} text-ink-500 mb-2`}>
        {allGuidance.length} item{allGuidance.length !== 1 ? 's' : ''} to review
        <span className="sr-only">. Use arrow keys to navigate, Enter to focus on canvas.</span>
      </div>
      {allGuidance.map((item, index) => (
        <div
          key={item.id}
          ref={(el) => { cardRefs.current[index] = el }}
          role="option"
          aria-selected={focusedIndex === index}
          tabIndex={focusedIndex === index ? 0 : -1}
          className={focusedIndex === index ? 'ring-2 ring-sky-500 ring-offset-2 rounded-xl' : ''}
          onFocus={() => setFocusedIndex(index)}
        >
          <GuidanceCard item={item} onClick={() => handleFocusItem(item)} />
        </div>
      ))}
    </div>
  )
}

/**
 * Hook to get the count of unresolved guidance items
 * Used for badge display in OutputsDock
 */
export function useGuidanceCount(): number {
  const { activeNudge } = useCEECoaching()
  const graphHealth = useCanvasStore((s) => s.graphHealth)
  const results = useCanvasStore((s) => s.results)
  const runMeta = useCanvasStore((s) => s.runMeta)

  return useMemo(() => {
    let count = 0

    // Coaching
    if (activeNudge) count += 1

    // Validation blockers only for badge
    if (graphHealth?.issues) {
      count += graphHealth.issues.filter(
        (i) => i.severity === 'error' || i.severity === 'blocker'
      ).length
    }

    // Weight suggestions
    const critique = results?.report?.critique
    if (critique && Array.isArray(critique)) {
      count += critique.filter(
        (c) => c.source === 'cee' && !c.message?.includes('auto-applied')
      ).length
    }

    // Biases (non-info only)
    const biasFindings = runMeta?.ceeReview?.bias_findings
    if (biasFindings && Array.isArray(biasFindings)) {
      count += biasFindings.filter((b) => b.severity !== 'info').length
    }

    return count
  }, [activeNudge, graphHealth, results, runMeta])
}
