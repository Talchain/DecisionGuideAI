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
import { typography } from '../../styles/typography'
import { ViewportPortal, type Node } from '@xyflow/react'
import { deriveTierLanes } from '../utils/tierLanes'

/** Breathing room around a band, in graph units. Enough that the band reads as
 *  a lane the cards sit IN, not a box drawn tight around them. */
const LANE_PAD_Y = 48
const LANE_PAD_X = 120

/**
 * ⭐ WHERE A BAND'S TITLE SITS, IN GRAPH UNITS (contract v3.1, `.layer-label`:
 * left-aligned with the layer's content, just above it).
 *
 * It used to sit at the band's padded LEFT edge, 120 units outside the
 * outermost card. The band is furniture and never enters the fit, so at the
 * landing fit that edge lies under the left toolbar and the title was clipped
 * ("tions", "mes & risks" — Paul, 24 Sep, both PoCs). Anchored on the content
 * edge it is inside the fitted box whenever the cards are.
 *
 * Anchored by its BOTTOM, `LANE_TITLE_GAP` above the first card's top: the
 * label counter-scales, so at far zoom it grows several times taller, and it
 * must grow up into the space between bands, never down over a card.
 */
export const LANE_TITLE_GAP = 8
export function laneTitleFlowAnchor(lane: { x: number; y: number }): { x: number; bottomY: number } {
  return { x: lane.x, bottomY: lane.y - LANE_TITLE_GAP }
}

export const TierLanes = memo(function TierLanes({ nodes }: { nodes: readonly Node[] }) {
  const lanes = useMemo(() => deriveTierLanes(nodes), [nodes])
  if (lanes.length === 0) return null

  return (
    <ViewportPortal>
      <div aria-hidden="true" style={{ pointerEvents: 'none' }} data-testid="tier-lanes">
        {lanes.map((lane) => (
          <div
            key={lane.tier}
            data-testid={`tier-lane-${lane.tier}`}
            className="absolute rounded-2xl bg-panel"
            style={{
              left: lane.x - LANE_PAD_X,
              top: lane.y - LANE_PAD_Y,
              width: lane.width + LANE_PAD_X * 2,
              height: lane.height + LANE_PAD_Y * 2,
              pointerEvents: 'none',
              // Quiet by construction. The band's job is to group, not to
              // attract: at full strength it competes with the cards it holds.
              // `bg-panel` is the DS v5 surface token — the legacy `paper` scale
              // is on the compliance ratchet and a new use is a net-new
              // violation, so it is not available to this file.
              opacity: 0.5,
              /**
               * ⭐⭐⭐ THE BANDS WERE PAINTING ON TOP OF THE CARDS. This one
               * property is the whole fix, and the reason it was needed is that
               * JSX ORDER DOES NOT DECIDE IT.
               *
               * `ReactFlowGraph` mounts `<TierLanes>` "immediately after the
               * ground and before every node" and its comment concludes the
               * bands therefore "sit BEHIND the cards they hold". That was false
               * the moment this component reached for `<ViewportPortal>`: the
               * portal's target is `.react-flow__viewport-portal`, which React
               * Flow renders as the LAST of the viewport's five children
               * (EdgeRenderer → ConnectionLineWrapper → edge labels →
               * NodeRenderer → viewport-portal, derived at the installed
               * @xyflow/react 12.10.2). Portalled content leaves the call site's
               * position entirely, so where the element is written says nothing
               * about where it paints.
               *
               * ⛔ WHAT IT COST, MEASURED RATHER THAN CALLED UGLY. The band's box
               * is the union of its tier's card boxes plus padding, so it covers
               * 100% of every card it holds. A 50%-alpha #FEFEFE sheet leaves the
               * card FACE unchanged (also #FEFEFE) while washing everything drawn
               * ON it halfway to white: body text #3F3F3E composites to ~#9E9E9E
               * and contrast falls from ~10.4:1 to ~2.66:1 — under WCAG SC 1.4.3's
               * 4.5:1, and under even the 3:1 large-text floor. It is an
               * accessibility regression, not a matter of taste. The founder
               * reported it as "all of the nodes are still dulled out because
               * they're behind the panels of the different node type rows",
               * which is precisely what the DOM was doing.
               *
               * ⚠ NOT A LOWER OPACITY. At any opacity above zero the band still
               * tints every card; opacity is the AMPLITUDE of the defect and the
               * stacking order is the defect.
               *
               * ⚠ NOT ON THE WRAPPER EITHER. The parent div is `position: static`,
               * so a z-index there is silently ignored, and making it `relative`
               * to fix that would change the containing block for these
               * absolutely-positioned bands.
               *
               * A negative z-index cannot escape the viewport's stacking context,
               * so the bands still paint above `.react-flow__background`.
               */
              zIndex: -1,
            }}
          >
            <span
              data-testid={`tier-lane-${lane.tier}-title`}
              /**
               * ⛔ WAS AN INLINE `fontSize: calc(13px * var(--canvas-label-scale))`.
               * Counter-scaled and therefore correct on screen — and invisible
               * to `canvasTextCounterScale.census.spec.ts`, which classifies an
               * inline fontSize it cannot resolve to a literal as an ERROR
               * rather than as a hit. A size that no census can see is exactly
               * how a surface drifts off the scale without anything going red.
               * `typography.nodeLabel` is the same idea as a TOKEN the census
               * resolves, and 12px is the canvas's own label size — 13 was a
               * number I chose, which is the smaller half of the same defect.
               */
              className={`absolute uppercase text-text-light ${typography.nodeLabel}`}
              style={{
                // Band-local coordinates of `laneTitleFlowAnchor`.
                left: LANE_PAD_X,
                top: LANE_PAD_Y - LANE_TITLE_GAP,
                transform: 'translateY(-100%)',
                lineHeight: 1.2,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              {lane.title}
            </span>
          </div>
        ))}
      </div>
    </ViewportPortal>
  )
})
