/**
 * LimitedOptionsCard Component (P2 Task 3)
 *
 * Coaching card shown when optionCount <= 2 AND a baseline exists.
 * Uses the existing dismissible pattern with sessionStorage persistence.
 *
 * Priority: Baseline card takes precedence (if no baseline, show BaselineToggleCard instead)
 */

import { useState, useCallback, useEffect } from 'react'
import { Info } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface LimitedOptionsCardProps {
  /** Number of options in the analysis */
  optionCount: number
  /** Whether a baseline exists (if false, this card shouldn't show - baseline card takes priority) */
  hasBaseline: boolean
  /** Response hash for dismiss persistence */
  responseHash?: string
}

export function LimitedOptionsCard({
  optionCount,
  hasBaseline,
  responseHash,
}: LimitedOptionsCardProps) {
  // Dismiss key based on responseHash
  const dismissalKey = responseHash ? `limited-options-dismissed-${responseHash}` : null

  // Safe sessionStorage access (Safari private mode throws on access)
  const safeGetItem = useCallback((key: string): string | null => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  }, [])

  const safeSetItem = useCallback((key: string, value: string): void => {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // Silently fail in restricted environments
    }
  }, [])

  // Initialize dismiss state from sessionStorage
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!dismissalKey) return false
    return safeGetItem(dismissalKey) === 'true'
  })

  // Reset dismissal when responseHash changes
  useEffect(() => {
    if (dismissalKey) {
      const wasDismissed = safeGetItem(dismissalKey) === 'true'
      setIsDismissed(wasDismissed)
    } else {
      setIsDismissed(false)
    }
  }, [dismissalKey, safeGetItem])

  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
    if (dismissalKey) {
      safeSetItem(dismissalKey, 'true')
    }
  }, [dismissalKey, safeSetItem])

  // Show conditions:
  // - optionCount <= 2
  // - hasBaseline (if no baseline, BaselineToggleCard takes priority)
  // - not dismissed
  // - not single option (that has its own messaging)
  const shouldShow = optionCount <= 2 && optionCount > 1 && hasBaseline && !isDismissed

  if (!shouldShow) return null

  return (
    <div
      className="p-3 bg-info-light border border-info/30 rounded-lg"
      data-testid="limited-options-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
          <p className={`${typography.panelBody} text-text-body`}>
            You're comparing {optionCount} option{optionCount !== 1 ? 's' : ''}.
            Adding alternatives would strengthen the analysis.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className={`${typography.panelBody} text-text-light hover:text-text-body flex-shrink-0`}
          aria-label="Dismiss suggestion"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
