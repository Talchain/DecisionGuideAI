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
import { type ReactElement, useCallback, useMemo } from 'react'
import { Check, Hand, X } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { dedupeRenderedText, splitRenderSegments } from '../../canvas/conversation/messageComposition'
import { CHIP_CLASS } from './chipClass'
import type {
  V5HeldProposalBlock as V5HeldProposalBlockType,
  V5HeldProposalAction,
} from '../../canvas/conversation/types'
import type { PatchBlockState } from '../../canvas/conversation/useConversation'
import {
  heldProposalReasonText,
  HELD_PROPOSAL_HEADING,
  HELD_PROPOSAL_SETTLED_HEADING,
  HELD_PROPOSAL_DISMISS_LABEL,
  HELD_PROPOSAL_CONFIRM_CLAMPED_LABEL,
  HELD_PROPOSAL_CONFIRMED_ACK,
  HELD_PROPOSAL_DISMISSED_ACK,
} from './heldProposalReasonCopy'

/** How this card is settled, if it is. `null` ⇒ still pending. */
export type HeldProposalSettlement = 'accepted' | 'dismissed'

export interface V5HeldProposalBlockProps {
  block: V5HeldProposalBlockType
  /**
   * This proposal's settlement, read from the conversation's SHARED registry
   * (`patchBlockStates`, via `resolveHeldProposalState`). The card holds NO
   * settlement state of its own — see the state-ownership note below.
   *
   * Absent ⇒ `'proposed'`, i.e. a pending card with live controls.
   */
  settledState?: PatchBlockState
  /**
   * The turn this card is mounted in. Reported back on settle so the host can
   * retire THIS copy with certainty, whatever else it finds in the transcript.
   */
  turnId?: string
  /**
   * Record this proposal's settlement in the shared registry. Called with the
   * PROPOSAL HANDLE and the MOUNT TURN, never a position or a label. The host
   * owns which keys that writes — see `selectors.ts` :: the two questions.
   */
  onSettle?: (
    proposalId: string,
    settlement: HeldProposalSettlement,
    turnId?: string,
  ) => void
}

/**
 * ── STATE OWNERSHIP (SENDABLE failure 5, witnessed 2026-08-22) ──────────────
 *
 * This card used to own `settled` in a component-local `useState`. The canvas
 * mounts TWO conversation surfaces at once — the dock (`OlumiTabBody`) and
 * `FloatingOlumiPanel` — and both render the SAME message list from the SAME
 * singleton `useConversationContext()`. So one held proposal is two or more
 * React instances, and local state is invisible across them: confirming in one
 * surface left the others headed "Waiting for your go-ahead", controls enabled,
 * and a second press produced a refusal from CEE. Four such cards were
 * witnessed live AFTER their deletions had been applied and persisted.
 *
 * The two authorities, named apart (CLAUDE.md trap 21):
 *   · local `useState` answered "did the user click THIS React node?"
 *   · everything else — the user, the other copies, CEE's hold registry —
 *     asks "has this PROPOSAL been settled?"
 * The second question subsumes the first entirely, so the first is deleted
 * rather than reconciled. The canonical owner is `useConversation`'s
 * `patchBlockStates`, the same registry `GraphPatchBlockRenderer` already uses.
 *
 * ⚠ The key is the MOUNT key — turn + handle (`selectors.ts ::
 * heldProposalMountKey`) — NOT the bare handle. A CEE hold handle names a
 * target SLOT and is deliberately re-minted for a later offer against the same
 * target, so a handle-only key leaks a settlement forward onto a proposal the
 * user has never seen and leaves it with no affordance at all. Which copies one
 * settlement retires is a SEPARATE question, answered once at settle time by
 * `heldProposalRetirementKeys`.
 *
 * ⚠ The refusal CEE returns on a stale confirm is deliberately NOT touched.
 * It is the safe behaviour: it declines explicitly and writes nothing. This
 * change removes the affordance that provokes it; it does not weaken the
 * server-side guard behind it.
 */

/**
 * READABILITY OF THE THING BEING CONSENTED TO (scoreboard Q3, 16 Aug 2026).
 *
 * The measured card restated SIX operations in one paragraph, repeating the
 * same 70-character option name five times, each stopping mid-word at
 * `(Under £...`, and the whole plan was ALSO printed as prose above it. A user
 * confirming a structural change could not skim what they were confirming.
 *
 * Three separate fixes, and it matters that they are separate:
 *   · the PROSE duplicate is withheld by the turn's render authority
 *     (`collectConsentSurfaceText` in messageComposition.ts) — the card wins,
 *     because the card is the control the consent is given through;
 *   · the run-on paragraph is rendered as a LIST when the producer already
 *     delimited it by lines. Splitting on `\n` is deterministic and lossless —
 *     every byte still renders, in producer order — and a single-line summary
 *     renders exactly as it does today. NOTHING is inferred from punctuation;
 *   · a line the producer emitted TWICE renders once (item 7's rule, applied
 *     here through the same shared primitive rather than a second local copy).
 *
 * What is NOT done, deliberately: the mid-word `…` truncation is in the
 * PRODUCER's bytes (CEE clamps names before it emits the summary). The UI can
 * wrap what it is given and it can stop repeating it, but reconstructing the
 * clamped name would be fabrication. It is reported, not invented.
 */
function useConsentLines(summary: string): string[] {
  return useMemo(() => {
    const lines: string[] = []
    let rendered: string[] = []
    for (const raw of splitRenderSegments(summary)) {
      if (raw.trim().length === 0) continue
      const { text: survived, suppressedCount } = dedupeRenderedText(raw, rendered)
      // A whole-line duplicate collapses; a line that survives partially is kept
      // verbatim rather than half-rewritten (suppression works on whole
      // segments, and a single line is one segment).
      if (suppressedCount > 0 && survived.trim().length === 0) continue
      lines.push(raw.trim())
      rendered = [...rendered, raw]
    }
    return lines
  }, [summary])
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

export function V5HeldProposalBlock({
  block,
  settledState = 'proposed',
  turnId,
  onSettle,
}: V5HeldProposalBlockProps): ReactElement {
  const sendChip = useGuidanceStore((s) => s._sendChip)

  /**
   * The card's ONLY notion of settlement, derived from the shared registry.
   * `rejected` and `dismissed` are the registry's two decline spellings
   * (`PatchBlockState`); both retire the card the same way, because from the
   * user's side there is one decline.
   */
  const settled: HeldProposalSettlement | null =
    settledState === 'accepted'
      ? 'accepted'
      : settledState === 'dismissed' || settledState === 'rejected'
        ? 'dismissed'
        : null

  const { confirm, decline } = block

  /** Visible dismiss text: the producer's decline label when CEE emits one. */
  const dismissLabel = decline ? decline.label : HELD_PROPOSAL_DISMISS_LABEL

  /** Complete confirm copy — see resolveHeldConfirmCopy. */
  const confirmCopy = resolveHeldConfirmCopy(confirm)

  /** The plan, one change per line, each named once — see useConsentLines. */
  const consentLines = useConsentLines(block.summary)

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
    // Arg 2 carries the PRODUCER's own `action_type` when it emitted one (L-59).
    // Without it this click was a bare text send and CEE routed the apply as
    // ordinary chat — the affordance said "confirm", the reply said "you did not
    // ask me to edit the model". Absent ⇒ omitted, i.e. exactly today's turn.
    sendChip(
      confirmCopy.record,
      confirm.message,
      confirm.action_type ? { action_type: confirm.action_type } : undefined,
    )
    onSettle?.(block.proposal_id, 'accepted', turnId)
  }, [
    settled,
    sendChip,
    onSettle,
    block.proposal_id,
    turnId,
    confirmCopy.record,
    confirm.message,
    confirm.action_type,
  ])

  const handleDismiss = useCallback(() => {
    if (settled) return
    // Decline through the existing chip seam when CEE emits a decline action;
    // otherwise dismiss is local-only (the free-text decline path stays open).
    if (decline) {
      sendChip?.(
        decline.label,
        decline.message,
        decline.action_type ? { action_type: decline.action_type } : undefined,
      )
    }
    onSettle?.(block.proposal_id, 'dismissed', turnId)
  }, [settled, sendChip, decline, onSettle, block.proposal_id, turnId])

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
        {/* The icon carries the same claim as the heading: a settled card must
            not still show the "held" hand. Lucide only, aria-hidden — the
            heading is the accessible statement. */}
        {settled === 'accepted' ? (
          <Check size={16} className="flex-none mt-0.5 text-info" aria-hidden="true" />
        ) : settled === 'dismissed' ? (
          <X size={16} className="flex-none mt-0.5 text-text-light" aria-hidden="true" />
        ) : (
          <Hand size={16} className="flex-none mt-0.5 text-info" aria-hidden="true" />
        )}
        <h3 className={typography.panelHeader} data-testid="v5-held-proposal-heading">
          {settled === null ? HELD_PROPOSAL_HEADING : HELD_PROPOSAL_SETTLED_HEADING}
        </h3>
      </div>

      {/* WRAP, NEVER TRUNCATE (the estate's no-mid-word-wrap rule): the option
          names in a held plan are long, and the dock is narrow. `break-words`
          wraps at word boundaries and only breaks a word that is itself wider
          than the column — it never clips, and there is no `truncate` anywhere
          on this card. A `title` is deliberately NOT added: the full text is
          already on screen, so a tooltip would be a second copy of it. */}
      {consentLines.length > 1 ? (
        <ul
          className={`${typography.panelBody} list-disc pl-4 space-y-1 break-words`}
          data-testid="v5-held-proposal-summary"
          data-consent-line-count={consentLines.length}
        >
          {consentLines.map((line, i) => (
            <li key={i} data-testid={`v5-held-proposal-summary-line-${i}`}>
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={`${typography.panelBody} break-words`}
          data-testid="v5-held-proposal-summary"
          data-consent-line-count={consentLines.length}
        >
          {consentLines[0] ?? block.summary}
        </p>
      )}

      {/* WHY it is held — a present-tense claim ("...so it needs your go-ahead
          before it is applied"), and therefore false once the user has given or
          withheld that go-ahead. Withheld when settled rather than reworded:
          the summary above still says WHAT was proposed, and the ack below says
          what the user did, so nothing is lost and nothing is asserted twice. */}
      {settled === null && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="v5-held-proposal-reason"
        >
          {heldProposalReasonText(block.reason_code)}
        </p>
      )}

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
