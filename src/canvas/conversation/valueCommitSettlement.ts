/**
 * Shared settlement logic for a VALUE commit whose local optimistic write may
 * be REVERTED by a later server refusal — extracted so the inspector's value
 * editor (`FactorControllablePanel`) and the on-canvas card editor
 * (`NodeValueEditor`) cannot drift apart on what counts as "not saved"
 * (CLAUDE.md trap 12: a rule written on one carrier and swept to neither
 * sibling is how this estate's settlement defects keep recurring — see
 * `settleSystemEventSend.ts`'s own header for the canonical instance).
 *
 * ⚠ THIS IS NOT THE SAME QUESTION `settleSystemEventSend` ANSWERS, and the two
 * are not interchangeable. That module classifies what happened to the SEND
 * ITSELF, from the promise `sendSystemEvent` returns — five states including
 * `refused` and `unverified`, available only to a caller holding that promise.
 * `didValueCommitRevert` below answers a narrower, OBSERVABLE question — "did
 * the value visibly move away and then back?" — the one signal available to a
 * caller that never sees the promise at all. `NodeValueEditor` is exactly that
 * caller: it is handed a synchronous `onCommit` outcome
 * (`'dispatched' | 'local_only' | 'not_encodable'`) by
 * `useModelEditAuthority.proposeFactorValue`, whose own send settles inside a
 * closure this component cannot reach. See `NodeValueEditor.tsx`'s header for
 * the full reasoning and the one thing this predicate genuinely cannot tell
 * apart (a slow-but-successful commit from a lost one).
 */
import type { SystemEventSendSettlement } from './settleSystemEventSend'

/** Every settlement word a value-commit editor may show after a dispatch. */
export type ValueCommitSettlementWord = 'saving' | 'not_applied' | 'unconfirmed' | 'local_only'

/**
 * Did an optimistic write REVERT?
 *
 * Mirrors the exact predicate `FactorControllablePanel.commitValue` inlines at
 * its settle (`seedAfterWrite !== seedBeforeWrite && seedNow === seedBeforeWrite`,
 * alongside its own `outcome !== SEND_DEFERRED` guard, which is specific to
 * that caller's access to the real send outcome and is NOT part of this
 * shared predicate).
 *
 * ⚠ BOTH HALVES ARE REQUIRED, AND THE ORDER OF THE COMPARISON WITHIN THIS
 * FUNCTION'S DOC IS NOT INCIDENTAL. Comparing only "is it back to the value it
 * held before the commit?" would misreport as a revert the ordinary case where
 * the optimistic write has SIMPLY NOT LANDED YET — nothing has moved, so
 * `observedNow === beforeCommit` is trivially true from the first render. This
 * predicate requires the optimistic write to have visibly LANDED FIRST
 * (`optimisticallyWrittenTo !== beforeCommit`) before treating a return to the
 * original value as meaningful.
 *
 * @param beforeCommit — the value the field showed immediately before this
 *   commit (the pre-write seed).
 * @param optimisticallyWrittenTo — the value this commit optimistically wrote
 *   (what the caller sent — model-scale, user-unit, or whatever frame the
 *   field itself displays; both arguments must share ONE scale, the caller's).
 * @param observedNow — the LIVE value at the moment being checked.
 */
export function didValueCommitRevert(
  beforeCommit: number | null | undefined,
  optimisticallyWrittenTo: number | null | undefined,
  observedNow: number | null | undefined,
): boolean {
  return optimisticallyWrittenTo !== beforeCommit && observedNow === beforeCommit
}

/**
 * The word + ARIA role a caller should render for one settlement state.
 *
 * ⚠ `role: 'alert'` ONLY ON `not_applied` — the one state this predicate can
 * assert with confidence (a genuine, observed revert). `saving` and
 * `unconfirmed` are both honest UNCERTAINTY, never a confirmed problem, so
 * they take the non-interrupting `status` role — the same split
 * `FactorControllablePanel` already draws between its `role="alert"`
 * not-applied notice and its non-alert `EditConfirmation` pending states.
 *
 * ⚠ THE `not_applied` STRING IS COPIED VERBATIM FROM `FactorControllablePanel`
 * (straight apostrophe, matching its JSX `&apos;`) rather than reworded, so
 * the two surfaces say the identical sentence for the identical fact.
 */
export const VALUE_COMMIT_SETTLEMENT_COPY: Record<
  ValueCommitSettlementWord,
  { readonly message: string; readonly role: 'alert' | 'status' }
> = {
  saving: { message: 'Saving…', role: 'status' },
  not_applied: {
    message: 'Not saved. The model kept its previous value; Olumi\'s reply says why.',
    role: 'alert',
  },
  unconfirmed: {
    message: 'Could not confirm. It may not have reached the model.',
    role: 'status',
  },
  /** The busy lock refused the send: nothing reached the server. */
  local_only: {
    message: 'Saved on this device only — not sent to the model yet.',
    role: 'status',
  },
}

/**
 * The sentence for a commit the writer REFUSED to encode — nothing was written
 * anywhere (`proposeFactorValue` → `'not_encodable'`).
 *
 * ⭐ ONE OWNER FOR TWO SURFACES (26 Sep 2026). It lived as an inline literal in
 * `NodeValueEditor`; the canvas context menu's Set value now proposes through
 * the same writer and must say the same sentence for the same outcome, so the
 * literal moved here rather than being copied beside it (trap 12).
 */
export const VALUE_NOT_ENCODABLE_COPY = 'This value cannot be sent to the model yet.'

/**
 * Which word a dispatched value commit settles on — or `null` for "say nothing".
 *
 * ⭐ EXTRACTED FROM `NodeValueEditor.commit`'s `onSendSettled`, VERBATIM, so the
 * card and the canvas context menu cannot disagree about what a settlement
 * means (26 Sep 2026). The mapping and its reasons are that component's header:
 *
 *   refused → `not_applied` · unverified → `unconfirmed` · blocked → `local_only`
 *   queued → nothing (the flush queue owns it) · sent → `not_applied` only when
 *   the live value visibly REVERTED (`didValueCommitRevert`), else nothing.
 *
 * `readNow` is a THUNK, read only on `'sent'`, because the caller's live value
 * must be read at settlement time, not when the commit was made.
 *
 * All three numbers share ONE scale — the scale of the field the number was
 * typed into (`resolveValueInputSeed`), exactly as `didValueCommitRevert` requires.
 */
export function valueCommitSettlementWord(
  settlement: SystemEventSendSettlement,
  beforeCommit: number | null | undefined,
  committedTo: number | null | undefined,
  readNow: () => number | null | undefined,
): ValueCommitSettlementWord | null {
  if (settlement === 'refused') return 'not_applied'
  if (settlement === 'unverified') return 'unconfirmed'
  if (settlement === 'blocked') return 'local_only'
  if (settlement === 'queued') return null
  return didValueCommitRevert(beforeCommit, committedTo, readNow()) ? 'not_applied' : null
}
