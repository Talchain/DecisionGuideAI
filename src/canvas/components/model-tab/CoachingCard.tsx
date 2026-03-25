/**
 * CoachingCard — dismissible coaching line for model-tab sections.
 *
 * Dismissal persists in sessionStorage per section key:
 *   `olumi:coach:dismissed:{sectionId}`
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { typography } from '../../../styles/typography'

interface CoachingCardProps {
  /** Unique section ID for dismissal persistence */
  sectionId: string
  /** Coaching text content */
  children: React.ReactNode
}

export function CoachingCard({ sectionId, children }: CoachingCardProps) {
  const storageKey = `olumi:coach:dismissed:${sectionId}`
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(storageKey) === '1' } catch { return false }
  })

  if (dismissed) return null

  return (
    <div
      className="bg-panel-hover rounded-lg p-2.5 flex items-start gap-2"
      data-testid={`coaching-card-${sectionId}`}
    >
      <span className={`${typography.panelMeta} text-text-light leading-relaxed flex-1`}>
        {children}
      </span>
      <button
        type="button"
        onClick={() => {
          setDismissed(true)
          try { sessionStorage.setItem(storageKey, '1') } catch { /* noop */ }
        }}
        className="text-text-light hover:text-text-body transition-colors shrink-0"
        aria-label="Dismiss coaching"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
