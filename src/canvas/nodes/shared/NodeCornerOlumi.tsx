/**
 * NodeCornerOlumi — v10 only (#/canvas2). The Olumi mark in the BOTTOM-RIGHT CORNER of a card, drawn as a badge that
 * overlaps the card edge slightly: a white circle, a 1px border, a small shadow (Paul, 24 Oct 2026, ruling 3: "the Olumi
 * icon sits bottom-right of a card and is the contextual prompt into the chat").
 *
 * ── WHEN IT SHOWS ────────────────────────────────────────────────────────────
 * On hover, on keyboard focus inside the card, while the card is selected, and on touch. At rest it shows only where
 * Olumi has something to say about THIS card: a guidance item that names it (the producer's note), or an attention
 * reason from the board's one plan (`useNodeAttention`, the "worth reviewing" cue). Nothing else is a signal, so a quiet
 * card stays quiet.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 * A click puts "About <card>: " in the chat composer for the person to finish and sends nothing (the same act the
 * rail's coaching icon performs in v10; `NodeCoachingIcon`). Its tooltip and accessible name are both
 * "Ask Olumi about <card>".
 *
 * ── WHAT IT REPLACES ─────────────────────────────────────────────────────────
 * In v10 `NodeQuickActions` no longer draws its Olumi door (coaching icon or generic ask), so the mark is never shown
 * twice. #/canvas keeps the rail door and never mounts this component.
 *
 * ── HIT-TESTING ──────────────────────────────────────────────────────────────
 * The `pointer-events` set mirrors the `opacity` set, 1:1, exactly as the rail does (see `NodeQuickActions`): an
 * invisible badge must not swallow the clicks and drags meant for the card. `group-hover` keys off the CARD, whose box
 * contains the badge's inner half, so hovering the corner reveals it in the same frame.
 */
import { memo, useCallback } from 'react'
import Tooltip from '../../../components/Tooltip'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useShowToastSafe } from '../../ToastContext'
import { requestAsk, canReceiveAsk } from '../../ui/inspector-v2/askSemantic'
import { COACHING_ICON_GLYPH } from './NodeCoachingIcon'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'

export const NODE_CORNER_OLUMI_TESTID_PREFIX = 'node-corner-olumi-'

/** The badge's box and how far it hangs over the card edge, at glyph scale 1; both follow `--canvas-glyph-scale`. */
const BADGE_PX = 24
const OVERHANG_PX = 8
const GLYPH_PX = 14

export interface NodeCornerOlumiProps {
  nodeId: string
  /** The card is selected: the badge stays up. */
  selected?: boolean
  /** The board's attention plan has a reason on this card (`useNodeAttention(id).reasons.length > 0`). */
  hasAttention?: boolean
}

export const NodeCornerOlumi = memo(function NodeCornerOlumi({ nodeId, selected = false, hasAttention = false }: NodeCornerOlumiProps) {
  const canAsk = useGuidanceStore(canReceiveAsk)
  // The producer's note: a live guidance item whose target is this card (the filter the card's coaching marker uses).
  const hasGuidance = useGuidanceStore((s) => (s.guidanceItems ?? []).some((i) => i.target_object?.id === nodeId))
  const showToast = useShowToastSafe()
  const nodeLabel = useCanvasStore((s) => {
    const n = (s as { nodes?: ReadonlyArray<{ id: string; data?: { label?: unknown } }> }).nodes?.find((x) => x.id === nodeId)
    const l = n?.data?.label
    return typeof l === 'string' && l.trim().length > 0 ? l.trim() : 'this element'
  })

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useCanvasStore.getState().selectNodeWithoutHistory?.(nodeId)
    const landed = requestAsk({ text: `About ${nodeLabel}: `, label: `Ask Olumi about ${nodeLabel}`, targetId: nodeId, source: 'node-coaching-icon' })
    if (landed === 'none') showToast('The conversation is not open yet. Try again in a moment.', 'warning')
  }, [nodeId, nodeLabel, showToast])

  // Never a dead control: with no conversation surface to receive the prompt there is nothing to ask.
  if (!canAsk) return null

  const hasNote = hasGuidance || hasAttention
  const name = `Ask Olumi about ${nodeLabel}`
  const visible = selected || hasNote
  // `opacity` and `pointer-events` share every variant (see the header), so the badge can never hit-test unseen.
  const visibility = visible
    ? 'opacity-100 pointer-events-auto'
    : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(pointer:coarse)]:opacity-100 [@media(pointer:coarse)]:pointer-events-auto'

  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={name}>
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={name}
        data-testid={`${NODE_CORNER_OLUMI_TESTID_PREFIX}${nodeId}`}
        data-corner-at-rest={visible ? 'true' : 'false'}
        data-node-tooltip="true"
        className={`nodrag nopan absolute z-[3] inline-flex items-center justify-center rounded-full border border-default bg-panel shadow-1 transition-opacity duration-150 motion-reduce:transition-none hover:bg-info/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 ${visibility}`}
        style={{
          width: `calc(${BADGE_PX}px * var(--canvas-glyph-scale, 1))`,
          height: `calc(${BADGE_PX}px * var(--canvas-glyph-scale, 1))`,
          right: `calc(-${OVERHANG_PX}px * var(--canvas-glyph-scale, 1))`,
          bottom: `calc(-${OVERHANG_PX}px * var(--canvas-glyph-scale, 1))`,
        }}
      >
        <COACHING_ICON_GLYPH.Icon aria-hidden="true" size={GLYPH_PX} />
      </button>
    </Tooltip>
  )
})
