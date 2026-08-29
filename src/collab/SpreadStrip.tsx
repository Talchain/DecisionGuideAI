/**
 * COLLAB — WHERE THE ANSWERS SIT, DRAWN.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * Everything this draws was already on the wire and none of it was drawn.
 * `spread.low`, `spread.high` and `spread.width` arrived and rendered as one
 * sentence; `spread.width` rendered nowhere at all; and each position's `pole`
 * was written into a `data-pole` attribute that drove nothing visual. A team
 * looking at their own disagreement got a `<ul>`.
 *
 * The strip states the same facts spatially: how far apart the team actually
 * is, who is at each end, and where the model's own number falls among them.
 * That last comparison is the one a facilitator wants and the one no list can
 * make — *the model says 0.35, your team says 0.18 to 0.62*.
 *
 * ── WHAT IT IS NOT ALLOWED TO BE ──────────────────────────────────────────
 * ⚠ NO AGGREGATE MARK, EVER. No mean line, no midpoint tick, no shaded
 * "consensus band", no box plot, no density curve. Every one of those puts a
 * number or a region on screen that nobody in the room said, which is the
 * averaging failure the whole feature exists to prevent — and a drawn average
 * is more persuasive than a written one, so the rule is stricter here, not
 * looser. The ONLY marks are: the two endpoints (both real answers), one dot
 * per person at their own number, and the model's own value, labelled as the
 * model's.
 *
 * ⚠ AND NO RANKING. Dots are laid out by VALUE, which is a position on a
 * scale, not an order of merit. The rows below the axis are ordered by value
 * for legibility only; a lone dissenter is drawn exactly like anyone else, at
 * the same size, in the same colour.
 *
 * ── THE AXIS DOMAIN IS A DISPLAY DEVICE AND SAYS SO ───────────────────────
 * `spread` is the range of the ANSWERS. The model's value can fall outside it
 * — that is a perfectly ordinary and quite interesting state — so the drawn
 * axis is widened to contain it. The widened ends are therefore NOT claimed as
 * answers: only the two endpoint ticks carry value labels, and they carry
 * `spread.low` / `spread.high`, never the drawn extent.
 *
 * ── MOTION AND COLOUR ─────────────────────────────────────────────────────
 * There is no animation and no transition anywhere in this file, so
 * `prefers-reduced-motion` is satisfied by construction rather than by a media
 * query that has to be kept true. Every stroke and fill is `currentColor`
 * under a design-system token class, so the strip is theme-aware for free and
 * carries no hex literal for the DS gate to catch.
 */

import { typography } from '../styles/typography'
import type { DisagreementPosition } from './collabService'
import { formatPanelValue } from './formatPanelValue'

/** Geometry. One row per person below the axis — labels can never collide. */
const VIEW_W = 640
const PAD_X = 64
const MODEL_BAND = 34
const AXIS_H = 30
const END_LABEL_H = 22
const ROW_H = 26
const PAD_BOTTOM = 8
const DOT_R = 5.5

export interface SpreadStripProps {
  targetId: string
  spread: { low: number; high: number; width: number }
  positions: DisagreementPosition[]
  /** The model's own number at the pinned version, when it has one. */
  modelValue: number | null
}

/**
 * ⚠ ONE FORMATTER FOR THE WHOLE SURFACE, DELEGATED — not a local variant.
 *
 * The strip sits directly above the list of positions, so a second formatting
 * rule here would put two different renderings of ONE person's answer a few
 * pixels apart ("0.85" on the dot, "85%" in their row). That is the
 * two-authorities-on-one-fact defect wearing a stylesheet, and it is worse in a
 * picture than in prose because the reader assumes the picture is derived.
 */
function short(value: number): string {
  return formatPanelValue(value)
}

/**
 * ⭐ THE ONE PIECE OF ARITHMETIC HERE, AND IT IS PURELY GEOMETRIC.
 * Maps a value onto an x pixel. It computes no statistic: a degenerate domain
 * (which the server does not currently produce — `spread` is non-null only for
 * `shape === 'split'`, where `low < high` — but which this component must not
 * divide by regardless) collapses to the centre rather than to `Infinity`.
 */
export function projectX(value: number, domainLow: number, domainHigh: number): number {
  const span = domainHigh - domainLow
  if (!Number.isFinite(span) || span <= 0) return VIEW_W / 2
  const t = (value - domainLow) / span
  return PAD_X + t * (VIEW_W - PAD_X * 2)
}

export function SpreadStrip({
  targetId,
  spread,
  positions,
  modelValue,
}: SpreadStripProps): JSX.Element | null {
  const answered = positions
    .filter((p): p is DisagreementPosition & { value: number } => typeof p.value === 'number')
    // By value, for legibility. NOT a ranking — see the header.
    .sort((a, b) => a.value - b.value)

  // Nothing to draw. A strip with no dots is a picture of a claim nobody made.
  if (answered.length === 0) return null

  const hasModel = typeof modelValue === 'number' && Number.isFinite(modelValue)
  // The DRAWN extent, widened to contain the model mark. Never labelled as an
  // answer — see the header.
  const domainLow = hasModel ? Math.min(spread.low, modelValue) : spread.low
  const domainHigh = hasModel ? Math.max(spread.high, modelValue) : spread.high

  const modelTop = hasModel ? MODEL_BAND : 0
  const axisY = modelTop + AXIS_H / 2
  const rowsTop = modelTop + AXIS_H + END_LABEL_H
  const height = rowsTop + answered.length * ROW_H + PAD_BOTTOM

  const x = (v: number): number => projectX(v, domainLow, domainHigh)

  /**
   * The text equivalent. Every datum the picture carries, in one sentence, so
   * a screen reader gets the comparison rather than "graphic".
   */
  const described = [
    `The answers run from ${short(spread.low)} to ${short(spread.high)}.`,
    ...answered.map((p) => `${p.display_label} ${short(p.value)}.`),
    hasModel ? `The model held ${short(modelValue)} when the round opened.` : '',
  ]
    .filter((s) => s !== '')
    .join(' ')

  return (
    /**
     * ⚠ THE SCROLL FLOOR, AND IT WAS FOUND IN A BROWSER, NOT IN jsdom.
     *
     * A `viewBox` scales its TEXT along with its geometry. At the card's
     * desktop width the 13-unit labels land at ~15px and read well; rendered in
     * a 552px-wide viewport they measured **~9px**, and on a phone they would
     * be smaller still — illegible exactly where a participant reads the
     * reveal. jsdom lays nothing out, so every test in this repo was green
     * about a picture nobody could read (trap 3).
     *
     * A larger `fontSize` cannot fix it: sized for a phone it is grotesque on a
     * projector, and vice versa. So the strip keeps a MINIMUM WIDTH and the
     * container scrolls — the labels stay legible at every viewport, and the
     * page itself never scrolls sideways.
     */
    <div className="mt-3 overflow-x-auto">
    <svg
      data-testid={`spread-strip-${targetId}`}
      role="img"
      aria-label={described}
      viewBox={`0 0 ${VIEW_W} ${height}`}
      // Grows with the card up to the projector, never shrinks below legible.
      className="block w-full min-w-[520px]"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* ── the model's own number, above the axis ─────────────────────────
          Drawn DIFFERENTLY from the people (dashed, hollow, and labelled
          "Model") because it is a different KIND of thing: nobody in the room
          said it. A mark that looked like a participant's dot would read as a
          silent extra panellist. */}
      {hasModel && (
        <g className="text-info" data-testid={`spread-strip-model-${targetId}`}>
          <line
            x1={x(modelValue)}
            y1={MODEL_BAND - 12}
            x2={x(modelValue)}
            y2={axisY}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <text
            x={x(modelValue)}
            y={MODEL_BAND - 17}
            textAnchor={
              x(modelValue) < VIEW_W * 0.2
                ? 'start'
                : x(modelValue) > VIEW_W * 0.8
                  ? 'end'
                  : 'middle'
            }
            fill="currentColor"
            fontSize={13}
          >
            Model {short(modelValue)}
          </text>
        </g>
      )}

      {/* ── the axis, and the two REAL endpoints ───────────────────────────
          The rule ends at the answers, not at the drawn extent: a rule that
          ran to a widened edge would imply somebody answered there. */}
      <g className="text-text-light">
        <line
          x1={x(spread.low)}
          y1={axisY}
          x2={x(spread.high)}
          y2={axisY}
          stroke="currentColor"
          strokeWidth={2}
        />
        {[spread.low, spread.high].map((end, i) => (
          <line
            key={`end-${i}`}
            x1={x(end)}
            y1={axisY - 7}
            x2={x(end)}
            y2={axisY + 7}
            stroke="currentColor"
            strokeWidth={2}
          />
        ))}
        <text
          x={x(spread.low)}
          y={axisY + AXIS_H / 2 + 10}
          textAnchor="start"
          fill="currentColor"
          fontSize={13}
        >
          {short(spread.low)}
        </text>
        <text
          x={x(spread.high)}
          y={axisY + AXIS_H / 2 + 10}
          textAnchor="end"
          fill="currentColor"
          fontSize={13}
        >
          {short(spread.high)}
        </text>
      </g>

      {/* ── one dot and one row per person ─────────────────────────────────
          The leader line is what makes a TIE readable: two people on the same
          number share a dot (they gave the same answer — drawing them apart
          would be a lie about the data) and are told apart by their rows. */}
      {answered.map((p, i) => {
        const px = x(p.value)
        const rowY = rowsTop + i * ROW_H + 12
        // `pole` decides the side the label runs, so an endpoint's text stays
        // inside the strip instead of running off the edge it sits on.
        const anchor = p.pole === 'low' ? 'start' : p.pole === 'high' ? 'end' : 'middle'
        return (
          <g
            key={p.participant_id}
            data-testid={`spread-strip-position-${p.participant_id}`}
            data-pole={p.pole ?? 'none'}
            className="text-text-header"
          >
            <circle cx={px} cy={axisY} r={DOT_R} fill="currentColor" />
            <line
              x1={px}
              y1={axisY + DOT_R}
              x2={px}
              y2={rowY - 10}
              stroke="currentColor"
              strokeWidth={1}
              // 0.35 vanished at projector distance in the browser check.
              opacity={0.45}
            />
            <text x={px} y={rowY} textAnchor={anchor} fill="currentColor" fontSize={13}>
              {p.display_label} {short(p.value)}
            </text>
          </g>
        )
      })}
    </svg>
    </div>
  )
}

/**
 * The strip plus the sentence it restates. Kept together so no caller can
 * mount the picture WITHOUT the words — the text is the accessible floor and
 * the fallback for anything that will not render SVG.
 */
export function SpreadSection({
  targetId,
  spread,
  positions,
  modelValue,
}: SpreadStripProps): JSX.Element {
  return (
    <div className="mt-1">
      <p
        data-testid={`disagreement-spread-${targetId}`}
        className={`${typography.bodySmall} text-text-light`}
      >
        The answers run from {short(spread.low)} to {short(spread.high)}.
      </p>
      <SpreadStrip
        targetId={targetId}
        spread={spread}
        positions={positions}
        modelValue={modelValue}
      />
    </div>
  )
}
