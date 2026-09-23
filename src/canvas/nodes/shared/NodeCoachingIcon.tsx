/**
 * NodeCoachingIcon — the card's ONE coaching affordance.
 *
 * ⭐ LOCKED EXPERIENCE DESIGN (Paul-approved, 23 Sep 2026): *"Coaching becomes
 * ONE consistent icon on the card surface."* Every card family used to carry a
 * permanent row of `NodeChip`s on its resting face — measured on the four
 * anchor cards alone: "What would we see first?", "How likely is this?", "What
 * would falsify this?", "Is this the real goal?", "Explore more options", "What
 * could go wrong?". Each was right on its own card; together they spent the
 * card's height on chrome rather than on the reasoning it exists to show.
 *
 * ── WHAT IT DECIDES, AND WHAT IT DOES NOT ─────────────────────────────────
 *
 * It decides NOTHING about what to ask. The caller passes the resolver's
 * output for its card surface, unchanged, and the icon's question is the
 * FIRST chip — the one the chip row would have painted first. So every rule
 * `resolveNodeCoaching` carries (pre-analysis-only chips, baseline
 * suppression, the deliberate silences) reaches the icon by construction: a
 * `null` resolution renders no icon, exactly as it rendered no row.
 *
 * ── HOW IT ASKS — THE EXISTING SEAM, PREFILL-AND-CONFIRM ───────────────────
 *
 * The click goes through `requestAsk` (`ui/inspector-v2/askSemantic.ts`), the
 * one semantic for every "ask Olumi about this" affordance: it NEVER
 * dispatches, it lands the question as an editable draft the user sends. No
 * new AI path is minted here.
 *
 * ⚠ IT CARRIES `parameters: { chip_id }`, AND THAT IS THE CARRIER DECISION
 * `askSemantic` NAMES AS Q2. The chips this replaces shipped their id as
 * `chip.parameters.chip_id` (`NodeChip`'s mandatory intent metadata), and
 * chip_metadata survives ONLY on the conversation-typed turn — so an ask with
 * parameters routes to the Ask-Olumi drawer rather than a bare composer
 * prefill, which would silently drop the id. The drawer's `targetId` gives
 * the draft its "Focus on canvas" route back to this node.
 *
 * ⚠ AND IT SELECTS THE NODE FIRST — the ordering `NodeQuickActions`' Challenge
 * button reproduces from `askAI` for the reason it gives: the UI attaches
 * `selected_elements` from the live store on every send, so the turn carries
 * THIS element rather than a bare sentence about it (or, worse, whatever else
 * happened to be selected).
 *
 * ⚠ A TYPED CHIP LOSES ITS `action_type` HERE, AND THAT IS STATED RATHER THAN
 * HIDDEN. The drawer sends `action_type: 'discuss'` (`AskOlumiDrawer.tsx`),
 * so a first chip whose own `actionType` is set — today only the Question
 * card's post-analysis `decision_challenge_result` (`what_would_flip`) —
 * reaches CEE as a discuss turn carrying its `chip_id`, not as the typed
 * action. The typed chip itself still dispatches unchanged from the popover
 * and from Detailed. `requestAsk` has no action-type channel and one is not
 * invented here.
 *
 * ── PRODUCER FIRST (the one-voice-per-node ruling) ─────────────────────────
 *
 * Where a live `guidance_item` names THIS node, the producer's voice is
 * `NodeCoachingMarker` in `BaseNode`'s corner stack, and this icon yields —
 * renders nothing — rather than put a second, client-authored question on the
 * same card. The filter is byte-for-byte the one `NodeCoachingMarker` and
 * `useScienceIcons` apply (`target_object.id === nodeId`), so all three agree
 * about whether the producer spoke. The same precedence `useScienceIcons.ts`
 * records: the producer outranks a local signal per node, and the local one is
 * not deleted — where the producer is silent it is all the reader gets.
 *
 * ── NO SURFACE, NO AFFORDANCE ───────────────────────────────────────────────
 *
 * Gated on `canReceiveAsk`, `askSemantic`'s own rule: *"no surface at all →
 * nothing. The affordance should not have rendered; it must not pretend."*
 *
 * ── PLACEMENT ──────────────────────────────────────────────────────────────
 *
 * It renders its own right-aligned row, and every adopter mounts it LAST in the
 * card body, so it sits bottom-right on every card. ⚠ It is IN FLOW, not
 * absolutely positioned, deliberately: the card's bottom band
 * (`NODE_QUICK_ACTION_BAND_PX`) is reserved for `NodeQuickActions`, which
 * paints at the SAME bottom-right inset on hover, focus and selection. An
 * absolute icon there would sit under the quick-action row the moment the
 * reader reached for either. The box and hit slop are the quick actions' own
 * constants, so the two controls share one target size.
 *
 * ── API (for the Factor and Option cards) ─────────────────────────────────
 *
 *     <NodeCoachingIcon
 *       nodeId={id}
 *       chips={resolveNodeCoaching({ kind, surface: 'card', state, context })}
 *     />
 *
 * Pass the resolver's output unchanged; mount it where the card-surface chip
 * row stood, as the last child of the body. Nothing else is required.
 */
import { memo, useCallback } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { requestAsk, canReceiveAsk } from '../../ui/inspector-v2/askSemantic'
import { useShowToastSafe } from '../../ToastContext'
import type { ResolvedCoaching } from '../coaching/resolveNodeCoaching'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import {
  CANVAS_GLYPH_SIZE_CLASSES,
  CANVAS_HIT_SLOP_CLASSES,
  CANVAS_QUICK_ACTION_BOX_PX,
  CANVAS_QUICK_ACTION_SLOP_PX,
} from './canvasGlyphScale'

/** `data-testid` is this prefix + the node id — one icon per card, bound by identity. */
export const NODE_COACHING_ICON_TESTID_PREFIX = 'node-coaching-icon-'

export interface NodeCoachingIconProps {
  /** The canvas node this card renders. */
  nodeId: string
  /**
   * The resolver's output for this card's face, passed through unchanged. The
   * FIRST chip is the question; `null` renders nothing.
   */
  chips: ResolvedCoaching
}

const BUTTON_CLASSES =
  'nodrag nopan relative inline-flex ' +
  CANVAS_GLYPH_SIZE_CLASSES[CANVAS_QUICK_ACTION_BOX_PX] +
  ' items-center justify-center rounded text-text-light hover:text-info ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-info ' +
  CANVAS_HIT_SLOP_CLASSES[CANVAS_QUICK_ACTION_SLOP_PX]

export const NodeCoachingIcon = memo(function NodeCoachingIcon({ nodeId, chips }: NodeCoachingIconProps) {
  const chip = chips?.[0] ?? null
  const canAsk = useGuidanceStore(canReceiveAsk)
  // The SAME filter as `NodeCoachingMarker` and `useScienceIcons` — see header.
  const producerNamesThisNode = useGuidanceStore((s) =>
    s.guidanceItems.some((i) => i.target_object?.id === nodeId),
  )
  const showToast = useShowToastSafe()

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!chip) return
    // Select, THEN ask — the turn carries this element (see header).
    useCanvasStore.getState().selectNodeWithoutHistory(nodeId)
    const landed = requestAsk({
      text: chip.message,
      label: chip.label,
      targetId: nodeId,
      parameters: { chip_id: chip.id },
      source: 'chip',
    })
    // The gate is read at render; a channel can still die before the click.
    // Never a silent click.
    if (landed === 'none') {
      showToast('Could not open a draft — try typing your question directly.', 'warning')
    }
  }, [chip, nodeId, showToast])

  if (!chip || !canAsk || producerNamesThisNode) return null

  return (
    <div className="flex justify-end mt-1">
      <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={chip.label}>
        <button
          type="button"
          className={BUTTON_CLASSES}
          onClick={handleClick}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label={chip.label}
          data-testid={`${NODE_COACHING_ICON_TESTID_PREFIX}${nodeId}`}
          data-coaching-chip-id={chip.id}
          // The node preview yields while this control's own tooltip is up —
          // `usePopoverHover`'s action rule, the same marker metric rows use.
          data-node-tooltip="true"
        >
          <MessageCircleQuestion size={14} aria-hidden="true" className={CANVAS_GLYPH_SIZE_CLASSES[14]} />
        </button>
      </Tooltip>
    </div>
  )
})
