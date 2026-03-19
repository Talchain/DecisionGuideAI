/**
 * GoalProgressChecklist — pre-analysis readiness checklist for Goal nodes
 *
 * S.6: Replaces the single coaching card in Goal Summary (pre-analysis only).
 * Correction #6: Softer tone — "Not set yet" in text-text-light, "[Set now]" in text-info.
 */

import { Check } from 'lucide-react'
import { useCanvasStore } from '../../store'
import { isGoalDefined } from '../../../utils/isGoalDefined'
import { typography } from '../../../styles/typography'

interface GoalProgressChecklistProps {
  nodeId: string
  /** Callback to expand Assumptions section and focus threshold field */
  onExpandAssumptions?: () => void
}

interface CheckItem {
  label: string
  /** Text shown when the check fails (includes the item name for context) */
  failLabel: string
  passed: boolean
  /** Optional action text+handler for failed items */
  action?: { text: string; onClick: () => void }
}

export function GoalProgressChecklist({ nodeId, onExpandAssumptions }: GoalProgressChecklistProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const goalThreshold = useCanvasStore(s => s.goalThreshold)
  const goalConstraints = useCanvasStore(s => s.goalConstraints)

  const node = nodes.find(n => n.id === nodeId)
  const titleSet = Boolean(node?.data?.label?.toString().trim())
  const thresholdSet = isGoalDefined(goalThreshold, goalConstraints)
  const hasIncomingEdges = edges.some(e => e.target === nodeId)
  const hasOptions = nodes.some(n => n.type === 'option')

  const checks: CheckItem[] = [
    { label: 'Title set', failLabel: 'Title not set yet', passed: titleSet },
    {
      label: 'Threshold set',
      failLabel: 'Threshold not set yet',
      passed: thresholdSet,
      action: onExpandAssumptions
        ? { text: 'Set now', onClick: onExpandAssumptions }
        : undefined,
    },
    { label: 'Connected to factors', failLabel: 'Not connected to factors', passed: hasIncomingEdges },
    { label: 'Options defined', failLabel: 'No options defined', passed: hasOptions },
  ]

  return (
    <div className="mt-2 space-y-1" data-testid="goal-progress-checklist">
      {checks.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.passed ? (
            <Check size={10} className="text-success flex-shrink-0" />
          ) : (
            <span className={`w-2.5 h-2.5 flex items-center justify-center flex-shrink-0 text-text-light ${typography.panelMeta}`}>
              –
            </span>
          )}
          <span className={`${typography.panelMeta} ${item.passed ? 'text-text-body' : 'text-text-light'}`}>
            {item.passed ? item.label : (
              <>
                {item.failLabel}
                {item.action && (
                  <>
                    {' \u2014 '}
                    <button
                      type="button"
                      onClick={item.action.onClick}
                      className="text-info hover:underline"
                    >
                      {item.action.text}
                    </button>
                  </>
                )}
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
