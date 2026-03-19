/**
 * InfluenceBar — mini horizontal bar showing factor sensitivity percentage.
 *
 * 40px wide, 4px tall, info-coloured fill, proportional to influence (0–1).
 * Renders nothing if influence is undefined (pre-analysis state).
 */

import { typography } from '../../../styles/typography'

interface InfluenceBarProps {
  /** Sensitivity score 0–1, or undefined when no post-analysis data */
  influence: number | undefined
}

export function InfluenceBar({ influence }: InfluenceBarProps) {
  if (influence === undefined) return null
  const pct = Math.min(100, Math.max(0, influence * 100))

  return (
    <div className="flex items-center gap-1.5" data-testid="influence-bar">
      <div className="h-1 rounded-full overflow-hidden bg-panel-border" style={{ width: 40 }}>
        <div
          className="h-full rounded-full bg-info transition-all"
          style={{ width: `${pct}%` }}
          data-testid="influence-bar-fill"
        />
      </div>
      <span className={`${typography.panelMeta} text-text-light tabular-nums`}>
        {Math.round(pct)}%
      </span>
    </div>
  )
}
