/**
 * AcceptOverrideControl - Reusable component for CEE suggestion pattern
 * Implements the CEE Transparency Principle: every AI suggestion must have
 * clear provenance and one-click override capability.
 */

import { memo, useState } from 'react'
import { Check, Pencil, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { typography } from '../../styles/typography'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface AcceptOverrideControlProps<T> {
  /** The suggested value from CEE */
  suggestedValue: T
  /** Format the value for display */
  formatValue: (value: T) => string
  /** Confidence level of the suggestion */
  confidence: ConfidenceLevel
  /** Explanation for the suggestion */
  rationale: string
  /** Called when user accepts the suggestion */
  onAccept: (value: T) => void
  /** Called when user wants to override */
  onOverride: () => void
  /** Optional: Label for the suggestion type */
  suggestionLabel?: string
  /** Optional: Show expanded rationale by default */
  defaultExpanded?: boolean
  /** Optional: Additional className */
  className?: string
  /** Optional: Test ID prefix */
  testIdPrefix?: string
}

const confidenceConfig: Record<ConfidenceLevel, { bg: string; border: string; text: string; badge: string }> = {
  high: {
    bg: 'bg-mint-50',
    border: 'border-mint-200',
    text: 'text-mint-700',
    badge: 'bg-mint-100 text-mint-700',
  },
  medium: {
    bg: 'bg-sun-50',
    border: 'border-sun-200',
    text: 'text-sun-700',
    badge: 'bg-sun-100 text-sun-700',
  },
  low: {
    bg: 'bg-sand-50',
    border: 'border-sand-200',
    text: 'text-sand-600',
    badge: 'bg-sand-100 text-sand-600',
  },
}

function AcceptOverrideControlInner<T>({
  suggestedValue,
  formatValue,
  confidence,
  rationale,
  onAccept,
  onOverride,
  suggestionLabel = 'AI suggests',
  defaultExpanded = false,
  className = '',
  testIdPrefix = 'accept-override',
}: AcceptOverrideControlProps<T>) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const config = confidenceConfig[confidence]

  return (
    <div
      className={`p-3 rounded-lg ${config.bg} border ${config.border} ${className}`}
      role="region"
      aria-label="AI suggestion"
      data-testid={`${testIdPrefix}-container`}
    >
      <div className="flex items-start gap-2">
        <Sparkles
          className={`w-4 h-4 ${config.text} flex-shrink-0 mt-0.5`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          {/* Header with suggestion and confidence */}
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className={`${typography.caption} text-ink-600`}>
              {suggestionLabel}:
            </span>
            <span className={`${typography.label} text-ink-900`}>
              {formatValue(suggestedValue)}
            </span>
            <span
              className={`${typography.caption} px-1.5 py-0.5 rounded font-medium ${config.badge}`}
            >
              {confidence} confidence
            </span>
          </div>

          {/* Rationale - collapsible */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`${typography.caption} text-ink-500 flex items-center gap-1 hover:text-ink-700 transition-colors`}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {isExpanded ? 'Hide' : 'Show'} rationale
            </button>
            {isExpanded && (
              <p className={`${typography.bodySmall} text-ink-600 mt-1`}>
                {rationale}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAccept(suggestedValue)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                ${typography.button} bg-mint-500 text-white
                hover:bg-mint-600 transition-colors
              `}
              data-testid={`${testIdPrefix}-accept`}
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Accept
            </button>
            <button
              type="button"
              onClick={onOverride}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                ${typography.button} border border-ink-300 text-ink-700
                hover:bg-ink-50 transition-colors
              `}
              data-testid={`${testIdPrefix}-override`}
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              Override
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const AcceptOverrideControl = memo(AcceptOverrideControlInner) as typeof AcceptOverrideControlInner
