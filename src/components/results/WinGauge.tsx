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

// Colour assignment: ordinal by win-probability rank. NOT by option ID.
// Determined state: winner=success(green) · runner-up=info(sky) · third=option(lilac) · fourth+=sand.
// Indeterminate state: all options use info/info-light (near-tie signal).
// DS v5 §3.3: data channel — distinct ordinal colours, each reserved for its rank tier.

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
  'border-2 border-success/60', // Winner — high-contrast accent
  'border-2 border-info/60',    // Runner-up — visibly linked to win-bar
  'border-2 border-option/60',  // Third — ordinal palette
  'border border-panel-border', // Fourth+ — neutral baseline
]

/** Indeterminate palette border classes, parallel to WIN_GAUGE_COLORS_INDETERMINATE. */
export const WIN_GAUGE_BORDER_CLASSES_INDETERMINATE = [
  'border border-info/30',      // Top option — matches var(--info)
  'border border-info/20',      // Second option — matches var(--info-light)
  'border border-panel-border', // Third — matches var(--border-default)
  'border border-panel-border', // Fourth — matches var(--border-default)
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
  designationsWithheld = false,
}: {
  shares: OptionWinShare[]
  decisionState?: DecisionState
  /**
   * ROADMAP 1.267. The LABEL of this chart was already fixed once (see the
   * comment below the tooltip) but its ORDER was not: segments were sorted
   * winner-first, and the palette's first entry is commented "Winner —
   * mint-500", so the leader was designated twice over — by position and by
   * green — under a caption that had been carefully de-designated.
   *
   * Withheld ⇒ segments follow canonical order. The colours stay (a stacked
   * bar needs distinguishable segments, and the legend maps them by name),
   * but they now track graph position rather than rank, so green means
   * "first option you created", not "the winner". The percentages are
   * untouched — this chart is a distribution, and the distribution is data.
   */
  designationsWithheld?: boolean
}) {
  if (shares.length === 0) return null

  const colors = decisionState === 'indeterminate' ? WIN_GAUGE_COLORS_INDETERMINATE : WIN_GAUGE_COLORS

  // Sort: winner first, then by win probability descending.
  // WITHHELD: no sort at all — `shares` already arrives in canonical order.
  const sorted = designationsWithheld
    ? [...shares]
    : [...shares].sort((a, b) => {
        if (a.isWinner && !b.isWinner) return -1
        if (!a.isWinner && b.isWinner) return 1
        return b.winProbability - a.winProbability
      })

  const isDeemphasised = decisionState === 'indeterminate'

  return (
    <div className={`mb-4${isDeemphasised ? ' opacity-70' : ''}`} role="figure" aria-label="Win probability distribution across options">
      <Tooltip content="Share of Monte Carlo simulations in which each option came out ahead">
        {/* ROADMAP 1.223: was "Leads across scenarios". The bar is a
            DISTRIBUTION over options — it shows a share per option, and it is
            drawn on every completed run, including turns where the producer
            withheld the leader claim. The old label read as a designation
            ("who leads"), which is the one thing this chart does not say.
            Relabelled rather than gated: the DATA is honest on every run, and
            a carve-out list of "leader words that are actually fine" is the
            hand-maintained mirror CLAUDE.md trap 12 is about. The wording now
            names the metric the product already uses elsewhere (the
            confidence panel's ring caption reads "win probability"). */}
        <p className={`${typography.panelMeta} text-text-light mb-1`}>
          Win probability across scenarios
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
      {/* Legend — coloured dot + truncated name + percentage */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {sorted.map((share, i) => {
          const displayPct = Math.round(Math.max(0, Math.min(1, share.winProbability)) * 100)
          if (displayPct <= 0) return null
          return (
            <span key={share.id} className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-light`}>
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: colors[Math.min(i, colors.length - 1)] }}
                aria-hidden="true"
              />
              <span className="truncate max-w-[120px]">{stripEncodingNotation(share.label)}</span>
              <span className="tabular-nums">{displayPct}%</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
