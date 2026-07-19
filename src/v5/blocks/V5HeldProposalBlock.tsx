/**
 * V5HeldProposalBlock — renders a held CEE graph mutation as an honest,
 * non-error-styled card (R8, seamless-workspace roadmap 2.27; 0.18.0
 * HeldProposalBlockSchema).
 *
 * The card shows the held proposal honestly:
 *   - WHAT is proposed: `summary`, the producer's display-safe description,
 *     rendered verbatim (the UI adds no interpretation).
 *   - WHY it is held: the UI's own copy for `reason_code`
 *     (heldProposalReasonText). The raw code, `mutation_class`, `proposal_id`
 *     and the `held_proposal` token NEVER render as user-facing copy — they
 *     ride as data-* attributes only. This is the whole point of the 1.43
 *     fix: no internal-doctrine-prose leak.
 *   - THE USER'S ACTIONS: confirm + dismiss.
 *
 * Action routing (EXISTING seams only — single-writer doctrine, post-#364):
 *   - Confirm dispatches the resolved suggested-action `message` through the
 *     guidance store's `_sendChip(label, message)` seam — the SAME chip-send
 *     path EvidenceBlock's "Apply to model" uses. That sends the message as a
 *     turn; CEE applies the held mutation server-side on that turn. The card
 *     mints NO client-side graph mutation.
 *   - Dismiss dispatches the resolved decline action's message when CEE emits
 *     one; otherwise it is a local-only dismiss (the ProposalBlockRenderer
 *     "Cancel" idiom — mark settled, no turn).
 *
 * DS: this is a proposal / action card, so it uses the ratified full-border
 * V5 card recipe (`bg-panel` + `border border-info/30`, DESIGN_SYSTEM.md
 * "Patterns"), matching V5CoachingBlock's `default` variant — NOT the
 * left-border coaching recipe (reserved for facilitator coaching). Confirm /
 * dismiss use the ratified suggested-action chip idiom (SuggestedChips).
 * Lucide only, typography tokens, British English, no em dashes.
 *
 * Fail-closed: `_sendChip` unavailable (no conversation host registered) → the
 * confirm click is a safe no-op. Malformed blocks never reach here — the
 * mapper degrades an unresolvable confirm ref to the R7 unsupported card.
 */
import { type ReactElement, useCallback, useState } from 'react'
import { Hand } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import type { V5HeldProposalBlock as V5HeldProposalBlockType } from '../../canvas/conversation/types'
import {
  heldProposalReasonText,
  HELD_PROPOSAL_HEADING,
  HELD_PROPOSAL_DISMISS_LABEL,
  HELD_PROPOSAL_CONFIRMED_ACK,
  HELD_PROPOSAL_DISMISSED_ACK,
} from './heldProposalReasonCopy'

export interface V5HeldProposalBlockProps {
  block: V5HeldProposalBlockType
}

/** Ratified suggested-action chip idiom (SuggestedChips.tsx), verbatim. */
const CHIP_CLASS = [
  'inline-flex items-center gap-1.5',
  'bg-panel border border-panel-border rounded-full',
  'px-4 py-2 min-h-[44px]',
  'hover:bg-panel-hover active:bg-panel-border/30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
  'text-text-body cursor-pointer font-sans',
  typography.bodySmall,
  'disabled:opacity-40 disabled:pointer-events-none',
  'transition-colors duration-200',
].join(' ')

export function V5HeldProposalBlock({ block }: V5HeldProposalBlockProps): ReactElement {
  const sendChip = useGuidanceStore((s) => s._sendChip)
  const [settled, setSettled] = useState<null | 'accepted' | 'dismissed'>(null)

  const { confirm, decline } = block

  const handleConfirm = useCallback(() => {
    if (settled) return
    // Single-writer apply path: send the producer's confirm message as a turn;
    // CEE applies the held mutation server-side. No client-minted mutation.
    sendChip?.(confirm.label, confirm.message)
    setSettled('accepted')
  }, [settled, sendChip, confirm.label, confirm.message])

  const handleDismiss = useCallback(() => {
    if (settled) return
    // Decline through the existing chip seam when CEE emits a decline action;
    // otherwise dismiss is local-only (the free-text decline path stays open).
    if (decline) sendChip?.(decline.label, decline.message)
    setSettled('dismissed')
  }, [settled, sendChip, decline])

  return (
    <div
      data-testid="v5-held-proposal"
      data-block-id={block.proposal_id}
      data-mutation-class={block.mutation_class}
      data-reason-code={block.reason_code}
      data-settled={settled ?? undefined}
      className="rounded-xl border border-info/30 bg-panel p-4 space-y-2"
    >
      <div className="flex items-start gap-2">
        <Hand size={16} className="flex-none mt-0.5 text-info" aria-hidden="true" />
        <h3 className={typography.panelHeader} data-testid="v5-held-proposal-heading">
          {HELD_PROPOSAL_HEADING}
        </h3>
      </div>

      <p className={typography.panelBody} data-testid="v5-held-proposal-summary">
        {block.summary}
      </p>

      <p
        className={`${typography.panelMeta} text-text-light`}
        data-testid="v5-held-proposal-reason"
      >
        {heldProposalReasonText(block.reason_code)}
      </p>

      {settled === null ? (
        <div className="flex flex-wrap gap-2 pt-1" data-testid="v5-held-proposal-actions">
          <button
            type="button"
            onClick={handleConfirm}
            aria-label={confirm.label}
            className={CHIP_CLASS}
            data-testid="v5-held-proposal-confirm"
          >
            {confirm.label}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss this proposed change"
            className={CHIP_CLASS}
            data-testid="v5-held-proposal-dismiss"
          >
            {decline ? decline.label : HELD_PROPOSAL_DISMISS_LABEL}
          </button>
        </div>
      ) : (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="v5-held-proposal-settled"
          role="status"
        >
          {settled === 'accepted' ? HELD_PROPOSAL_CONFIRMED_ACK : HELD_PROPOSAL_DISMISSED_ACK}
        </p>
      )}
    </div>
  )
}

export default V5HeldProposalBlock
