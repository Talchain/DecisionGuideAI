/**
 * heldProposalReasonCopy — user-facing copy for a held CEE graph mutation.
 *
 * The 0.18.0 HeldProposalBlockSchema carries `reason_code` as a code-keyed
 * enum ON PURPOSE: "a consumer maps each code to its OWN user-facing copy, so
 * the internal-doctrine-prose leak 1.43 flagged in `blocker_readable` cannot
 * recur through this block" (schema doctrine note). This module IS that
 * mapping for the UI.
 *
 * Rules (DESIGN_SYSTEM.md "Canonical State Copy"):
 *   - Every sentence is an exported constant, so chat/panel/card cannot drift.
 *   - British English, no em dashes, no internal vocabulary. The card never
 *     renders the raw code, `mutation_class`, or the `held_proposal` token.
 *   - Unknown / future codes fall through to REASON_HELD_GENERIC — the block
 *     still renders honestly (fail-closed), no UI release needed to add a code.
 *   - Each sentence states only WHY the change is waiting. It makes no claim
 *     about the change's content (that is the producer's `summary`) and no
 *     claim that it has been applied.
 */

/** Verbatim held-reason sentences, keyed by the 0.18.0 reason_code enum. */
export const HELD_PROPOSAL_REASON_COPY = {
  STRUCTURAL_APPLY_HELD:
    'This reshapes your model, so it needs your go-ahead before it is applied.',
  TUNABLE_APPLY_HELD:
    'This adjusts a value in your model, so it needs your go-ahead before it is applied.',
  REMOVE_UNCONFIRMED:
    'This removes something from your model, so it needs your confirmation first.',
  ADD_OPTION_APPLY_UNWIRED:
    'This adds an option that is not yet connected to your model, so it needs your confirmation first.',
  OPTION_TOP_LEVEL_OPTIONS_DIVERGENCE:
    'This changes how your options are organised, so it needs your confirmation first.',
  FRAME_UNAVAILABLE:
    'The current decision framing could not be read, so this change is waiting for your confirmation.',
  CURRENT_GRAPH_UNREADABLE:
    'The current model could not be read cleanly, so this change is waiting for your confirmation.',
  CLASSIFY_FAILED:
    'This change could not be sorted automatically, so it is waiting for your confirmation.',
} as const

/** Fallback for any code outside the pinned set (future / unknown). */
export const REASON_HELD_GENERIC =
  'This change is waiting for your confirmation before it is applied.'

/**
 * Resolve a reason_code to its user-facing sentence. Never throws: an unknown
 * code returns the generic held sentence, so a producer that mints a new code
 * degrades to honest copy rather than a blank or a raw token.
 */
export function heldProposalReasonText(reasonCode: string): string {
  return (
    (HELD_PROPOSAL_REASON_COPY as Record<string, string>)[reasonCode] ??
    REASON_HELD_GENERIC
  )
}

// ---------------------------------------------------------------------------
// Card chrome copy (fixed, UI-owned — never producer text).
// ---------------------------------------------------------------------------

/** Card heading. States the situation, makes no claim about the change. */
export const HELD_PROPOSAL_HEADING = 'Waiting for your go-ahead'

/** UI-owned dismiss affordance label (the confirm label is the producer's). */
export const HELD_PROPOSAL_DISMISS_LABEL = 'Not now'

/**
 * UI-owned confirm label used ONLY when the producer signals that it clamped
 * its own chip label — i.e. when `Action.detail` is present and differs from
 * `label` (ROADMAP 2.474 residual (a)).
 *
 * WHY THIS CONSTANT EXISTS. CEE clamps a multi-operation confirm label to 60
 * characters on purpose (`buildGmHeldPublicCopy`: a ~300-character chip is
 * unusable) and ships the complete sentence in `detail`. Rendering the clamped
 * form put a sentence that stops mid-word on the control, in its accessible
 * name, and — via the chip seam's display text — in the PERMANENT TRANSCRIPT,
 * so the record of what the user agreed to ended in an ellipsis. The complete
 * sentence goes to the accessible name and the record; the control itself
 * carries this short, COMPLETE label instead of a fragment.
 *
 * It states the user's action and makes no claim about the change's content —
 * that claim belongs to the producer's `summary`, rendered directly above.
 */
export const HELD_PROPOSAL_CONFIRM_CLAMPED_LABEL = 'Confirm these changes'

/**
 * Acknowledgement shown after the user confirms. States the user's action, not
 * the outcome: the change is applied by CEE on the next turn, so the card must
 * not claim it is already applied.
 */
export const HELD_PROPOSAL_CONFIRMED_ACK = 'Sent for you to apply.'

/** Acknowledgement shown after the user dismisses. */
export const HELD_PROPOSAL_DISMISSED_ACK = 'Dismissed.'
