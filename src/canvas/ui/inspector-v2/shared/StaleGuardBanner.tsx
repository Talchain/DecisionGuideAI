/**
 * StaleGuardBanner — wraps post-analysis impact sections ONLY
 * When stale: warning banner + children at opacity-75
 * Does NOT wrap identity, editable controls, connections, or coaching cards
 */

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { EMPTY_STATES } from '../inspectorStrings'

interface StaleGuardBannerProps {
  isStale: boolean
  hasResults: boolean
  onRerun?: () => void
  children: ReactNode
}

export function StaleGuardBanner({ isStale, hasResults, onRerun, children }: StaleGuardBannerProps) {
  // No analysis yet — show empty state
  if (!hasResults) {
    return (
      <div className="mt-2 py-4 text-center">
        <p className={`${typography.panelMeta} text-text-light`}>
          {EMPTY_STATES.noAnalysis}
        </p>
      </div>
    )
  }

  return (
    <div>
      {isStale && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-panel border border-warning/30 mt-2 mb-1">
          <AlertTriangle size={13} className="text-warning flex-shrink-0" aria-hidden="true" />
          <span className={`${typography.panelMeta} text-text-body flex-1`}>
            Results may have changed since your last edit
          </span>
          {onRerun && (
            <button
              onClick={onRerun}
              className={`${typography.panelMeta} ml-auto px-2.5 py-0.5 rounded-full border border-info/30 bg-transparent text-info hover:bg-panel-hover transition-colors flex-shrink-0`}
            >
              Re-run
            </button>
          )}
        </div>
      )}
      <div style={{ opacity: isStale ? 0.75 : 1 }}>
        {children}
      </div>
    </div>
  )
}
