/**
 * AcceptOverrideControl - Reusable component for CEE suggestion pattern
 * Implements the CEE Transparency Principle: every AI suggestion must have
 * clear provenance and one-click override capability.
 *
 * DS v5 compliant: semantic tokens, ChevronRight (rotated on expand),
 * animated transition-[height,opacity] duration-200 (§15.2).
 */

import { memo, useState, useRef, useEffect } from 'react'
import { Check, Pencil, Sparkles, ChevronRight } from 'lucide-react'
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

const confidenceConfig: Record<ConfidenceLevel, {
  bg: string
  border: string
  text: string
  badge: string
  label: string
  shortLabel: string
}> = {
  high: {
    // DS v5: semantic tokens (bg-panel + success/30 border), matches .low tier.
    bg: 'bg-panel',
    border: 'border-success/30',
    text: 'text-success',
    badge: 'bg-transparent border border-success/30 text-text-body',
    // Copy: neutral "Suggested" framing per ea8d23a7 (no "Recommended"/"Winner").
    label: 'Suggested based on pattern',
    shortLabel: 'Suggested',
  },
  medium: {
    bg: 'bg-panel',
    border: 'border-warning/30',
    text: 'text-warning',
    badge: 'bg-transparent border border-warning/30 text-text-body',
    label: 'Suggestion — please review',
    shortLabel: 'Review',
  },
  low: {
    bg: 'bg-panel',
    border: 'border-neutral/30',
    text: 'text-text-light',
    badge: 'bg-transparent border border-neutral/30 text-text-body',
    label: 'Suggestion — please verify',
    shortLabel: 'Verify',
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
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    defaultExpanded ? undefined : 0
  )

  useEffect(() => {
    if (!contentRef.current) return

    if (isExpanded) {
      const height = contentRef.current.scrollHeight
      setContentHeight(height)
      const timer = setTimeout(() => setContentHeight(undefined), 200)
      return () => clearTimeout(timer)
    } else {
      if (contentRef.current.scrollHeight > 0) {
        setContentHeight(contentRef.current.scrollHeight)
        requestAnimationFrame(() => setContentHeight(0))
      }
    }
  }, [isExpanded])

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
            <span className={`${typography.caption} text-text-light`}>
              {suggestionLabel}:
            </span>
            <span className={`${typography.label} text-text-body`}>
              {formatValue(suggestedValue)}
            </span>
            <span
              className={`${typography.caption} px-1.5 py-0.5 rounded font-medium ${config.badge}`}
              title={`${confidence} confidence`}
              data-testid={`${testIdPrefix}-confidence`}
            >
              {config.label}
            </span>
          </div>

          {/* Rationale - collapsible with animated transition (DS v5 §15.2) */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`${typography.caption} text-text-light flex items-center gap-1 hover:text-text-body transition-colors`}
              aria-expanded={isExpanded}
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                aria-hidden="true"
              />
              {isExpanded ? 'Hide' : 'Show'} rationale
            </button>
            <div
              ref={contentRef}
              className="transition-[height,opacity] duration-200 ease-in-out overflow-hidden"
              style={{
                height: contentHeight === undefined ? 'auto' : contentHeight,
                opacity: isExpanded ? 1 : 0,
              }}
            >
              <p className={`${typography.bodySmall} text-text-body mt-1`}>
                {rationale}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAccept(suggestedValue)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                ${typography.button} bg-primary text-text-on-color
                hover:bg-primary-hover transition-colors
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
                ${typography.button} border border-panel-border text-text-body
                hover:bg-panel-hover transition-colors
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
