/**
 * ⭐ THE TURNING-POINT MINI-VISUAL (locked spec §3 "Primary mini-visual
 * precedence", item 1; ED 11:52Z: "turning-point mini-visual only when
 * authoritative PLoT evidence exists").
 *
 *   Below 6.5%, the current model comparison changes.
 *   ──◆──────────────●──   (full width; ◆ Info blue, filled; ● 7px, dark)
 *                 8% in this run
 *
 * ⭐ Paul 23 Sep contract feedback point 3 replaced the bare `Turning point`
 * caption, which named the concept but not its meaning:
 *   (a) the DIRECTION is said in words ("Below 6.5%" / "Above 12 seats");
 *   (b) the OPTION SCOPE is said when the producer names the option
 *       ("… shifts towards Two Developers" — the register's withheld form);
 *   (c) the track's DOMAIN is stated. A PLoT row carries no search bounds, so
 *       the track marks the turning point and the run's own value in order of
 *       value (low → high, left → right) at fixed places, and the spoken/hover
 *       sentence says it is not to scale. ONLY a row that states its display
 *       range (`turningPointDomainOf`) is drawn to scale, with both ends of
 *       that range labelled beneath (contract `flipPlot`: `6%` · `8% now` ·
 *       `10%`) — see `turningPointCopy.ts`;
 *   (d) "no turning point" is a first-class, quiet fallback
 *       (`FactorTurningPointNone`), mounted through `FactorTurningPointSlot` —
 *       and, since NODE-ANATOMY v3.2, only under a RANKED factor's driver line
 *       (the caller gates it: "Nothing is shown just to say that nothing
 *       exists"). A found turning point still shows on any factor.
 *
 * ⭐ AT REST (`atRest`; contract v3.1 `flipPlot`, post-run DIFF item 10,
 * 28 Sep 2026) the caption is the direction sentence in the card's own unit
 * notation (`Below £700`, never `Below 700 GBP MRR added per month`) and
 * WITHOUT the option scope, so it keeps to two lines; the scope the producer
 * named follows in the accessible name and the tooltip (v3.1 point 3: "on the
 * card or one click away"). The track is full width with its labels beneath.
 * Popover and Detailed keep the scope in the visible sentence.
 *
 * ⚠ THE DIAMOND IS INFO BLUE, FILLED — the contract's own `flipPlot`
 * (`fill="#277A9D"`), the brief's item 10. It was a hollow body-ink diamond on
 * a reading of point 9 ("Info is attention's"); v3.1's fixture, drawn after
 * point 9, fills the threshold mark with Info, and shape (diamond vs dot)
 * still tells the two marks apart.
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
import { formatFlipFigure, formatFlipReading } from '../../../components/results/utils/flipThresholdDisplay'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { openNodeInspector } from './openNodeInspector'
import type { FactorTurningPoint } from './nodeAttention'
import { turningPointNumberPrints, type FactorTurningPointState, type TurningPointDomain } from './factorTurningPoint'
import { TURNING_POINT_TRACK_COPY, turningPointSide } from './turningPointCopy'

/** Not to scale: the two marks sit at fixed places, in order of value. */
const NEAR_PCT = 20
const FAR_PCT = 80

/**
 * The track's marks and type, counter-scaled like the text beside them so they
 * keep the contract's on-screen size at every zoom (`flipPlot`: a 2px line, a
 * 10px-wide diamond — a 7px square turned 45° — and a 7px dot; labels at 10px).
 */
const TRACK_LINE_CLASS = 'h-[calc(2px*var(--canvas-label-scale,1))]'
const TRACK_ROW_CLASS = 'h-[calc(10px*var(--canvas-label-scale,1))] px-[calc(5px*var(--canvas-label-scale,1))]'
const TRACK_MARK_CLASS = 'w-[calc(7px*var(--canvas-label-scale,1))] h-[calc(7px*var(--canvas-label-scale,1))]'
const TRACK_LABEL_CLASS = 'text-[length:calc(10px*var(--canvas-label-scale,1))] font-sans leading-snug text-text-light tabular-nums'

/** Where a value sits along a stated domain, 0–100. */
const pctIn = (v: number, min: number, max: number): number => ((v - min) / (max - min)) * 100

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
  turningPoint: FactorTurningPoint & { alternativeLabel?: string | null; domain?: TurningPointDomain | null }
  /** The model is KNOWN to have changed since the run (`useModelChangedSinceRun`). */
  fromLastRun?: boolean
  /**
   * The factor's own unit (`observed_state.unit`). When supplied, the number and
   * the track print only if the row's unit is compatible with it. Omitted →
   * the display-scale gate alone applies.
   */
  factorUnit?: string | null
  /**
   * ⭐ THE RESTING CARD'S FORM (contract v3.1 `flipPlot`): the caption is the
   * direction sentence WITHOUT the option scope — "Below 6.5%, the current
   * model comparison changes." — so it keeps to two lines, and the scope the
   * producer named follows it in the accessible name and the tooltip. The
   * number is not repeated on the track. Popover and Detailed keep the scope
   * in the visible sentence and label the number on the track.
   */
  atRest?: boolean
}) {
  // v3.1 point 3: the direction in words, from the producer's two values only;
  // `at` (neutral) when they cannot establish one. The track still draws a
  // lower flip value first.
  const side = turningPointSide(turningPoint.flipValue, turningPoint.currentValue)
  const falls = side === 'below'
  const numeric = turningPointNumberPrints(turningPoint, factorUnit)
  const unit = turningPoint.unit
  const alternative = turningPoint.alternativeLabel ?? null
  // ⭐ THE CARD'S NOTATION (DIFF item 10): `£700`, not `700 GBP MRR added per
  // month`. The figure is what the visible marks print; the reading keeps the
  // compound's words and is what the spoken name says.
  const flipFigure = numeric ? formatFlipFigure(turningPoint.flipValue, unit) : null
  const runFigure = numeric ? formatFlipFigure(turningPoint.currentValue, unit) : null
  const flipReading = numeric ? formatFlipReading(turningPoint.flipValue, unit) : null
  const runReading = numeric ? formatFlipReading(turningPoint.currentValue, unit) : null
  // At rest the scope moves off the caption (two lines), into the name and tip.
  const scopeSpoken = atRest && alternative !== null
  const sentence = TURNING_POINT_TRACK_COPY.sentence({
    side,
    value: flipFigure,
    alternative: scopeSpoken ? null : alternative,
    fromLastRun,
  })
  const scope = scopeSpoken ? TURNING_POINT_TRACK_COPY.scope(alternative!, fromLastRun) : null
  // ⭐ TO SCALE ONLY WHEN THE WIRE GAVE THE DOMAIN (`turningPointDomainOf`).
  const domain = numeric ? turningPoint.domain ?? null : null
  const detail =
    flipReading !== null && runReading !== null
      ? domain !== null
        ? TURNING_POINT_TRACK_COPY.scaledDomain(
            formatFlipFigure(domain.min, unit),
            formatFlipFigure(domain.max, unit),
            flipReading,
            TURNING_POINT_TRACK_COPY.runValue(runReading, fromLastRun),
          )
        : TURNING_POINT_TRACK_COPY.domain(flipReading, TURNING_POINT_TRACK_COPY.runValue(runReading, fromLastRun))
      : turningPoint.displayScale
        ? TURNING_POINT_TRACK_COPY.unitMismatch
        : TURNING_POINT_TRACK_COPY.internalScale
  // At rest, only where its number prints: the caption IS the direction
  // sentence, whose number the track then does not print a second time.
  const compact = atRest && flipFigure !== null && runFigure !== null
  // Label in Name (WCAG 2.5.3): the visible sentence opens the spoken name; the
  // scope (at rest) and the domain follow.
  const name = [sentence, scope, detail].filter(Boolean).join(' ')
  const tip = scope !== null ? `${scope} ${detail}` : detail
  // Low → high, left → right: a flip below the run's value is drawn first. To
  // scale, each mark sits at its own value along the stated domain.
  const flipAtPct = domain !== null ? pctIn(turningPoint.flipValue, domain.min, domain.max) : falls ? NEAR_PCT : FAR_PCT
  const currentAtPct = domain !== null ? pctIn(turningPoint.currentValue, domain.min, domain.max) : falls ? FAR_PCT : NEAR_PCT

  const runLabel = runFigure !== null && (
    <span data-testid="factor-turning-point-run-value">{TURNING_POINT_TRACK_COPY.runValue(runFigure, fromLastRun)}</span>
  )
  // At rest the number is in the caption, so the track does not print it again.
  const flipLabel = flipFigure !== null && !compact && (
    <span data-testid="factor-turning-point-value" className="text-text-body">{flipFigure}</span>
  )

  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={tip}>
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
        {/* Contract v3.1 `.plot-caption b` (point 3): the direction sentence,
            the card's strongest analysis line (weight 500, hover underline). */}
        <span
          data-testid="factor-turning-point-caption"
          className={`${typography.edgeLabel} min-w-0 font-medium text-text-body underline-offset-[3px] group-hover:underline`}
        >
          {sentence}
        </span>
        {flipFigure !== null && runFigure !== null && (
          // ⭐ contract v3.1 `flipPlot`: a FULL-WIDTH 2px line, a filled
          // Info-blue diamond at the turning point, a 7px dark dot at the run's
          // value, and the labels BENEATH it. `data-scale` says which form: to
          // scale only when the wire stated the domain (then its two ends are
          // labelled), else the not-to-scale order the name and tip declare.
          <span
            data-testid="factor-turning-point-plot"
            data-scale={domain !== null ? 'domain' : 'not-to-scale'}
            className="flex w-full flex-col"
            aria-hidden="true"
          >
            <span className={`relative flex w-full items-center ${TRACK_ROW_CLASS}`}>
              <span data-testid="factor-turning-point-track" className={`relative block w-full rounded-full bg-border-emphasis ${TRACK_LINE_CLASS}`}>
                <span
                  data-testid="factor-turning-point-current"
                  className={`absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-body ${TRACK_MARK_CLASS}`}
                  style={{ left: `${currentAtPct}%` }}
                />
                <span
                  data-testid="factor-turning-point-flip"
                  className={`absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rotate-45 bg-info ${TRACK_MARK_CLASS}`}
                  style={{ left: `${flipAtPct}%` }}
                />
              </span>
            </span>
            {domain !== null ? (
              <span className={`flex w-full items-baseline justify-between gap-1.5 ${TRACK_LABEL_CLASS}`}>
                <span data-testid="factor-turning-point-domain-min">{formatFlipFigure(domain.min, unit)}</span>
                {runLabel}
                <span data-testid="factor-turning-point-domain-max">{formatFlipFigure(domain.max, unit)}</span>
              </span>
            ) : (
              // The run's label under the dot's end of the line; the turning
              // point's (off the resting card) under the diamond's.
              <span className={`flex w-full items-baseline gap-1.5 ${flipLabel ? 'justify-between' : falls ? 'justify-end' : 'justify-start'} ${TRACK_LABEL_CLASS}`}>
                {falls ? flipLabel : runLabel}
                {falls ? runLabel : flipLabel}
              </span>
            )}
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
