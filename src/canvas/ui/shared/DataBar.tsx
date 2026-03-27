/**
 * DataBar — shared progress bar component.
 *
 * Replaces three parallel implementations:
 *   - FactorNode.tsx inline sensitivity/evidence bars
 *   - GoalNode.tsx inline stability bar
 *   - DriversSection.tsx local ProgressBar
 *
 * DS v5 §11.6 evaluative thresholds (auto colour when no override provided):
 *   < 0.4  → danger
 *   0.4–0.69 → warning
 *   ≥ 0.7  → success
 */

import { useMemo } from 'react'
import { typography } from '../../../styles/typography'
import { evaluativeToken } from '../../../styles/evaluative'

export type DataBarColour = 'success' | 'warning' | 'danger' | 'info' | 'goal'

export type DataBarSize = 'compact' | 'standard'

interface DataBarProps {
  /** Normalised 0–1 value */
  value: number
  /** Accessible label for the progress bar */
  label: string
  /** Colour token override. When omitted, evaluative thresholds are applied automatically. */
  colour?: DataBarColour
  /**
   * CSS variable string for fill colour, e.g. 'var(--success)'.
   * Takes precedence over `colour` when provided. Use when precise CSS-var
   * colours are needed (e.g. DriversSection direction-keyed colours).
   */
  colourVar?: string
  /** 'compact' for canvas node cards (h-1.5, max-w-[60px]); 'standard' for panel rows (h-2, full width) */
  size?: DataBarSize
  /** Optional right-aligned text label (e.g. tier label "High", "Fair") */
  trailingLabel?: string
  /**
   * When true (and size='standard'), show a numeric percentage suffix (e.g. DriversSection).
   * Silently ignored in compact mode — use trailingLabel for suffixes on compact bars.
   * showPercent and trailingLabel are mutually exclusive; showPercent takes precedence.
   */
  showPercent?: boolean
}

const COLOUR_CLASS: Record<DataBarColour, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
  info:    'bg-info',
  goal:    'bg-goal',
}

/** DS v5 §11.6 evaluative thresholds — delegates to shared utility */
const evaluativeColour = evaluativeToken as (value: number) => DataBarColour

/**
 * Accessible progress bar following DS v5 §11.6.
 *
 * @example
 * // Compact canvas node sensitivity bar with entity colour override:
 * <DataBar value={0.72} label="Sensitivity" colour="info" trailingLabel="High" />
 *
 * // Standard panel stability bar with auto evaluative colour:
 * <DataBar value={0.85} label="Stability" size="standard" trailingLabel="85%" />
 */
export function DataBar({ value, label, colour, colourVar, size = 'compact', trailingLabel, showPercent }: DataBarProps) {
  const clampedValue = Math.max(0, Math.min(1, value))
  const percent = Math.round(clampedValue * 100)

  const resolvedColour = useMemo(
    () => colour ?? evaluativeColour(clampedValue),
    [colour, clampedValue],
  )
  const fillClass = colourVar ? '' : COLOUR_CLASS[resolvedColour]
  const fillStyle = colourVar
    ? { width: `${percent}%`, backgroundColor: colourVar }
    : { width: `${percent}%` }

  // showPercent only applies in standard mode — compact bars use trailingLabel for any suffix
  const percentSuffix = (showPercent && size === 'standard') ? (
    <span className={`${typography.panelBody} font-mono text-slate-600 w-9 text-right shrink-0`}>
      {percent}%
    </span>
  ) : trailingLabel !== undefined ? (
    <span className={`${typography.nodeLabel} text-text-light ${size === 'compact' ? 'w-8 text-right' : ''} shrink-0`}>
      {trailingLabel}
    </span>
  ) : null

  if (size === 'compact') {
    return (
      <div className="flex items-center gap-1.5">
        <div
          className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden max-w-[60px]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className={`h-full ${fillClass} rounded-full transition-all duration-300`}
            style={fillStyle}
          />
        </div>
        {percentSuffix}
      </div>
    )
  }

  // standard — full-width panel row bar
  // showPercent=true uses the DriversSection visual: h-2 bg-sand-200 track, tighter gap
  // showPercent=false (default) uses the canvas panel visual: h-1.5 bg-panel-border track
  const trackClass = showPercent ? 'h-2 bg-sand-200' : 'h-1.5 bg-panel-border'
  const gapClass = showPercent ? 'gap-1' : 'gap-1.5'
  const transitionClass = showPercent ? 'transition-all' : 'transition-all duration-300'

  return (
    <div className={`flex items-center ${gapClass} w-full`}>
      <div
        className={`flex-1 ${trackClass} rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full ${fillClass} rounded-full ${transitionClass}`}
          style={fillStyle}
        />
      </div>
      {percentSuffix}
    </div>
  )
}
