/**
 * v10 (#/canvas2): the outcome band on an option card, under its chance headline. One slim band per option, every
 * card on ONE shared axis, so the cards read side by side: the 8-runs-in-10 range (p10 to p90), the median as a tick,
 * and the person's aim as a thin amber line when there is one.
 *
 * Nothing here is computed afresh. The ranges are the Analysis tab's own (`recommendation.allOptions[].outcome`), the
 * axis is its own `computeOptionScale`, the aim is its `goalThreshold`, and the unit is its own `formatDownsideValue`.
 *
 * ⛔ NUMBERS ONLY WHERE THE BAND IS IN THE PERSON'S UNITS. `goalBandIsInUserUnits()` is the estate's one switch (DL
 * 5854887316 item 1): the goal band is a model level, not the user's figure (Paul's MRR run printed "£15,320" beside a
 * stated £75,000). While it is off, and for any normalised or model-scale run, the Analysis tab draws its axis ends as
 * "Lower" and "Higher" (`optionFigures.axisLower/axisHigher`), "says where, never how much". This band does the same, and
 * draws no aim line, because a £ aim against a model level would put the line in the wrong place. Flip the switch and the
 * figures, the unit and the aim line follow with no change here.
 */
import { createContext, useContext } from 'react'
import Tooltip from '../components/Tooltip'
import { computeOptionScale, isFiniteNumber } from '../components/results/shared/OptionRangeBar'
import { goalBandIsInUserUnits } from '../components/results/analysisNew/goalBandUnits'
import { outcomeValuesAreModelScale } from '../components/results/outcomeValuesAreModelScale'
import { formatDownsideValue } from '../components/results/utils/formatDownsideValue'
import { ANALYSIS_NEW_COPY } from '../components/results/analysisNew/analysisNewCopy'
import type { DecisionResultData } from '../components/results/types'
import { typography } from '../styles/typography'
import { NODE_TOOLTIP_DELAY_MS } from '../canvas/nodes/shared/nodeTooltip'

export interface V10OptionBandModel {
  /** Percent positions on the shared axis, 0 to 100. */
  readonly leftPct: number
  readonly widthPct: number
  readonly medianPct: number | null
  readonly aimPct: number | null
  /** Left and right end labels: figures in the person's unit, or "Lower" and "Higher" while the band is a model level. */
  readonly lowLabel: string
  readonly highLabel: string
  readonly sentence: string
}

export type V10OptionBandOf = (optionId: string) => V10OptionBandModel | null

const pct = (value: number, min: number, span: number): number => Math.min(100, Math.max(0, ((value - min) / span) * 100))

/** One shared axis for every option, from the rows the Analysis tab draws; `null` when no option has a full range. */
export function buildV10OptionBands(
  rec: Pick<DecisionResultData, 'allOptions' | 'outcomeUnit' | 'outcomeUnitSymbol' | 'isNormalised' | 'goalThreshold'>,
): V10OptionBandOf {
  const options = rec.allOptions ?? []
  const base = computeOptionScale(options)
  if (base === null) return () => null
  const rangeEnds = options.flatMap((o) => (isFiniteNumber(o.outcome?.p10) && isFiniteNumber(o.outcome?.p90) ? [o.outcome.p10, o.outcome.p90] : []))
  const inUserUnits = goalBandIsInUserUnits() && rec.isNormalised !== true && !outcomeValuesAreModelScale(rangeEnds)
  const aim = inUserUnits && isFiniteNumber(rec.goalThreshold) ? rec.goalThreshold : null
  // An aim beyond every range still has to be seen (every option falls short of it), so the shared axis reaches it.
  const min = aim === null ? base.globalMin : Math.min(base.globalMin, aim)
  const max = aim === null ? base.globalMax : Math.max(base.globalMax, aim)
  const span = max - min
  if (!(span > 0)) return () => null
  const unit = { unit: rec.outcomeUnit, unitSymbol: rec.outcomeUnitSymbol, isNormalised: rec.isNormalised }
  return (optionId) => {
    const o = options.find((x) => x.id === optionId)
    const p10 = o?.outcome?.p10
    const p90 = o?.outcome?.p90
    if (!isFiniteNumber(p10) || !isFiniteNumber(p90)) return null
    const p50 = o?.outcome?.p50
    const low = inUserUnits ? formatDownsideValue(p10, unit) : ANALYSIS_NEW_COPY.optionFigures.axisLower
    const high = inUserUnits ? formatDownsideValue(p90, unit) : ANALYSIS_NEW_COPY.optionFigures.axisHigher
    return {
      leftPct: pct(p10, min, span),
      widthPct: Math.max(2, pct(p90, min, span) - pct(p10, min, span)),
      // The median, or nothing: never a mean standing in for it (OptionRangeBar's rule).
      medianPct: isFiniteNumber(p50) ? pct(p50, min, span) : null,
      aimPct: aim === null ? null : pct(aim, min, span),
      lowLabel: low,
      highLabel: high,
      sentence: inUserUnits
        ? `8 runs in 10 land between ${low} and ${high}, in this model.`
        : '8 runs in 10 land inside this range, in this model.',
    }
  }
}

/** The canvas's band reader; the empty value draws nothing, so a mount outside #/canvas2 is unchanged. */
export const V10OptionBandContext = createContext<V10OptionBandOf>(() => null)

export function V10OptionBand({ optionId }: { optionId: string }) {
  const band = useContext(V10OptionBandContext)(optionId)
  if (band === null) return null
  return (
    <Tooltip asChild content={band.sentence} delay={NODE_TOOLTIP_DELAY_MS}>
      <div
        data-testid={`v10-option-band-${optionId}`}
        data-node-tooltip="true"
        role="img"
        tabIndex={0}
        aria-label={band.sentence}
        className="mt-1 min-w-0"
      >
        <div className="relative" style={{ height: 6, background: 'var(--factor-light)', borderRadius: 3 }}>
          <div
            data-testid={`v10-option-band-range-${optionId}`}
            className="absolute top-0 h-full"
            style={{ left: `${band.leftPct}%`, width: `${band.widthPct}%`, background: 'var(--option)', borderRadius: 3 }}
          />
          {band.aimPct !== null && (
            <div
              data-testid={`v10-option-band-aim-${optionId}`}
              className="absolute"
              style={{ left: `${band.aimPct}%`, top: -3, bottom: -3, width: 2, marginLeft: -1, background: 'var(--goal)' }}
            />
          )}
          {band.medianPct !== null && (
            <div
              data-testid={`v10-option-band-median-${optionId}`}
              className="absolute"
              style={{ left: `${band.medianPct}%`, top: -1, bottom: -1, width: 2, marginLeft: -1, background: 'var(--text-header)', borderRadius: 1 }}
            />
          )}
        </div>
        <div className={`flex justify-between ${typography.edgeLabel} text-text-light`} aria-hidden="true">
          <span data-testid={`v10-option-band-low-${optionId}`}>{band.lowLabel}</span>
          <span data-testid={`v10-option-band-high-${optionId}`}>{band.highLabel}</span>
        </div>
      </div>
    </Tooltip>
  )
}
