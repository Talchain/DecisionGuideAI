/**
 * DraftWarnings - Displays structural warnings from AI Draft with friendly, educational tone
 *
 * Features:
 * - Non-alarming banana-200 styling (not error red)
 * - Clickable node references
 * - Dismissible with session persistence
 * - Educational messaging
 */

import { useState, useCallback } from 'react'
import { AlertCircle, X, ExternalLink } from 'lucide-react'
import { typography } from '../../styles/typography'
import { focusNodeById } from '../utils/focusHelpers'

export type DraftWarningType =
  | 'orphan_node'
  | 'cycle_detected'
  | 'no_outcome_node'
  | 'decision_after_outcome'
  | 'unbalanced_factors'
  | 'missing_evidence'

export interface DraftWarning {
  type: DraftWarningType
  nodes?: string[]
  nodeLabels?: string[]
  message?: string
}

interface DraftWarningsProps {
  warnings: DraftWarning[]
  onNodeClick?: (nodeId: string) => void
}

/**
 * Format warning message with friendly, educational tone
 */
function formatWarningMessage(warning: DraftWarning): string {
  switch (warning.type) {
    case 'orphan_node':
      return 'Some nodes aren\'t connected - consider linking them to the decision flow'
    case 'cycle_detected':
      return 'Circular relationship detected - check if this reflects your intended logic'
    case 'no_outcome_node':
      return 'No outcome defined yet - add what you\'re trying to achieve'
    case 'decision_after_outcome':
      return 'Decision appears after outcome - verify the sequence makes sense'
    case 'unbalanced_factors':
      return 'Factors seem unbalanced - consider if both pros and cons are represented'
    case 'missing_evidence':
      return 'Some relationships lack evidence - add sources to strengthen your model'
    default:
      return warning.message || 'Graph structure could be improved'
  }
}

/**
 * Get emoji icon for warning type
 */
function getWarningIcon(type: DraftWarningType): string {
  switch (type) {
    case 'orphan_node':
      return '\u{1F517}' // link
    case 'cycle_detected':
      return '\u{1F504}' // arrows
    case 'no_outcome_node':
      return '\u{1F3AF}' // target
    case 'decision_after_outcome':
      return '\u{26A0}' // warning
    case 'unbalanced_factors':
      return '\u{2696}' // scales
    case 'missing_evidence':
      return '\u{1F4DA}' // books
    default:
      return '\u{1F4A1}' // lightbulb
  }
}

const STORAGE_KEY = 'draft-warnings-dismissed'

export function DraftWarnings({ warnings, onNodeClick }: DraftWarningsProps) {
  // Initialize from sessionStorage to restore dismissed state across page reloads
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Ignore storage errors
    }
  }, [])

  const handleNodeClick = useCallback((nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId)
    } else {
      focusNodeById(nodeId)
    }
  }, [onNodeClick])

  if (warnings.length === 0 || dismissed) {
    return null
  }

  return (
    <div
      className="mb-4 p-4 bg-banana-200/30 border border-banana-200 rounded-lg"
      role="alert"
      aria-live="polite"
      data-testid="draft-warnings"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-ink-700" aria-hidden="true" />
            <h4 className={`${typography.label} text-ink-900`}>
              Graph structure suggestions
            </h4>
          </div>

          {/* Warning list */}
          <ul className="space-y-2" role="list">
            {warnings.map((warning, idx) => (
              <li key={`${warning.type}-${idx}`} className={`${typography.body} text-ink-800`}>
                <span className="mr-2" aria-hidden="true">
                  {getWarningIcon(warning.type)}
                </span>
                {formatWarningMessage(warning)}

                {/* Clickable node references */}
                {warning.nodes && warning.nodes.length > 0 && (
                  <span className="inline-flex items-center gap-1 ml-2">
                    {warning.nodes.map((nodeId, nodeIdx) => {
                      const label = warning.nodeLabels?.[nodeIdx] || nodeId
                      return (
                        <span key={nodeId}>
                          {nodeIdx > 0 && ', '}
                          <button
                            type="button"
                            onClick={() => handleNodeClick(nodeId)}
                            className="inline-flex items-center gap-0.5 text-sky-600 hover:text-sky-700 hover:underline"
                          >
                            {label}
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </span>
                      )
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {/* Help text */}
          <p className={`${typography.caption} text-ink-600 mt-3`}>
            These suggestions can help improve your model's accuracy and completeness.
          </p>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-ink-500 hover:text-ink-700 hover:bg-banana-300/30 rounded transition-colors"
          aria-label="Dismiss suggestions"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default DraftWarnings
