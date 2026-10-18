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
import { REVISION_CONFLICT_NOTICE } from '../../v5/failureTypeRetryability'
import { listModelVersions } from '../../adapters/cee/modelVersions'
import { noteCanvasLocalCommit } from '../analysis/useAnalyseAfterCommittedChange'
import { useCanvasStore } from '../store'
import type { SystemEventSendSettlementDetail, SystemEventSendSettlement } from './settleSystemEventSend'

/** Every settlement word a value-commit editor may show after a dispatch. */
export type ValueCommitSettlementWord =
  | 'saving'
  | 'not_applied'
  | 'unconfirmed'
  | 'local_only'
  | 'revision_conflict'
  | 'checking'
  | 'saved'
  | 'refused'
  | 'refused_unread'

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
 * ⚠ `role: 'alert'` on `not_applied` and revision refusal — the one state this predicate can
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
  revision_conflict: { message: REVISION_CONFLICT_NOTICE, role: 'alert' },
  saving: { message: 'Saving…', role: 'status' },
  not_applied: {
    message: 'Not saved. The model kept its previous value; Olumi\'s reply says why.',
    role: 'alert',
  },
  /**
   * The server refused the send and the model still holds the value it had. A refused system event gets NO reply (no
   * transcript bubble), so this never says "Olumi's reply says why" (`goalTargetEdit.ts` learned the same; served
   * `live/runs/2026-10-12T144844Z/capacity`, row 6). `not_applied` keeps that clause for a 200 that wrote nothing: there
   * the reply came.
   */
  refused: { message: 'Not saved. The model kept its previous value.', role: 'alert' },
  refused_unread: {
    message: 'Not saved on this attempt. The latest model could not be refreshed. Reload it before editing again.',
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
  /** A moved-base refusal: the saved model is being read before anything is said (`awaitSavedModelRead`). */
  checking: { message: 'Checking the saved model…', role: 'status' },
  /** The saved model, read after a moved-base refusal, already holds the committed value. */
  saved: { message: 'Saved. The model holds this value.', role: 'status' },
}

/**
 * The conflict categories that mean "the saved model MOVED under this send" — the base hash it carried is no longer
 * the stored one. The stale-base, CAS, delete-divergence and revision-CAS members of
 * `PROVEN_NO_WRITE_CONFLICT_CATEGORIES`, and no others: a fence verdict (`turn_fence_*`) moves nothing.
 *
 * `revision_conflict` is the revision CAS (expected revision N, current N+1): the model moved, by another tab's edit or
 * by this edit's own lost reply. Served `live/runs/2026-10-12T144844Z/capacity`, row 6: tab B's 2 → 5 got 409
 * `revision_conflict` because tab A's 2 → 4 landed first, and the card said "Not saved. The model kept its previous value;
 * Olumi's reply says why." over a model holding 4, with no reply. So it reads the saved model too.
 */
const MOVED_BASE_CONFLICT_CATEGORIES: ReadonlySet<string> = new Set([
  'stale_base_graph_hash',
  'BASE_HASH_DIVERGED',
  'rpc_cas_conflict',
  'revision_conflict',
])

/**
 * ⭐ A REFUSAL ON A MOVED BASE SAYS NOTHING ABOUT WHAT THE MODEL HOLDS (recovery Batch B, served
 * `live/runs/2026-10-12T001307Z/capacity`, row 7a).
 *
 * The server certifies that THIS send wrote nothing. It does not say the model kept the value it had before: the base
 * moved because something else was written, and after a lost reply that something is usually this same edit. Served:
 * "Add one specialist" 1 → 2, the 200 was dropped after the server stored 2, the user re-entered 2, the retry carried the
 * old base and got 409 `stale_base_graph_hash` — and the card said "Not saved. The model kept its previous value" over a
 * model holding 2. So on these categories the editor reads the saved model before it speaks.
 */
export function needsSavedModelRead(
  settlement: SystemEventSendSettlement,
  detail: SystemEventSendSettlementDetail = {},
): boolean {
  return settlement === 'refused' && detail.refusal === 'conflict' &&
    detail.conflictCategory !== undefined && MOVED_BASE_CONFLICT_CATEGORIES.has(detail.conflictCategory)
}

/** What a moved-base refusal says once the saved model has been read, or could not be. */
export type SavedModelReadWord = 'saved' | 'refused' | 'revision_conflict' | 'refused_unread'

/** How long a moved-base refusal waits before reporting that the current model could not be refreshed. */
export const SAVED_MODEL_READ_TIMEOUT_MS = 30_000

/**
 * Wait for the saved model, then say what it holds. Returns a cancel.
 *
 * A proven-no-write 409 on a graph-writing event already requests the canonical re-read (`refusedGraphRefresh`); this
 * does not read anything itself. "The saved model has been read" is the write base moving off `baseBeforeRead` (the
 * base when the refusal settled, before that re-read can run) — every writer of `lastServerGraphHash` sets it beside the
 * graph it read. Then:
 *   the model holds the committed value → `saved` (no second write: a 409 on the retry means it was already applied) ·
 *   it holds the value from before the commit → `refused` (a genuine refusal; nothing moved for this field) ·
 *   it holds a third value → `revision_conflict` (another change got in first: "The scenario changed while I was
 *   saving, so nothing was saved", CEE's own 409 sentence) · no read within the timeout → `refused_unread`: this
 *   attempt was refused, while the latest held value remains unknown. A failed read cannot undo the server's no-write
 *   guarantee or claim that an earlier attempt did not land. None of these claims a reply: a refused send has none.
 * The value is read one task after the base moves, so a writer that sets the hash and the graph in separate store
 * updates is read whole.
 */
export function awaitSavedModelRead(opts: {
  baseBeforeRead: string | null
  readBase: () => string | null
  subscribe: (listener: () => void) => () => void
  beforeCommit: number | null | undefined
  committedTo: number | null | undefined
  readNow: () => number | null | undefined
  onWord: (word: SavedModelReadWord) => void
  /**
   * Takes back one of this editor's own sends whose outcome is unknown, by its `turn_id`: true once, if it is one.
   * Only a `saved` read whose current version that send wrote is this editor's commit (`ownSavedVersion`).
   */
  claimOwnSend?: (turnId: string) => boolean
  timeoutMs?: number
}): () => void {
  let done = false
  let readTimer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  const wordFromRead = (held: number | null | undefined): SavedModelReadWord =>
    held === opts.committedTo ? 'saved' : held === opts.beforeCommit ? 'refused' : 'revision_conflict'
  const finish = (word: SavedModelReadWord) => {
    if (done) return
    done = true
    cancel()
    if (word === 'saved' && opts.claimOwnSend) noteOwnSavedVersion(opts.readBase(), opts.claimOwnSend)
    opts.onWord(word)
  }
  const deadline = setTimeout(() => finish('refused_unread'), opts.timeoutMs ?? SAVED_MODEL_READ_TIMEOUT_MS)
  const check = () => {
    if (done || readTimer !== undefined || opts.readBase() === opts.baseBeforeRead) return
    readTimer = setTimeout(() => finish(wordFromRead(opts.readNow())), 0)
  }
  function cancel() {
    clearTimeout(deadline)
    if (readTimer !== undefined) clearTimeout(readTimer)
    unsubscribe?.()
    unsubscribe = undefined
    done = true
  }
  unsubscribe = opts.subscribe(check)
  check()
  return cancel
}

/**
 * The version this editor's own earlier send wrote, when the scenario's current version is it; else `null`.
 *
 * ⛔ THE VALUE NEVER PROVES WHO SAVED IT (PL-C3-FOREIGN-COMMIT-0505). A 409 proves only that the retry wrote nothing,
 * and another tab saving the same value leaves the same model. The current version's `creation.source_turn_id` is the
 * turn that wrote it, in the UI's own `turn_id` space (served list, scenario 91be5d76: version 2c9b40a1 ↔ turn 75028e02,
 * the send whose reply was lost). Only an id `claim` takes back counts. A guest has no versions, so never counts.
 */
async function ownSavedVersion(scenarioId: string, claim: (turnId: string) => boolean): Promise<string | null> {
  // Lazily, as `captureAgentTurnForUndo` does: the session client is needed only on this rare path.
  const { getSessionIdentity } = await import('../../lib/supabase')
  const identity = await getSessionIdentity()
  if (!identity.accessToken) return null
  const listed = await listModelVersions(scenarioId, { userId: identity.userId, accessToken: identity.accessToken, limit: 1 })
  if (listed.status !== 'list') return null
  const head = listed.versions.find(version => version.id === listed.currentVersionId)
  return head?.sourceTurnId && claim(head.sourceTurnId) ? head.id : null
}

/**
 * A lost reply's write, proven this editor's by `ownSavedVersion`, is noted as its commit, once, so its automatic Run
 * follows (served C3, 2026-10-18T034045Z turns 03–04: no response will note it). Only while the canvas still holds the
 * model that read found.
 */
function noteOwnSavedVersion(landed: string | null, claim: (turnId: string) => boolean): void {
  const scenarioId = useCanvasStore.getState().currentScenarioId
  if (!landed || !scenarioId) return
  void ownSavedVersion(scenarioId, claim).then(versionId => {
    const now = useCanvasStore.getState()
    if (versionId && now.currentScenarioId === scenarioId && now.lastServerGraphHash === landed) noteCanvasLocalCommit(versionId)
  }, () => undefined)
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
 *   refused → `refused` (revision uses its exact notice; no reply clause, a refused send has none) ·
 *   unverified → `unconfirmed` · blocked → `local_only`
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
  detail: SystemEventSendSettlementDetail = {},
): ValueCommitSettlementWord | null {
  if (settlement === 'refused') return detail.conflictCategory === 'revision_conflict' ? 'revision_conflict' : 'refused'
  if (settlement === 'unverified') return 'unconfirmed'
  if (settlement === 'blocked') return 'local_only'
  if (settlement === 'queued') return null
  return didValueCommitRevert(beforeCommit, committedTo, readNow()) ? 'not_applied' : null
}
