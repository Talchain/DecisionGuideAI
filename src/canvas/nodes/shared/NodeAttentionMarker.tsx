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
import Tooltip from '../../../components/Tooltip'
import { openNodeInspector } from './openNodeInspector'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'

export const ATTENTION_MARKER_TESTID_PREFIX = 'attention-marker-'

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
        className="nodrag nopan shrink-0 inline-flex items-center justify-center rounded-full bg-panel border border-info/40 text-info shadow-1 hover:bg-info/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        style={{
          width: 'calc(18px * var(--canvas-label-scale, 1))',
          height: 'calc(18px * var(--canvas-label-scale, 1))',
        }}
      >
        <span
          aria-hidden="true"
          data-testid="attention-marker-ring"
          className="block rounded-full border-2 border-info"
          style={{
            width: 'calc(9px * var(--canvas-label-scale, 1))',
            height: 'calc(9px * var(--canvas-label-scale, 1))',
          }}
        />
      </button>
    </Tooltip>
  )
}
