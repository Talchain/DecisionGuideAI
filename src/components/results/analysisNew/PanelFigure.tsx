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

/**
 * Geometry. Fixed, exported so guards can assert against it rather than a literal.
 *
 * ⭐ V2 FIDELITY (24 Sep 2026, census gaps 13/20): `bg-panel-hover` measured at
 * 1.038:1 against the panel — a track no reader could see, and the ONLY thing
 * on screen was the fill, which is what made a `range` band read as a heavy
 * solid slab rather than a fill ON a track. `bg-panel-border` is the token
 * every other rule on this panel already uses to be seen; the same lightening
 * pass drops the track from 8px to 5px, so the resting bars read as a line
 * rather than a slab. `h-2`/`bg-panel-hover` are kept as dead literals nowhere
 * so a reviewer diffing this cannot mistake the change for a typo.
 */
export const FIGURE_TRACK_HEIGHT = 'h-[5px]'
export const FIGURE_RADIUS = 'rounded-full'
export const FIGURE_TRACK_TONE = 'bg-panel-border'
/**
 * The marker's diameter. V2: an 11px dot in the option colour replaces the
 * old 6px dark tick, which read as a different ink from the range it marks.
 * `markerLeft` uses this for its horizontal clamp, so the two can never
 * drift apart.
 *
 * ⭐ V2 FIDELITY (25 Sep 2026, gap CHART-5): the `ring-2 ring-panel` border
 * gave the dot a 15px footprint — about 2.5× the prototype's core area — and
 * notched the band it sits on. `border-2 border-panel` draws the SAME
 * panel-coloured separation from the band as a border-box 2px inset (an 11px
 * border-box leaves a 7px `bg-option` core, matching the prototype's
 * `.rangemean`), and `ring-1 ring-option/50` replaces it with the
 * prototype's own thin lavender halo instead of doubling the white ring.
 */
export const FIGURE_MARKER_W = 11
export const FIGURE_MARKER_CLASS =
  'absolute top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full bg-option border-2 border-panel ring-1 ring-option/50'
/**
 * `range` ONLY: the band's own height. Taller than the 1px hairline it sits
 * on (below) so it reads as the figure, not the track.
 *
 * ⭐ V2 FIDELITY (25 Sep 2026, gaps CHART-1/CHART-2/SPACE-3): the range track
 * used to be a 5px beige SLAB the same height as the band — a range read as a
 * slider with a thumb, not a spread on a scale. It is now a centred 1px
 * hairline (`FIGURE_TRACK_TONE`, moved off the outer track and onto that
 * hairline alone), and the band gets its OWN height, independent of it.
 */
export const FIGURE_BAND_HEIGHT = 'h-1.5'
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
 *
 * ⚠ V2 FIDELITY (gaps 13/20): `range`'s fill was a solid `bg-option` band —
 * measured as reading heavy, the loudest thing on the row. A transparent
 * `bg-option/20` with a `border-option/30` outline keeps the same hue (still
 * distinct from `share`/`goal`'s blue) while dropping the weight, which is
 * the fill a distributional figure earns rather than a magnitude one.
 *
 * ⚠ `bg-option/20`, NOT `bg-option-light`. `eslint-rules/no-bare-light-bg.js`
 * (DS v5 §3.2) forbids a bare `bg-{semantic}-light` FILL BY NAME — the rule
 * is a string match on the token, so it flags the class no matter what sits
 * beside it, and my first draft here (a border next to `bg-option-light`)
 * still tripped it. Its own message names the fix literally: "a transparent
 * background with a border-{colour}/30 outline", i.e. the base colour at
 * reduced ALPHA, not the dedicated `-light` swatch — the same construction
 * `panelSurfaces.ts` already uses for `PANEL_INSET_ACTION` (`bg-info/[0.06]`).
 *
 * ⭐ V2 FIDELITY (25 Sep 2026, gap CHART-1): `range`'s TINT alone, not its
 * base. A translucent fill straight on the track let the hairline
 * (`FIGURE_TRACK_TONE`, now centred under the band) show through the band's
 * own middle as a visible stripe. `PanelFigure`'s `range` branch below layers
 * this tint on an OPAQUE `bg-panel` base, so `FILL.range` is applied to the
 * inner span only.
 */
const FILL: Record<FigureVariant, string> = {
  share: 'bg-info',
  goal: 'bg-info',
  range: 'bg-option/40 ring-1 ring-inset ring-option/70',
  influence: 'bg-info',
  partition: 'bg-info',
}

export type FigureVariant = 'share' | 'goal' | 'range' | 'influence' | 'partition'

/**
 * ⭐ TONE IS MEANING AND VARIES — #1346's other half, and the reason this is a
 * NAMED SET rather than a colour prop. The glance's bar is green when the run's
 * verdict is `stable` and amber otherwise; that is a claim about the RESULT, so
 * the caller owns which one, and the component owns what each one looks like. A
 * free `color` prop would hand tone back to the call sites, which is the drift
 * this whole component exists to stop.
 */
export type FigureTone = 'neutral' | 'stable' | 'caution'

const TONE: Record<FigureTone, string | null> = {
  neutral: null,
  stable: 'bg-success',
  caution: 'bg-warning',
}

/** A segment of a `partition` — the parts sum to the whole by construction. */
export interface FigureSegment {
  readonly id: string
  readonly fraction: number
}

export interface PanelFigureProps {
  variant: FigureVariant
  /** Overrides the variant's fill where the RESULT's character is the claim. */
  tone?: FigureTone
  /**
   * `partition` only: the parts, in order. Every part is floored by the same
   * rule as a single fill, so a measured sliver stays visible in a stack.
   */
  segments?: readonly FigureSegment[] | null
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
  tone = 'neutral',
  segments = null,
  fraction = null,
  band = null,
  markerData,
  className = '',
  testId,
  label,
}: PanelFigureProps): JSX.Element {
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }
  const track = `relative block w-full ${FIGURE_TRACK_HEIGHT} ${FIGURE_RADIUS} ${FIGURE_TRACK_TONE} overflow-hidden ${className}`
  /**
   * ⭐ V2 FIDELITY (gap 20): `range` ALONE gets `overflow-visible`, not
   * `overflow-hidden`. The marker grew from a 6×9 tick (which fit, clipped
   * flush, inside an 8px track) to an 11px dot — taller than the now-5px
   * track on every variant. Clipping it would draw a half-moon, not a dot.
   * Height and radius still come from the SAME constants every other variant
   * uses (rule 3, `oneFigureGrammar.spec.tsx`), so the track's SIZE has not
   * left the shared grammar — only whether it crops its own marker has,
   * and only for the one variant whose marker is taller than the line.
   *
   * ⭐ V2 FIDELITY (25 Sep 2026, gaps CHART-1/CHART-2/SPACE-3): `FIGURE_TRACK_TONE`
   * (the beige fill) COMES OFF this element. The outer track keeps
   * `FIGURE_TRACK_HEIGHT`/`FIGURE_RADIUS` — rule 3 still holds — but paints no
   * colour of its own; a centred 1px hairline, drawn as the first child below,
   * carries the tone instead. A 5px beige slab the same height as the band
   * read as a slider's groove, not a range on a scale.
   */
  const rangeTrack = `relative block w-full ${FIGURE_TRACK_HEIGHT} ${FIGURE_RADIUS} overflow-visible ${className}`
  /** The hairline every range track draws, whether or not a band is present. */
  const rangeHairline = (
    <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-panel-border" />
  )

  if (variant === 'range') {
    // ⚠ `!= null`, LOOSE, ON EVERY BOUND. These arrive from view models whose
    // types declare them required and whose fixtures omit them; a strict
    // `!== null` admits `undefined` and then draws `calc(NaN%)`, which is a
    // silently invisible figure — worse than a throw, because nothing reports
    // it. CI caught exactly that on `outcomeRange` once already.
    if (band == null || band.start == null || band.end == null) {
      return (
        <span className={rangeTrack} data-testid={testId} {...a11y}>
          {rangeHairline}
        </span>
      )
    }
    const width = Math.max(band.end - band.start, 0)
    /*
     * ⚠ THE HORIZONTAL CLAMP (rule 2) IS UNCHANGED AND STILL THE REASON THE
     * MARKER NEVER LEAVES THE TRACK SIDEWAYS. `overflow-visible` above is a
     * VERTICAL relaxation only, for an 11px dot centred on a 5px line
     * (`top-1/2 -translate-y-1/2` on the marker, below) — it does not touch
     * `left`, which `markerLeft`'s clamp still bounds to `[0, 100% - 11px]`.
     *
     * ⚠ AND THIS COMMENT SITS OUTSIDE THE `return`, WHICH IS WHY IT IS A BLOCK
     * COMMENT. A `{/* … *\/}` JSX comment placed before the root element inside
     * `return ( … )` is a syntax error — a returned expression has exactly one
     * root. My delimiter-balance check reads it as balanced, because it is:
     * the defect is JSX GRAMMAR, not delimiters. Only the build caught it.
     */
    return (
      <span className={rangeTrack} data-testid={testId} {...a11y}>
        {rangeHairline}
        {/* ⭐ V2 FIDELITY (gap CHART-1): OPAQUE BASE, TINT ON TOP. `bg-panel`
            hides the hairline running underneath the band's own middle — the
            fill this replaces was translucent, and the hairline showed
            through it as a visible seam. `${testId}-band` and `left` stay on
            THIS outer span: `optionsComparisonFigure.spec` asserts `left`
            here. */}
        <span
          className={`absolute top-1/2 -translate-y-1/2 ${FIGURE_BAND_HEIGHT} ${FIGURE_RADIUS} bg-panel`}
          style={{ left: pct(band.start), width: `max(${pct(width)}, ${NON_ZERO_FLOOR_PX}px)` }}
          data-testid={`${testId}-band`}
        >
          <span className={`absolute inset-0 ${FIGURE_RADIUS} ${FILL.range}`} />
        </span>
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

  if (variant === 'partition') {
    return (
      <span className={`${track} flex gap-[2px]`} data-testid={testId} {...a11y}>
        {(segments ?? []).map((seg) => (
          <span
            key={seg.id}
            className={`block h-full ${FILL.partition} first:rounded-l-full last:rounded-r-full`}
            /* The same floor as a single fill: a sliver that was measured must
               survive being stacked beside a runaway share. */
            style={{
              width: pct(seg.fraction),
              ...(seg.fraction > 0 ? { minWidth: `${NON_ZERO_FLOOR_PX}px` } : {}),
            }}
            data-testid={`${testId}-segment`}
          />
        ))}
      </span>
    )
  }

  return (
    <span className={track} data-testid={testId} {...a11y}>
      {fraction != null ? (
        <span
          className={`block h-full ${FIGURE_RADIUS} ${TONE[tone] ?? FILL[variant]}`}
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
