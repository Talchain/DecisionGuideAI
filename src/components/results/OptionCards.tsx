/**
 * OptionCards — V9.2 card-based option comparison.
 *
 * Replaces RangeVisualization (p10/p50/p90 range bars) with:
 * - Option name + rank badge ("#1 of N")
 * - 1-2 line contextual description (story headline or fallback)
 * - "Wins" stat row: horizontal bar + percentage
 * - "Hits target" stat row: horizontal bar + percentage (conditional on target set)
 *
 * Leading option card has border-success (mint-500 border).
 * Other cards use border-panel-border.
 *
 * Design rules: no background fills on cards (borders only).
 */

import { useRef, type RefObject } from 'react'
import { typography } from '../../styles/typography'
import { formatPercent as formatPct } from '../../utils/formatPercent'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import type { OptionResult } from './types'
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

/** Horizontal bar segment for stat rows */
function StatBar({
  value,
  label,
  isLeader,
  color,
}: {
  value: number | null | undefined
  label: string
  isLeader: boolean
  color: 'success' | 'info'
}) {
  if (value == null) return null

  const pct = Math.round(value * 100)
  const barWidth = Math.max(2, pct) // minimum 2% so bar is always visible

  const barColorClass = isLeader
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
          style={{ width: `${barWidth}%` }}
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
}: {
  option: OptionResult
  isWinner: boolean
  totalOptions: number
  hasGoalThreshold: boolean
  description: string
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  const borderClass = isWinner ? 'border-success' : 'border-panel-border'
  const rank = option.rank ?? (isWinner ? 1 : undefined)

  return (
    <div
      ref={cardRef}
      className={`p-3 border ${borderClass} rounded-lg space-y-2`}
      data-testid={`option-card-${option.id}`}
      data-option-id={option.id}
    >
      {/* Header: name + rank badge */}
      <div className="flex items-center gap-2">
        <span className={`${typography.panelHeader} text-text-header truncate`}>
          {stripEncodingNotation(option.label)}
        </span>
        {rank != null && totalOptions > 1 && (
          <span
            className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full leading-none flex-shrink-0 ${
              isWinner
                ? 'bg-success-light text-success'
                : 'bg-factor-light text-text-light'
            }`}
          >
            #{rank} of {totalOptions}
          </span>
        )}
        {option.isBaseline && (
          <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>
            Baseline
          </span>
        )}
      </div>

      {/* Description: story headline or fallback */}
      <p className={`${typography.panelBody} text-text-light line-clamp-2`}>
        {description}
      </p>

      {/* Stat rows */}
      <div className="space-y-1.5">
        <StatBar
          value={option.winProbability}
          label="Wins"
          isLeader={isWinner}
          color="success"
        />
        {hasGoalThreshold && (
          <StatBar
            value={option.goalProbability}
            label="Hits target"
            isLeader={isWinner}
            color="info"
          />
        )}
      </div>

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
}: OptionCardsProps) {
  // Internal ref map if none provided externally
  const internalRefMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const refMap = cardRefMap ?? internalRefMap

  // Sort: winner first, then by rank
  const sorted = [...options].sort((a, b) => {
    if (a.id === winnerId) return -1
    if (b.id === winnerId) return 1
    const rankA = a.rank ?? 999
    const rankB = b.rank ?? 999
    return rankA - rankB
  })

  if (sorted.length === 0) return null

  return (
    <div className="space-y-2" data-testid="option-cards">
      {sorted.map(option => {
        const isWinner = option.id === winnerId
        const headline = storyHeadlines?.[option.id]
        const description = headline
          ? stripEncodingNotation(headline)
          : fallbackDescription(option, options.length)

        return (
          <OptionCard
            key={option.id}
            option={option}
            isWinner={isWinner}
            totalOptions={options.length}
            hasGoalThreshold={hasGoalThreshold}
            description={description}
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
