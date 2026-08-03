/**
 * hydrateProvenance — keep "checked by you" HONEST across a boot-time merge.
 *
 * ROADMAP 2.312 piece 3, adversarial-review finding A1. The overlay primitive
 * is provenance-BLIND, and on this path that is not a cosmetic problem: it
 * breaks the review badge in BOTH directions at once.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE SERVER CAN NEVER SETTLE THIS BY ITSELF
 * ─────────────────────────────────────────────────────────────────────────────
 * The stamp the UI reads is `observed_state.source`, and CEE's `ObservedStateV3`
 * types that field as `z.enum(['brief_extraction', 'cee_inference'])`. There is
 * no user-owned member, and the set-factor-value path never writes `source` at
 * all. So the server bag is STRUCTURALLY incapable of carrying "the user
 * checked this" — a merge that lets it decide the field is not resolving a
 * conflict, it is discarding evidence only the client holds.
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
