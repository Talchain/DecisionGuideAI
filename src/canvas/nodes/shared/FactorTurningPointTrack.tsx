/**
 * ⭐ THE TURNING-POINT MINI-VISUAL (locked spec §3 "Primary mini-visual
 * precedence", item 1; ED 11:52Z: "turning-point mini-visual only when
 * authoritative PLoT evidence exists").
 *
 *   `Turning point  ●────◆  6.5%`
 *
 * The current value and the flip value on a small track; direction only — the
 * two marks sit at fixed positions, so the geometry claims no precision the row
 * does not carry. The number prints ONLY when the producer stamped the row on
 * the display scale (`factorTurningPoint.ts`); otherwise the tooltip says the
 * point is on the model's internal scale and no number is shown.
 *
 * Click → the element's existing inspector (spec §9: "driver / turning-point
 * mini visual → existing analysis/impact section").
 *
 * ⛔ The caller shows it only while the analysis is CURRENT (spec §8).
 */
import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import { formatFlipValue } from '../../../components/results/utils/flipThresholdDisplay'
import { TURNING_POINT_COPY } from './metricVocabulary'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { openNodeInspector } from './openNodeInspector'
import { turningPointSentence, type FactorTurningPoint } from './nodeAttention'

const NEAR_PCT = 20
const FAR_PCT = 80

export function turningPointExplanation(factorLabel: string, tp: FactorTurningPoint): string {
  const sentence = turningPointSentence(factorLabel, tp)
  return tp.displayScale ? sentence : `${sentence} ${TURNING_POINT_COPY.internalScale}`
}

export function FactorTurningPointTrack({
  nodeId,
  factorLabel,
  turningPoint,
}: {
  nodeId: string
  factorLabel: string
  turningPoint: FactorTurningPoint
}) {
  const explanation = turningPointExplanation(factorLabel, turningPoint)
  const rises = turningPoint.flipValue > turningPoint.currentValue
  const currentAtPct = rises ? NEAR_PCT : FAR_PCT
  const flipAtPct = rises ? FAR_PCT : NEAR_PCT
  const value = turningPoint.displayScale ? formatFlipValue(turningPoint.flipValue, turningPoint.unit) : null
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={explanation}>
      <button
        type="button"
        data-testid="factor-turning-point"
        data-node-tooltip="true"
        aria-label={`${TURNING_POINT_COPY.caption}. ${explanation}`}
        className="nodrag nopan mt-1 flex w-full items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded"
        onClick={(e) => {
          e.stopPropagation()
          openNodeInspector(nodeId)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <span className={`${typography.edgeLabel} min-w-0 text-text-body`}>{TURNING_POINT_COPY.caption}</span>
        <span className="inline-flex items-center gap-1.5 shrink-0" aria-hidden="true">
          <span className="relative block h-1 w-[54px] rounded-full bg-panel-border">
            <span
              data-testid="factor-turning-point-current"
              className="absolute top-1/2 block h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-body"
              style={{ left: `${currentAtPct}%` }}
            />
            <span
              data-testid="factor-turning-point-flip"
              className="absolute top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-info bg-panel"
              style={{ left: `${flipAtPct}%` }}
            />
          </span>
          {value !== null && (
            <span data-testid="factor-turning-point-value" className={`${typography.edgeLabel} text-text-body tabular-nums`}>
              {value}
            </span>
          )}
        </span>
      </button>
    </Tooltip>
  )
}
