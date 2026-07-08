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
  formatPercent as formatPct,
  formatProbabilityWithResolution,
  isAboveSimulationResolution,
  isBelowSimulationResolution,
} from '../../utils/formatPercent'
import { ExpertBlock } from './ExpertBlock'
import { formatOptionLabelForCard } from './utils/cleanFactorLabel'
import { sortOptionsForDisplay } from './utils/optionDisplayOrder'
import { formatRangeValue } from './utils/formatRangeValue'
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

export interface OptionCardsProps {
  options: OptionResult[]
  winnerId?: string
  /** Whether a goal threshold is set (controls "Hits target" row visibility) */
  hasGoalThreshold?: boolean
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
function fallbackDescription(option: OptionResult, totalOptions: number): string {
  if (option.isRecommended && totalOptions > 1) {
    return 'Top-performing option based on current estimates.'
  }
  if (option.isBaseline) {
    return 'Baseline for comparison.'
  }
  return 'Compare against the leading option.'
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
): string {
  if (isWinner) {
    if (hinge?.reason === 'fragile_edge') {
      return `Highest leading-option likelihood but depends on ${hinge.label}`
    }
    if (hinge?.reason === 'heuristic' || hinge?.reason === 'voi') {
      return `Highest leading-option likelihood. ${hinge.label} has the widest uncertainty.`
    }
    return 'Highest leading-option likelihood across simulated scenarios'
  }
  if (isRunnerUp) {
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
  // Task 9: Status quo / baseline — specific copy
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

/**
 * OptionRangeBar — thin 4px bar showing p10-to-p90 range with dot at median.
 *
 * All option range bars share the same [globalMin, globalMax] scale
 * for visual comparability between options. The bar fill width
 * represents each option's range within the shared scale.
 */
function OptionRangeBar({
  p10,
  p50,
  p90,
  globalMin,
  globalMax,
}: {
  p10: number
  p50?: number
  p90: number
  globalMin: number
  globalMax: number
}) {
  const span = globalMax - globalMin
  if (span <= 0) return null

  const leftPct = ((p10 - globalMin) / span) * 100
  const widthPct = ((p90 - p10) / span) * 100
  const dotPct = p50 != null ? ((p50 - globalMin) / span) * 100 : undefined

  return (
    <div data-testid="option-range-bar">
      <div className="relative" style={{ height: 4, background: 'var(--border-default)', borderRadius: 2 }}>
        <div
          className="absolute top-0 h-full rounded-sm"
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(2, widthPct)}%`,
            background: 'rgba(82,163,200,0.3)',
          }}
        />
        {dotPct != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${dotPct}%`,
              width: 8,
              height: 8,
              background: 'var(--info)',
              border: '1.5px solid var(--bg-panel)',
              transform: `translate(-50%, -50%)`,
            }}
          />
        )}
      </div>
      <div className={`flex justify-between mt-0.5 ${typography.panelMeta}`}>
        <span className="text-text-light">{formatRangeValue(p10)}</span>
        {p50 != null && (
          <span className="text-text-header">{formatRangeValue(p50)}</span>
        )}
        <span className="text-text-light">{formatRangeValue(p90)}</span>
      </div>
    </div>
  )
}

/** Single option card */
function OptionCard({
  option,
  isWinner,
  totalOptions,
  hasGoalThreshold,
  description,
  cardRef,
  neutralised = false,
  sortedRank,
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
}: {
  option: OptionResult
  isWinner: boolean
  totalOptions: number
  hasGoalThreshold: boolean
  description: string
  cardRef?: (el: HTMLDivElement | null) => void
  /** V11: When true, neutralise all colour semantics (indeterminate state) */
  neutralised?: boolean
  /** V14.2: 1-indexed rank derived from win probability sort order */
  sortedRank?: number
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
  const borderClass = neutralised
    ? 'border border-panel-border'
    : isWinner
      ? 'border border-success/30'
      : 'border border-panel-border'
  // V14.2: Prefer sort-derived rank, fallback to option.rank or winner inference
  const rank = sortedRank ?? option.rank ?? (isWinner ? 1 : undefined)

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
                  : `Leads in ${formatProbabilityWithResolution(option.winProbability, option.nValidSamples)} of simulated scenarios`
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

      {/* Description: story headline or fallback */}
      <p className={`${typography.panelBody} text-text-light line-clamp-2`}>
        {description}
      </p>

      {/* Task 6b: Coloured fill bar matching wins-bar segment colour */}
      {option.winProbability != null && segmentFillColor && !neutralised && (
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 5, backgroundColor: 'var(--border-default, #EEE6D8)' }}
          title={`Leading-option probability: ${formatProbabilityWithResolution(option.winProbability, option.nValidSamples)}`}
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
      {isWinner && leadingOptionDownsideFlag === true && !neutralised && (
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
            isLeader={isWinner}
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
                onSendMessage(winnerChipPrompt(isWinner, option.label))
              }}
              className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-1 bg-transparent hover:bg-panel-hover cursor-pointer`}
            >
              {winnerChipLabel(isWinner, confidenceTier, recommendationStability)}
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
  hasGoalThreshold = false,
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
}: OptionCardsProps) {
  // Internal ref map if none provided externally
  const internalRefMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const refMap = cardRefMap ?? internalRefMap

  // V11: Indeterminate neutralisation — stone colours, no success border
  const neutralised = decisionState === 'indeterminate'

  // V11: Conditional "Hits target" — hide unless EVERY option has goalProbability
  const allGoalProbability = options.every(o => o.goalProbability != null)
  const showHitsTarget = hasGoalThreshold && allGoalProbability

  // V14.2: Sort by win probability descending (same order as WinGauge segments).
  // Shared with the analysis hero via sortOptionsForDisplay so both surfaces
  // number and order options identically.
  const sorted = sortOptionsForDisplay(options)

  // Range bar global scale: shared [globalMin, globalMax] across all options
  // so bar widths are visually comparable. Falls back to mean when percentiles absent.
  const globalMin = Math.min(
    ...options.map(o => o.outcome?.p10 ?? o.outcome?.mean ?? 0),
  )
  const globalMax = Math.max(
    ...options.map(o => o.outcome?.p90 ?? o.outcome?.mean ?? 0),
  )

  // Brief 5.8B D3 collapsed the per-rank border palette to a 2-state
  // (winner / non-winner) hierarchy, so `buildSegmentBorderClassMap` /
  // `WIN_GAUGE_BORDER_CLASSES` are no longer consumed here. The segment
  // colour map below is still used for coloured fill bars (Task 6b).
  const segmentColorMap = buildSegmentColorMap(options, winnerId, decisionState)

  // Brief 3 ST2: Truncate to top 2 whenever there are more than 2 options
  const TOP_N = 2
  const shouldTruncate = sorted.length > TOP_N
  const [showAllOptions, setShowAllOptions] = useState(false)
  const visibleOptions = shouldTruncate && !showAllOptions ? sorted.slice(0, TOP_N) : sorted
  const hiddenCount = sorted.length - TOP_N

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
        // keeps gap-based specificity. Story headlines still take priority when present.
        const winnerOpt = options.find(o => o.id === winnerId)
        const description = decisionState
          ? hingeAwareDescription(option, isWinner, isRunnerUp, hinge, winnerOpt?.winProbability)
          : headline
            ? headline
            : (winnerOpt?.winProbability != null || option.winProbability != null)
              ? hingeAwareDescription(option, isWinner, isRunnerUp, hinge, winnerOpt?.winProbability)
              : fallbackDescription(option, options.length)

        const segmentFillColor = segmentColorMap[option.id]
        return (
          <OptionCard
            key={option.id}
            option={option}
            isWinner={isWinner}
            totalOptions={options.length}
            hasGoalThreshold={showHitsTarget}
            description={description}
            neutralised={neutralised}
            sortedRank={index + 1}
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
          />
        )
      })}
      {/* Brief 5.8B hotfix: wrap disclosure + approach link in flex-col so they
          never collapse onto the same visual line. gap-1 = 4px (mt-1 equivalent). */}
      {(shouldTruncate || onSendMessage) && (
        <div className="flex flex-col gap-1">
          {/* Brief 3 ST2: Show all / show fewer toggle (when 3+ options) */}
          {shouldTruncate && (
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
              Routes the prompt through the existing onSendMessage pathway so the
              conversation panel reuses the same coaching loop the AI chips use. */}
          {onSendMessage && (
            <button
              type="button"
              onClick={() => onSendMessage('What if I tried a different approach? Suggest one or two alternative options I could compare against the current set.')}
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
