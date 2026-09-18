import Tooltip from '../../../components/Tooltip'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import {
  firmnessBandDescription,
  firmnessBandWidthPx,
  type FactorFirmnessDisplay,
} from './factorFirmness'

/**
 * ⭐⭐ THE SPREAD BAND — how firm this factor's number is, drawn under it.
 *
 * Renders NOTHING unless `resolveFactorFirmnessDisplay` returned `show: true`.
 * The width is reached only through `firmnessBandWidthPx`, which takes the
 * provenance union, so there is no code path from a raw `observedState.std` to
 * a pixel on this card.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ WHY IT IS ABSOLUTELY POSITIONED — THE CARD'S HEIGHT BUDGET IS NOT MINE
 * ─────────────────────────────────────────────────────────────────────────────
 * The corner stack and the card's height are tightly managed, and a band that
 * added height would reflow the board for every factor that happens to carry a
 * σ — i.e. the layout would move depending on the DATA, which is the one thing
 * a reader reads as noise. So this takes itself out of flow entirely and sits in
 * the half-leading BELOW THE BASELINE of the value row's existing line box:
 * `typography.nodeLabel` is 12px on `leading-snug` (1.375 → a 16.5px box), the
 * glyphs occupy the middle ~12px, and the band is 2px at the bottom edge of that
 * box — roughly 2.6px clear of the baseline, inside a box that already exists.
 *
 * **Consequence, stated rather than assumed: this component contributes exactly
 * zero height, whether it draws or not.** A factor with a σ and a factor without
 * one are the same height, so no card moves and no edge re-routes.
 *
 * ⚠ IT IS A GRADIENT, NOT A BAR, AND THAT IS NOT DECORATION. A uniform bar under
 * a number is an UNDERLINE — a token this canvas already spends on emphasis and
 * links, and a reader would file it as styling. A band that fades out at both
 * ends reads as spread, which is the statistical idiom a reader already knows
 * from a confidence ribbon, and it cannot be mistaken for an underline. The edge
 * ribbon borrows the same idiom one object along, so the two surfaces teach each
 * other.
 *
 * ⚠ CENTRED ON THE NUMBER, deliberately: a spread is symmetric about the point
 * value, and anchoring it left would read as a progress bar — a magnitude
 * growing from zero, which is a different and false claim.
 *
 * ⛔ NOT FOCUSABLE, and the reasoning is `EstimateMarker`'s: it is a status
 * marker, the detail behind it is reachable through the inspector, and a second
 * tab stop per node costs more than it gives. It carries `role="img"` with a
 * full `aria-label`, so the claim is available to a screen reader as a sentence
 * rather than as an unlabelled box.
 */
export function FactorFirmnessBand({ display }: { display: FactorFirmnessDisplay }) {
  const width = firmnessBandWidthPx(display)
  const description = firmnessBandDescription(display)
  // Both are null on the same branch (`show: false`); testing both is what lets
  // TypeScript narrow, and it is also the honest guard — a band with no sentence
  // to explain it is an unexplained mark, which is what this lane is against.
  if (width === null || description === null) return null

  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={description}>
      <span
        role="img"
        aria-label={description}
        data-testid="factor-firmness-band"
        className="pointer-events-auto absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full"
        style={{
          width: `${width}px`,
          // `--text-light-rgb` is the token behind `bg-text-light`; a gradient
          // cannot go through the Tailwind colour utility, so the variable is
          // read directly rather than a hex being hardcoded beside it. Quieter
          // than the value it sits under (which is `text-text-body`), because a
          // spread is secondary to the number it qualifies.
          //
          // ⚠ THE CENTRE IS FULLY OPAQUE, AND THAT IS A CORRECTION, NOT A TASTE.
          // At 0.8 the band read as a drop shadow on the glyphs above it —
          // measured in a browser at 4× on the geometry probe — which is exactly
          // the failure mode of a mark a reader files as styling and stops
          // seeing. The ends still fade to zero, so it is a spread and not an
          // underline; only the middle is solid.
          background:
            'linear-gradient(to right, rgb(var(--text-light-rgb) / 0) 0%, rgb(var(--text-light-rgb) / 1) 50%, rgb(var(--text-light-rgb) / 0) 100%)',
        }}
      />
    </Tooltip>
  )
}
