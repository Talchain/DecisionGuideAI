/**
 * An open door at the end of a tier.
 *
 * Generalises `GhostOptionNode`, which shipped this pattern for options alone:
 * a dashed placeholder that, when opened, asks Olumi to help the user think of
 * something the model does not yet contain. That was the most reasoning-shaped
 * affordance already on the canvas, and it existed on one of four tiers.
 *
 * ⚠ IT ADDS NOTHING TO THE MODEL. Opening it sends a QUESTION. Whatever comes
 * back is the user's to accept, argue with or ignore — a ghost that inserted a
 * node would make the AI the author of the model, which inverts the one thing
 * this product is for.
 *
 * ⚠ AND THE DOOR SAYS THE QUESTION OUT LOUD. The label is composed in
 * `utils/ghostTiers.ts` and is a question there; this file must not summarise
 * it, prefix it, or fall back to a noun. `data.label ?? 'Add'` was the old
 * fallback and it is gone: a door handed no label renders none, for the same
 * reason it sends no prompt when handed none — a visible failure beats a
 * generic one.
 */

import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useGuidanceStore } from '../stores/guidanceStore'
import { typography } from '../../styles/typography'
import { MAX_LABEL_COUNTER_SCALE } from '../utils/zoomLegibility'

export const GHOST_TIER_TESTID = 'ghost-tier-node'

/* ── GEOMETRY, DERIVED FROM THE LEGIBILITY CONTRACT ─────────────────────────
 *
 * ⭐⭐ THIS CARD WAS A HAND-TUNED 132 × 64, AND IT WAS ALREADY CLIPPING ITS OWN
 * COPY BEFORE A SINGLE WORD OF THIS PR CHANGED — measured in a real browser at
 * the counter-scale bound, 3 Sep 2026.
 *
 * Canvas label text carries `--canvas-label-scale` (`utils/zoomLegibility.ts`),
 * which reaches `MAX_LABEL_COUNTER_SCALE` at exactly `LABEL_LEGIBLE_ZOOM` —
 * and that is precisely where a post-draft auto-fit parks, because
 * `useFitViewOnLayoutVersion` passes that value as `minZoom`. So the bound is
 * not a corner case, it is the view the product picks for the user.
 *
 * At that bound the OLD copy needed 75px of content in a 61px box: all four of
 * "Another option / factor / risk / outcome" overflowed, at 132 × 64, with the
 * old strings. This is `#758`'s defect on this card — the font grew and the box
 * did not — and `zoomLegibility.ts` names `nodeLayoutConstants.ts` as the place
 * geometry is supposed to answer it. Real node titles do. This door never did.
 *
 * So the box is a function of the same constant the font is, exactly as
 * `NODE_TITLE_MIN_MEASURE_PX` is. Two rules from that file are carried over
 * deliberately:
 *
 *   • TEXT measures scale; CHROME does not. The icon and the padding are a
 *     fixed 16 / 4 / 8 px that no counter-scale touches — multiplying them
 *     would count one decision twice, which is the arithmetic error
 *     `NODE_TITLE_RECLAIMED_PX` exists to record.
 *   • The height is a FLOOR, not a fixed height. `GhostOptionNode` has always
 *     used `min-height` and grows; a fixed height cannot grow, so any font the
 *     browser substitutes for Inter — a fallback this file cannot control —
 *     clips instead. Sizing for the measured worst case AND letting the box
 *     grow means the clipping class is closed rather than tuned.
 *
 * `GHOST_DOOR_TEXT_MEASURE_PX` is the one HAND-MEASURED number here: 88px
 * declared is the narrowest measure at which every one of the four questions
 * still fits two lines at the bound (measured 176px @22px in Chromium with
 * Inter, 3 Sep 2026; 160 spills the risk and outcome doors to three lines).
 *
 * ⚠⚠ WHAT GUARDS THIS NUMBER, AND WHAT DOES NOT — STATED EXACTLY, BECAUSE THE
 * SENTENCE THAT STOOD HERE WAS FALSE. It claimed
 * `GhostTierNode.doorGeometry.spec.tsx` "re-does this arithmetic and REDs if a
 * label outgrows it". It does not, and it cannot. Proven by execution in
 * review: mutating this constant `88 → 60` — a value measured to spill the risk
 * and outcome doors to three lines — left **115/115 tests green across 11
 * ghost-touching specs**. No test looked at any label's rendered width, because
 * jsdom has no layout and no text metrics (CLAUDE.md trap 3). A comment
 * asserting coverage that does not exist is worse than no comment: the next
 * maintainer reads it and believes the fit is pinned.
 *
 *   • GUARDED — the ARITHMETIC. The spec asserts `GHOST_DOOR_W_PX` is this
 *     measure times `MAX_LABEL_COUNTER_SCALE` plus unscaled chrome, so the
 *     width cannot drift from the measure or start multiplying the chrome.
 *   • GUARDED — the VALUE, as a TRIPWIRE ONLY. The spec pins this constant to
 *     88 so a change must be made deliberately rather than sliding through. It
 *     REDs on `88 → 60`. It is a change-detector, NOT a fit guard: it knows
 *     nothing about the copy and would happily bless 88 for a longer sentence.
 *   • NOT GUARDED — THE FIT ITSELF. Whether these four strings actually fit two
 *     lines at this measure is a text-metrics question that only a real browser
 *     can answer. It belongs in `e2e/geometry/ghostDoorVisibility.measure.ts`,
 *     not in jsdom. Rowed; see the PR. Until that lands, EDITING ANY OF THE
 *     FOUR TIER LABELS REQUIRES RE-MEASURING IN A BROWSER — no test will catch
 *     a label that outgrows this box, and the tripwire will not fire, because
 *     the label changed and this number did not.
 *
 * The cost of being wrong is bounded and was verified in review: `minHeight` is
 * a FLOOR with no `overflow: hidden`, and `break-words` is present, so a wrong
 * measure costs a taller card — never a truncated word.
 */
export const GHOST_DOOR_TEXT_MEASURE_PX = 88
/** `typography.nodeLabel` — 11px, `leading-tight` (1.25). Declared, unscaled. */
const GHOST_DOOR_LABEL_PX = 11
const GHOST_DOOR_LINE_HEIGHT = 1.25
/** Two lines is what the copy needs at the bound; see the measure above. */
const GHOST_DOOR_MAX_LINES = 2
/** Chrome: `Plus` at `w-4`, the `gap-1` beneath it, `px-1` either side, border. */
const GHOST_DOOR_ICON_PX = 16
const GHOST_DOOR_GAP_PX = 4
const GHOST_DOOR_PADDING_X_PX = 4
const GHOST_DOOR_BORDER_PX = 1.5

export const GHOST_DOOR_W_PX =
  GHOST_DOOR_TEXT_MEASURE_PX * MAX_LABEL_COUNTER_SCALE +
  GHOST_DOOR_PADDING_X_PX * 2 +
  GHOST_DOOR_BORDER_PX * 2

export const GHOST_DOOR_MIN_H_PX =
  GHOST_DOOR_ICON_PX +
  GHOST_DOOR_GAP_PX +
  GHOST_DOOR_MAX_LINES * GHOST_DOOR_LABEL_PX * GHOST_DOOR_LINE_HEIGHT * MAX_LABEL_COUNTER_SCALE +
  GHOST_DOOR_BORDER_PX * 2

export const GhostTierNode = memo((props: NodeProps) => {
  const data = (props.data ?? {}) as { label?: string; prompt?: string; tier?: string }
  const label = data.label
  const prompt = data.prompt

  const open = useCallback(() => {
    if (!prompt) return
    const send = useGuidanceStore.getState()._sendMessage
    if (send) send(prompt)
  }, [prompt])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid={GHOST_TIER_TESTID}
      data-tier={data.tier}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      // ⚠ `items-start`, NOT `items-center`, AND THE AXIS IS THE WHOLE REASON.
      // This is a flex COLUMN, so `items-center` is the HORIZONTAL axis: it
      // centres the label's whole box, not just the text inside it. Measured
      // at the shipped 187px door width, the label span shrink-wraps to
      // ~150px, so `items-center` left ~18.5px of gap on each side and
      // removing the span's `text-center` alone changed nothing. `justify-*`
      // is the VERTICAL axis here and `justify-center` stays: it is what keeps
      // the content vertically centred in a door sized for two lines.
      className="rounded-lg cursor-pointer hover:bg-panel-hover transition-colors flex flex-col items-start justify-center gap-1 nodrag nopan text-left"
      style={{
        // Matches GhostOptionNode's measured 3:1 non-text contrast outline —
        // the dashes are the only thing marking this affordance's bounds.
        //
        // ⚠ This read `var(--panel-border, #C7C7C7)`, and --panel-border is
        // not a defined custom property, so it always resolved to the
        // hardcoded #C7C7C7: a fixed light grey in both themes, and NOT the
        // colour it claimed to match. The comment above asserted a contrast
        // property the code could not have. Now it reads the same token
        // GhostOptionNode does, so the claim is true rather than aspirational.
        width: GHOST_DOOR_W_PX,
        minHeight: GHOST_DOOR_MIN_H_PX,
        border: `${GHOST_DOOR_BORDER_PX}px dashed var(--text-body, #3F3F3E)`,
        background: 'transparent',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Plus className="w-4 h-4 text-text-light" aria-hidden="true" />
      {/* `break-words`: the last-resort rule that stops a single long word
          overflowing the measure horizontally, as node titles already use. */}
      <span className={`${typography.nodeLabel} text-text-light px-1 break-words`}>{label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
})

GhostTierNode.displayName = 'GhostTierNode'
