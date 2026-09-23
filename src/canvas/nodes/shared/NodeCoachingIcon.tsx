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
 * `NodeCoachingMarker` in the corner stack, and this icon yields rather than
 * put a second, client-authored question on the same card (the filter is the
 * one `NodeCoachingMarker` and `useScienceIcons` apply).
 */
import { memo, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { requestAsk, canReceiveAsk } from '../../ui/inspector-v2/askSemantic'
import { useShowToastSafe } from '../../ToastContext'
import type { CoachingChip, ResolvedCoaching } from '../coaching/resolveNodeCoaching'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { NODE_RAIL_BUTTON_CLASSES, NODE_RAIL_GLYPH_CLASSES } from './nodeCardRailStyles'

export const NODE_COACHING_ICON_TESTID_PREFIX = 'node-coaching-icon-'

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
 * The chip the icon will ask, or `null` when the icon renders nothing. ONE gate,
 * read by the icon AND by the rail that decides whether "Ask Olumi" is a
 * duplicate — so the two can never disagree about whether coaching is showing.
 */
export function useCoachingIconChip(nodeId: string, chips: ResolvedCoaching): CoachingChip | null {
  const chip = chips?.find((c) => c.actionType !== 'run_analysis') ?? null
  const canAsk = useGuidanceStore(canReceiveAsk)
  const producerNamesThisNode = useGuidanceStore((s) =>
    (s.guidanceItems ?? []).some((i) => i.target_object?.id === nodeId),
  )
  if (!chip || !canAsk || producerNamesThisNode) return null
  return chip
}

export const NodeCoachingIcon = memo(function NodeCoachingIcon({ nodeId, chips }: NodeCoachingIconProps) {
  const chip = useCoachingIconChip(nodeId, chips)
  const showToast = useShowToastSafe()

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!chip) return
    const store = useCanvasStore.getState() as { selectNodeWithoutHistory?: (id: string) => void }
    store.selectNodeWithoutHistory?.(nodeId)

    if (coachingChipIsTyped(chip)) {
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
  }, [chip, nodeId, showToast])

  if (!chip) return null

  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={chip.label}>
      <button
        type="button"
        className={`${NODE_RAIL_BUTTON_CLASSES} text-text-light hover:text-info`}
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={chip.label}
        data-testid={`${NODE_COACHING_ICON_TESTID_PREFIX}${nodeId}`}
        data-coaching-chip-id={chip.id}
        data-coaching-typed={coachingChipIsTyped(chip) ? 'true' : undefined}
        data-node-tooltip="true"
      >
        {/* ⭐ `MessageCircle` EXACTLY — Panel's R3 (#63 5796486697, settled for the
            canvas by 5796609717): "ask / hand this to Olumi" is one meaning, so
            one glyph, shared with the quick-action "Ask Olumi" and the panel.
            `MessageCircleQuestion` would be a second glyph for the same act. */}
        <MessageCircle aria-hidden="true" className={NODE_RAIL_GLYPH_CLASSES} />
      </button>
    </Tooltip>
  )
})
