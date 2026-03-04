/**
 * RecommendedNextSteps - Panel 4: "What's next?"
 *
 * Brief H Task 11: Improved next steps with priority and actions
 *
 * Features:
 * - Prioritized action list
 * - Clickable items for validation actions
 * - Links to VoI suggestions
 * - Clear call-to-action buttons
 */

import { useCallback } from 'react'
import {
  ArrowRight,
  CheckCircle,
  Search,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'
import { typography } from '../../../styles/typography'
import { EMPTY_STATES } from '../../../components/results/emptyStates'

interface NextStepAction {
  action: string
  rationale?: string
  priority?: 'high' | 'medium' | 'low'
  type?: 'validate' | 'investigate' | 'decide' | 'default'
  nodeId?: string
}

interface RecommendedNextStepsProps {
  /** List of recommended actions */
  actions: NextStepAction[]
  /** Items requiring validation */
  validationItems?: Array<{
    label: string
    nodeId: string
  }>
  /** Key insight to display at top */
  keyInsight?: string | null
  /** Callback when action is clicked */
  onActionClick?: (action: NextStepAction) => void
  /** Callback when validation item is clicked */
  onValidationClick?: (nodeId: string) => void
  /** Maximum actions to show */
  maxActions?: number
}

export function RecommendedNextSteps({
  actions,
  validationItems = [],
  keyInsight,
  onActionClick,
  onValidationClick,
  maxActions = 5,
}: RecommendedNextStepsProps) {
  const handleActionClick = useCallback(
    (action: NextStepAction) => {
      onActionClick?.(action)
    },
    [onActionClick]
  )

  const handleValidationClick = useCallback(
    (nodeId: string) => {
      onValidationClick?.(nodeId)
    },
    [onValidationClick]
  )

  // Get priority styling
  const getPriorityStyle = (priority?: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return {
          bg: 'bg-carrot-50',
          border: 'border-carrot-200',
          text: 'text-carrot-700',
          icon: AlertTriangle,
          label: 'High priority',
        }
      case 'medium':
        return {
          bg: 'bg-banana-50',
          border: 'border-banana-200',
          text: 'text-banana-700',
          icon: Lightbulb,
          label: 'Recommended',
        }
      default:
        return {
          bg: 'bg-sky-50',
          border: 'border-sky-200',
          text: 'text-sky-700',
          icon: ArrowRight,
          label: '',
        }
    }
  }

  // Get action type icon
  const getActionIcon = (type?: NextStepAction['type']) => {
    switch (type) {
      case 'validate':
        return CheckCircle
      case 'investigate':
        return Search
      case 'decide':
        return ArrowRight
      default:
        return ArrowRight
    }
  }

  const hasContent = actions.length > 0 || validationItems.length > 0 || keyInsight

  if (!hasContent) {
    return (
      <div className="p-4 bg-panel border border-panel-border rounded-lg" data-testid="next-steps-empty">
        <p className={`${typography.body} text-ink-600 flex items-start gap-2`}>
          <span aria-hidden="true">ℹ️</span>
          {EMPTY_STATES.nextSteps}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="recommended-next-steps">
      {/* Key insight at top */}
      {keyInsight && (
        <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className={`${typography.bodySmall} text-ink-700`}>
              {keyInsight}
            </p>
          </div>
        </div>
      )}

      {/* Validation items - shown first if they exist */}
      {validationItems.length > 0 && (
        <div className="space-y-2">
          <span className={`${typography.caption} font-medium text-ink-600`}>
            Validate these factors:
          </span>
          <div className="space-y-1.5">
            {validationItems.map((item) => (
              <button
                key={item.nodeId}
                type="button"
                onClick={() => handleValidationClick(item.nodeId)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-banana-50 border border-banana-200 hover:bg-banana-100 transition-colors text-left"
              >
                <Search className="h-4 w-4 text-banana-600 flex-shrink-0" aria-hidden="true" />
                <span className={`${typography.bodySmall} text-ink-700`}>
                  {item.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-banana-500 ml-auto" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action items */}
      {actions.length > 0 && (
        <div className="space-y-2">
          {validationItems.length > 0 && (
            <span className={`${typography.caption} font-medium text-ink-600`}>
              Recommended actions:
            </span>
          )}
          <div className="space-y-2">
            {actions.slice(0, maxActions).map((action, index) => {
              const priorityStyle = getPriorityStyle(action.priority)
              const ActionIcon = getActionIcon(action.type)

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleActionClick(action)}
                  className={`w-full p-3 rounded-lg ${priorityStyle.bg} border ${priorityStyle.border} hover:opacity-90 transition-opacity text-left`}
                >
                  <div className="flex items-start gap-3">
                    <ActionIcon
                      className={`h-4 w-4 ${priorityStyle.text} flex-shrink-0 mt-0.5`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {priorityStyle.label && (
                          <span className={`${typography.caption} font-medium ${priorityStyle.text}`}>
                            {priorityStyle.label}
                          </span>
                        )}
                      </div>
                      <p className={`${typography.bodySmall} font-medium text-ink-800`}>
                        {action.action}
                      </p>
                      {action.rationale && (
                        <p className={`${typography.caption} text-ink-600 mt-0.5`}>
                          {action.rationale}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {actions.length > maxActions && (
            <p className={`${typography.caption} text-ink-500 text-center`}>
              +{actions.length - maxActions} more action{actions.length - maxActions !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Decision prompt if ready */}
      {actions.length === 0 && validationItems.length === 0 && (
        <div className="p-3 bg-mint-50 border border-mint-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-mint-600" aria-hidden="true" />
            <span className={`${typography.bodySmall} font-medium text-mint-800`}>
              Ready to decide
            </span>
          </div>
          <p className={`${typography.caption} text-mint-700 mt-1 ml-7`}>
            Your model is well-validated. You can proceed with confidence.
          </p>
        </div>
      )}
    </div>
  )
}
