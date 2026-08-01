/**
 * OptionCards — V9.2 card-based option comparison.
 *
 * - Ordinal colour marker + option name + win percentage text (D17: "#N of M" prefix removed)
 * - 1-2 line contextual description (story headline or fallback)
 * - "Hits target" stat row: horizontal bar + percentage (conditional on target set)
 * V12.4: Per-card "Wins" bars removed; win % shown as text in card header.
 * Brief 5.8B D3: per-rank palette (V14.2: border-2 border-success/60 / border-info/60 /
 *   border-option/60) collapsed to a 2-state hierarchy — winner cards carry
 *   `border-success/30`; everything else stays neutral with `border-panel-border`.
 *   Single-stroke borders only.
 *
 * V11: Indeterminate neutralisation — stone colours, percentage badges, muted text.
 *
 * Design rules: no background fills on cards (full borders only, no left-accent).
 */

import { useRef, useState, useCallback, type RefObject } from 'react'
import { typography } from '../../styles/typography'
import {
  COMPARATIVE_COPY,
  LENS_COPY,
  isFiniteProbability,
  runHasGoalNumbers,
} from './utils/goalAnchorCopy'
import {
  formatPercent as formatPct,
  formatProbabilityWithResolution,
  isAboveSimulationResolution,
  isBelowSimulationResolution,
} from '../../utils/formatPercent'
import { ExpertBlock } from './ExpertBlock'
import { formatOptionLabelForCard } from './utils/cleanFactorLabel'
import { sortOptionsForDisplay } from './utils/optionDisplayOrder'
import { OptionRangeBar, computeOptionScale } from './shared/OptionRangeBar'
import { SUB_ONE_PERCENT_FLOOR } from './utils/displayFloors'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from './utils/goalFitBasisCaveatCopy'
import { highlightNode, clearHighlight } from '../../canvas/utils/highlightHelpers'
import { useCanvasStore, selectResultsStatus } from '../../canvas/store'
import { isGraphLensEnabled } from '../../flags'
import type { OptionResult, DecisionState, HingeInfo, ConfidenceTier } from './types'
import {
  constraintConfidenceColour,
  jointProbabilityLabel,
} from '../../types/constraints'
import { buildSegmentColorMap, WIN_GAUGE_COLORS } from './WinGauge'
import Tooltip from '../Tooltip'
import { winnerChipLabel, winnerChipPrompt } from './utils/winnerChipCopy'
import { openAskOlumi } from './coaching/askOlumiStore'

export interface OptionCardsProps {
  options: OptionResult[]
  winnerId?: string
  /**
   * ROADMAP 1.223 — `DecisionVerdict.hasLeadingOption`, the single boolean any
   * surface must gate on before asserting a leading option exists.
   *
   * Deliberately SEPARATE from `winnerId`, which stays populated on a withheld
   * turn: `winnerId` is an IDENTITY, and identity still drives the lens crown
   * and node focus. This flag is the ENTITLEMENT.
   *
   * ⚠ CORRECTED 27 Jul (ROADMAP 1.267). This doc used to end "…still drives
   * segment colours, the lens crown and card ordering, NONE OF WHICH CLAIM
   * ANYTHING", and that sentence was wrong. Row 1.306 records the confirming
   * screenshots and names it: "the G-UI-1 closure treated client-side
   * ordering as benign when it is the designation channel." Ordering,
   * ordinal swatches and rank-derived colour are claims wearing numbers, so
   * they are now gated too — see `designationsWithheld` below. This flag
   * still gates the comparative SENTENCES; the two are separate because a
   * sentence and a sort fail differently and a single flag hid that for four
   * slices.
   *
   * `undefined` ⇒ legacy behaviour, matching the same concession
   * `certaintyCopy` and `buildV7Headline` make for callers/fixtures predating
   * the shared verdict. The one live caller (ResultsBody) always supplies it.
   */
  hasLeadingOption?: boolean
  /** Paul's ruling 2026-07-12: when the risk-appetite lens is active the
   * crowned card presents as lens-strongest, never as THE recommendation. */
  lensActive?: boolean
  /** Codex B1: the lens-selected option id. The lens CROWN (styling + lens
   * copy) follows this id; every LEADER predicate (downside sentence, leader
   * CTA/prompt, hinge winner copy) stays keyed to the CANONICAL winnerId so
   * a lens can never hand another option the recommendation's semantics. */
  lensHighlightedId?: string
  /** Wave 2 (§6.4): identity-anchored ordinals keyed by option id; a chip
   * renders only when provided AND the id has a number — the provider
   * (ResultsBody) supplies the map all-or-nothing behind the flag. */
  stableNumbers?: Readonly<Record<string, number | null>>
  /** Whether a goal threshold is set (controls "Hits target" row visibility) */
  hasGoalThreshold?: boolean
  /**
   * F3 — whether this run carries a goal ranking at all, threaded from the
   * caller rather than re-derived here. `ResultsBody` already derives it once
   * for `RiskAppetiteFilter` and the lens sentences; taking the SAME answer
   * means the card's lens copy and the disclaimer above it cannot disagree
   * about whether a goal ranking exists.
   *
   * Optional, and OMITTED falls back to deriving it from `options` — the same
   * legacy concession `hasLeadingOption` above documents. Direct-render
   * callers (specs, and any surface predating this prop) keep byte-identical
   * behaviour; a hard `false` default would have silently swapped the lens
   * sentence on them.
   */
  hasGoalNumbers?: boolean
  /** Story headlines keyed by option ID (M1 coaching) */
  storyHeadlines?: Record<string, string>
  /** Ref map for flash animation: optionId → ref */
  cardRefMap?: RefObject<Map<string, HTMLDivElement>>
  /** V11: Tri-state decision classification for neutralisation */
  decisionState?: DecisionState
  /** V11: Hinge info for contextual descriptions */
  hinge?: HingeInfo | null
  /** V11: Runner-up option ID for hinge-aware descriptions */
  runnerId?: string
  /** Handler for sending a message to the conversation panel */
  onSendMessage?: (text: string) => void
  /** Handler for focusing a node on the canvas */
  onFocusNode?: (nodeId: string) => void
  /** Expert mode — show range bars and technical details */
  expertMode?: boolean
  /** Brief 5.4 Phase 7: confidence tier for winner chip label copy */
  confidenceTier?: ConfidenceTier
  /** Brief 5.4 QA Item 4: stability gate for winner chip hedging (mirrors certaintyCopy threshold) */
  recommendationStability?: number
  /**
   * Display-honesty (UI-SEM-050): when true, render a single qualifying
   * sentence inside the leading option's card noting meaningful downside
   * in the lower simulated range.
   */
  leadingOptionDownsideFlag?: boolean
}

/** Fallback description when no story headline is available */
function fallbackDescription(
  option: OptionResult,
  totalOptions: number,
  hasLeadingOption?: boolean,
): string {
  // ROADMAP 1.223: both leader-presupposing strings below are withheld when
  // the producer made no leader claim. Returning '' suppresses the line
  // entirely (the caller renders nothing) rather than substituting invented
  // copy — the card still shows the option's label, its win probability and
  // its bar, so no DATA is lost. Only the claim is.
  const noLeader = hasLeadingOption === false
  if (option.isRecommended && totalOptions > 1) {
    return noLeader ? '' : 'Top-performing option based on current estimates.'
  }
  if (option.isBaseline) {
    return 'Baseline for comparison.'
  }
  return noLeader ? '' : 'Compare against the leading option.'
}

/**
 * V11: Hinge-aware description for option cards.
 * Used when decisionState is available OR when win probability data exists.
 * Task 9: Specific text using flip data and win probability gap.
 */
function hingeAwareDescription(
  option: OptionResult,
  isWinner: boolean,
  isRunnerUp: boolean,
  hinge: HingeInfo | null | undefined,
  winnerWinProbability?: number | null,
  lensActive = false,
  hasLeadingOption?: boolean,
  /** Run-level: does ANY option carry a goal number? Gates the lens sentence. */
  hasGoalNumbers = false,
): string {
  // ROADMAP 1.223: every string in this function is comparative — it either
  // names an option as the leader ("Highest leading-option likelihood"),
  // measures against one ("Behind by N percentage points"), or DENIES one
  // ("Statistically tied with the leading option"). On a turn where the
  // producer withheld the leader claim the UI is entitled to none of the
  // three: the denial is not a safe default, it is a second unearned claim,
  // and it is the same silence-not-denial rule this roadmap row applies at
  // `deriveDecisionVerdict`. So the whole line is withheld ('' ⇒ the caller
  // renders nothing) and the card falls back to label + win % + bar, which
  // are DATA and stay.
  //
  // The lens branch is exempt by construction: it describes the risk-appetite
  // LENS ("strongest under this lens"), which is a per-view argmax over data
  // on screen, not the producer's designation — the same distinction that
  // keeps the hero's per-lens crown alive.
  const noLeader = hasLeadingOption === false

  // ROADMAP 1.239 — ONE gate, ABOVE the branch table.
  //
  // #493 placed `if (noLeader) return ''` INSIDE three of the branches and
  // stated, deliberately, that two lines needed no gate because they "name a
  // factor and this option, never a leader":
  //
  //   runner-up: "If {factor} shifts, this option overtakes"
  //   baseline:  "Lowest risk but lowest expected outcome"
  //
  // A1 has since ruled the class in scope, and both are comparative after all.
  // "Overtakes" is transitive with the object suppressed — there is nothing to
  // overtake unless something is ahead — and it renders on the runner-up card
  // while the front-runner's own sentence is (correctly) withheld, so it points
  // at the silent card by elimination. "Lowest expected outcome" is a
  // superlative over the option set: an ordering claim, and the ordering is
  // exactly what the producer withheld.
  //
  // Both returned BEFORE the scattered gates, so the gate was present and
  // simply unreachable for those branches. Hoisting it is therefore an
  // ORDERING fix, and ordering is the instrument this arc settled on (#491:
  // a boolean guard on an OPTIONAL input silently restores the defect for any
  // caller that omits it; ordering has no such failure mode). It also removes
  // the three duplicated gates, so a branch added later cannot be born
  // ungated the way these two were.
  //
  // The lens branch stays ABOVE the gate — the one carve-out, and the reason
  // this is not simply the first line of the function.
  //
  // ⭐ CHALLENGED AND UPHELD, 2026-08-01 (ROADMAP 2.238 review). A reviewer read
  // `:436-437`'s "a withheld run crowns nothing. The lens crown goes too" as
  // governing THIS sentence, making the carve-out look like a live
  // self-contradiction, and I agreed and moved the gate above this branch. That
  // was WRONG, and the check that settles it is the `designationsWithheld` prop
  // doc introduced by the very same commit (#501, ROADMAP 1.267), which
  // enumerates its own scope: "the ordinal rank swatch, the crowned border, and
  // the leader colour on the 'Hits target' bar. NEVER THE VALUES THEMSELVES."
  // That comment annotates `const crowned` — the styling designation. It never
  // reached this sentence.
  //
  // So the two rulings do not conflict; they govern different channels:
  //   · #501 / 1.267 — STYLING designations derived from the producer's
  //     ordering (border, rank swatch, bar colour) go on a withheld run.
  //   · #494 / 1.239 — THIS sentence stays, because it is a per-view argmax
  //     over outcome values already on screen, not the producer's designation,
  //     and its companion clause explicitly disclaims the main ranking. #494
  //     also names the risk of gating it: the over-suppression class this arc
  //     had already had to fix once in DecisionNode.
  //
  // `residualComparative.optionCards.spec.ts` pins the carve-out deliberately
  // and is what caught the attempted removal. Do not gate this branch without
  // re-adjudicating 1.239 on the record.
  if (isWinner && lensActive) {
    return `Ahead on this outcome view. ${LENS_COPY.unchanged(hasGoalNumbers)}`
  }
  if (noLeader) return ''

  if (isWinner) {
    /**
     * The winner's comparative claim, in ONE place for all three variants.
     *
     * ⚠ F1 — an ABSENT comparative probability must never become a measured
     * one. This read `option.winProbability ?? 0` and then applied the
     * simulation-resolution floor, so a designated leader carrying no
     * comparative probability got "Came out ahead in <0.02% of simulated
     * scenarios" — a precise-looking, entirely invented measurement, on the
     * card the user trusts most. Reachable: the `decisionState` arm at the
     * render site calls this with no presence check (its sibling arm does).
     *
     * Same class as the two defects the previous pass fixed, and the same
     * remedy — `phraseNoMagnitude`, built for exactly this. Derived once here
     * so a fourth variant cannot be born ungated.
     */
    const claim =
      isFiniteProbability(option.winProbability)
        ? COMPARATIVE_COPY.phrase(
            formatProbabilityWithResolution(option.winProbability, option.nValidSamples),
          )
        : COMPARATIVE_COPY.leadNoMagnitude

    // F2 — both hinge variants carried the retired un-anchored superlative
    // ("Highest leading-option likelihood"): no basis, no number. Only the
    // third sibling had been re-anchored. They keep the hinge clause, which
    // is the whole point of the variant.
    if (hinge?.reason === 'fragile_edge') {
      return `${claim}, but this depends on ${hinge.label}`
    }
    if (hinge?.reason === 'heuristic' || hinge?.reason === 'voi') {
      return `${claim}. ${hinge.label} has the widest uncertainty.`
    }
    return claim
  }
  if (isRunnerUp) {
    // ROADMAP 1.239: reachable only on a permitted turn now — see the gate
    // above. The conditional-flip line is honest copy where a leader HAS been
    // designated; it is the designation it presupposes, not the factor it
    // names, that made it unrenderable on a withheld one.
    if (hinge?.alternativeWinnerLabel && hinge.alternativeWinnerLabel === option.label) {
      return `If ${hinge.label} shifts, this option overtakes`
    }
    // Task 9: Gap-based fallback instead of generic "Second highest"
    if (winnerWinProbability != null && option.winProbability != null) {
      const gapPct = Math.round((winnerWinProbability - option.winProbability) * 100)
      if (gapPct > 0) {
        return `Behind by ${gapPct} percentage point${gapPct === 1 ? '' : 's'}`
      }
      return 'Statistically tied with the leading option'
    }
    return 'Close competitor'
  }
  // Task 9: Status quo / baseline — specific copy. ROADMAP 1.239 corrects the
  // note that used to sit here ("non-comparative … so it is not gated"): both
  // halves are superlatives OVER THE OPTION SET, not descriptions of this
  // option in isolation, so the line asserts an ordering. It now sits below
  // the single hoisted gate with everything else.
  if (option.isBaseline) {
    return 'Lowest risk but lowest expected outcome'
  }
  // Task 9: Other non-winner — gap-based
  if (winnerWinProbability != null && option.winProbability != null) {
    const gapPct = Math.round((winnerWinProbability - option.winProbability) * 100)
    if (gapPct > 0) {
      return `Behind by ${gapPct} percentage point${gapPct === 1 ? '' : 's'}`
    }
    return 'Statistically tied with the leading option'
  }
  return 'Compare against the leading option'
}

/** Horizontal bar segment for stat rows */
function StatBar({
  value,
  label,
  isLeader,
  color,
  neutralised = false,
  segmentColor,
}: {
  value: number | null | undefined
  label: string
  isLeader: boolean
  color: 'success' | 'info'
  /** V11: When true, use stone colours for all bars (indeterminate state) */
  neutralised?: boolean
  /** V12.3: CSS colour value from wins bar segment for bar fill */
  segmentColor?: string
}) {
  if (value == null) return null

  const pct = Math.round(value * 100)
  const barWidth = Math.max(2, pct) // minimum 2% so bar is always visible

  // V12.3: Use segment colour for "Wins" bar; keep "Hits target" as info
  const useSegmentColor = segmentColor && color === 'success'

  const barColorClass = useSegmentColor
    ? '' // colour applied via inline style
    : neutralised
      ? 'bg-factor'
      : isLeader
        ? (color === 'success' ? 'bg-success' : 'bg-info')
        : 'bg-panel'

  return (
    <div className="flex items-center gap-2">
      <span className={`${typography.panelMeta} text-text-light w-[72px] flex-shrink-0`}>
        {label}
      </span>
      <div className="flex-1 h-2 bg-panel-border/30 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${barColorClass}`}
          style={{
            width: `${barWidth}%`,
            ...(useSegmentColor ? { backgroundColor: segmentColor } : {}),
          }}
        />
      </div>
      <span className={`${typography.panelMeta} text-text-body tabular-nums w-[36px] text-right flex-shrink-0`}>
        {formatPct(value, { fromDecimal: true })}
      </span>
    </div>
  )
}

// Range values format via the shared magnitude-tiered helper
// (utils/formatRangeValue) — the same rule formatThreshold's user-unit
// percent branch uses, so card labels and hero readouts share one scale.
// TODO: PLoT should provide outcome_unit for proper display.
//
// OptionRangeBar + the [globalMin, globalMax] scale now live in the shared
// ./shared/OptionRangeBar module (consumed here and by the V7 lens group) so
// the two surfaces cannot drift.

/** Single option card */
function OptionCard({
  option,
  isWinner,
  isLensCrowned = false,
  cardLensActive = false,
  totalOptions,
  hasGoalThreshold,
  description,
  cardRef,
  neutralised = false,
  designationsWithheld = false,
  sortedRank,
  stableNumber = null,
  segmentFillColor,
  onClick,
  globalMin = 0,
  globalMax = 1,
  onSendMessage,
  onFocusNode,
  expertMode = false,
  confidenceTier,
  recommendationStability,
  leadingOptionDownsideFlag,
  hasLeadingOption,
}: {
  option: OptionResult
  isWinner: boolean
  /** ROADMAP 1.223 — see OptionCardsProps. Gates the comparative SENTENCES. */
  hasLeadingOption?: boolean
  /**
   * ROADMAP 1.267 — gates the non-prose DESIGNATIONS on this card: the
   * ordinal rank swatch, the crowned border, and the leader colour on the
   * "Hits target" bar. Never the values themselves.
   */
  designationsWithheld?: boolean
  /** Codex B1: lens crown restyles only — leader predicates stay on isWinner. */
  isLensCrowned?: boolean
  /** True when the risk-appetite lens is non-neutral (suppresses the canonical crown styling). */
  cardLensActive?: boolean
  totalOptions: number
  hasGoalThreshold: boolean
  description: string
  cardRef?: (el: HTMLDivElement | null) => void
  /** V11: When true, neutralise all colour semantics (indeterminate state) */
  neutralised?: boolean
  /** V14.2: 1-indexed rank derived from win probability sort order */
  sortedRank?: number
  /** Wave 2 (§6.4): identity-anchored ordinal — rendered as an "Option N"
   * chip so the same option keeps its number across rerun rank flips. */
  stableNumber?: number | null
  /** Task 6b: CSS colour string for coloured fill bar (matches wins segment) */
  segmentFillColor?: string
  onClick?: () => void
  /** Global min p10 across all options for shared range bar scale */
  globalMin?: number
  /** Global max p90 across all options for shared range bar scale */
  globalMax?: number
  onSendMessage?: (text: string) => void
  onFocusNode?: (nodeId: string) => void
  expertMode?: boolean
  /** Brief 5.4 Phase 7: confidence tier for winner chip label copy */
  confidenceTier?: ConfidenceTier
  /** Brief 5.4 QA Item 4: stability gate for winner chip hedging (mirrors certaintyCopy threshold) */
  recommendationStability?: number
  /**
   * Display-honesty (UI-SEM-050): when true and this card is the leading
   * option, render a single qualifying sentence noting meaningful downside
   * in the lower simulated range. Display-only.
   */
  leadingOptionDownsideFlag?: boolean
}) {
  // Brief 5.8B D3: per-rank palette (success / info / option / panel-border)
  // collapsed to a 2-state hierarchy — winner cards get `border-success/30`,
  // every other card stays neutral with `border-panel-border`. The richer
  // palette competed with the WinGauge segment colours one row above and
  // pulled visual weight away from the queue's emphasised first card.
  // Codex B1: under a lens, the CROWN styling follows the lens selection and
  // the canonical leader drops to a neutral border (never two crowns); the
  // canonical leader keeps every SEMANTIC leader predicate below regardless.
  // ROADMAP 1.267: a withheld run crowns nothing. The lens crown goes too —
  // it is a second designation, not an exemption from the first.
  //
  // ⭐ SCOPE MADE EXPLICIT, 2026-08-01 (ROADMAP 2.238 review). "The lens crown"
  // here means THE STYLING — this `crowned` flag and the `rank` swatch below —
  // exactly as the `designationsWithheld` prop doc from the same commit states:
  // "the ordinal rank swatch, the crowned border, and the leader colour on the
  // 'Hits target' bar. Never the values themselves."
  //
  // It does NOT govern the lens SENTENCE in `hingeAwareDescription`, which is
  // deliberately exempt under ROADMAP 1.239 (#494) as a per-view argmax over
  // on-screen values. A reviewer and I both read this comment as covering the
  // sentence and briefly "fixed" a contradiction that does not exist; the note
  // is added here so the next reader does not repeat it. The two rulings
  // co-exist because they govern different channels.
  const crowned = designationsWithheld ? false : cardLensActive ? isLensCrowned : isWinner
  const borderClass = neutralised || !crowned
    ? 'border border-panel-border'
    : 'border border-success/30'
  // V14.2: Prefer sort-derived rank, fallback to option.rank or winner inference.
  // ROADMAP 1.267: withheld ⇒ no rank at all. Note the fallback chain is
  // itself three ordinal designations stacked — `sortedRank` is the position
  // in the probability sort, `option.rank` is documented "1 = best", and
  // `isWinner ? 1` hands rank 1 to the winner outright — so the suppression
  // has to sit above the whole chain, not inside one arm of it.
  const rank = designationsWithheld
    ? undefined
    : sortedRank ?? option.rank ?? (isWinner ? 1 : undefined)

  return (
    <div
      ref={cardRef}
      className={`bg-panel p-3 ${borderClass} rounded-lg space-y-2 shadow-1 results-card-hover`}
      data-testid={`option-card-${option.id}`}
      data-option-id={option.id}
      onMouseEnter={() => highlightNode(option.id)}
      onMouseLeave={clearHighlight}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {/* Header: colour marker · option name | win percentage right-aligned.
          D17: "#N of M" rank prefix removed (rank conveyed by position +
          marker colour + right-aligned win%). Colour marker = 10×10px square
          matching the scenario-bar ordinal palette from WIN_GAUGE_COLORS. */}
      <div className="flex items-center gap-2">
        {!neutralised && rank != null && totalOptions > 1 && (
          <span
            aria-hidden="true"
            className="inline-block flex-shrink-0 w-2.5 h-2.5"
            data-testid={`rank-marker-${option.id}`}
            style={{ backgroundColor: WIN_GAUGE_COLORS[Math.min(rank - 1, WIN_GAUGE_COLORS.length - 1)] }}
          />
        )}
        {stableNumber != null && (
          <span
            data-testid={`stable-number-${option.id}`}
            className={`${typography.panelMeta} text-text-light flex-shrink-0`}
          >
            Option {stableNumber}
          </span>
        )}
        <Tooltip content="Hover highlights on canvas. Click opens inspector.">
          {/* Brief 5.1 Task 7: card title strips the trailing "(Status Quo)"
              suffix when the Baseline pill below already carries the same
              signal — prevents runner-up labels from wrapping to three lines
              on 1280px. Source option.label is untouched everywhere else. */}
          <span className={`${typography.panelHeader} text-text-header`}>
            {formatOptionLabelForCard(option.label, option.isBaseline === true)}
          </span>
        </Tooltip>
        {option.isBaseline && (
          <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>
            Baseline
          </span>
        )}
        <span className="flex-1" />
        {option.winProbability != null && (
          <Tooltip
            content={
              isBelowSimulationResolution(option.winProbability, option.nValidSamples)
                ? 'This option did not lead in any of the simulation runs, so its true chance may be below the current resolution.'
                : isAboveSimulationResolution(option.winProbability, option.nValidSamples)
                  ? 'This option led in every simulation run, so its display value reflects the current simulation resolution.'
                  : COMPARATIVE_COPY.phrase(
                      formatProbabilityWithResolution(option.winProbability, option.nValidSamples),
                    )
            }
          >
            <span
              className={`${typography.panelHeader} text-text-header tabular-nums flex-shrink-0`}
              data-testid={`win-pct-${option.id}`}
            >
              {formatProbabilityWithResolution(option.winProbability, option.nValidSamples)}
            </span>
          </Tooltip>
        )}
      </div>

      {/* Description: story headline or fallback. Empty ⇒ the comparative
          sentence was withheld (ROADMAP 1.223); render nothing rather than an
          empty paragraph that still occupies a line. */}
      {description ? (
        <p className={`${typography.panelBody} text-text-light line-clamp-2`}>
          {description}
        </p>
      ) : null}

      {/* Task 6b: Coloured fill bar matching wins-bar segment colour */}
      {option.winProbability != null && segmentFillColor && !neutralised && (
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 5, backgroundColor: 'var(--border-default, #EEE6D8)' }}
          // Re-anchored: this bar is drawn from the COMPARATIVE quantity, so
          // it takes the comparative register. The §6 map proposed the A
          // register here on the grounds that `goalProbability` is in scope —
          // but the BAR is not the goal number, and a goal caption over a
          // comparative fill is the mislabel map row 3 forbids.
          title={COMPARATIVE_COPY.phrase(
            formatProbabilityWithResolution(option.winProbability, option.nValidSamples),
          )}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(2, Math.round(option.winProbability * 100))}%`,
              backgroundColor: segmentFillColor,
            }}
          />
        </div>
      )}

      {/* Display-honesty (UI-SEM-050): qualifying sentence for the leading
          option when its lower simulated range includes meaningful downside.
          Reuses the existing outlined-pill pattern (border-info/30) — no new
          colour or component primitive. */}
      {isWinner && hasLeadingOption !== false && leadingOptionDownsideFlag === true && !neutralised && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid={`leading-option-downside-${option.id}`}
        >
          This option currently leads, but the lower range of simulated outcomes includes meaningful downside.
        </p>
      )}

      {/* Stat rows */}
      {hasGoalThreshold && (
        <div className="space-y-1.5">
          <StatBar
            value={option.goalProbability}
            label="Hits target"
            // ROADMAP 1.267: the bar length stays (it is the goal
            // probability); only the leader COLOUR is withheld.
            isLeader={isWinner && !designationsWithheld}
            color="info"
            neutralised={neutralised}
          />
          {/* T6 fix: Warning badge when goal probability is very low (<10%) */}
          {typeof option.goalProbability === 'number' && option.goalProbability < 0.10 && (
            <div className="flex items-center gap-1.5">
              <span
                className={`${typography.panelMeta} inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-danger/30 text-text-body`}
                data-testid={`low-goal-warning-${option.id}`}
              >
                {option.goalProbability < SUB_ONE_PERCENT_FLOOR
                  ? '< 1% likely to reach target'
                  : `${Math.round(option.goalProbability * 100)}% likely to reach target`}
              </span>
            </div>
          )}
          {/* Display-honesty (ROADMAP 1.6b, doctrine B / PLoT #204): the
              "Hits target" number above is scored from a MODELLED
              forward-propagated outcome distribution, not a
              directly-elicited base — the caveat renders adjacent to the
              number it qualifies, never separately (never invented; the
              wording mirrors the honesty rule verbatim). */}
          {option.goalFitIsModelledBasis === true && (
            <p
              className={`${typography.panelMeta} text-text-light`}
              data-testid={`goal-fit-basis-caveat-${option.id}`}
            >
              {GOAL_FIT_BASIS_CAVEAT_COPY}
            </p>
          )}
        </div>
      )}

      {/* Range bar: p10 / p50 / p90 visual — expert mode only */}
      {expertMode && (
        <ExpertBlock>
          {option.outcome && typeof option.outcome.p10 === 'number' && typeof option.outcome.p90 === 'number' ? (
            <OptionRangeBar
              p10={option.outcome.p10}
              p50={option.outcome.p50 ?? option.outcome.mean ?? undefined}
              p90={option.outcome.p90}
              globalMin={globalMin}
              globalMax={globalMax}
            />
          ) : option.outcome?.mean != null ? (
            <p className={`${typography.panelMeta} text-text-light`}>
              Expected: {option.outcome.mean.toLocaleString()}
            </p>
          ) : null}
        </ExpertBlock>
      )}

      {/* Multi-constraint joint probability line */}
      {option.constraintAnalysis != null &&
        option.constraintAnalysis.constraints.length > 0 && (
        <p
          className={`${typography.panelMeta} ${constraintConfidenceColour(option.constraintAnalysis.joint_probability)}`}
          data-testid="option-constraint-badge"
        >
          {jointProbabilityLabel(option.constraintAnalysis.joint_probability)}{' '}
          {Math.round(option.constraintAnalysis.joint_probability * 100)}%
        </p>
      )}

      {/* Action CTAs */}
      {(onSendMessage || onFocusNode) && (
        <div className="flex items-center gap-1 pt-1.5">
          {onSendMessage && (
            // Brief 5.1 Task 7 / Brief 5.4 Phase 7: single non-winner chip copy.
            // The earlier baseline-specific "Why does this lose?" read as negative
            // framing; forward-looking copy is parallel for both winner and non-winner.
            // Copy source: winnerChipCopy utility (no hardcoded strings at render sites).
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                // Codex finding 6: exploratory question-shaped CTA — prefill the
                // Ask-Olumi drawer (editable draft, user presses Send) instead of
                // auto-sending into a possibly-hidden conversation.
                openAskOlumi({
                  context: `About "${option.label}"`,
                  draft: winnerChipPrompt(isWinner, option.label, hasLeadingOption),
                  label: winnerChipLabel(isWinner, confidenceTier, recommendationStability, hasLeadingOption),
                })
              }}
              className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-1 bg-transparent hover:bg-panel-hover cursor-pointer`}
            >
              {winnerChipLabel(isWinner, confidenceTier, recommendationStability, hasLeadingOption)}
            </button>
          )}
          {!option.isBaseline && onFocusNode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onFocusNode(option.id)
              }}
              className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-1 bg-transparent hover:bg-panel-hover cursor-pointer`}
            >
              Edit interventions
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function OptionCards({
  options,
  winnerId,
  lensActive = false,
  lensHighlightedId,
  stableNumbers,
  hasGoalThreshold = false,
  hasGoalNumbers: hasGoalNumbersProp,
  storyHeadlines,
  cardRefMap,
  decisionState,
  hinge,
  runnerId,
  onSendMessage,
  onFocusNode,
  expertMode,
  confidenceTier,
  recommendationStability,
  leadingOptionDownsideFlag,
  hasLeadingOption,
}: OptionCardsProps) {
  // Internal ref map if none provided externally
  const internalRefMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const refMap = cardRefMap ?? internalRefMap

  // V11: Indeterminate neutralisation — stone colours, no success border
  const neutralised = decisionState === 'indeterminate'

  // ROADMAP 1.267 — DESIGNATION vs DATA. Read from the entitlement boolean
  // this component already receives; nothing new is derived. `=== false`
  // (not `!hasLeadingOption`) keeps the documented legacy concession: an
  // `undefined` prop is a caller predating the shared verdict, not a
  // withheld run, and behaves byte-identically to before.
  //
  // Deliberately NOT folded into `neutralised`, though the two suppress an
  // overlapping set of styles: `neutralised` also drops the win-probability
  // FILL BAR entirely (line ~459), and that bar is DATA. Reusing it would
  // have deleted a computed fact the ruling explicitly protects — the
  // over-suppression failure mode, arrived at by trying to save a flag.
  const designationsWithheld = hasLeadingOption === false

  // V11: Conditional "Hits target" — hide unless EVERY option has goalProbability
  const allGoalProbability = options.every(o => o.goalProbability != null)
  const showHitsTarget = hasGoalThreshold && allGoalProbability

  // V14.2: Sort by win probability descending (same order as WinGauge segments).
  // Shared with the analysis hero via sortOptionsForDisplay so both surfaces
  // number and order options identically. WITHHELD: canonical order instead
  // (ROADMAP 1.267) — `options` already arrives canonical from the hook, and
  // passing the flag here stops this leaf re-imposing the ranking.
  const sorted = sortOptionsForDisplay(options, { designationsWithheld })

  // Range bar global scale: shared [globalMin, globalMax] across all options
  // so bar widths are visually comparable. Falls back to mean when percentiles
  // absent (computeOptionScale — the same formula the V7 lens shares).
  const { globalMin, globalMax } = computeOptionScale(options)

  // Brief 5.8B D3 collapsed the per-rank border palette to a 2-state
  // (winner / non-winner) hierarchy, so `buildSegmentBorderClassMap` /
  // `WIN_GAUGE_BORDER_CLASSES` are no longer consumed here. The segment
  // colour map below is still used for coloured fill bars (Task 6b).
  // F3: run-level goal presence. Taken from the CALLER when it has one
  // (ResultsBody derives it once for the filter disclaimer and the lens
  // sentences), so the card copy and the sentence above it read one answer.
  // Only a caller that supplies none falls back to deriving it here.
  const hasGoalNumbers = hasGoalNumbersProp ?? runHasGoalNumbers(options)
  const segmentColorMap = buildSegmentColorMap(options, winnerId, decisionState)

  // Brief 3 ST2: Truncate to top 2 whenever there are more than 2 options
  const TOP_N = 2
  const shouldTruncate = sorted.length > TOP_N
  const [showAllOptions, setShowAllOptions] = useState(false)
  const truncated = shouldTruncate && !showAllOptions ? sorted.slice(0, TOP_N) : sorted
  //
  // ⭐ ROADMAP 2.237 — THE LENS PICK IS ALWAYS RENDERED.
  //
  // The panel above says "highlights the option with the strongest low end
  // (p10)". The list is ordered by `winProbability`, so the lens's own pick
  // routinely sits OUTSIDE the top 2 — on the sweep's fixture the p10 leader
  // was third and rendered nowhere, behind "Show all (1 more)". The user was
  // told which option the lens picked and then could not see it: a claim that
  // cannot be checked is the same defect as a claim that is wrong.
  //
  // Appended rather than promoted: promoting it would re-order the list, which
  // is precisely the ranking the copy must NOT claim.
  const lensPickHidden =
    lensActive &&
    lensHighlightedId != null &&
    !truncated.some((o) => o.id === lensHighlightedId) &&
    sorted.some((o) => o.id === lensHighlightedId)
  const visibleOptions = lensPickHidden
    ? [...truncated, ...sorted.filter((o) => o.id === lensHighlightedId)]
    : truncated
  // Derived from what is actually rendered — `sorted.length - TOP_N` would say
  // "1 more" while that one was already on screen.
  const hiddenCount = sorted.length - visibleOptions.length

  // ⭐ B1 (ROADMAP 2.237) — THE TOGGLE MUST NOT PROMISE WHAT IT CANNOT DELIVER.
  //
  // Re-deriving `hiddenCount` above was necessary but not sufficient: the
  // button's own render condition was still `shouldTruncate`, so on the
  // three-option appended state it rendered "Show all (0 more)" — and clicking
  // it changed nothing, because the card set was already complete; only the
  // label flipped to "Show fewer". A control claiming to reveal something and
  // revealing nothing is exactly the defect class this PR exists to remove,
  // freshly created BY this PR, on its own headline fixture.
  //
  // `showAllOptions ||` is load-bearing and is the reason this is not simply
  // `hiddenCount > 0`: once expanded, `hiddenCount` is 0 by construction, so
  // the bare predicate would delete the "Show fewer" control and strand the
  // user in the expanded state with no way back.
  const canRevealMore = hiddenCount > 0
  const showToggle = shouldTruncate && (showAllOptions || canRevealMore)

  // ⚠ TRUE rank, not the render position. `sortedRank` used to be the map index
  // (`index + 1`), which was correct only while `visibleOptions` was always a
  // PREFIX of `sorted`. It no longer is: an appended lens pick would have been
  // stamped "3" whatever its real standing, i.e. a fabricated ordinal — the
  // exact placeholder-where-a-quantity-belongs class. The rank now comes from
  // the ordering itself.
  const rankById = new Map(sorted.map((o, i) => [o.id, i + 1]))

  // Graph Lens: reverse panel sync — click option card to toggle lens isolation
  const lensEnabled = isGraphLensEnabled()
  const resultsComplete = useCanvasStore(s => selectResultsStatus(s) === 'complete')
  const lensSelectedOptionId = useCanvasStore(s => s.lens.selectedOptionId)
  const setLens = useCanvasStore(s => s.setLens)
  const resetLens = useCanvasStore(s => s.resetLens)

  const handleLensClick = useCallback((optionId: string) => {
    if (!lensEnabled || !resultsComplete) return
    if (lensSelectedOptionId === optionId) {
      resetLens()
    } else {
      setLens('option', optionId)
    }
  }, [lensEnabled, resultsComplete, lensSelectedOptionId, setLens, resetLens])

  if (sorted.length === 0) return null

  return (
    <div className="space-y-2" data-testid="option-cards">
      {visibleOptions.map((option, index) => {
        const isWinner = option.id === winnerId
        const isRunnerUp = option.id === runnerId
        const headline = storyHeadlines?.[option.id]

        // V11.2 Fix 2: VM hinge-aware descriptions take priority when decisionState available.
        // When decisionState is absent (e.g. non-neutral risk appetite), still use
        // hingeAwareDescription over fallbackDescription if win probabilities exist —
        // keeps gap-based specificity. Story headlines still take priority when present,
        // EXCEPT on the lens-crowned card: Paul's ruling requires the crowned card to
        // say it is lens-strongest, never THE recommendation — a coaching headline
        // there would restate the neutral recommendation under a non-neutral lens.
        const winnerOpt = options.find(o => o.id === winnerId)
        // Codex B1: isWinner = the CANONICAL leader (drives leader predicates);
        // the lens crown is a separate identity that only restyles + relabels.
        //
        // ⭐ ROADMAP 2.238 (P1-2) — THE `?? winnerId` FALLBACK IS REMOVED.
        //
        // It read `lensActive && option.id === (lensHighlightedId ?? winnerId)`.
        // `lensHighlightedId` is null exactly when the lens has no comparable
        // data — the same memo that makes the panel above print "Not enough
        // range data to compare options under this lens." So on any run whose
        // bands carry p10/p50 but no p90, clicking "Optimistic (p90)" printed
        // that sentence AND crowned the COMPARATIVE winner with "Ahead on this
        // outcome view" plus the success border: a comparative result
        // attributed to an outcome view that had just declared itself
        // unavailable. Both lines read one memo, so it was deterministic, not a
        // race.
        //
        // This is `buildV7Headline`'s defect exactly — the SUBJECT of the claim
        // is not the SOURCE of the number — and the rule is the same one
        // `selectGoalLeader` enforces for the goal crown: if the metric a claim
        // NAMES has no complete data, do not crown. `selectLensOption` already
        // documents this at `:69-73` ("an absence, never a fallback to a
        // different quantity"); the doctrine was written and then not applied
        // at the one call site that mattered.
        const isLensCrowned = lensActive && lensHighlightedId != null && option.id === lensHighlightedId
        const description = isLensCrowned
          ? hingeAwareDescription(option, true, isRunnerUp, hinge, winnerOpt?.winProbability, true, hasLeadingOption, hasGoalNumbers)
          : decisionState
            ? hingeAwareDescription(option, isWinner, isRunnerUp, hinge, winnerOpt?.winProbability, false, hasLeadingOption, hasGoalNumbers)
            : headline
              ? headline
              : (winnerOpt?.winProbability != null || option.winProbability != null)
                ? hingeAwareDescription(option, isWinner, isRunnerUp, hinge, winnerOpt?.winProbability, false, hasLeadingOption, hasGoalNumbers)
                : fallbackDescription(option, options.length, hasLeadingOption)

        // ROADMAP 1.267: the fill bar's LENGTH is the win probability (data,
        // kept) but its COLOUR is the rank palette — WIN_GAUGE_COLORS[0] is
        // commented "Winner — mint-500". On a withheld run the bar still
        // draws, in one neutral colour for every option: the measurement
        // survives, the ranking does not.
        const segmentFillColor = designationsWithheld
          ? 'var(--factor)'
          : segmentColorMap[option.id]
        return (
          <OptionCard
            key={option.id}
            option={option}
            isWinner={isWinner}
            isLensCrowned={isLensCrowned}
            cardLensActive={lensActive}
            totalOptions={options.length}
            hasGoalThreshold={showHitsTarget}
            description={description}
            neutralised={neutralised}
            designationsWithheld={designationsWithheld}
            sortedRank={rankById.get(option.id) ?? index + 1}
            stableNumber={stableNumbers?.[option.id] ?? null}
            segmentFillColor={segmentFillColor}
            globalMin={globalMin}
            globalMax={globalMax}
            onClick={lensEnabled && resultsComplete ? () => handleLensClick(option.id) : undefined}
            cardRef={(el) => {
              const currentMap = refMap.current
              if (!currentMap) return
              if (el) {
                currentMap.set(option.id, el)
              } else {
                currentMap.delete(option.id)
              }
            }}
            onSendMessage={onSendMessage}
            onFocusNode={onFocusNode}
            expertMode={expertMode}
            confidenceTier={confidenceTier}
            recommendationStability={recommendationStability}
            leadingOptionDownsideFlag={leadingOptionDownsideFlag}
            hasLeadingOption={hasLeadingOption}
          />
        )
      })}
      {/* Brief 5.8B hotfix: wrap disclosure + approach link in flex-col so they
          never collapse onto the same visual line. gap-1 = 4px (mt-1 equivalent). */}
      {(showToggle || onSendMessage) && (
        <div className="flex flex-col gap-1">
          {/* Brief 3 ST2: Show all / show fewer toggle (when 3+ options) */}
          {showToggle && (
            <button
              type="button"
              onClick={() => setShowAllOptions(prev => !prev)}
              className={`self-start ${typography.panelBody} text-info hover:underline`}
              data-testid="option-cards-toggle"
            >
              {showAllOptions
                ? 'Show fewer'
                : `Show all (${hiddenCount} more)`}
            </button>
          )}
          {/* Brief 5.8B D3 step 3: "What if I tried a different approach?" link.
              Codex finding 6: exploratory CTA — prefills the Ask-Olumi drawer
              (editable draft, user presses Send) rather than auto-sending. */}
          {onSendMessage && (
            <button
              type="button"
              onClick={() => openAskOlumi({
                context: 'Explore a different approach',
                draft: 'What if I tried a different approach? Suggest one or two alternative options I could compare against the current set.',
                label: 'A different approach',
              })}
              className={`self-start ${typography.panelBody} text-info hover:underline cursor-pointer`}
              data-testid="option-cards-different-approach"
            >
              What if I tried a different approach?
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default OptionCards
