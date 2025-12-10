/**
 * SuggestionCard<T> - Generic CEE suggestion display
 *
 * Shows AI-generated suggestions with confidence indicators:
 * - "AI suggested" badge with Sparkles icon
 * - Confidence level (high/medium/low)
 * - Reasoning text
 * - Accept/Override action buttons
 * - Clarification mode with clickable options
 *
 * Reusable for utility weights, beliefs, risk tolerance, etc.
 */

import { Sparkles, Check, Pencil } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface Suggestion<T> {
  suggested_value: T
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  provenance: 'cee'
  needs_clarification?: boolean
  clarifying_question?: string
  options?: Array<{ label: string; value: T }>
}

interface SuggestionCardProps<T> {
  suggestion: Suggestion<T>
  /** Label for the suggestion (e.g., "Utility Weight", "Belief Estimate") */
  label: string
  /** Format the value for display */
  formatValue: (value: T) => string
  /** Called when user accepts the suggestion */
  onAccept: (value: T) => void
  /** Called when user wants to override (opens editor mode) */
  onOverride: () => void
  /** Called when user selects a clarification option */
  onSelectOption?: (value: T) => void
  /** Current override mode state */
  isOverriding?: boolean
}

// Confidence styling configuration
const confidenceConfig = {
  high: {
    bgColor: 'bg-mint-50',
    borderColor: 'border-mint-200',
    textColor: 'text-mint-700',
    label: 'High confidence',
  },
  medium: {
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    textColor: 'text-banana-700',
    label: 'Medium confidence',
  },
  low: {
    bgColor: 'bg-sand-50',
    borderColor: 'border-sand-200',
    textColor: 'text-sand-600',
    label: 'Low confidence',
  },
}

export function SuggestionCard<T>({
  suggestion,
  label,
  formatValue,
  onAccept,
  onOverride,
  onSelectOption,
  isOverriding = false,
}: SuggestionCardProps<T>) {
  const conf = confidenceConfig[suggestion.confidence]

  // Clarification mode - show options as clickable choices
  if (suggestion.needs_clarification && suggestion.options?.length) {
    return (
      <div
        className={`p-4 rounded-lg border ${conf.borderColor} ${conf.bgColor}`}
        data-testid="suggestion-card-clarification"
      >
        <div className="flex items-start gap-3">
          <Sparkles
            className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 space-y-3">
            {/* AI badge */}
            <div className="flex items-center gap-2">
              <span
                className={`${typography.caption} px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium`}
              >
                AI suggested
              </span>
              <span className={`${typography.caption} ${conf.textColor}`}>
                {conf.label}
              </span>
            </div>

            {/* Clarifying question */}
            <p className={`${typography.body} text-ink-800`}>
              {suggestion.clarifying_question}
            </p>

            {/* Options as buttons */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Clarification options">
              {suggestion.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectOption?.(opt.value)}
                  className={`${typography.button} px-3 py-1.5 rounded-lg border border-ink-200
                    text-ink-700 hover:bg-ink-50 transition-colors`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Standard suggestion mode
  return (
    <div
      className={`p-4 rounded-lg border ${conf.borderColor} ${conf.bgColor}`}
      data-testid="suggestion-card"
    >
      <div className="flex items-start gap-3">
        <Sparkles
          className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 space-y-3">
          {/* Header: AI badge + confidence */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`${typography.caption} px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium`}
              >
                AI suggested
              </span>
              <span className={`${typography.caption} ${conf.textColor}`}>
                {conf.label}
              </span>
            </div>
            <span className={`${typography.label} text-ink-900`}>{label}</span>
          </div>

          {/* Suggested value */}
          <p className={`${typography.h4} text-ink-900`}>
            {formatValue(suggestion.suggested_value)}
          </p>

          {/* Reasoning */}
          <p className={`${typography.body} text-ink-600`}>{suggestion.reasoning}</p>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onAccept(suggestion.suggested_value)}
              disabled={isOverriding}
              className={`${typography.button} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-mint-500 text-white hover:bg-mint-600 disabled:opacity-50 transition-colors`}
              aria-label={`Accept suggestion: ${formatValue(suggestion.suggested_value)}`}
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              Accept
            </button>
            <button
              type="button"
              onClick={onOverride}
              className={`${typography.button} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                border border-ink-300 text-ink-700 hover:bg-ink-50 transition-colors`}
              aria-label="Override suggestion with custom value"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
              Override
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
