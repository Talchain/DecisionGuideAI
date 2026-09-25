/**
 * The ONE "Worth reviewing" marker (locked spec §2 "Attention cue — add"; ED
 * 11:52Z point 7; ED 02:31Z D1b).
 *
 * ── HOW IT LOOKS ────────────────────────────────────────────────────────────
 *
 * A small INFO-tinted ring in the card's top-right corner stack — visually
 * separate from the bottom icon rail (spec §2). ⛔ NEVER the warning family:
 * "Worth reviewing" can mean a top driver or an evidence opportunity, not
 * danger, and ED 02:31Z rejected a semantic-warning outline at every rung. The
 * ring is counter-scaled like every canvas glyph, so it stays a legible, static
 * cue at far zoom without any outline on the card.
 *
 * ⭐ CONTRACT v3.1 GLYPH (`.node .attention`; deltas PILL-03 / ICON-05 / F13).
 * It was an 18px bordered, shadowed disc holding a CSS donut (`border-2`, whose
 * 2px was NOT counter-scaled, so the ring thinned with zoom) — read as a radio
 * button. It is now the contract's attention mark: a borderless, shadowless
 * Info glyph button with an info-soft hover, in the rail's own counter-scaled
 * 20px box with the rail's one 14px glyph size (`NODE_RAIL_GLYPH_PX`; the
 * contract's is 25/15), the target glyph drawn with Lucide's `LocateFixed` — the stock equivalent of the
 * contract's circle + centre + four ticks (DS v5 §9: Lucide only), at the
 * contract's lighter 1.6 stroke. It keeps a panel fill (`bg-panel/90`)
 * because the corner stack floats it over the layer gap, where a bare glyph
 * would sit on edges. Info stays its colour at rest: it is the ONE
 * Info-at-rest mark on a card (Paul 23 Sep pt 9, attention = Info blue).
 *
 * ── HOW IT EXPLAINS ITSELF ──────────────────────────────────────────────────
 *
 * The shared, focusable `Tooltip` — hover AND keyboard focus — never a native
 * `title` alone (ED 02:31Z: native title is not full-text recovery; it is absent
 * on touch). The same sentence is the accessible name, so the two channels
 * cannot say different things.
 *
 * ── WHAT A CLICK DOES ───────────────────────────────────────────────────────
 *
 * Selects the element and opens its EXISTING inspector (spec §2: "Do not create
 * a new panel").
 */
import type { MouseEvent } from 'react'
import { LocateFixed } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { openNodeInspector } from './openNodeInspector'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { CANVAS_GLYPH_SIZE_CLASSES, CANVAS_QUICK_ACTION_BOX_PX } from './canvasGlyphScale'
import { NODE_RAIL_GLYPH_CLASSES, NODE_RAIL_GLYPH_PX } from './nodeCardRailStyles'

export const ATTENTION_MARKER_TESTID_PREFIX = 'attention-marker-'

/**
 * The mark as drawn — glyph, stroke and resting ink — owned HERE and read by
 * the canvas key (`CanvasLegendPopover`, contract v3.1 §03 "Worth reviewing"),
 * so the key imports this mark rather than redrawing one.
 */
export const ATTENTION_MARKER_GLYPH = { Icon: LocateFixed, strokeWidth: 1.6, inkClass: 'text-info' } as const

export function NodeAttentionMarker({ nodeId, sentence }: { nodeId: string; sentence: string }) {
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={sentence}>
      <button
        type="button"
        data-testid={`${ATTENTION_MARKER_TESTID_PREFIX}${nodeId}`}
        data-node-tooltip="true"
        aria-label={sentence}
        onClick={(e: MouseEvent) => {
          e.stopPropagation()
          openNodeInspector(nodeId)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`nodrag nopan shrink-0 inline-flex items-center justify-center rounded bg-panel/90 ${ATTENTION_MARKER_GLYPH.inkClass} hover:bg-info/10 focus-visible:bg-info/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${CANVAS_GLYPH_SIZE_CLASSES[CANVAS_QUICK_ACTION_BOX_PX]}`}
      >
        <ATTENTION_MARKER_GLYPH.Icon
          aria-hidden="true"
          data-testid="attention-marker-ring"
          size={NODE_RAIL_GLYPH_PX}
          strokeWidth={ATTENTION_MARKER_GLYPH.strokeWidth}
          className={NODE_RAIL_GLYPH_CLASSES}
        />
      </button>
    </Tooltip>
  )
}
