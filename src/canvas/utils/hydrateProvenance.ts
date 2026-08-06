/**
 * hydrateProvenance — keep "checked by you" HONEST across a boot-time merge.
 *
 * ROADMAP 2.312 piece 3, adversarial-review finding A1. The overlay primitive
 * is provenance-BLIND, and on this path that is not a cosmetic problem: it
 * breaks the review badge in BOTH directions at once.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE SERVER CANNOT SETTLE THIS BY ITSELF
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ CORRECTED 6 Aug 2026 at CEE's bytes (staging `d5b64246`), because the
 * original reason here has EXPIRED and the conclusion now rests on a different,
 * narrower fact. This block used to read: *"CEE's `ObservedStateV3` types
 * `observed_state.source` as `z.enum(['brief_extraction','cee_inference'])`
 * … the set-factor-value path never writes `source` at all … the server bag is
 * STRUCTURALLY incapable of carrying 'the user checked this'."* **That is no
 * longer true.** ROADMAP 2.396(b) landed the write: `set_factor_value` now
 * merges `source: USER_EDIT_SOURCE` into the persisted `observed_state`
 * (`orchestrator-v5/tools/handlers/set-factor-value.ts:421`) and stamps
 * `node.provenance = 'user_set'` beside it.
 *
 * The conclusion survives for a SMALLER reason, and the size matters:
 * `USER_EDIT_SOURCE` is the single literal `'user_override'`
 * (`orchestrator/canonicalise-value-ops.ts:280`), written for a typed value and
 * for a "confirm as is" alike. So the server can now say A PERSON TOUCHED THIS
 * — it still cannot say WHICH ACT, and it cannot say the person later withdrew
 * the claim. Those two facts live only in the client, so a merge that lets the
 * server decide them is still discarding evidence only the client holds.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TWO FAILURES, AND WHY THEY ARE ONE BUG
 * ─────────────────────────────────────────────────────────────────────────────
 * `mapDraftNodeToCanvas` emits ONLY the camelCase `observedState` key, and
 * `overlayNode` replaces that object WHOLESALE. Meanwhile `isReviewedByUser`
 * resolves `observed_state` (snake) BEFORE `observedState` (camel) — the
 * opposite precedence to `getObservedState`, which the display uses. Hence:
 *
 *   (a) UNDER-CLAIM. A camel-only user stamp is STRIPPED on every boot even
 *       when the value round-tripped byte-identically. The "User edited" pill
 *       disappears and the "N to verify" count grows back on every reload — the
 *       user's work is undone visually while the number is unchanged.
 *
 *   (b) OVER-CLAIM, and this is the serious direction. On a dual-key node the
 *       SNAKE stamp survives (the mapper never emits that key) while the CAMEL
 *       object is replaced by the server's. The display then shows the SERVER'S
 *       number wearing the user's "checked by you" badge — a provenance claim
 *       attached to a number the user never saw, which is the exact defect class
 *       `overlayEdge`'s own orphan-stamp comment already names.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE — honesty in both directions, and it needs both halves
 * ─────────────────────────────────────────────────────────────────────────────
 *   · value UNCHANGED by the merge → PRESERVE the user's stamp (fixes (a));
 *   · value CHANGED by the merge   → the server wins on the value AND every
 *     user stamp is cleared in BOTH spellings and at the top level (fixes (b)).
 *
 * Only USER-OWNED stamps are touched, and membership is decided by
 * `isReviewedSource` — the same predicate that paints the badge, so this can
 * never drift from what the UI actually claims. A producer stamp
 * (`cee_inference`, `brief_extraction`) is left to the overlay, which is the
 * correct owner of it.
 *
 * The comparison is made on the node BEFORE and AFTER the overlay rather than
 * on the wire shape, so it asks the only question that matters — *did the number
 * the user reviewed move?* — without depending on which keys CEE happened to
 * send.
 */

import { isReviewedSource } from '../components/pre-analysis/utils/isReviewedByUser'
import { getObservedState } from './observedStateHelpers'

/** The two spellings of the observed-state bag that carry a `source`. */
const OBSERVED_STATE_KEYS = ['observed_state', 'observedState'] as const

/**
 * The user stamp as it was spelled on the pre-merge node.
 *
 * Recorded per LOCATION rather than collapsed to one value: restoring has to
 * reproduce the shape that was there, and a node stamped in only one spelling
 * must not gain the other (that would silently change which predicate wins).
 */
export interface UserProvenanceSnapshot {
  observed_state?: string
  observedState?: string
  /** Top-level `data.source` — the third rung of `isReviewedByUser`'s chain. */
  top?: string
}

/**
 * Capture the USER-owned source stamps on a node's data, at every location
 * `isReviewedByUser` consults. Producer stamps are deliberately not captured:
 * they are the server's to move.
 */
export function captureUserProvenance(data: unknown): UserProvenanceSnapshot {
  const d = data as Record<string, any> | undefined
  const snapshot: UserProvenanceSnapshot = {}
  for (const key of OBSERVED_STATE_KEYS) {
    const source = d?.[key]?.source
    if (typeof source === 'string' && isReviewedSource(source)) {
      snapshot[key] = source
    }
  }
  if (typeof d?.source === 'string' && isReviewedSource(d.source)) {
    snapshot.top = d.source
  }
  return snapshot
}

/** True when the observed VALUE the user would see is the same on both nodes. */
export function observedValueUnchanged(beforeData: unknown, afterData: unknown): boolean {
  const before = getObservedState(beforeData)
  const after = getObservedState(afterData)
  // `Object.is` so a NaN value compares equal to itself rather than forcing a
  // spurious "changed" verdict that would strip a stamp on every boot.
  return Object.is(before.value, after.value)
}

/**
 * Put the user's stamps back exactly where they were.
 *
 * Only writes a location the snapshot actually held, so a camel-only stamp
 * stays camel-only. Returns the SAME reference when there is nothing to do, so
 * callers keep their no-op detection.
 */
export function restoreUserProvenance(
  data: Record<string, any>,
  snapshot: UserProvenanceSnapshot,
): Record<string, any> {
  const locations = OBSERVED_STATE_KEYS.filter((k) => snapshot[k] !== undefined)
  if (locations.length === 0 && snapshot.top === undefined) return data

  const next: Record<string, any> = { ...data }
  for (const key of locations) {
    // Only re-create the bag if it already exists post-merge; a stamp with no
    // observed state to describe would be an orphan of the kind this file
    // exists to prevent.
    if (next[key] && typeof next[key] === 'object') {
      next[key] = { ...next[key], source: snapshot[key] }
    }
  }
  if (snapshot.top !== undefined) next.source = snapshot.top
  return next
}

/**
 * Remove every USER stamp, in both spellings and at the top level.
 *
 * Called when the merge moved the number: whatever the user reviewed, it is not
 * what is on screen now, so no surface may go on claiming they reviewed it.
 * Clearing ALL THREE is the point — clearing only the camel key would leave the
 * snake key, which is the one `isReviewedByUser` reads FIRST.
 *
 * Returns the SAME reference when there was nothing to clear.
 */
export function clearUserProvenance(data: Record<string, any>): Record<string, any> {
  const snapshot = captureUserProvenance(data)
  const locations = OBSERVED_STATE_KEYS.filter((k) => snapshot[k] !== undefined)
  if (locations.length === 0 && snapshot.top === undefined) return data

  const next: Record<string, any> = { ...data }
  for (const key of locations) {
    const bag = { ...(next[key] as Record<string, unknown>) }
    delete bag.source
    next[key] = bag
  }
  if (snapshot.top !== undefined) delete next.source
  return next
}

/**
 * The key that records a WITHDRAWN confirmation.
 *
 * Top-level on `node.data`, UI-only, never on the wire — deliberately the same
 * shape as `userReviewedStrength` below, and for the same reason: `overlayNode`
 * merges `{...existing.data, ...mapped.data}`, so a key the mapper never emits
 * survives every merge. An ABSENCE could not do this job (see below).
 */
export const CONFIRMATION_WITHDRAWN_KEY = 'userConfirmationWithdrawn'

/** True when the user has withdrawn their confirmation of this node's value. */
export function isConfirmationWithdrawn(data: unknown): boolean {
  return (data as Record<string, unknown> | undefined)?.[CONFIRMATION_WITHDRAWN_KEY] === true
}

/**
 * Withdraw a confirmation — ROADMAP 2.638 S2, Ruling 1's "reversible per value".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE REVERSAL IS EXACT, AND WHY IT NEEDS NO SNAPSHOT
 * ─────────────────────────────────────────────────────────────────────────────
 * "Confirm as is" commits with `writeValue: false` — it moves no number, it
 * only makes a claim about one. So withdrawing it has nothing to restore: the
 * pre-confirmation state IS the current value with the claim removed. That is
 * reversal by construction, the same property §4.3 of the design brief asks of
 * the compute slice.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ AND WHY A BARE `clearUserProvenance` IS NOT ENOUGH — the measured trap
 * ─────────────────────────────────────────────────────────────────────────────
 * CEE now DOES stamp a user-owned source server-side:
 * `set_factor_value` writes `observed_state.source = USER_EDIT_SOURCE`, and
 * `USER_EDIT_SOURCE = 'user_override'` (`canonicalise-value-ops.ts:280`,
 * `set-factor-value.ts:421`, CEE staging `d5b64246`). ⚠ That falsifies this
 * file's own header claim that "the server bag is STRUCTURALLY incapable of
 * carrying 'the user checked this'" — true when written (2.312), landed
 * otherwise by 2.396(b). The header is corrected in place above.
 *
 * The consequence for a withdrawal is precise: `restoreUserProvenance` writes
 * back only the locations the PRE-merge snapshot HELD, so a node whose stamp we
 * merely deleted yields an EMPTY snapshot, the server's `user_override` rides
 * the overlay in untouched, and the badge is back on the next boot. A deletion
 * cannot survive a merge whose default is "the server's stamp stands"; only a
 * POSITIVE record can. Hence the key.
 *
 * Producer stamps are left alone — they are the server's to move, exactly as in
 * `clearUserProvenance`.
 *
 * ⚠ THE NODE-LEVEL `provenance: 'user_set'` IS DELIBERATELY NOT TOUCHED, and
 * that is a correction to the obvious design. It is CEE's field — the UI never
 * writes it — so clearing it locally would put the client into disagreement
 * with the wire on a value the server owns, and it would be undone by the next
 * merge anyway. It does not need clearing: the withdrawal marker is the FIRST
 * rung `isReviewedByUser` consults and short-circuits every rung below it,
 * including that one. (It also cannot be deleted through the store: `updateNode`
 * merges `{...n.data, ...updates.data}`, so a top-level key removed from the
 * patch simply survives — a deletion is not expressible on this path. The
 * NESTED observed-state bags are different: they are whole objects at the top
 * level, so replacing them does remove their `source`.)
 *
 * Returns the SAME reference when there is nothing to withdraw.
 */
export function withdrawUserConfirmation(data: Record<string, any>): Record<string, any> {
  const snapshot = captureUserProvenance(data)
  const hadUserStamp =
    snapshot.observed_state !== undefined ||
    snapshot.observedState !== undefined ||
    snapshot.top !== undefined
  const hadNodeStamp = data?.provenance === 'user_set'
  if (!hadUserStamp && !hadNodeStamp) return data

  return { ...clearUserProvenance(data), [CONFIRMATION_WITHDRAWN_KEY]: true }
}

/**
 * End a withdrawal.
 *
 * Called wherever a NEW user claim is EARNED, so the withdrawal is not a
 * one-way door: a re-confirmation has to be believed.
 *
 * ⚠ Writes an explicit `false` rather than deleting the key, and the reason is
 * measured, not stylistic: the store's `updateNode` merges
 * `data: {...n.data, ...updates.data}`, so a deleted top-level key SURVIVES the
 * write. A `delete` here left the marker standing and the re-confirmation
 * invisible — caught by driving the real receipt path rather than a hand-rolled
 * clear. `isConfirmationWithdrawn` tests `=== true`, so `false` reads exactly
 * as "not withdrawn".
 *
 * Returns the SAME reference when there is no marker.
 */
export function clearConfirmationWithdrawal(data: Record<string, any>): Record<string, any> {
  if (!isConfirmationWithdrawn(data)) return data
  return { ...data, [CONFIRMATION_WITHDRAWN_KEY]: false }
}

/**
 * The edge counterpart. `userReviewedStrength` is a UI-only boolean set by the
 * pre-analysis strength quick-select; it never reaches the wire, so the overlay
 * can never clear it and it outlives any weight the server sends.
 *
 * Same rule, same reason: a "user judged this relationship" marker attached to
 * a strength the server has since moved is a claim about a number the user
 * never chose. Returns the SAME reference when there is nothing to clear.
 */
export function clearEdgeUserReviewOnValueChange(
  beforeData: unknown,
  afterData: Record<string, any>,
): Record<string, any> {
  if (afterData?.userReviewedStrength !== true) return afterData
  const before = (beforeData ?? {}) as Record<string, any>
  if (Object.is(before.weight, afterData.weight)) return afterData
  const next = { ...afterData }
  delete next.userReviewedStrength
  return next
}
