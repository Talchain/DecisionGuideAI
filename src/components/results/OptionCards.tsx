/**
 * OptionCards — V9.2 card-based option comparison.
 *
 * - Option name + rank badge ("#1 of N") + win percentage text
 * - 1-2 line contextual description (story headline or fallback)
 * - "Hits target" stat row: horizontal bar + percentage (conditional on target set)
 * V12.4: Per-card "Wins" bars removed; win % shown as text in card header.
 * V14.2: Ordinal full-border palette (no left-accent). Winner gets border-2 border-success/60;
 *   runner-up border-info/60; third border-option/60; fourth+ border-panel-border.
 *   Border classes derived from WIN_GAUGE_BORDER_CLASSES in HeroSection — coupled to win-bar palette.
 *
 * V11: Indeterminate neutralisation — stone colours, percentage badges, muted text.
 *
 * Design rules: no background fills on cards (full borders only, no left-accent).
 */

import { useRef, useState, useCallback, type RefObject } from 'react'
import { typography } from '../../styles/typography'
import { formatPercent as formatPct } from '../../utils/formatPercent'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { highlightNode, clearHighlight } from '../../canvas/utils/highlightHelpers'
import { useCanvasStore, selectResultsStatus } from '../../canvas/store'
import { isGraphLensEnabled } from '../../flags'
import type { OptionResult, DecisionState, HingeInfo } from './types'
import {
  constraintConfidenceColour,
  jointProbabilityLabel,
} from '../../types/constraints'
import { buildSegmentBorderClassMap } from './HeroSection'

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
 * Replaces fallbackDescription when decisionState is available.
 */
function hingeAwareDescription(
  option: OptionResult,
  isWinner: boolean,
  isRunnerUp: boolean,
  hinge: HingeInfo | null | undefined,
): string {
  if (isWinner) {
    if (hinge?.reason === 'fragile_edge') {
      return `Highest win likelihood but depends on ${hinge.label}`
    }
    if (hinge?.reason === 'heuristic' || hinge?.reason === 'voi') {
      return `Highest win likelihood. ${hinge.label} has the widest uncertainty.`
    }
    return 'Highest win likelihood across simulated scenarios'
  }
  if (isRunnerUp) {
    if (hinge?.alternativeWinnerLabel && hinge.alternativeWinnerLabel === option.label) {
      return `If ${hinge.label} shifts, this option overtakes`
    }
    return 'Second highest win likelihood'
  }
  return 'Lower win likelihood'
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
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
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
  segmentBorderClass,
  onClick,
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
  /** Ordinal border class matching this option's WinGauge segment colour */
  segmentBorderClass?: string
  onClick?: () => void
}) {
  const borderClass = neutralised
    ? 'border-panel-border'
    : (segmentBorderClass ?? 'border-panel-border')
  // V14.2: Prefer sort-derived rank, fallback to option.rank or winner inference
  const rank = sortedRank ?? option.rank ?? (isWinner ? 1 : undefined)

  // V11: Rank badge — show "58%" in stone when neutralised (with winProbability), "#1 of N" otherwise
  const rankBadgeContent = neutralised && option.winProbability != null
    ? formatPct(option.winProbability, { fromDecimal: true })
    : rank != null ? `#${rank} of ${totalOptions}` : null

  // §8.5 outlined variant: metadata labels use border + text-text-body (main-on-light fails contrast)
  const rankBadgeClass = neutralised
    ? 'border border-factor/30 text-text-body'
    : isWinner
      ? 'border border-success/30 text-text-body'
      : 'border border-factor/30 text-text-body'

  return (
    <div
      ref={cardRef}
      className={`bg-panel p-3 border ${borderClass} rounded-lg space-y-2 shadow-1 results-card-hover`}
      data-testid={`option-card-${option.id}`}
      data-option-id={option.id}
      onMouseEnter={() => highlightNode(option.id)}
      onMouseLeave={clearHighlight}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {/* Header: name + rank badge + win percentage */}
      <div className="flex items-center gap-2">
        <span className={`${typography.panelHeader} text-text-header`}>
          {stripEncodingNotation(option.label)}
        </span>
        {rank != null && totalOptions > 1 && (
          <span
            className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full leading-none flex-shrink-0 ${rankBadgeClass}`}
            data-testid={`rank-badge-${option.id}`}
          >
            {rankBadgeContent}
          </span>
        )}
        {option.isBaseline && (
          <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>
            Baseline
          </span>
        )}
        <span className="flex-1" />
        {option.winProbability != null && (
          <span
            className={`${typography.panelMeta} text-text-body tabular-nums flex-shrink-0`}
            data-testid={`win-pct-${option.id}`}
          >
            {formatPct(option.winProbability, { fromDecimal: true })}
          </span>
        )}
      </div>

      {/* Description: story headline or fallback */}
      <p className={`${typography.panelBody} text-text-light line-clamp-2`}>
        {description}
      </p>

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
        </div>
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
}: OptionCardsProps) {
  // Internal ref map if none provided externally
  const internalRefMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const refMap = cardRefMap ?? internalRefMap

  // V11: Indeterminate neutralisation — stone colours, no success border
  const neutralised = decisionState === 'indeterminate'

  // V11: Conditional "Hits target" — hide unless EVERY option has goalProbability
  const allGoalProbability = options.every(o => o.goalProbability != null)
  const showHitsTarget = hasGoalThreshold && allGoalProbability

  // V14.2: Sort by win probability descending (same order as WinGauge segments)
  const sorted = [...options].sort((a, b) => {
    return (b.winProbability ?? 0) - (a.winProbability ?? 0)
  })

  // Ordinal border class map: derived from same palette arrays as WinGauge by index
  const segmentBorderClassMap = buildSegmentBorderClassMap(options, winnerId, decisionState)

  // V16.1: Truncate to top 2 when there are 4+ options; show toggle below
  const TOP_N = 2
  const shouldTruncate = sorted.length >= 4
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

        // V11.2 Fix 2: VM hinge-aware descriptions take priority when decisionState available
        // Arrow characters stripped from story headlines (scoped to option card descriptions)
        const description = decisionState
          ? hingeAwareDescription(option, isWinner, isRunnerUp, hinge)
          : headline
            ? headline
            : fallbackDescription(option, options.length)

        // Ordinal border class: index-derived from same palette as WinGauge segment
        const segmentBorderClass = segmentBorderClassMap[option.id] ?? 'border-panel-border'
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
            segmentBorderClass={segmentBorderClass}
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
          />
        )
      })}
      {/* V16.1: Show all / show fewer toggle (only when 4+ options) */}
      {shouldTruncate && (
        <button
          type="button"
          onClick={() => setShowAllOptions(prev => !prev)}
          className={`${typography.panelBody} text-info hover:underline`}
          data-testid="option-cards-toggle"
        >
          {showAllOptions
            ? 'Show fewer'
            : `Show all (${hiddenCount} more)`}
        </button>
      )}
    </div>
  )
}

export default OptionCards
