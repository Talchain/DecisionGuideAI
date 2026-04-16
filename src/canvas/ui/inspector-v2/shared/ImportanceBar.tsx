/**
 * ImportanceBar — compact ISL sensitivity bar for factor panels.
 *
 * v6.2 layout: single horizontal row — rank on left (16px semibold, primary),
 * bar in middle (6px height, primary fill on panel-border track), percentage
 * on right (panelMeta, medium weight). Below the row: descriptive text
 * "Influence on results".
 *
 * Replaces the WhatIfChart approach from v6.1 — single scalar, no trend line.
 *
 * The score is consumed via `useNodeDisplayMetadata().influence`, which
 * already normalises across `influence_score` / `elasticity` /
 * `sensitivity_score` / `importance_score` fallbacks.
 */

import { typography } from '../../../../styles/typography'

interface ImportanceBarProps {
  /** 0..1 normalised importance score. Null → pre-analysis empty state. */
  importanceScore: number | null
  /** Ordinal rank among factors (1 = most influential). Null → no rank label. */
  sensitivityRank: number | null
}

const RANK_ORDINALS = ['', '1st', '2nd', '3rd']

function ordinalFor(rank: number): string {
  if (rank >= 1 && rank <= 3) return RANK_ORDINALS[rank]
  const mod100 = rank % 100
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`
  const mod10 = rank % 10
  if (mod10 === 1) return `${rank}st`
  if (mod10 === 2) return `${rank}nd`
  if (mod10 === 3) return `${rank}rd`
  return `${rank}th`
}

export function ImportanceBar({ importanceScore, sensitivityRank }: ImportanceBarProps) {
  if (importanceScore == null) return null

  const pct = Math.max(0, Math.min(1, importanceScore)) * 100
  const rankLabel = sensitivityRank != null ? ordinalFor(sensitivityRank) : null

  return (
    <div data-testid="importance-bar">
      {/* Single row: rank | bar | percentage */}
      <div className="flex items-center gap-2">
        {rankLabel && (
          <span
            className="font-semibold text-primary flex-shrink-0"
            style={{ fontSize: 16 }}
          >
            {rankLabel}
          </span>
        )}
        <div
          className="flex-1 h-1.5 rounded-full bg-panel-border overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Relative influence"
        >
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`${typography.panelMeta} font-medium text-text-body flex-shrink-0`}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className={`${typography.panelMeta} text-text-light mt-1`}>
        Influence on results
      </div>
    </div>
  )
}
