/**
 * WinGauge — the option-comparison figure at the top of the options block.
 *
 * ⭐ RE-ANCHORED 2026-07-31 (Paul's ruling; §6 map row 1). It used to
 * headline the COMPARATIVE quantity under the label "Win probability across
 * scenarios" — a number that is neither of the two questions the product is
 * allowed to answer. It is the share of Monte-Carlo runs in which an option
 * out-ranked the others: not "will this reach my goal" and not "what is most
 * likely to happen".
 *
 * The figure now carries BOTH blocks, in this order:
 *
 *   1. THE GOAL BLOCK (question A) — per-option `goalProbability`, the
 *      quantity the user asked about, ranked by that quantity. Absent when
 *      the run had no success target, because ISL computes a goal
 *      probability only when a threshold was supplied.
 *   2. THE COMPARATIVE BLOCK — the same stacked distribution as before,
 *      DEMOTED beneath the goal block and labelled by what it measures.
 *
 * ⚠ WHY THE GOAL BLOCK IS NOT A STACKED BAR. The comparative shares are a
 * distribution: they partition the runs and sum to 1, so a stacked bar is an
 * honest picture of them. Goal probabilities are INDEPENDENT per-option
 * probabilities — they do not sum to anything. Stacking them would draw a
 * share-of-a-whole that does not exist. The goal block is therefore a plain
 * ranked readout, sharing the comparative block's colour assignment so the
 * two read as one figure.
 *
 * ⚠ THE NO-TARGET STATE NEVER BLOCKS. Without a target the goal block is
 * replaced by an invitation naming the action, and the comparative
 * distribution keeps rendering — the absent target hides nothing that was
 * computed.
 *
 * Extracted from HeroSection to be shared between hero (removed) and
 * options section (Task 2). Includes shared colour palette constants
 * used by OptionCards for visual continuity.
 */

import { typography } from '../../styles/typography'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY, isFiniteProbability } from './utils/goalAnchorCopy'
import { formatGoalProbability } from './utils/displayFloors'
import Tooltip from '../Tooltip'
import type { DecisionState } from './types'

// =============================================================================
// Types
// =============================================================================

/** Per-option input to the comparison figure. */
export interface OptionWinShare {
  id: string
  label: string
  /**
   * The COMPARATIVE quantity — share of simulated scenarios this option came
   * out ahead in. Kept, demoted, and always described by what it measures.
   */
  winProbability: number
  isWinner: boolean
  /**
   * QUESTION A — this option's goal-attainment probability, as chosen by
   * `selectGoalProbability` and carried on `OptionResult.goalProbability`.
   * Null/undefined on a run with no success target, which is the ordinary
   * case rather than an error.
   */
  goalProbability?: number | null
  /**
   * THE POSSESSIVE GATE — `OptionResult.goalFitIsSubstitutedJoint`, i.e.
   * `selectGoalProbability(...).basis === 'joint_goal_substituted'`. True ⇒
   * the number answers a different question from the one "your goal"
   * asserts, so the A copy drops the possessive. Read, never re-derived.
   */
  goalFitIsSubstitutedJoint?: boolean
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
 * The two-block comparison figure: the goal readout (question A) above the
 * comparative distribution.
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

  // Colour by option id, derived from the comparative block's own segment
  // order so the goal block's dots match the bar beneath it. One map, so the
  // two blocks cannot assign different colours to the same option.
  const colorById: Record<string, string> = {}
  sorted.forEach((s, i) => {
    colorById[s.id] = colors[Math.min(i, colors.length - 1)]
  })

  // ── The goal block (question A) ────────────────────────────────────────
  // Ranked by the goal quantity itself, independently of the comparative
  // sort above — the two rankings disagree on real runs, and that
  // disagreement is exactly what the user needs to see.
  //
  // ⚠ EXCEPT WHEN THE VERDICT WITHHOLDS. Order IS a designation
  // (`optionDisplayOrder`'s header, ratified in ROADMAP row 1.306 — "the
  // G-UI-1 closure treated client-side ordering as benign when it is the
  // designation channel"), which is why `sortOptionsForDisplay`'s second
  // parameter is mandatory rather than defaulted. This block ranked
  // unconditionally, so on a withheld run it put an option first inside a
  // figure whose every other ordering had just been de-designated — the
  // segments above already take the `[...shares]` branch for this reason.
  // Withheld ⇒ the goal rows follow `sorted`, i.e. the same display order the
  // rest of the gauge uses. The PROBABILITIES are untouched: the claim is
  // withheld, the data is not.
  const goalRows = designationsWithheld
    ? sorted.filter((s) => isFiniteProbability(s.goalProbability))
    : shares
        .filter((s) => isFiniteProbability(s.goalProbability))
        .sort((a, b) => (b.goalProbability as number) - (a.goalProbability as number))
  const hasGoalNumbers = goalRows.length > 0
  // The possessive gate is a property of the RUN, not of a row: every row is
  // scored on the same basis. Any substituted row withholds the possessive
  // for the whole block — the safe direction, and it cannot produce a block
  // that says "your goal" over a number that does not answer it.
  const substituted = goalRows.some((s) => s.goalFitIsSubstitutedJoint === true)

  return (
    <div
      className={`mb-4${isDeemphasised ? ' opacity-70' : ''}`}
      role="figure"
      aria-label={
        hasGoalNumbers ? GOAL_ANCHOR_COPY.byOptionAria(substituted) : COMPARATIVE_COPY.byOptionAria
      }
    >
      {hasGoalNumbers ? (
        <div className="mb-3" data-testid="win-gauge-goal-block">
          <p
            className={`${typography.panelMeta} text-text-light mb-1`}
            data-testid="win-gauge-goal-heading"
          >
            {GOAL_ANCHOR_COPY.label(substituted)}
          </p>
          <div className="flex flex-col gap-1">
            {goalRows.map((share) => {
              const clamped = Math.max(0, Math.min(1, share.goalProbability as number))
              // Width is geometry; the READOUT goes through the shared floored
              // formatter (UI-SEM-057) so a 0.4% probability reads "< 1%" here
              // exactly as it does on the option card beside it, instead of a
              // bare "0%" the same panel contradicts.
              const pct = Math.round(clamped * 100)
              const readout = formatGoalProbability(clamped)
              return (
                <div
                  key={share.id}
                  className="flex items-center gap-2"
                  data-testid={`goal-row-${share.id}`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colorById[share.id] ?? 'var(--border-default)' }}
                    aria-hidden="true"
                  />
                  <span
                    className={`${typography.panelMeta} text-text-body truncate max-w-[160px]`}
                  >
                    {stripEncodingNotation(share.label)}
                  </span>
                  {/* Each option's own track: an INDEPENDENT probability
                      drawn against a full-width rail, never a share of a
                      stacked whole (see the module header). */}
                  <span className="flex-1 h-1.5 rounded-full overflow-hidden bg-[var(--border-default)] min-w-[24px]">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: colorById[share.id] ?? 'var(--border-default)',
                      }}
                    />
                  </span>
                  <span
                    className={`${typography.panelMeta} text-text-body tabular-nums flex-shrink-0`}
                    data-testid={`goal-pct-${share.id}`}
                  >
                    {readout}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // A5 — an invitation with its route, not a wall. The comparative
        // block below keeps rendering.
        <p
          className={`${typography.panelMeta} text-text-light mb-2`}
          data-testid="win-gauge-no-target"
        >
          {GOAL_ANCHOR_COPY.noTarget}{' '}
          <span className="text-info">{GOAL_ANCHOR_COPY.noTargetCta}</span>
        </p>
      )}

      <div data-testid="win-gauge-comparative-block">
        <Tooltip content="Share of Monte Carlo simulations in which each option came out ahead">
          {/* ROADMAP 1.223 relabelled this away from a leader VERB ("Leads
              across scenarios"); the 2026-07-31 re-anchoring finishes the job.
              "Win probability across scenarios" named the metric but anchored
              it to neither question the product answers, and it sat at the top
              of the panel as the most prominent number on the screen. The
              label now says what the number MEASURES, and the block sits below
              the goal readout rather than above it. The DATA is untouched —
              this chart is a distribution, and the distribution is honest on
              every completed run including withheld ones. */}
          <p
            className={`${typography.panelMeta} text-text-light mb-1`}
            data-testid="win-gauge-comparative-heading"
          >
            {COMPARATIVE_COPY.label}
          </p>
        </Tooltip>
        {/* Stacked bar — use clamped raw percentage for width to avoid rounding gaps */}
        <div className={`flex rounded-full overflow-hidden gap-0.5${isDeemphasised ? ' h-2' : ' h-3'}`}>
          {sorted.map((share) => {
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
                  backgroundColor: colorById[share.id],
                }}
                role="img"
                aria-label={`${stripEncodingNotation(share.label)}: ${displayPct}%`}
              />
            )
          })}
        </div>
        {/* Legend — coloured dot + truncated name + percentage */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
          {sorted.map((share) => {
            const displayPct = Math.round(Math.max(0, Math.min(1, share.winProbability)) * 100)
            if (displayPct <= 0) return null
            return (
              <span key={share.id} className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-light`}>
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorById[share.id] }}
                  aria-hidden="true"
                />
                <span className="truncate max-w-[120px]">{stripEncodingNotation(share.label)}</span>
                <span className="tabular-nums">{displayPct}%</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
