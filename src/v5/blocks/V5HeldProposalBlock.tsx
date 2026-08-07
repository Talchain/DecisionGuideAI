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
 * CONSENT COMPLETENESS (ROADMAP 2.474 residual (a), witnessed live 5 Aug 2026).
 * The producer CLAMPS a multi-operation confirm label to 60 characters and
 * ships the complete sentence in `Action.detail`. Rendering the clamped form
 * put a sentence that stopped mid-word on the control, into its accessible
 * name, and — through the chip seam's display text — into the PERMANENT
 * TRANSCRIPT, so the record of what the user agreed to ended in an ellipsis.
 * `resolveHeldConfirmCopy` below is the single place that resolves this: the
 * accessible name and the consent record are always COMPLETE, and the visible
 * label is never a fragment.
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
 * confirm click is a safe no-op AND the card does not acknowledge, because
 * nothing was sent; the affordance stays live so the user can confirm once a
 * host registers. Malformed blocks never reach here — the mapper degrades an
 * unresolvable confirm ref to the R7 unsupported card. Unknown `reason_code`
 * values degrade to the generic held sentence, never the raw code.
 */
import { type ReactElement, useCallback, useState } from 'react'
import { Hand } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { CHIP_CLASS } from './chipClass'
import type {
  V5HeldProposalBlock as V5HeldProposalBlockType,
  V5HeldProposalAction,
} from '../../canvas/conversation/types'
import {
  heldProposalReasonText,
  HELD_PROPOSAL_HEADING,
  HELD_PROPOSAL_DISMISS_LABEL,
  HELD_PROPOSAL_CONFIRM_CLAMPED_LABEL,
  HELD_PROPOSAL_CONFIRMED_ACK,
  HELD_PROPOSAL_DISMISSED_ACK,
} from './heldProposalReasonCopy'

export interface V5HeldProposalBlockProps {
  block: V5HeldProposalBlockType
}

/** The three strings the confirm affordance needs, resolved together. */
export interface HeldConfirmCopy {
  /** Rendered on the control. Always COMPLETE — never a clamped fragment. */
  readonly visible: string
  /** The control's accessible name. COMPLETE, and contains `visible`. */
  readonly accessibleName: string
  /** Display text handed to the chip seam — the PERMANENT consent record. */
  readonly record: string
}

/**
 * Resolve the confirm affordance's copy from the producer action.
 *
 * `detail` (0.19.0 `Action.detail`) is the producer's own signal that it
 * CLAMPED `label`: CEE emits it exactly when clamping shortened the label, and
 * omits it when the label already says everything
 * (`edit-graph-referee-gate.ts :: buildGmHeldPublicCopy`).
 *
 *   - No detail (or detail === label) → the label is already complete. Render
 *     it verbatim, name it verbatim, record it verbatim. Zero behaviour change.
 *   - Detail present → the label is a fragment. The control carries the
 *     UI-owned SHORT COMPLETE label; the accessible name and the consent
 *     record carry the producer's COMPLETE sentence.
 *
 * WCAG 2.5.3 "Label in Name" holds in both branches: the accessible name is
 * either the visible label itself, or the ratified `${visible}: ${detail}`
 * construction, which contains it. A speech-input user can always activate the
 * control by the words on screen — which is precisely what the clamped form
 * made impossible, since its visible words ended mid-word in an ellipsis.
 */
export function resolveHeldConfirmCopy(action: V5HeldProposalAction): HeldConfirmCopy {
  const detail = typeof action.detail === 'string' ? action.detail.trim() : ''
  if (detail.length === 0 || detail === action.label) {
    return { visible: action.label, accessibleName: action.label, record: action.label }
  }
  return {
    visible: HELD_PROPOSAL_CONFIRM_CLAMPED_LABEL,
    accessibleName: `${HELD_PROPOSAL_CONFIRM_CLAMPED_LABEL}: ${detail}`,
    record: detail,
  }
}

export function V5HeldProposalBlock({ block }: V5HeldProposalBlockProps): ReactElement {
  const sendChip = useGuidanceStore((s) => s._sendChip)
  const [settled, setSettled] = useState<null | 'accepted' | 'dismissed'>(null)

  const { confirm, decline } = block

  /** Visible dismiss text: the producer's decline label when CEE emits one. */
  const dismissLabel = decline ? decline.label : HELD_PROPOSAL_DISMISS_LABEL

  /** Complete confirm copy — see resolveHeldConfirmCopy. */
  const confirmCopy = resolveHeldConfirmCopy(confirm)

  const handleConfirm = useCallback(() => {
    if (settled) return
    // Fail closed WITHOUT acknowledging: with no conversation host registered
    // there is nothing to send, and "Sent for you to apply." would be a false
    // claim. Return early so the affordance stays live and the user can confirm
    // once a host registers (the EvidenceBlock "Apply to model" precedent —
    // InlineBlocks `if (!sendChip) return`). Re-firing is already bounded by the
    // `settled` guard above on the success path.
    if (!sendChip) return
    // Single-writer apply path: send the producer's confirm message as a turn;
    // CEE applies the held mutation server-side. No client-minted mutation.
    //
    // Arg 0 is the DISPLAY text — `dispatchAction` passes it as `displayText`,
    // which becomes the user's bubble in the permanent transcript. That bubble
    // IS the record of what was consented to, so it carries the COMPLETE
    // sentence, never the producer's clamped chip label (2.474 residual (a)).
    // Arg 1 is untouched: CEE's exact-match pre-route resolves a confirm by the
    // message, so clamping or rewriting it would break hold routing.
    sendChip(confirmCopy.record, confirm.message)
    setSettled('accepted')
  }, [settled, sendChip, confirmCopy.record, confirm.message])

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
            // COMPLETE accessible name: a screen-reader user's entire notion of
            // what this control does is this string, so it names every
            // operation. Contains the visible label (WCAG 2.5.3).
            aria-label={confirmCopy.accessibleName}
            title={confirmCopy.accessibleName}
            className={CHIP_CLASS}
            data-testid="v5-held-proposal-confirm"
          >
            {confirmCopy.visible}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            // WCAG 2.5.3 "Label in Name": the accessible name must CONTAIN the
            // visible label, or speech input cannot activate the control by its
            // visible words. Built with the ratified SuggestedChips construction
            // (`${prefix}: ${label}`), so it holds for the producer's decline
            // label too, not just the UI-owned default.
            aria-label={`Dismiss: ${dismissLabel}`}
            className={CHIP_CLASS}
            data-testid="v5-held-proposal-dismiss"
          >
            {dismissLabel}
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
