/**
 * P0-2: Save Status Pill
 *
 * Shows reactive save state: "Saving...", "Saved just now ✓", "Saved by [user] • [time]"
 * Replaces ambiguous "Unsaved scenario" text
 */

import { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface SaveStatusPillProps {
  isSaving: boolean
  lastSavedAt: number | null
  savedBy?: string | null
  /**
   * Is the graph write currently being WITHHELD for this scenario?
   *
   * Derived by the caller from `graphWriteWithheldFor` — the body of
   * `shouldPersistGraphForScenario`, which is the estate's single choke point
   * for `scenarios.graph` writes. While it is true nothing is being persisted,
   * so neither "Saved" nor "Saving…" is a true sentence: `lastSavedAt` refers
   * to an earlier save that does not contain the model now on screen.
   */
  graphWriteWithheld?: boolean
}

export function SaveStatusPill({
  isSaving,
  lastSavedAt,
  savedBy,
  graphWriteWithheld = false,
}: SaveStatusPillProps) {
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

  /**
   * ⭐⭐ CHECKED FIRST, AND THAT ORDER IS THE FIX. While the write is withheld
   * BOTH other branches are false — "Saved" asserts a durability nothing
   * confirmed, and "Saving…" asserts an in-flight write that was declined. The
   * measured deployed defect was `Saved 40s ago` standing over a model that a
   * reload then showed as zero nodes.
   *
   * ⚠ SAYING NOTHING WOULD ALSO BE WRONG: the pill is what a user consults
   * before closing the tab, and an empty space reads as "nothing to worry
   * about". Tell them the state they are actually in.
   */
  if (graphWriteWithheld) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 ${typography.caption} text-gray-600 bg-gray-100 rounded-full`}
        data-testid="save-status-not-saved"
        role="status"
        aria-live="polite"
        title="The model is still arriving, so it has not been saved yet. It will be saved once the draft settles."
      >
        <Clock className="w-3 h-3" />
        <span>Not saved yet</span>
      </div>
    )
  }

  if (isSaving) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 ${typography.caption} text-gray-600 bg-gray-100 rounded-full`}
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
        className={`flex items-center gap-1.5 px-2 py-1 ${typography.caption} text-success-700 bg-panel border border-success/30 rounded-full`}
        data-testid="save-status-saved"
        role="status"
        aria-live="polite"
      >
        <Check className="w-3 h-3" />
        <span>
          Saved{savedBy && ` by ${savedBy}`} {savedBy && '•'} {timeLabel}
        </span>
      </div>
    )
  }

  return null
}
