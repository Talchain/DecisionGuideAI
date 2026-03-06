/**
 * CoachingCard — DS v4 §15
 * bg-panel, 3px left border info, rounded-r-lg
 * Lightbulb icon + panelBody text + dismiss + optional action chip
 * Absent (not rendered) when no coaching data — parent controls visibility
 */

import { useState, useCallback } from 'react'
import { Lightbulb, X, Sparkles } from 'lucide-react'
import { typography } from '../../../../styles/typography'

interface CoachingCardProps {
  text: string
  action?: { label: string; onClick: () => void }
}

export function CoachingCard({ text, action }: CoachingCardProps) {
  const [dismissed, setDismissed] = useState(false)

  const handleDismiss = useCallback(() => setDismissed(true), [])

  if (dismissed) return null

  return (
    <div
      className="mt-3 bg-panel rounded-r-lg shadow-1"
      style={{ borderLeft: '3px solid var(--color-info, #63ADCF)' }}
    >
      <div className="p-2.5 pr-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex gap-1.5 items-start">
            <Lightbulb size={14} className="text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className={`${typography.panelBody} text-text-body m-0`}>{text}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-0.5 flex-shrink-0 rounded hover:bg-panel-hover transition-colors"
            aria-label="Dismiss suggestion"
          >
            <X size={12} className="text-text-light" />
          </button>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className={`${typography.panelMeta} mt-2 ml-5 px-3 py-1 rounded-full border border-info/30 bg-transparent text-info hover:bg-panel-hover transition-colors inline-flex items-center gap-1`}
          >
            <Sparkles size={11} className="text-info" aria-hidden="true" />
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
