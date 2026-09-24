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
import { deriveTierLanes, type TierLane } from '../utils/tierLanes'

/**
 * ⭐ BREATHING ROOM AROUND A BAND, IN GRAPH UNITS — AND NO MORE THAN THE FIT'S
 * OWN CHROME GAP (contract v3.1, CHR-1 / CHR-2).
 *
 * The band is furniture and never enters the fit, so every unit of padding
 * lands OUTSIDE the fitted box. It used to be 120 at the sides and 48 above and
 * below: at the 0.65 landing zoom the band's left end sat under the left
 * toolbar, the Goal band ran ~31px below the goal card into the bottom notice
 * strip, and — because the tallest-card-to-next-row gap is 88 units on all five
 * starters and 48 + 48 = 96 — every pair of adjacent bands overlapped by 8
 * units, where two half-alpha sheets drew a brighter seam.
 *
 *   · SIDES and BOTTOM are 16: at any zoom ≤ 1 that is ≤ 16px on screen, which
 *     is `computeFitPadding`'s GAP, so the band never reaches the sidebar, the
 *     dock or the bottom notice strip.
 *   · TOP is 44: the zone the title sits in. 44 + 16 leaves a 28-unit clear
 *     gutter between rows (18px at 0.65), so the rows read as distinct and
 *     nothing overlaps. At the counter-scale ceiling (2×) the title is 11 × 2 =
 *     22 units tall plus the 8-unit gap — still inside the 44.
 */
const LANE_PAD_X = 16
const LANE_PAD_TOP = 44
const LANE_PAD_BOTTOM = 16

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
 *
 * ⚠ EXCEPT THE FIRST ROW, WHEN THERE IS ROOM BESIDE ITS CARD (contract v3.1,
 * CHR-3). Nothing sits above the Question row, so "just above it" is the top
 * of the fitted box — the fit keeps only a 16px gap under the floating header,
 * and the title's upper half landed under it. The Question card is always
 * alone in its row and centred, so the board-left column at its top edge is
 * empty; the title sits there, level with the card's top, and so inside the
 * fitted box by construction. `LANE_TITLE_BESIDE_MIN` is the widest title at
 * the 2× counter-scale ceiling plus a 24-unit gap; a board narrow enough that
 * the Question card starts at board-left falls back to the placement above.
 */
export const LANE_TITLE_GAP = 8
export const LANE_TITLE_BESIDE_MIN = 160

export type LaneTitleAnchor =
  | { readonly placement: 'above'; readonly x: number; readonly bottomY: number }
  | { readonly placement: 'beside'; readonly x: number; readonly topY: number }

export function laneTitleFlowAnchor(
  lane: Pick<TierLane, 'tier' | 'x' | 'y' | 'contentLeft'>,
): LaneTitleAnchor {
  if (lane.tier === 0 && lane.contentLeft - lane.x >= LANE_TITLE_BESIDE_MIN) {
    return { placement: 'beside', x: lane.x, topY: lane.y }
  }
  return { placement: 'above', x: lane.x, bottomY: lane.y - LANE_TITLE_GAP }
}

export const TierLanes = memo(function TierLanes({ nodes }: { nodes: readonly Node[] }) {
  const lanes = useMemo(() => deriveTierLanes(nodes), [nodes])
  if (lanes.length === 0) return null

  return (
    <ViewportPortal>
      <div aria-hidden="true" style={{ pointerEvents: 'none' }} data-testid="tier-lanes">
        {lanes.map((lane) => {
          const anchor = laneTitleFlowAnchor(lane)
          // A title beside its card needs no title zone above the row, so the
          // band claims none: nothing of it reaches above the fitted box.
          const padTop = anchor.placement === 'beside' ? LANE_PAD_BOTTOM : LANE_PAD_TOP
          return (
          <div
            key={lane.tier}
            data-testid={`tier-lane-${lane.tier}`}
            className="absolute bg-panel"
            style={{
              left: lane.x - LANE_PAD_X,
              top: lane.y - padTop,
              width: lane.width + LANE_PAD_X * 2,
              height: lane.height + padTop + LANE_PAD_BOTTOM,
              // Concentric with the cards it holds (contract v3.1, CHR-11):
              // outer radius = the cards' own radius token + the side padding.
              // A fixed `rounded-2xl` (16) around 14-unit card corners 16 units
              // in read as a tighter corner outside a looser one.
              borderRadius: `calc(var(--radius-lg) + ${LANE_PAD_X}px)`,
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
               * A census-resolvable TOKEN is the fix.
               *
               * ⭐ LANE FURNITURE, NOT CARD CONTENT (contract v3.1, T11 / CHR-4:
               * `.layer-label{font-size:10px;letter-spacing:.5px;color:#777870}`).
               * At `nodeLabel` (12px) the title was the same size, weight and
               * colour as the cards' own eyebrow text, so "Question" read twice
               * in one style. `edgeLabel` is the smallest counter-scaled canvas
               * token (11px; 10px is the canvas text floor and has no token),
               * tracked 0.05em — the contract's .5px at 10px. `text-text-light`
               * is the DS muted token (#6E6B6B, ~5:1 on the half-alpha band),
               * the nearest to the contract's #777870, so no colour is added.
               *
               * ⛔ SENTENCE CASE, NOT THE CONTRACT'S ALL-CAPS. DS v5 §2 and
               * §17.3 require sentence case, and `check-ds-compliance.mjs`
               * enforces it as a ratchet on the required check: the all-caps
               * class that briefly sat on this line was a NET-NEW violation
               * that turned `--enforce` red. The words themselves stay bound
               * to the Model outline's spelling (`MODEL_GROUP_TITLE`).
               */
              className={`absolute text-text-light ${typography.edgeLabel}`}
              style={
                anchor.placement === 'beside'
                  ? {
                      // Band-local coordinates of `laneTitleFlowAnchor`:
                      // level with the Question card's top, in the empty
                      // board-left column beside it.
                      left: anchor.x - (lane.x - LANE_PAD_X),
                      top: anchor.topY - (lane.y - padTop),
                      lineHeight: 1,
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }
                  : {
                      // Band-local coordinates of `laneTitleFlowAnchor`.
                      left: anchor.x - (lane.x - LANE_PAD_X),
                      top: anchor.bottomY - (lane.y - padTop),
                      transform: 'translateY(-100%)',
                      lineHeight: 1,
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }
              }
            >
              {lane.title}
            </span>
          </div>
          )
        })}
      </div>
    </ViewportPortal>
  )
})
