/**
 * ⭐ THE TURNING-POINT MINI-VISUAL (locked spec §3 "Primary mini-visual
 * precedence", item 1; ED 11:52Z: "turning-point mini-visual only when
 * authoritative PLoT evidence exists").
 *
 *   Below 6.5%, the current model comparison changes.
 *   6.5%  ◆────●  8% in this run
 *
 * ⭐ Paul 23 Sep contract feedback point 3 replaced the bare `Turning point`
 * caption, which named the concept but not its meaning:
 *   (a) the DIRECTION is said in words ("Below 6.5%" / "Above 12 seats");
 *   (b) the OPTION SCOPE is said when the producer names the option
 *       ("… shifts towards Two Developers" — the register's withheld form);
 *   (c) the track's DOMAIN is stated: it marks the turning point and the run's
 *       own value, in order of value (low → high, left → right), both ends
 *       labelled; spacing is fixed and the spoken/hover sentence says it is not
 *       to scale. A PLoT row carries no search bounds, so no "modelled range"
 *       is claimed (see `turningPointCopy.ts`);
 *   (d) "no turning point" is a first-class, quiet fallback
 *       (`FactorTurningPointNone`), mounted through `FactorTurningPointSlot` —
 *       and, since NODE-ANATOMY v3.2, only under a RANKED factor's driver line
 *       (the caller gates it: "Nothing is shown just to say that nothing
 *       exists"). A found turning point still shows on any factor.
 *
 * ⭐ AT REST (`atRest`; prototype `flipPlot`, Paul 25 Sep 2026) the visible
 * caption is the prototype's `Model comparison changes  6.5%` on ONE line, and
 * the sentence above moves into the accessible name and the tooltip — the
 * 49-character sentence on the resting card broke the ~4-body-line limit.
 * Popover and Detailed keep the full form.
 *
 * ⛔ The number prints ONLY on the display scale (`factorTurningPoint.ts`,
 * ROADMAP 2.1371) AND only when the row's unit is compatible with the factor's
 * (`turningPointUnitsCompatible`). Otherwise the sentence keeps its direction,
 * loses its number, and the track withholds — a track with no numbers has no
 * domain to state.
 *
 * Click → the element's existing inspector (spec §9: "driver / turning-point
 * mini visual → existing analysis/impact section").
 *
 * ⛔ The caller shows it while the analysis is CURRENT, or — labelled
 * `Last run · ` through `fromLastRun` — while the model is KNOWN to have changed
 * since the run (design integration, 23 Sep 2026: #1891's rule, Paul's Ruling 3;
 * visual contract v3 "Last run · turning point"). Never-run and cannot-confirm
 * show nothing — not the track, and not the fallback either: neither may invent
 * a past analysis.
 */
import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import { formatFlipValue } from '../../../components/results/utils/flipThresholdDisplay'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { openNodeInspector } from './openNodeInspector'
import type { FactorTurningPoint } from './nodeAttention'
import { turningPointNumberPrints, type FactorTurningPointState } from './factorTurningPoint'
import { TURNING_POINT_TRACK_COPY, turningPointSide } from './turningPointCopy'

const NEAR_PCT = 20
const FAR_PCT = 80

export function FactorTurningPointTrack({
  nodeId,
  factorLabel: _factorLabel,
  turningPoint,
  fromLastRun = false,
  factorUnit,
  atRest = false,
}: {
  nodeId: string
  factorLabel: string
  turningPoint: FactorTurningPoint & { alternativeLabel?: string | null }
  /** The model is KNOWN to have changed since the run (`useModelChangedSinceRun`). */
  fromLastRun?: boolean
  /**
   * The factor's own unit (`observed_state.unit`). When supplied, the number and
   * the track print only if the row's unit is compatible with it. Omitted →
   * the display-scale gate alone applies.
   */
  factorUnit?: string | null
  /**
   * ⭐ THE RESTING CARD'S FORM (prototype `flipPlot`, Paul 25 Sep 2026): the
   * caption is `Model comparison changes` with the number beside it on ONE
   * line, and the number is not repeated on the track. The direction sentence
   * follows it in the accessible name and opens the tooltip. Only when the number
   * prints — otherwise the full sentence is kept (never a bare caption).
   */
  atRest?: boolean
}) {
  // v3.1 point 3: the direction in words, from the producer's two values only;
  // `at` (neutral) when they cannot establish one. The track still draws a
  // lower flip value first.
  const side = turningPointSide(turningPoint.flipValue, turningPoint.currentValue)
  const falls = side === 'below'
  const numeric = turningPointNumberPrints(turningPoint, factorUnit)
  const flipText = numeric ? formatFlipValue(turningPoint.flipValue, turningPoint.unit) : null
  const runText = numeric
    ? TURNING_POINT_TRACK_COPY.runValue(formatFlipValue(turningPoint.currentValue, turningPoint.unit), fromLastRun)
    : null
  const sentence = TURNING_POINT_TRACK_COPY.sentence({
    side,
    value: flipText,
    alternative: turningPoint.alternativeLabel ?? null,
    fromLastRun,
  })
  const detail =
    flipText !== null && runText !== null
      ? TURNING_POINT_TRACK_COPY.domain(flipText, runText)
      : turningPoint.displayScale
        ? TURNING_POINT_TRACK_COPY.unitMismatch
        : TURNING_POINT_TRACK_COPY.internalScale
  // At rest, only where its number prints: the v3.1 caption IS the direction
  // sentence ("Below 6.5%, the current model comparison changes."), whose
  // number the track then does not print a second time.
  const compact = atRest && flipText !== null && runText !== null
  // Label in Name (WCAG 2.5.3): the visible sentence opens the spoken name; the
  // domain follows.
  const name = `${sentence} ${detail}`
  // Low → high, left → right: a flip below the run's value is drawn first.
  const flipAtPct = falls ? NEAR_PCT : FAR_PCT
  const currentAtPct = falls ? FAR_PCT : NEAR_PCT

  // At rest the number is in the caption, so the track does not print it again.
  const flipLabel = flipText !== null && !compact && (
    <span data-testid="factor-turning-point-value" className={`${typography.edgeLabel} text-text-body tabular-nums`}>
      {flipText}
    </span>
  )
  const runLabel = runText !== null && (
    <span data-testid="factor-turning-point-run-value" className={`${typography.edgeLabel} text-text-light tabular-nums`}>
      {runText}
    </span>
  )

  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={detail}>
      <button
        type="button"
        data-testid="factor-turning-point"
        data-node-tooltip="true"
        aria-label={name}
        className="group nodrag nopan mt-1 flex w-full flex-col items-start gap-0.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded"
        onClick={(e) => {
          e.stopPropagation()
          openNodeInspector(nodeId)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* The finding is the card's strongest analysis line (contract
            `.plot-caption b{font-weight:500}`, hover underline), heavier than
            the regular-weight rank above it — the served card had it reversed. */}
        {/* Contract v3.1 `.plot-caption b` (point 3): the direction sentence,
            the card's strongest analysis line, at rest and in Detailed alike —
            one sentence, no floated number beside it. */}
        <span
          data-testid="factor-turning-point-caption"
          className={`${typography.edgeLabel} min-w-0 font-medium text-text-body underline-offset-[3px] group-hover:underline`}
        >
          {sentence}
        </span>
        {flipText !== null && runText !== null && (
          // The track spans the card between its two labels (contract
          // `.mini-plot svg{width:100%}`), not a fixed 54px squeezed between
          // them; the spacing is already declared "not to scale".
          <span className="flex w-full items-center gap-1.5" aria-hidden="true">
            {falls ? flipLabel : runLabel}
            <span data-testid="factor-turning-point-track" className="relative block h-1 min-w-[54px] flex-1 rounded-full bg-panel-border">
              <span
                data-testid="factor-turning-point-current"
                className="absolute top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-body"
                style={{ left: `${currentAtPct}%` }}
              />
              {/* Hollow diamond in body ink, not Info blue — Paul 23 Sep contract
                  feedback point 9 reserves Info for attention; shape (hollow
                  diamond vs solid dot) carries the distinction. */}
              <span
                data-testid="factor-turning-point-flip"
                className="absolute top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-text-body bg-panel"
                style={{ left: `${flipAtPct}%` }}
              />
            </span>
            {falls ? runLabel : flipLabel}
          </span>
        )}
      </button>
    </Tooltip>
  )
}

/**
 * ⭐ THE FIRST-CLASS FALLBACK (Paul 23 Sep contract feedback point 3: "make 'no
 * turning point available' the normal fallback, not an edge case"). Quiet — the
 * design-system muted token (`text-text-light`, pinned ≥ 4.5:1 by
 * `text-light-contrast.spec.ts`), no icon, no warning styling. Its words differ
 * by what the run ESTABLISHED: an attested search says "in this run"; anything
 * else says "available", so a probe that established nothing never reads as an
 * absence. The explanation is spoken (sr-only), not hidden behind a hover.
 */
export function FactorTurningPointNone({
  nodeId,
  attested,
  fromLastRun = false,
}: {
  nodeId: string
  attested: boolean
  fromLastRun?: boolean
}) {
  const copy = TURNING_POINT_TRACK_COPY.none
  const explanation = attested ? copy.attestedExplanation : copy.unavailableExplanation
  // Audit F10: focusable, with its meaning on hover AND focus, like the driver
  // line and the track — it was the one analysis cue on the card a sighted
  // keyboard user could not reach. The sr-only sentence is kept for AT.
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={explanation}>
      <p
        data-testid="factor-turning-point-none"
        data-node-id={nodeId}
        data-attested={attested ? 'true' : 'false'}
        data-node-tooltip="true"
        tabIndex={0}
        className={`${typography.edgeLabel} mt-1 self-start text-text-light rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      >
        {attested ? copy.attested(fromLastRun) : copy.unavailable(fromLastRun)}
        <span className="sr-only">. {explanation}</span>
      </p>
    </Tooltip>
  )
}

/** One slot, exactly one of the two: the track for a found row, else the fallback. */
export function FactorTurningPointSlot({
  nodeId,
  factorLabel,
  state,
  fromLastRun = false,
  factorUnit,
  atRest = false,
}: {
  nodeId: string
  factorLabel: string
  state: FactorTurningPointState
  fromLastRun?: boolean
  factorUnit?: string | null
  /** The resting card's one-line caption form (see `FactorTurningPointTrack`). */
  atRest?: boolean
}) {
  return state.kind === 'found' ? (
    <FactorTurningPointTrack
      nodeId={nodeId}
      factorLabel={factorLabel}
      turningPoint={state.turningPoint}
      fromLastRun={fromLastRun}
      factorUnit={factorUnit}
      atRest={atRest}
    />
  ) : (
    <FactorTurningPointNone nodeId={nodeId} attested={state.attested} fromLastRun={fromLastRun} />
  )
}
