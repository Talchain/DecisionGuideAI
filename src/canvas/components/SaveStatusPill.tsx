/**
 * P0-2: Save Status Pill
 *
 * Shows reactive save state: "Saving...", "Saved just now ✓", "Saved by [user] • [time]"
 * Replaces ambiguous "Unsaved scenario" text
 *
 * ⭐ DS v5 §8.5 PILL (contract v3.1 state words, delta PILL-14). Both states are
 * outlined pills on `bg-panel` with `text-text-body` ("Text on pills is always
 * text-text-body"; colour is carried by the border only). "Saving…" was a
 * FILLED pill in raw legacy greys (`text-gray-600 bg-gray-100`, DS v5 L235:
 * never raw or legacy tokens); "Saved" put the semantic green on the pill's
 * TEXT (`text-success-700`). The check glyph keeps the success hue — a glyph,
 * not text — and the border keeps it at 30%.
 */

import { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface SaveStatusPillProps {
  isSaving: boolean
  lastSavedAt: number | null
  savedBy?: string | null
}

export function SaveStatusPill({ isSaving, lastSavedAt, savedBy }: SaveStatusPillProps) {
  const [timeLabel, setTimeLabel] = useState<string>('')

  useEffect(() => {
    if (!lastSavedAt) {
      setTimeLabel('')
      return
    }

    const updateLabel = () => {
      const elapsed = Date.now() - lastSavedAt
      const seconds = Math.floor(elapsed / 1000)
      const minutes = Math.floor(seconds / 60)

      if (seconds < 10) {
        setTimeLabel('just now')
      } else if (seconds < 60) {
        setTimeLabel(`${seconds}s ago`)
      } else if (minutes < 60) {
        setTimeLabel(`${minutes}m ago`)
      } else {
        const hours = Math.floor(minutes / 60)
        setTimeLabel(`${hours}h ago`)
      }
    }

    updateLabel()
    const interval = setInterval(updateLabel, 10000) // Update every 10s

    return () => clearInterval(interval)
  }, [lastSavedAt])

  if (isSaving) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 ${typography.caption} text-text-body bg-panel border border-panel-border rounded-full`}
        data-testid="save-status-saving"
        role="status"
        aria-live="polite"
      >
        <Clock className="w-3 h-3 animate-pulse" aria-hidden="true" />
        <span>Saving…</span>
      </div>
    )
  }

  if (lastSavedAt) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 ${typography.caption} text-text-body bg-panel border border-success/30 rounded-full`}
        data-testid="save-status-saved"
        role="status"
        aria-live="polite"
      >
        <Check className="w-3 h-3 text-success" aria-hidden="true" />
        <span>
          Saved{savedBy && ` by ${savedBy}`} {savedBy && '•'} {timeLabel}
        </span>
      </div>
    )
  }

  return null
}
