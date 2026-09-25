/**
 * NodeCoachingIcon — the card's ONE coaching affordance (locked Canvas design,
 * spec §2: "Coaching is one consistent icon; hover explains the question,
 * click opens AI with the element already in context").
 *
 * ── WHERE IT LIVES ───────────────────────────────────────────────────────────
 *
 * In the card's bottom RAIL (`NodeCardRail`), which occupies the band BaseNode
 * already reserves for the quick actions (`NODE_QUICK_ACTION_BAND_PX`). ED
 * 02:31Z (D4): "Reuse the existing bottom action band so coaching does not
 * consume an extra ~24 px row. Treat the persistent coaching affordance as the
 * resting state of that slot; on hover/focus the quick actions should
 * expand/replace around it, not duplicate 'Ask Olumi'." So this icon costs no
 * height — the band was already there, empty at rest.
 *
 * ── WHAT IT ASKS ─────────────────────────────────────────────────────────────
 *
 * Nothing of its own. The caller passes the resolver's output for its card
 * (`resolveNodeCoaching`) unchanged, and the icon asks the FIRST chip — the one
 * the removed chip row painted first. Every other chip stays where Detailed and
 * the popover already show it, so secondary questions (e.g. the Risk card's
 * "How likely is this?", ED 02:31Z) remain reachable.
 *
 * ── HOW IT ASKS — AND THE TYPED ACTION IS NEVER DEMOTED ─────────────────────
 *
 * ED 02:31Z: "do not silently demote any existing typed action (e.g.
 * `what_would_flip`) into generic discuss." So:
 *   · a chip with a typed `actionType` dispatches EXACTLY as `NodeChip` does —
 *     `_dispatchAction({ action_type, parameters: { chip_id }, … })` — so the
 *     answer comes from the model's typed analysis path;
 *   · an untyped chip goes through `requestAsk` (prefill-and-confirm): it lands
 *     as an editable draft the user sends, never dispatched on their behalf.
 * Both select the node first, so the turn carries THIS element as context.
 *
 * ── PRODUCER FIRST ───────────────────────────────────────────────────────────
 *
 * Where a live `guidance_item` names this node, the producer's voice is
 * `NodeCoachingMarker` in the corner stack, and this icon does not put a
 * second, client-authored QUESTION on the same card (the filter is the one
 * `NodeCoachingMarker` and `useScienceIcons` apply).
 *
 * ⭐⭐ EVERY CARD, AT NORMAL ZOOM ONLY — Paul 23 Sep contract feedback point 6.
 * "Keep one very discreet, consistent coaching icon at Normal zoom. Hide it at
 * quiet/far zoom." Two earlier behaviours conflicted with that and are changed
 * here, citing the point:
 *   · the icon YIELDED (rendered nothing) on a card the producer names, and on
 *     any card whose resolver had no question — so the affordance was
 *     hover-only on those cards. It now stays, as the generic
 *     `ASK_OLUMI_CHIP` ("Ask Olumi"), which PRE-FILLS the question the
 *     hover-only "Ask Olumi" button already asked (`buildAskAIPrompt`
 *     `explain_element`) — the producer-first rule still holds for the
 *     QUESTION, only the door is constant;
 *   · the icon showed at the `quiet` rung. It now renders only at `full`
 *     (`line` already unmounts the rail).
 * Still ONE gate (`useCoachingIconChip`) read by the icon AND the quick
 * actions, so the hover "Ask Olumi" is withheld exactly where this icon shows.
 *
 * ⭐ NEVER SILENT (contract v3: "Coaching opens the existing AI surface with
 * element context and a pre-filled question; it does not send or mutate
 * silently"). An untyped question is prefill-and-confirm (`requestAsk`). A
 * TYPED question keeps its typed dispatch (ED 02:31Z, never demoted to a
 * generic discuss — the drawer can only send `discuss`), and the Olumi surface
 * is revealed first so the turn never lands where the user is not looking.
 */
import { memo, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { requestAsk, canReceiveAsk } from '../../ui/inspector-v2/askSemantic'
import { useShowToastSafe } from '../../ToastContext'
import { revealOlumiSurface } from '../../conversation/revealOlumi'
import { buildAskAIPrompt } from '../../contextMenu/actions'
import type { NodeType } from '../../domain/nodes'
import type { CoachingChip, ResolvedCoaching } from '../coaching/resolveNodeCoaching'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { NODE_RAIL_BUTTON_CLASSES, NODE_RAIL_GLYPH_CLASSES, NODE_RAIL_GLYPH_PX, NODE_RAIL_REST_TONE_CLASS } from './nodeCardRailStyles'

export const NODE_COACHING_ICON_TESTID_PREFIX = 'node-coaching-icon-'

/**
 * The coaching door as drawn — glyph and resting ink — owned HERE and read by
 * the canvas key (`CanvasLegendPopover`, contract v3.1 §03 "Explore with
 * Olumi"), so the key imports this mark rather than redrawing one.
 */
export const COACHING_ICON_GLYPH = { Icon: MessageCircle, inkClass: NODE_RAIL_REST_TONE_CLASS } as const

/** A typed chip keeps its typed route; `run_analysis` is a run, not a question. */
export function coachingChipIsTyped(chip: CoachingChip): boolean {
  return chip.actionType !== null && chip.actionType !== 'run_analysis'
}

export interface NodeCoachingIconProps {
  nodeId: string
  /**
   * The resolver's output for this card, unchanged. The icon asks the first
   * chip that is a QUESTION (a `run_analysis` chip is a run, not coaching).
   */
  chips: ResolvedCoaching
}

/**
 * The generic door, used when the card has no client question of its own (or
 * the producer is the card's coaching voice). Its `message` is filled at click
 * time from `buildAskAIPrompt(…, 'explain_element')` — the SAME question the
 * hover-only "Ask Olumi" button asks — so no copy is invented here. `id` is a
 * sentinel the click handler recognises; it never ships as a `chip_id`.
 */
export const ASK_OLUMI_CHIP_ID = '__ask_olumi__'
export const ASK_OLUMI_CHIP: CoachingChip = {
  id: ASK_OLUMI_CHIP_ID,
  label: 'Ask Olumi',
  message: '',
  actionType: null,
}

/**
 * The chip the icon will ask, or `null` when the icon renders nothing. ONE gate,
 * read by the icon AND by the rail that decides whether "Ask Olumi" is a
 * duplicate — so the two can never disagree about whether coaching is showing.
 *
 * Paul 23 Sep contract feedback point 6: non-null on EVERY card at the `full`
 * rung whenever a conversation surface can receive the ask; `null` at `quiet`
 * and `line`, and when no surface exists (never a dead control).
 */
export function useCoachingIconChip(nodeId: string, chips: ResolvedCoaching): CoachingChip | null {
  const chip = chips?.find((c) => c.actionType !== 'run_analysis') ?? null
  const canAsk = useGuidanceStore(canReceiveAsk)
  const producerNamesThisNode = useGuidanceStore((s) =>
    (s.guidanceItems ?? []).some((i) => i.target_object?.id === nodeId),
  )
  const atNormalZoom = useCanvasStore((s) => ((s as { lodRung?: string }).lodRung ?? 'full') === 'full')
  if (!canAsk || !atNormalZoom) return null
  if (!chip || producerNamesThisNode) return ASK_OLUMI_CHIP
  return chip
}

export const NodeCoachingIcon = memo(function NodeCoachingIcon({ nodeId, chips }: NodeCoachingIconProps) {
  const chip = useCoachingIconChip(nodeId, chips)
  const showToast = useShowToastSafe()
  const nodeLabel = useCanvasStore((s) => {
    const n = (s as { nodes?: ReadonlyArray<{ id: string; data?: { label?: unknown } }> }).nodes?.find((x) => x.id === nodeId)
    const l = n?.data?.label
    return typeof l === 'string' && l.trim().length > 0 ? l.trim() : 'this element'
  })

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!chip) return
    const store = useCanvasStore.getState() as {
      selectNodeWithoutHistory?: (id: string) => void
      nodes?: ReadonlyArray<{ id: string; type?: string; data?: unknown }>
    }
    store.selectNodeWithoutHistory?.(nodeId)

    if (chip.id === ASK_OLUMI_CHIP_ID) {
      // The generic door: pre-fill the element question, never send it.
      const node = store.nodes?.find((n) => n.id === nodeId)
      if (!node) return
      const text = buildAskAIPrompt(
        { kind: 'node', nodeId, nodeType: (node.type ?? 'factor') as NodeType, node: node as never, screenPos: { x: 0, y: 0 } },
        'explain_element',
      )
      const landedGeneric = requestAsk({ text, label: `Ask Olumi about ${nodeLabel}`, targetId: nodeId, source: 'node-coaching-icon' })
      if (landedGeneric === 'none') {
        showToast('Could not open a draft — try typing your question directly.', 'warning')
      }
      return
    }

    if (coachingChipIsTyped(chip)) {
      // Never silent: front the Olumi surface before the typed turn lands.
      revealOlumiSurface()
      const callbacks = useGuidanceStore.getState()
      if (callbacks._dispatchAction) {
        callbacks._dispatchAction({
          action_type: chip.actionType as string,
          parameters: { chip_id: chip.id },
          label: chip.label,
          message: chip.message,
          source: 'chip',
        })
        return
      }
      if (callbacks._sendMessage) {
        callbacks._sendMessage(chip.message)
        return
      }
      showToast('Olumi is unavailable here. Your question has not been sent.', 'warning')
      return
    }

    const landed = requestAsk({
      text: chip.message,
      label: chip.label,
      targetId: nodeId,
      parameters: { chip_id: chip.id },
      source: 'chip',
    })
    if (landed === 'none') {
      showToast('Could not open a draft — try typing your question directly.', 'warning')
    }
  }, [chip, nodeId, nodeLabel, showToast])

  if (!chip) return null

  // The generic door's accessible name carries the element (a keyboard user has
  // no spatial context); a resolver question keeps its own words, unchanged.
  const accessibleName = chip.id === ASK_OLUMI_CHIP_ID ? `Ask Olumi about ${nodeLabel}` : chip.label

  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={chip.label}>
      <button
        type="button"
        /* Discreet at rest (the rail's `.icon-btn` grey, #777B77 — gap 34; it
           was `text-text-light`); Info on an info-soft ground on hover AND keyboard focus, so
           focus shows the same cue as hover (Paul 23 Sep contract feedback
           point 12). The hover/focus half now lives in `NODE_RAIL_BUTTON_CLASSES`
           for EVERY rail member (contract v3.1 `.icon-btn:hover`, ICON-01), so
           this icon no longer carries a private copy of it. */
        className={`${NODE_RAIL_BUTTON_CLASSES} ${COACHING_ICON_GLYPH.inkClass}`}
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={accessibleName}
        data-testid={`${NODE_COACHING_ICON_TESTID_PREFIX}${nodeId}`}
        data-coaching-chip-id={chip.id}
        data-coaching-typed={coachingChipIsTyped(chip) ? 'true' : undefined}
        data-node-tooltip="true"
      >
        {/* ⭐ `MessageCircle` EXACTLY — Panel's R3 (#63 5796486697, settled for the
            canvas by 5796609717): "ask / hand this to Olumi" is one meaning, so
            one glyph, shared with the quick-action "Ask Olumi" and the panel.
            `MessageCircleQuestion` would be a second glyph for the same act. */}
        <COACHING_ICON_GLYPH.Icon aria-hidden="true" size={NODE_RAIL_GLYPH_PX} className={NODE_RAIL_GLYPH_CLASSES} />
      </button>
    </Tooltip>
  )
})
