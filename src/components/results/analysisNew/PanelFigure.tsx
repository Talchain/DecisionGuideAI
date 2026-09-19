/**
 * PanelFigure — ONE GRAMMAR FOR EVERY QUANTITY THIS PANEL DRAWS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 * #1346 ruled it already: **GEOMETRY IS GRAMMAR AND IS FIXED, TONE IS MEANING
 * AND VARIES** (`panelSurfaces.ts`). The panel had drifted from its own ruling.
 * Measured in `sections/` on deployed `99b46212` — FIVE treatments, two radii,
 * three heights, for quantities that are all "a proportion of a track":
 *
 *   AtAGlance:994          h-1   rounded-full   (a share)
 *   OptionsComparison:561  h-2   rounded-full   flex gap-[2px]  (the partition)
 *   OptionsComparison:790  h-2   rounded-full   (win share)
 *   OptionsComparison:845  h-1.5 rounded-pill   (the outcome range)
 *   OptionsComparison:960  h-2   rounded-full   (goal fit)
 *   DriverInfluenceChart:346  h-2, its own flex
 *
 * ⚠ THE `h-1.5 rounded-pill` ONE IS MINE, ADDED THE SAME NIGHT THIS WAS WRITTEN.
 * A fifth grammar arrived through exactly the route the others did — a new
 * figure authored at its own call site, sized against the row in front of me.
 * That is the argument for a component rather than a review note.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS FIXED AND WHAT VARIES
 * ═══════════════════════════════════════════════════════════════════════════
 * FIXED, and not a prop: track height, radius, track colour, marker size, the
 * non-zero floor. A caller cannot make its figure louder than its neighbour,
 * which is the whole point — four bars on a shared baseline are read
 * comparatively whether or not each one means the same thing.
 *
 * VARIES, by MEANING rather than by taste: `variant` picks the fill token.
 * Adding a variant is a decision about what the panel can say, made here, once.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE THREE RULES THIS COMPONENT CARRIES SO NO CALL SITE HAS TO
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. ⭐ A MEASURED NON-ZERO NEVER DRAWS AS ZERO. `OptionsComparison` shipped
 *    "< 1%" beside a 0px fill on deployed `ce32426c` — one row, one quantity,
 *    two contradictory claims. The floor applies ONLY when the fraction is
 *    strictly positive: a genuine zero must draw an empty track, because
 *    "came out ahead in 0% of scenarios" is true and the floor exists to stop
 *    a non-zero reading as zero, never to stop zero reading as zero.
 *
 * 2. ⭐ A MARKER NEVER LEAVES ITS TRACK. `calc(0% - 3px)` hangs half a 6px dot
 *    outside. On a range figure whose domain is DEFINED BY the extremes, one
 *    marker lands on an edge every single run by construction — measured on
 *    Paul's real run: Hire's p10 at 0.0%, ICP's p90 at 100.0%, two of four.
 *    Browser-measured: 3px of overhang each, 0px clamped.
 *
 * 3. ⭐ THE FIGURE CLAIMS NOTHING IN UNITS. It draws WHERE and HOW WIDE on a
 *    shared domain. The goal target may be currency, a count or a normalised
 *    scale and this panel does not always know which — `useResultsSectionData`
 *    carries an explicit normalised-vs-denormalised probe for exactly that
 *    reason. Every number a reader sees comes from the readout beside the
 *    figure, never from the figure.
 *
 * ⚠ `aria-hidden` BY DEFAULT AND THAT IS DELIBERATE. The readout next to the
 * figure is the accessible name; announcing both makes a screen reader say the
 * same quantity twice. A caller with no adjacent readout passes `label`.
 */
import type { ReactNode } from 'react'

/** Geometry. Fixed, exported so guards can assert against it rather than a literal. */
export const FIGURE_TRACK_HEIGHT = 'h-2'
export const FIGURE_RADIUS = 'rounded-full'
export const FIGURE_TRACK_TONE = 'bg-panel-hover'
/** The marker is 6px wide and slightly taller than the track, so it reads as a mark ON it. */
export const FIGURE_MARKER_W = 6
export const FIGURE_MARKER_CLASS = 'absolute top-[-1px] w-1.5 h-[9px] rounded-full bg-text-body'
/** Enough to be seen at all. Two device pixels at 1x. */
const NON_ZERO_FLOOR_PX = 2

/**
 * The fill token per MEANING.
 *
 * ⚠ `share` and `goal` are deliberately DIFFERENT tones for DIFFERENT questions
 * — "how often did this come top?" versus "does this reach the target you set?"
 * — because they can disagree, and a reader who sees one colour learns to read
 * them as one quantity. `range` is the distributional one and is quieter than
 * both: it qualifies an ordering rather than asserting one.
 */
const FILL: Record<FigureVariant, string> = {
  share: 'bg-info',
  goal: 'bg-info',
  range: 'bg-option',
  influence: 'bg-info',
}

export type FigureVariant = 'share' | 'goal' | 'range' | 'influence'

export interface PanelFigureProps {
  variant: FigureVariant
  /**
   * A proportion of the track, 0..1, for everything except `range`.
   * `null` renders the empty track — an absence, never a guessed zero.
   */
  fraction?: number | null
  /**
   * `range` only: where the band starts and ends on the SHARED domain, plus an
   * optional marker inside it. All three are already domain-relative 0..1 —
   * this component never sees a p10 or a currency value, which is what keeps
   * rule 3 true.
   */
  band?: { start: number; end: number; marker?: number | null } | null
  /** Extra data attributes for witnessing, e.g. the raw percentile a marker shows. */
  markerData?: Record<string, string | number>
  className?: string
  testId: string
  /** Only when there is no adjacent readout to serve as the name. */
  label?: string
  children?: ReactNode
}

const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`

/**
 * ⭐ THE CLAMP AS A PURE FUNCTION, SO A TEST CAN SEE IT.
 *
 * jsdom's CSS parser may silently DROP a value it cannot parse, so asserting
 * `style.left` on a rendered `clamp()` could pass — or fail — for reasons that
 * have nothing to do with the code, and a conditional assertion ("clamped OR
 * empty") would be a guard agreeing with itself. Exporting the expression makes
 * the rule testable without asking the runner a question it cannot answer.
 */
export function markerLeft(fraction: number): string {
  return `clamp(0px, calc(${pct(fraction)} - ${FIGURE_MARKER_W / 2}px), calc(100% - ${FIGURE_MARKER_W}px))`
}

export function PanelFigure({
  variant,
  fraction = null,
  band = null,
  markerData,
  className = '',
  testId,
  label,
}: PanelFigureProps): JSX.Element {
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }
  const track = `relative block w-full ${FIGURE_TRACK_HEIGHT} ${FIGURE_RADIUS} ${FIGURE_TRACK_TONE} overflow-hidden ${className}`

  if (variant === 'range') {
    // ⚠ `!= null`, LOOSE, ON EVERY BOUND. These arrive from view models whose
    // types declare them required and whose fixtures omit them; a strict
    // `!== null` admits `undefined` and then draws `calc(NaN%)`, which is a
    // silently invisible figure — worse than a throw, because nothing reports
    // it. CI caught exactly that on `outcomeRange` once already.
    if (band == null || band.start == null || band.end == null) {
      return <span className={track} data-testid={testId} {...a11y} />
    }
    const width = Math.max(band.end - band.start, 0)
    return (
      {/* ⚠ NO `overflow-visible` OVERRIDE. My first draft added one beside the
          track's `overflow-hidden`, which is two competing classes whose winner
          depends on stylesheet order rather than on intent. The clamp above
          already guarantees the marker sits INSIDE the track, so there is
          nothing to let out — the containment the override was protecting
          against is the thing rule 2 removed. */}
      <span className={track} data-testid={testId} {...a11y}>
        <span
          className={`absolute top-0 ${FIGURE_TRACK_HEIGHT} ${FIGURE_RADIUS} ${FILL.range}`}
          style={{ left: pct(band.start), width: `max(${pct(width)}, ${NON_ZERO_FLOOR_PX}px)` }}
          data-testid={`${testId}-band`}
        />
        {band.marker != null ? (
          <span
            className={FIGURE_MARKER_CLASS}
            /* Rule 2: clamped so the marker cannot leave its own track. */
            style={{ left: markerLeft(band.marker) }}
            data-testid={`${testId}-marker`}
            {...(markerData ?? {})}
          />
        ) : null}
      </span>
    )
  }

  return (
    <span className={track} data-testid={testId} {...a11y}>
      {fraction != null ? (
        <span
          className={`block h-full ${FIGURE_RADIUS} ${FILL[variant]}`}
          /* Rule 1: floor a measured non-zero, never a genuine zero. */
          style={{
            width: pct(fraction),
            ...(fraction > 0 ? { minWidth: `${NON_ZERO_FLOOR_PX}px` } : {}),
          }}
          data-testid={`${testId}-fill`}
        />
      ) : null}
    </span>
  )
}
