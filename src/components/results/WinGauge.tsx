/**
 * WinGauge — stacked horizontal bar showing win probability per option.
 *
 * Extracted from HeroSection to be shared between hero (removed) and
 * options section (Task 2). Includes shared colour palette constants
 * used by OptionCards for visual continuity.
 */

import { typography } from '../../styles/typography'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import Tooltip from '../Tooltip'
import type { DecisionState } from './types'

// =============================================================================
// Types
// =============================================================================

/** Win probability per option for the win gauge */
export interface OptionWinShare {
  id: string
  label: string
  winProbability: number
  isWinner: boolean
}

// =============================================================================
// Colour palettes — shared with OptionCards for visual continuity
// =============================================================================

/** V12.3: Win gauge + option card colours — shared palette */
export const WIN_GAUGE_COLORS = [
  'var(--success)',         // Winner — mint-500
  'var(--info)',            // Runner-up — sky-500
  'var(--option)',          // Third — lilac-400
  'var(--border-default)',  // Fourth+ — sand-200
]

/** V12.3: Indeterminate colours — sky for top two (near-tie signal), muted for rest */
export const WIN_GAUGE_COLORS_INDETERMINATE = [
  'var(--info)',            // Top option — sky-500
  'var(--info-light)',      // Second option — sky-200 (lighter, near-tie signal)
  'var(--border-default)',  // Third — sand-200
  'var(--border-default)',  // Fourth — sand-200
]

/**
 * Tailwind border classes that correspond 1-to-1 with WIN_GAUGE_COLORS by index.
 * Option cards use these to match their WinGauge segment colour without string-matching CSS vars.
 */
export const WIN_GAUGE_BORDER_CLASSES = [
  'border-2 border-success/60', // Winner — thicker, high-contrast accent
  'border-info/60',              // Runner-up — mid-contrast, visibly linked to win-bar
  'border-option/60',            // Third — mid-contrast, ordinal palette
  'border-panel-border',         // Fourth+ — neutral baseline
]

/** Indeterminate palette border classes, parallel to WIN_GAUGE_COLORS_INDETERMINATE. */
export const WIN_GAUGE_BORDER_CLASSES_INDETERMINATE = [
  'border-info/30',      // Top option — matches var(--info)
  'border-info/20',      // Second option — matches var(--info-light)
  'border-panel-border', // Third — matches var(--border-default)
  'border-panel-border', // Fourth — matches var(--border-default)
]

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a border-class map from option ID → Tailwind border class, using the same
 * sort order as buildSegmentColorMap. Derived from the palette arrays by index so
 * border and segment colours cannot drift independently.
 */
export function buildSegmentBorderClassMap(
  options: Array<{ id: string; winProbability?: number | null }>,
  winnerId: string | undefined,
  decisionState?: DecisionState,
): Record<string, string> {
  const classes = decisionState === 'indeterminate'
    ? WIN_GAUGE_BORDER_CLASSES_INDETERMINATE
    : WIN_GAUGE_BORDER_CLASSES
  const sorted = [...options].sort((a, b) => {
    if (a.id === winnerId && b.id !== winnerId) return -1
    if (a.id !== winnerId && b.id === winnerId) return 1
    return (b.winProbability ?? 0) - (a.winProbability ?? 0)
  })
  const map: Record<string, string> = {}
  sorted.forEach((opt, i) => {
    map[opt.id] = classes[Math.min(i, classes.length - 1)]
  })
  return map
}

/**
 * Build a colour map from option ID → CSS colour, using the same sort order
 * as WinGauge (winner first, then winProbability descending). This ensures
 * OptionCards colours match the corresponding WinGauge segment ordering
 * regardless of how cards are independently sorted.
 */
export function buildSegmentColorMap(
  options: Array<{ id: string; winProbability?: number | null; isRecommended?: boolean }>,
  winnerId: string | undefined,
  decisionState?: DecisionState,
): Record<string, string> {
  const colors = decisionState === 'indeterminate' ? WIN_GAUGE_COLORS_INDETERMINATE : WIN_GAUGE_COLORS
  const sorted = [...options].sort((a, b) => {
    if (a.id === winnerId && b.id !== winnerId) return -1
    if (a.id !== winnerId && b.id === winnerId) return 1
    return (b.winProbability ?? 0) - (a.winProbability ?? 0)
  })
  const map: Record<string, string> = {}
  sorted.forEach((opt, i) => {
    map[opt.id] = colors[Math.min(i, colors.length - 1)]
  })
  return map
}

// =============================================================================
// Component
// =============================================================================

/**
 * WinGauge — stacked horizontal bar showing win probability per option.
 * "Wins across scenarios" label + segmented bar.
 */
export function WinGauge({
  shares,
  decisionState,
}: {
  shares: OptionWinShare[]
  decisionState?: DecisionState
}) {
  if (shares.length === 0) return null

  const colors = decisionState === 'indeterminate' ? WIN_GAUGE_COLORS_INDETERMINATE : WIN_GAUGE_COLORS

  // Sort: winner first, then by win probability descending
  const sorted = [...shares].sort((a, b) => {
    if (a.isWinner && !b.isWinner) return -1
    if (!a.isWinner && b.isWinner) return 1
    return b.winProbability - a.winProbability
  })

  const isDeemphasised = decisionState === 'indeterminate'

  return (
    <div className={`mb-4${isDeemphasised ? ' opacity-70' : ''}`} role="figure" aria-label="Win probability distribution across options">
      <Tooltip content="Proportion of Monte Carlo simulations each option wins">
        <p className={`${typography.panelMeta} text-text-light mb-1`}>
          Wins across scenarios
        </p>
      </Tooltip>
      {/* Stacked bar — use clamped raw percentage for width to avoid rounding gaps */}
      <div className={`flex rounded-full overflow-hidden gap-0.5${isDeemphasised ? ' h-2' : ' h-3'}`}>
        {sorted.map((share, i) => {
          const clamped = Math.max(0, Math.min(1, share.winProbability))
          const widthPct = clamped * 100
          const displayPct = Math.round(widthPct)
          if (displayPct <= 0) return null
          return (
            <div
              key={share.id}
              className="h-full rounded-full"
              style={{
                width: `${widthPct}%`,
                backgroundColor: colors[Math.min(i, colors.length - 1)],
              }}
              role="img"
              aria-label={`${stripEncodingNotation(share.label)}: ${displayPct}%`}
            />
          )
        })}
      </div>
    </div>
  )
}
