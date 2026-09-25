/**
 * ONE owner for "the reader set an effect on this option".
 *
 * ⭐ IT EXISTS BECAUSE TWO SURFACES ASK THE SAME QUESTION, and this estate's
 * most expensive defect class is two surfaces answering it differently. The
 * option panel's intervention rows and `OptionAdvancedEditor`'s tech-mode rows
 * are the same gesture on the same data; before this they were two calls to
 * `mutations.setIntervention`, and a fix applied to one would have left the
 * other writing to the browser only — which is exactly the state this hook was
 * created to end (3 of 5 options on the founder's board carried no effect at
 * all, bundle `95b92672`).
 *
 * ⛔ NO LOCAL STORE WRITE. That is `useModelEditAuthority`'s ruling, not a
 * choice made here: *"the goal draft never changes the store before a real
 * applied response"*. The applied `graph_patch` owns the write.
 *
 * ⭐ WHICH IS WHY `pending` EXISTS. The row must still respond to the reader
 * while the turn is in flight — the same shape `EdgePanel` keeps for
 * `localStrength`. Without it the number visibly snaps back on every edit,
 * which reads as a broken control and is a worse lie than the one being fixed.
 * It is display state and nothing else: it is never read by a writer.
 *
 * ⛔ EVERY REFUSAL IS DISCLOSED, per the authority's own instruction that a
 * refusal "must be DISCLOSED by the caller, never silently swallowed". The two
 * are named apart because only ONE of them the reader can clear:
 * `needs_fresh_base` is the ordinary state after a reload (a restore reads
 * persistence with no CEE turn) and names its recovery; `not_encodable` does
 * not pretend to have one.
 *
 * ⛔⛔ AND THE SERVER'S ANSWER IS DISCLOSED TOO — THIS HOOK DID NOT LISTEN FOR IT.
 * It handled the two SYNCHRONOUS refusals and treated `dispatched` as the end of
 * the story: `proposeOptionIntervention` was called without `onSendSettled`, so
 * `settleSystemEventSend` had nobody to tell. Witnessed on served UI
 * `a4434670` (24 Sep 2026, CDP starter): CEE answered two option-target edits
 * with 422 `system_event_refused_no_write`, the inspector said NOTHING, the
 * field kept the refused number as if it were pending forever, and reopening
 * the inspector silently showed the old value. The Model tab's editor on the
 * same carrier has listened since its settlement leg; this surface was the
 * sibling that repair did not reach.
 *
 * So every non-`sent` settlement now ends the pending state and says what is
 * known, in the estate's edit-state vocabulary — "Not saved" only where the
 * producer PROVED nothing was written, "Could not confirm" where a write is not
 * ruled out, "Not sent" where no request left — and the value the reader asked
 * for stays on the row as UNAPPLIED until they dismiss it or try again.
 */

import { useCallback, useRef, useState } from 'react'
import {
  useModelEditAuthority,
  type OptionInterventionProposalOutcome,
  type OptionInterventionSendSettlement,
} from '../../../hooks/useModelEditAuthority'
import type { SystemEventSendSettlementDetail } from '../../../conversation/settleSystemEventSend'
import { fenceRefusalCopyForCategory } from '../../../../v5/failureTypeRetryability'
import { isDisplaySafeReason } from '../../../conversation/ceeRecovery'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE COPY — ONE SHAPE: `<state> · <specific reason>`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Experience Design's ruling for a refused option-target edit (#63
 * 5806266691, S2): *"`Not saved · <specific reason>` directly under the field,
 * keep the user's typed value visible, and offer retry/change/discard as
 * appropriate."* Every sentence below is that shape, so the row can print it
 * verbatim under its field and a spec binds the exact string the reader reads.
 *
 * ⚠ THE STATE WORD IS STILL THE ESTATE'S EDIT-STATE VOCABULARY, and the ruling
 * does not license flattening it: `Could not confirm` wherever a write is NOT
 * ruled out (never `Not saved` there); `Not sent` where the authority or the
 * busy lock stopped the request before it left; `Not saved` where the edit was
 * refused and nothing was written — CEE's proven no-write here, or the field's
 * own entry check (`optionTargetEntry`, same shape). The ruling fixes the shape
 * and the placement; the word stays the truth about the write.
 *
 * The copy lives here rather than at each surface for the same reason the hook
 * does: the panel's rows and `OptionAdvancedEditor` describe one refusal one way.
 */
export const OPTION_INTERVENTION_NEEDS_FRESH_BASE =
  'Not sent · Olumi has not seen this model this session. Ask it anything, then set this again.'
export const OPTION_INTERVENTION_NOT_ENCODABLE =
  'Not sent · this effect cannot be recorded on this model.'

/**
 * `SEND_BLOCKED` — the busy lock refused the dispatch, so no request was built.
 * The only settlement entitled to say "not sent"; a retry can succeed, so the
 * row offers one.
 */
export const OPTION_INTERVENTION_BLOCKED =
  'Not sent · another change is still in flight. Try again in a moment.'

/**
 * `refused` / `conflict` — a proven-no-write CONFLICT: the model moved on under
 * the send. The recovery named is the one that refreshes the base (a turn), the
 * same one `OPTION_INTERVENTION_NEEDS_FRESH_BASE` names for the same problem
 * arriving one moment earlier.
 */
export const OPTION_INTERVENTION_NOT_SAVED_CONFLICT =
  'Not saved · the model changed while this was sending, so nothing was written. Ask Olumi anything, then set this again.'

/**
 * `refused` / `declined` — the producer declined the request itself and states
 * it wrote nothing (`system_event_refused_no_write`, `retryable: false`).
 *
 * ⚠ NO REMEDY IS OFFERED, DELIBERATELY. The envelope says repeating the request
 * cannot succeed, and it does not say why — so "set it again" and "the model
 * moved on" would both be false, and any other route would be a guess this
 * surface cannot check. What it CAN say truthfully is that the model is
 * unchanged; the row's Discard control puts the saved value back on screen.
 *
 * Voice-neutral on purpose: the Model tab's editor on the same carrier says it
 * too (`ModelTabV2Panel`), and it speaks as "I" where this panel says "Olumi".
 */
export const OPTION_INTERVENTION_NOT_SAVED_DECLINED =
  'Not saved · this change was refused, so the model is unchanged.'

/**
 * ⛔ NO INFERRED CAUSE (Codex CHANGES_REQUIRED 5807262127, #1930).
 *
 * A CEE 422 carrying `details.reason: 'system_event_refused_no_write'` proves NO
 * WRITE, not WHY: `prepareOptionInterventionEdit` can refuse for
 * `canonical_graph_unavailable`, `unresolved_identity`,
 * `unresolved_effect_relationship` or `noncanonical_intervention_source`
 * before it ever reads the existing cell's source. A locally source-less row is
 * therefore NOT evidence of the cause, and this surface no longer promotes it
 * to one. A decline reads the generic line (plus the producer's own words when
 * they are display-safe); a specific cause returns only when CEE states it
 * (routed on #63, 5807024712).
 */

/**
 * `unverified` — a write is NOT ruled out. It may claim neither saved nor
 * refused nor unsent; it names the action that SHOWS the answer instead of
 * guessing it. The inspector-voice twin of the Model tab's line for the same
 * settlement. Setting a target is idempotent (CEE answers a repeat of the held
 * value as `verified_no_op`), so the row may offer a retry.
 */
export const OPTION_INTERVENTION_UNCONFIRMED =
  'Could not confirm · the model may or may not have this value. Ask Olumi anything about this decision to see where it stands.'

/**
 * The declined line, with the producer's own reason appended WHEN IT IS PROSE.
 * A machine token (`system_event_refused_no_write`) is never shown — the
 * estate's one gate for that is `isDisplaySafeReason`, the same one the
 * transcript's typed-error bubble uses.
 */
export function optionInterventionDeclinedNotice(reason?: string): string {
  return reason !== undefined && isDisplaySafeReason(reason)
    ? `${OPTION_INTERVENTION_NOT_SAVED_DECLINED} Reason given: ${reason.trim()}`
    : OPTION_INTERVENTION_NOT_SAVED_DECLINED
}

/**
 * The state word a ROW shows for a value that did not land — the first half of
 * its message. Kept as its own field so a reader of the state (a spec, a
 * future surface) does not have to parse a sentence for it.
 */
export type OptionInterventionUnappliedState = 'Not sent' | 'Not saved' | 'Could not confirm'

export interface OptionInterventionUnapplied {
  factorId: string
  /** The MODEL-SCALE value the reader asked for. The model does not (or may not) hold it. */
  value: number
  state: OptionInterventionUnappliedState
  /** The full `<state> · <specific reason>` sentence, printed under the field. */
  message: string
  /** Can sending the same value again succeed? Only then does the row offer "Try again". */
  retryable: boolean
}

export interface OptionInterventionCommit {
  /** Send one effect value. Returns the authority's outcome, unflattened. */
  commit: (factorId: string, value: number) => OptionInterventionProposalOutcome
  /** Display-only: the value this row should show while a send is in flight. */
  pending: { factorId: string; value: number } | null
  /**
   * The refusal to show the reader, or null — the same sentence as
   * `unapplied.message`, for a surface that has no row to put it under.
   */
  notice: string | null
  /**
   * The value the reader asked for that did NOT land, or may not have — kept on
   * screen, marked, until `dismiss` or the next commit. Display state only: it
   * is never written to the store.
   */
  unapplied: OptionInterventionUnapplied | null
  /** Drop the unapplied value and its notice; the row shows the saved value again. */
  dismiss: () => void
}

type Described = Pick<OptionInterventionUnapplied, 'state' | 'message' | 'retryable'>


/** Every non-`sent` settlement, mapped once. `sent`/`queued` keep waiting. */
function describeSettlement(
  settlement: Exclude<OptionInterventionSendSettlement, 'sent' | 'queued'>,
  detail: SystemEventSendSettlementDetail,
): Described {
  if (settlement === 'blocked') {
    return { state: 'Not sent', message: OPTION_INTERVENTION_BLOCKED, retryable: true }
  }
  if (settlement === 'refused') {
    // ⭐ A STOPPED or SUPERSEDED turn (CEE #1868 `turn_fence_*`) settles `conflict` too,
    // and "the model changed" is false about it. The fence states its own cause.
    const fence = fenceRefusalCopyForCategory(detail.conflictCategory)
    if (fence) return { state: 'Not saved', message: fence, retryable: false }
    if (detail.refusal !== 'declined') {
      return { state: 'Not saved', message: OPTION_INTERVENTION_NOT_SAVED_CONFLICT, retryable: false }
    }
    return {
      state: 'Not saved',
      message: optionInterventionDeclinedNotice(detail.reason),
      retryable: false,
    }
  }
  return { state: 'Could not confirm', message: OPTION_INTERVENTION_UNCONFIRMED, retryable: true }
}

export function useOptionInterventionCommit(nodeId: string | null): OptionInterventionCommit {
  const authority = useModelEditAuthority(nodeId ?? null)
  const [pending, setPending] = useState<{ factorId: string; value: number } | null>(null)
  const [unapplied, setUnapplied] = useState<OptionInterventionUnapplied | null>(null)
  /**
   * ⭐ FENCED BY THE ATTEMPT, minted per commit and never reused. A late
   * settlement for an edit the reader has since replaced must not relabel the
   * newer one — the Model tab proved that hole reachable on this same carrier
   * (`interventionSettlementIdentity.spec.tsx`).
   */
  const attemptRef = useRef(0)

  const commit = useCallback(
    (factorId: string, value: number): OptionInterventionProposalOutcome => {
      const attempt = ++attemptRef.current
      setPending({ factorId, value })
      setUnapplied(null)
      const outcome = authority.proposeOptionIntervention(factorId, value, {
        onSendSettled: (settlement, detail) => {
          if (attemptRef.current !== attempt) return
          // `sent`: the applied response settles the value through the store.
          // `queued`: unreachable while the carrier passes `deferIfBusy: false`.
          if (settlement === 'sent' || settlement === 'queued') return
          setPending(null)
          setUnapplied({ factorId, value, ...describeSettlement(settlement, detail) })
        },
      })
      if (outcome === 'dispatched') return outcome
      // Any refusal clears the optimistic display: showing the new number as
      // though it were in flight beside "not sent" would be the split-brain
      // this hook exists to avoid. It stays on the row as UNAPPLIED instead.
      // Neither refusal clears by repeating the same send, so no retry.
      setPending(null)
      setUnapplied({
        factorId,
        value,
        state: 'Not sent',
        message:
          outcome === 'needs_fresh_base'
            ? OPTION_INTERVENTION_NEEDS_FRESH_BASE
            : OPTION_INTERVENTION_NOT_ENCODABLE,
        retryable: false,
      })
      return outcome
    },
    [authority, nodeId],
  )

  const dismiss = useCallback(() => {
    // A settlement still in flight for the dismissed attempt must not bring it back.
    attemptRef.current += 1
    setUnapplied(null)
  }, [])

  return { commit, pending, notice: unapplied?.message ?? null, unapplied, dismiss }
}
