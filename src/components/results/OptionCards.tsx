/**
 * OptionCards — V9.2 card-based option comparison.
 *
 * Replaces RangeVisualization (p10/p50/p90 range bars) with:
 * - Option name + rank badge ("#1 of N") + win percentage text
 * - 1-2 line contextual description (story headline or fallback)
 * - "Hits target" stat row: horizontal bar + percentage (conditional on target set)
 * V12.4: Per-card "Wins" bars removed; win % shown as text in card header.
 *
 * All cards use border-panel-border. Leading option card gets a coloured
 * left border (3px) matching its WinGauge segment colour via inline style.
 *
 * V11: Indeterminate neutralisation — stone colours, percentage badges, muted text.
 *
 * Design rules: no background fills on cards (borders only).
 */

import { useRef, type RefObject } from 'react'
import { typography } from '../../styles/typography'
import { formatPercent as formatPct } from '../../utils/formatPercent'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { highlightNode, clearHighlight } from '../../canvas/utils/highlightHelpers'
import type { OptionResult, DecisionState, HingeInfo } from './types'
import {
  constraintConfidenceColour,
  jointProbabilityLabel,
} from '../../types/constraints'

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
  /** V12.3: Segment colour per option ID (keyed by option ID, CSS custom property values) */
  segmentColorMap?: Record<string, string>
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
        : 'bg-factor-light'

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
  segmentColor,
  sortedRank,
}: {
  option: OptionResult
  isWinner: boolean
  totalOptions: number
  hasGoalThreshold: boolean
  description: string
  cardRef?: (el: HTMLDivElement | null) => void
  /** V11: When true, neutralise all colour semantics (indeterminate state) */
  neutralised?: boolean
  /** V12.3: CSS colour value for left border + bar fill (from wins bar segment) */
  segmentColor?: string
  /** V14.2: 1-indexed rank derived from win probability sort order */
  sortedRank?: number
}) {
  // V12.3: Use segment colour for left border when provided
  const borderClass = 'border-panel-border'
  // V14.2: Prefer sort-derived rank, fallback to option.rank or winner inference
  const rank = sortedRank ?? option.rank ?? (isWinner ? 1 : undefined)

  // V11: Rank badge — show "58%" in stone when neutralised (with winProbability), "#1 of N" otherwise
  const rankBadgeContent = neutralised && option.winProbability != null
    ? formatPct(option.winProbability, { fromDecimal: true })
    : rank != null ? `#${rank} of ${totalOptions}` : null

  const rankBadgeClass = neutralised
    ? 'bg-factor-light text-factor'
    : isWinner
      ? 'bg-success-light text-success'
      : 'bg-factor-light text-text-light'

  return (
    <div
      ref={cardRef}
      className={`p-3 border ${borderClass} rounded-lg space-y-2 results-card-hover`}
      style={segmentColor ? { borderLeftWidth: '3px', borderLeftColor: segmentColor } : undefined}
      data-testid={`option-card-${option.id}`}
      data-option-id={option.id}
      onMouseEnter={() => highlightNode(option.id)}
      onMouseLeave={clearHighlight}
    >
      {/* Header: name + rank badge + win percentage */}
      <div className="flex items-center gap-2">
        <span className={`${typography.panelHeader} text-text-header truncate`}>
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
  segmentColorMap,
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

  if (sorted.length === 0) return null

  return (
    <div className="space-y-2" data-testid="option-cards">
      {sorted.map((option, index) => {
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

        // V12.3: Segment colour from wins bar palette (keyed by option ID)
        const segmentColor = segmentColorMap?.[option.id]

        return (
          <OptionCard
            key={option.id}
            option={option}
            isWinner={isWinner}
            totalOptions={options.length}
            hasGoalThreshold={showHitsTarget}
            description={description}
            neutralised={neutralised}
            segmentColor={segmentColor}
            sortedRank={index + 1}
            cardRef={(el) => {
              if (el) {
                refMap.current.set(option.id, el)
              } else {
                refMap.current.delete(option.id)
              }
            }}
          />
        )
      })}
    </div>
  )
}

export default OptionCards
