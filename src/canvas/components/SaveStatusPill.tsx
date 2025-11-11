/**
 * P0-2: Save Status Pill
 *
 * Shows reactive save state: "Saving...", "Saved just now ✓", "Saved by [user] • [time]"
 * Replaces ambiguous "Unsaved scenario" text
 */

import { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'

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
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded-full"
        data-testid="save-status-saving"
        role="status"
        aria-live="polite"
      >
        <Clock className="w-3 h-3 animate-pulse" />
        <span>Saving…</span>
      </div>
    )
  }

  if (lastSavedAt) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-success-700 bg-success-50 rounded-full"
        data-testid="save-status-saved"
        role="status"
        aria-live="polite"
      >
        <Check className="w-3 h-3" />
        <span>
          Saved {timeLabel}
          {savedBy && ` by ${savedBy}`}
        </span>
      </div>
    )
  }

  return null
}
