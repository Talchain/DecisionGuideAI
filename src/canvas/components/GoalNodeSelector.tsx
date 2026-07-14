/**
 * GoalNodeSelector Component (Phase 1.4)
 *
 * Strict goal selection that only allows nodes with kind='goal'.
 * Provides "Mark as goal" action for other node types.
 *
 * Key features:
 * - Only goal nodes appear in dropdown
 * - Candidates (outcome/factor nodes) can be promoted to goal
 * - Clear warnings for missing/invalid goal
 * - Validates goal selection before analysis
 */

import { useMemo } from 'react'
import { Target, AlertTriangle, AlertCircle, Check } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { typography } from '../../styles/typography'

// ============================================================================
// Types
// ============================================================================

interface GoalNodeSelectorProps {
  /** All canvas nodes */
  nodes: Node[]
  /** Currently selected goal node ID */
  currentGoalId: string | null
  /** Callback when goal selection changes */
  onChange: (nodeId: string | null) => void
  /** Callback when user wants to mark a node as goal */
  onMarkAsGoal: (nodeId: string) => void
  /** Compact display mode */
  compact?: boolean
}

interface NodeData {
  label?: string
  kind?: string
}

// ============================================================================
// Component
// ============================================================================

export function GoalNodeSelector({
  nodes,
  currentGoalId,
  onChange,
  onMarkAsGoal,
  compact = false,
}: GoalNodeSelectorProps) {
  // Only show goal nodes in dropdown
  const goalNodes = useMemo(
    () => nodes.filter((n) => (n.data as NodeData)?.kind === 'goal'),
    [nodes]
  )

  // Show candidates that could become goals (for "Mark as goal" action)
  const promotableCandidates = useMemo(
    () =>
      nodes.filter((n) => {
        const kind = (n.data as NodeData)?.kind
        return kind === 'outcome' || kind === 'factor'
      }),
    [nodes]
  )

  const currentGoal = nodes.find((n) => n.id === currentGoalId)
  const currentGoalKind = (currentGoal?.data as NodeData)?.kind
  const isCurrentGoalValid = currentGoalKind === 'goal'

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="goal-selector-compact">
        <Target className="h-4 w-4 text-sky-600 flex-shrink-0" />
        {goalNodes.length > 0 ? (
          <select
            value={currentGoalId ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="text-sm border border-sand-200 rounded px-2 py-1 bg-white"
          >
            <option value="">Select goal...</option>
            {goalNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {(node.data as NodeData).label || node.id}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-carrot-600">No goal nodes</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="goal-selector">
      <div>
        <label className={`${typography.body} font-medium text-ink-800 flex items-center gap-1`}>
          Goal Node
          <span className="text-carrot-500">*</span>
        </label>
        <p className={`${typography.caption} text-ink-500 mt-0.5`}>
          Select the outcome you want to optimise when comparing options.
        </p>
      </div>

      {/* Warning: No goal selected */}
      {!currentGoalId && (
        <div className="flex items-start gap-2 px-3 py-2 bg-carrot-50 border border-carrot-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-carrot-600 flex-shrink-0 mt-0.5" />
          <span className={`${typography.caption} text-carrot-700`}>
            No goal selected. Analysis requires a goal node.
          </span>
        </div>
      )}

      {/* Warning: Goal node deleted */}
      {currentGoalId && !currentGoal && (
        <div className="flex items-start gap-2 px-3 py-2 bg-carrot-50 border border-carrot-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-carrot-600 flex-shrink-0 mt-0.5" />
          <span className={`${typography.caption} text-carrot-700`}>
            Selected goal no longer exists. Please select a new goal.
          </span>
        </div>
      )}

      {/* Warning: Goal node kind mismatch */}
      {currentGoal && !isCurrentGoalValid && (
        <div className="flex items-start gap-2 px-3 py-2 bg-banana-50 border border-banana-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-banana-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className={`${typography.caption} text-banana-700`}>
              "{(currentGoal.data as NodeData).label || currentGoal.id}" is not
              marked as a goal.
            </span>
            <button
              type="button"
              onClick={() => onMarkAsGoal(currentGoal.id)}
              className="ml-2 text-xs font-medium text-banana-700 hover:text-banana-800 underline"
            >
              Mark as goal
            </button>
          </div>
        </div>
      )}

      {/* Goal selector */}
      {goalNodes.length > 0 ? (
        <select
          value={currentGoalId ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full px-3 py-2 border border-sand-200 rounded-lg bg-white text-ink-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
        >
          <option value="">Select goal node...</option>
          {goalNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {(node.data as NodeData).label || node.id}
            </option>
          ))}
        </select>
      ) : (
        <div className="space-y-3">
          <div className="px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg">
            <p className={`${typography.caption} text-ink-600`}>
              No goal nodes in the model.
            </p>
          </div>

          {/* Promotable candidates */}
          {promotableCandidates.length > 0 && (
            <div className="space-y-2">
              <p className={`${typography.caption} text-ink-600`}>
                Would you like to mark one of these as the goal?
              </p>
              <ul className="space-y-1">
                {promotableCandidates.slice(0, 5).map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onMarkAsGoal(node.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left bg-white border border-sand-200 rounded-lg hover:bg-sky-50 hover:border-sky-300 transition-colors"
                    >
                      <span className={`${typography.bodySmall} text-ink-700`}>
                        {(node.data as NodeData).label || node.id}
                      </span>
                      <span
                        className={`${typography.caption} px-1.5 py-0.5 rounded ${
                          (node.data as NodeData).kind === 'outcome'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-sand-100 text-sand-600'
                        }`}
                      >
                        {(node.data as NodeData).kind}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Current selection indicator */}
      {currentGoal && isCurrentGoalValid && (
        <div className="flex items-center gap-2 px-3 py-2 bg-mint-50 border border-mint-200 rounded-lg">
          <Check className="h-4 w-4 text-mint-600 flex-shrink-0" />
          <span className={`${typography.caption} text-mint-700`}>
            Goal: {(currentGoal.data as NodeData).label || currentGoal.id}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Handle marking a node as goal.
 * Updates both the node kind and selects it as the goal.
 */
export function useGoalNodeActions(
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void,
  setOutcomeNode: (nodeId: string | null, opts?: { rederiveThreshold?: boolean }) => void
) {
  const handleMarkAsGoal = (nodeId: string) => {
    // Update node kind to 'goal'
    updateNodeData(nodeId, { kind: 'goal' })
    // Set as the selected goal AND re-derive the goal-threshold scalar from this
    // node (P0-1, external review round 2): marking a new goal is a goal-context
    // transition, so a previous goal's target must not ride it.
    setOutcomeNode(nodeId, { rederiveThreshold: true })
  }

  return { handleMarkAsGoal }
}
