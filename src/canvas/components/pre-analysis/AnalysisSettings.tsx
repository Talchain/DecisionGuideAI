/**
 * AnalysisSettings — T3 "Advanced" accordion.
 *
 * Collapsed by default. Hosts the inventory of advanced configuration
 * surfaces:
 *   - Goal node selector (dropdown).
 *   - Goal success target editor (`SuccessTarget`) — passed as children
 *     by the consumer so the editor stays a single canonical surface.
 *   - Future surfaces (risk appetite, graph statistics, simulation
 *     settings) are deliberately deferred to Brief 5.8B/5.9 because their
 *     data sources are not yet wired. The accordion stays mounted now so
 *     the IA slot is reserved.
 */

import { Accordion } from './primitives'
import type { Node } from '@xyflow/react'
import type { ReactNode } from 'react'
import { typography } from '@/styles/typography'

interface AnalysisSettingsProps {
  /** All goal nodes */
  goalNodes: Node[]
  /** Currently selected goal node */
  selectedGoalNode: Node | null
  /** Callback when goal selection changes */
  onGoalChange?: (goalId: string) => void
  /**
   * Brief 5.8A holistic-review pass: the SuccessTarget editor (and any
   * future advanced surfaces) is supplied as children so AnalysisSettings
   * stays a thin layout component. Render order: goal selector first,
   * then children, then deferred-surfaces note.
   */
  children?: ReactNode
}

export function AnalysisSettings({
  goalNodes,
  selectedGoalNode,
  onGoalChange,
  children,
}: AnalysisSettingsProps) {
  const hasGoals = goalNodes.length > 0
  if (!hasGoals) return null

  const getNodeLabel = (node: Node): string => {
    return (node.data as { label?: string })?.label ?? node.id
  }

  return (
    <Accordion
      title="Advanced"
      defaultExpanded={false}
      testId="analysis-settings-accordion"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label
            htmlFor="goal-selector"
            className={`${typography.panelBody} text-text-light flex-shrink-0`}
          >
            Goal
          </label>
          <select
            id="goal-selector"
            value={selectedGoalNode?.id ?? ''}
            onChange={(e) => onGoalChange?.(e.target.value)}
            title={selectedGoalNode ? getNodeLabel(selectedGoalNode) : undefined}
            className={`flex-1 min-w-0 px-2 py-1.5 ${typography.panelBody} border border-panel-border rounded-lg bg-panel text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info cursor-pointer truncate`}
          >
            {goalNodes.map(goal => (
              <option key={goal.id} value={goal.id}>
                {getNodeLabel(goal)}
              </option>
            ))}
          </select>
        </div>

        {children}

        {/* Brief 5.8A holistic-review pass: deferred-surfaces disposition.
            Risk appetite, graph statistics, and simulation settings remain
            pending — their data sources land in Brief 5.8B/5.9. The note
            sets user expectations about why the section is sparse today. */}
        <p className={`${typography.panelMeta} text-text-light`}>
          Risk appetite, graph statistics, and simulation settings will appear here once their data is wired (Brief 5.8B/5.9).
        </p>
      </div>
    </Accordion>
  )
}

export default AnalysisSettings
