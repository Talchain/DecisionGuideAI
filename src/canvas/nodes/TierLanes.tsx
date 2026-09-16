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
              className={`absolute text-text-light ${typography.nodeLabel}`}
              style={{
                left: 16,
                top: 12,
                lineHeight: 1.2,
                letterSpacing: '0.01em',
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
