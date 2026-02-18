/**
 * AnalysisSettings - Accordion with analysis configuration
 *
 * Collapsed by default.
 * Contains:
 * - Goal node selector (dropdown, reads/writes selectedGoalNode from existing store)
 * - Define Success threshold (currency input + "Auto-filled" pill if value was auto-derived)
 *
 * Future placeholders (commented): detail level selector, seed override
 */

import { Accordion, Pill } from './primitives'
import type { Node } from '@xyflow/react'

interface AnalysisSettingsProps {
  /** All goal nodes */
  goalNodes: Node[]
  /** Currently selected goal node */
  selectedGoalNode: Node | null
  /** Success threshold value */
  successThreshold: number | null
  /** Whether threshold was auto-derived */
  isThresholdAutoDerived: boolean
  /** Raw threshold value from CEE (e.g. 200) */
  goalThresholdRaw?: number | null
  /** Threshold unit from CEE (e.g. "customers") */
  goalThresholdUnit?: string | null
  /** Callback when goal selection changes */
  onGoalChange?: (goalId: string) => void
  /** Callback when threshold changes */
  onThresholdChange?: (value: number | null) => void
}

export function AnalysisSettings({
  goalNodes,
  selectedGoalNode,
  successThreshold,
  isThresholdAutoDerived,
  goalThresholdRaw,
  goalThresholdUnit,
  onGoalChange,
  onThresholdChange,
}: AnalysisSettingsProps) {
  // Show if there are any goal nodes (always show goal selector when goals exist)
  const hasGoals = goalNodes.length > 0

  // Don't render if no goals
  if (!hasGoals) {
    return null
  }

  const getNodeLabel = (node: Node): string => {
    return (node.data as { label?: string })?.label ?? node.id
  }

  return (
    <Accordion
      title="Analysis settings"
      defaultExpanded={false}
      testId="analysis-settings-accordion"
    >
      <div className="space-y-4">
        {/* Goal selector - always show when goals exist */}
        {hasGoals && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="goal-selector"
              className="text-sm text-text-light flex-shrink-0"
            >
              Goal
            </label>
            <select
              id="goal-selector"
              value={selectedGoalNode?.id ?? ''}
              onChange={(e) => onGoalChange?.(e.target.value)}
              title={selectedGoalNode ? getNodeLabel(selectedGoalNode) : undefined}
              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-panel-border rounded-lg bg-panel text-text-body focus:outline-none focus:ring-2 focus:ring-info cursor-pointer truncate"
            >
              {goalNodes.map(goal => (
                <option key={goal.id} value={goal.id}>
                  {getNodeLabel(goal)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Success threshold */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="success-threshold"
            className="text-sm text-text-light w-24 flex-shrink-0"
          >
            Success threshold
          </label>
          <div className="flex-1 flex items-center gap-2">
            {/* Show raw value with unit when available, otherwise editable normalised input */}
            {goalThresholdRaw != null ? (
              <span className="flex-1 px-2 py-1.5 text-sm text-text-body">
                {goalThresholdRaw.toLocaleString()}{goalThresholdUnit ? ` ${goalThresholdUnit}` : ''}
              </span>
            ) : (
              <input
                id="success-threshold"
                type="number"
                placeholder="Enter target value (optional)"
                value={successThreshold ?? ''}
                onChange={(e) => {
                  const rawValue = e.target.value
                  if (rawValue === '' || rawValue === null) {
                    onThresholdChange?.(null)
                    return
                  }
                  const parsed = parseFloat(rawValue)
                  // Only update if parsed value is a valid number (not NaN)
                  if (!Number.isNaN(parsed)) {
                    onThresholdChange?.(parsed)
                  }
                }}
                className="flex-1 px-2 py-1.5 text-sm border border-panel-border rounded-lg bg-panel text-text-body focus:outline-none focus:ring-2 focus:ring-info"
              />
            )}
            {isThresholdAutoDerived && (
              <span title="Derived from goal node value">
                <Pill size="small" variant="info">
                  Auto
                </Pill>
              </span>
            )}
          </div>
        </div>

        {/* Helper text */}
        <p className="text-sm text-text-light">
          When set, shows probability of reaching this target for each option.
        </p>

        {/* Future placeholders */}
        {/* TODO: Detail level selector */}
        {/* TODO: Seed override */}
      </div>
    </Accordion>
  )
}

export default AnalysisSettings
