/**
 * StaleGuardBanner — wraps post-analysis impact sections ONLY.
 * Renders the no-analysis empty state when hasResults is false; otherwise
 * children. (Its stale-banner half was DELETED with useStaleGuard — the
 * guard read hash keys nothing ever wrote, so the banner could never
 * render in production. F10, 2026-07-16.)
 * Does NOT wrap identity, editable controls, connections, or coaching cards
 */

import type { ReactNode } from 'react'
import { typography } from '../../../../styles/typography'
import { EMPTY_STATES } from '../inspectorStrings'

interface StaleGuardBannerProps {
  hasResults: boolean
  children: ReactNode
}

export function StaleGuardBanner({ hasResults, children }: StaleGuardBannerProps) {
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

  return <div>{children}</div>
}
