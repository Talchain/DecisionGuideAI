/**
 * FieldLabel Component
 *
 * Displays user-friendly labels with optional technical term tooltips.
 * Part of Phase 1A.2 dual terminology implementation.
 */

import { Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useState, useRef, useEffect } from 'react'

interface FieldLabelProps {
  label: string // User-friendly label (e.g., "Confidence")
  technicalTerm?: string // Technical term (e.g., "Belief (epistemic uncertainty)")
  technicalDescription?: string // Short explanation for tooltip
  htmlFor?: string // Optional id for label's associated input
  required?: boolean // Show required indicator
}

export function FieldLabel({
  label,
  technicalTerm,
  technicalDescription,
  htmlFor,
  required = false,
}: FieldLabelProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top')
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (showTooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceAbove = rect.top
      const spaceBelow = window.innerHeight - rect.bottom

      // If more space below or not enough space above, show below
      setTooltipPosition(spaceBelow > 200 || spaceAbove < 100 ? 'bottom' : 'top')
    }
  }, [showTooltip])

  const hasTooltip = technicalTerm || technicalDescription

  return (
    <div className="flex items-center gap-1">
      <label
        htmlFor={htmlFor}
        className={`${typography.code} font-medium text-ink-900 uppercase tracking-wide`}
      >
        {label}
        {required && <span className="text-danger-600 ml-0.5" aria-label="required">*</span>}
      </label>
      {hasTooltip && (
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setShowTooltip(!showTooltip)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-ink-900/50 hover:text-ink-900/80 hover:bg-sand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500"
            aria-label="Show technical details"
            data-testid="field-label-info-button"
          >
            <Info className="w-3 h-3" aria-hidden="true" />
          </button>
          {showTooltip && (
            <div
              className={`absolute ${tooltipPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-1/2 transform -translate-x-1/2 z-50 w-64 px-3 py-2 bg-ink-900 text-paper-50 rounded shadow-lg ${typography.caption}`}
              role="tooltip"
              data-testid="field-label-tooltip"
            >
              {technicalTerm && (
                <div className="font-medium mb-1">{technicalTerm}</div>
              )}
              {technicalDescription && (
                <div className="text-paper-50/90">{technicalDescription}</div>
              )}
              {/* Tooltip arrow */}
              <div
                className={`absolute left-1/2 transform -translate-x-1/2 ${tooltipPosition === 'top' ? 'bottom-0 translate-y-full' : 'top-0 -translate-y-full'}`}
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  [tooltipPosition === 'top' ? 'borderTop' : 'borderBottom']: '6px solid rgb(var(--ink-900))',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
