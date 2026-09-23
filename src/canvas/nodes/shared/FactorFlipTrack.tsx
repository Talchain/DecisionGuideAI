import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import {
  FLIP_THRESHOLD_COPY,
  flipDirectionWording,
  formatFlipValue,
} from '../../../components/results/utils/flipThresholdDisplay'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { LAST_RUN_PREFIX } from './metricVocabulary'
import { openNodeInspector } from './openNodeInspector'
import type { FactorTurningPoint } from './factorTurningPoint'

/**
 * ⭐⭐ THE TURNING POINT, AS ONE MINI-VISUAL ON THE FACTOR CARD.
 *
 * Locked Experience Design, D1a (Paul-approved 23 Sep 2026): a factor card
 * carries at most ONE mini-visual, and a REAL turning point comes first. The
 * row is admitted by `factorTurningPoint.ts` (UI-SEM-097) — this component only
 * draws it.
 *
 * ⚠ NO PSEUDO-PRECISION IN THE GEOMETRY (UI-SEM-097, the drawing half). The two
 * markers sit at fixed positions, ordered by the producer's two numbers: the
 * flip point on the side the factor would have to move towards. Position
 * encodes DIRECTION ONLY, never distance — the track has no axis, and a
 * two-point "scale" would state a proportion nobody computed. The only number
 * printed is the flip value, through the ONE shared formatter
 * (`formatFlipValue`) the hero and the V7 chip already use, so one threshold
 * cannot render two ways.
 *
 * ⚠ THE SENTENCE IS THE REGISTER'S, in its withheld-designation form
 * ("the comparison shifts towards X" / "is likely to change"). That form names
 * no winner, which is what the canvas's no-contest ruling requires
 * (`noContestFraming.canvas.spec.ts`, Paul 7 Sep: "There's never a winner").
 *
 * A stale run is labelled, never withheld (Ruling 3, ROADMAP 2.651), off the
 * same `useModelChangedSinceRun()` the driver line reads.
 *
 * Click opens the EXISTING factor inspector (`openNodeInspector`), the card's
 * own "View parameters" action — no new panel.
 */

export const TURNING_POINT_CAPTION = 'Turning point'

/** Marker positions, as a percentage of the track. Order only — see header. */
const NEAR = 20
const FAR = 80

export interface FactorFlipTrackProps {
  nodeId: string
  /** The card's own cleaned label — the factor the sentence is about. */
  factorLabel: string
  turningPoint: FactorTurningPoint
  /** `useModelChangedSinceRun()` — opens the caption with `LAST_RUN_PREFIX`. */
  fromLastRun: boolean
}

export function FactorFlipTrack({ nodeId, factorLabel, turningPoint, fromLastRun }: FactorFlipTrackProps) {
  const { currentValue, flipValue, unit, alternativeLabel } = turningPoint
  const value = formatFlipValue(flipValue, unit)
  const direction = flipDirectionWording(currentValue, flipValue)
  const subject = factorLabel.trim() || 'this factor'
  const sentence = alternativeLabel
    ? FLIP_THRESHOLD_COPY.flipRiskWithAlternative(subject, direction, value, alternativeLabel, true)
    : FLIP_THRESHOLD_COPY.flipRiskNoAlternative(subject, direction, value, true)
  const caption = `${fromLastRun ? LAST_RUN_PREFIX : ''}${TURNING_POINT_CAPTION}`
  const rises = flipValue > currentValue
  const currentAt = rises ? NEAR : FAR
  const flipAt = rises ? FAR : NEAR

  return (
    <Tooltip asChild content={sentence} delay={NODE_TOOLTIP_DELAY_MS}>
      <button
        type="button"
        data-testid="factor-flip-track"
        className="mt-1 flex items-center gap-1.5 text-left nodrag nopan focus-visible:outline focus-visible:outline-info"
        /* Label in Name: the visible caption and value open the spoken sentence. */
        aria-label={`${caption} ${value}. ${sentence}`}
        onClick={e => {
          e.stopPropagation()
          openNodeInspector(nodeId)
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        <span className={`${typography.edgeLabel} min-w-0 text-text-light`} aria-hidden="true">
          {caption}
        </span>
        <span className="relative h-1 w-[54px] shrink-0 rounded-full bg-panel-border" aria-hidden="true">
          <span
            data-testid="factor-flip-track-current"
            className="absolute top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-light"
            style={{ left: `${currentAt}%` }}
          />
          <span
            data-testid="factor-flip-track-flip"
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warning"
            style={{ left: `${flipAt}%` }}
          />
        </span>
        <span className={`${typography.edgeLabel} shrink-0 text-text-body`} aria-hidden="true">
          {value}
        </span>
      </button>
    </Tooltip>
  )
}
