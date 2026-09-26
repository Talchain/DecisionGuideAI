/**
 * ⭐⭐ THE BOARD READS AS ONE ARGUMENT — the five bands, drawn.
 *
 * `decision → options → what drives it → what follows → goal`. That grammar is
 * exact in the geometry (`TIER_BY_KIND` places every node) and, until now, was
 * drawn nowhere. See {@link deriveTierLanes} for the measurement and for why the
 * extents are derived from the cards rather than tabulated.
 *
 * ⚠ RENDERED THROUGH `ViewportPortal`, WHICH IS THE WHOLE REASON THIS WORKS.
 * The bands must sit in GRAPH space — panning and zooming with the cards — and
 * anything rendered as an ordinary child of `<ReactFlow>` sits in SCREEN space
 * and would slide off its own cards the moment the user pans.
 *
 * ⚠ IT IS FURNITURE, NOT CONTENT: `pointer-events: none` throughout, so it can
 * never intercept a click meant for a card, an edge or the pane; it is not a
 * node, so it cannot enter the fit, a selection, a count or an export; and it
 * carries `aria-hidden`, because the grouping it draws is already available to a
 * screen reader through the Model outline's headings — announcing five more
 * landmarks would be duplication, not access.
 *
 * ⚠ THE LABEL COUNTER-SCALES. Canvas type multiplies by `--canvas-label-scale`
 * so it stays legible at the zoom the auto-fit parks at; a label that did not
 * would render at ~7px on a freshly drafted model, which is the legibility
 * defect this pass exists to remove rather than add to.
 */
import { memo, useMemo } from 'react'
import { ViewportPortal, type Node } from '@xyflow/react'
import { deriveTierLanes, LANE_TITLE_GAP } from '../utils/tierLanes'

/**
 * ⭐ THE BANDS ARE LABELS ONLY, IN ONE LEFT COLUMN (Paul, 24 Sep: "Keep the
 * labels on the left, but remove the different colour panels of the different
 * node types. Just leave the normal canvas background as is." — NODE-ANATOMY-v32
 * L1/L2; contract v3.1 `.layer-label`, one fixed left x for every layer).
 *
 * ⛔ NO PANEL. The tinted rectangles are gone, not faded: they stretched past
 * the viewport (a band is its row's width plus 120 units a side, and it never
 * enters the fit), and at any opacity they tinted the cards they sat behind
 * (the stacking history is in git: `zIndex: -1` was needed because the portal
 * paints last). With no rectangle there is nothing to stack.
 *
 * ⭐ ONE COLUMN, INSIDE THE FIT. Every title shares x = the graph's leftmost
 * card edge. That edge IS the fitted box's left edge (a row-end prompt only ever
 * stands at a row's END), so whenever the board fits, a title cannot sit under
 * the left toolbar at landing — which is what clipped "Question", "Options" and
 * "Goal" on both PoCs. ⚠ When the board does NOT fit on width (a five-card row
 * with its prompt at 1280×800 dock-open, 1740 units against 1520) the clamped
 * camera spills the overflow evenly, and the column lands ~21px from the pane
 * edge — the S4 shortfall, stated in `laptopFit.arithmetic.spec.ts`. Per-lane x would put the Question and Goal
 * titles mid-screen above their centred cards; one column keeps them "on the
 * left" as asked.
 *
 * The label is the contract's band WORD (`TITLE_BY_TIER`, v3.1 WS1 #26: the
 * Canvas lead's brief rules v3.1 wins on the words), written as content, in the
 * shared muted token (`text-text-light`, 4.65:1 on the canvas — the contract's
 * `#777870` measures 3.93:1 and fails AA), at the contract's 10px and 0.5px
 * tracking, both ON SCREEN. No `text-transform` and no raw hex, so nothing is
 * hidden from `check-ds-compliance`. ⚠ The all-caps words conflict with DS v5
 * §2 (sentence case) and review 5824187641; see `TITLE_BY_TIER` — an owner
 * ruling is still required.
 *
 * Bottom-anchored `LANE_TITLE_GAP` above each band's first card: the label
 * counter-scales, so at far zoom it grows several times taller and must grow up
 * into the gap between rows, never down over a card.
 */
export { LANE_TITLE_GAP }

export function laneTitleColumnX(lanes: ReadonlyArray<{ x: number }>): number {
  return lanes.reduce((min, l) => Math.min(min, l.x), Number.POSITIVE_INFINITY)
}

export function laneTitleFlowAnchor(
  lane: { x: number; y: number },
  columnX: number,
): { x: number; bottomY: number } {
  return { x: columnX, bottomY: lane.y - LANE_TITLE_GAP }
}

export const TierLanes = memo(function TierLanes({ nodes }: { nodes: readonly Node[] }) {
  const lanes = useMemo(() => deriveTierLanes(nodes), [nodes])
  if (lanes.length === 0) return null
  const columnX = laneTitleColumnX(lanes)

  return (
    <ViewportPortal>
      <div aria-hidden="true" style={{ pointerEvents: 'none' }} data-testid="tier-lanes">
        {lanes.map((lane) => {
          const anchor = laneTitleFlowAnchor(lane, columnX)
          return (
            <span
              key={lane.tier}
              data-testid={`tier-lane-${lane.tier}-title`}
              /* contract v3.1 `.layer-label` size only: the counter-scaled base
                 drops from `typography.edgeLabel`'s 11px to the contract's 10px — a
                 LOCAL arbitrary-value class, not an edit to the shared token, since
                 no other canvas surface uses 10px. Sentence case and the shared
                 muted token stay (DS v5 §2; see the header). */
              className={`absolute text-text-light text-[length:calc(10px*var(--canvas-label-scale,1))] font-sans`}
              style={{
                left: anchor.x,
                top: anchor.bottomY,
                transform: 'translateY(-100%)',
                lineHeight: 1.2,
                // v3.1 WS1 #26: 0.5px ON SCREEN, like the 10px beside it — a
                // fixed 0.5px was 0.25px on screen at the landing zoom.
                letterSpacing: 'calc(0.5px * var(--canvas-label-scale, 1))',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {lane.title}
            </span>
          )
        })}
      </div>
    </ViewportPortal>
  )
})
