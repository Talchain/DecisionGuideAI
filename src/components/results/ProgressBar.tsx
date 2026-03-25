/**
 * ProgressBar — thin progress indicator for the "Your next steps" section.
 *
 * Shows a 4px bar (success fill on panel-hover track) with "You've addressed N of M" text.
 * Returns null when total === 0.
 */

import { typography } from '../../styles/typography'

export interface ProgressBarProps {
  resolved: number
  total: number
}

export function ProgressBar({ resolved, total }: ProgressBarProps) {
  if (total === 0) return null

  const pct = total > 0 ? Math.min(100, Math.round((resolved / total) * 100)) : 0

  return (
    <div className="mb-3" data-testid="next-steps-progress">
      <div className="h-1 w-full rounded-full bg-panel-hover overflow-hidden">
        <div
          className="h-full rounded-full bg-success transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`${typography.panelMeta} text-text-light mt-1`}>
        You've addressed {resolved} of {total}
      </p>
    </div>
  )
}
