/**
 * ⭐⭐⭐ A PENDING FACTOR EDIT IS DELIVERY STATE, NOT AUTHORSHIP EVIDENCE.
 *
 * ## The defect this exists to close
 *
 * Witnessed headed, real Chromium, live render loop, on deployed-equivalent
 * code (21 Sep 2026, PR #1837): a user types `0.77` into the on-graph editor of
 * a factor carrying `unit: "scale"`. The write lands — `observed_state.value`
 * goes `0.5 → 0.77` in the canonical store, and `extractionType: "inferred"` is
 * correctly dropped. **And then the card shows no value at all**, because the
 * whole `valueDisplay !== null` block unmounts, taking the editor with it.
 *
 * ## Two CORRECT rules composing into a wrong screen
 *
 * 1. `formatFactorDisplayValue` suppresses a bare non-binary number on a
 *    generic placeholder unit, so `0.77 scale` never renders as though it were
 *    measured. Its rescue fires only for `source: 'user' | 'user_confirmed'`.
 * 2. `useModelEditAuthority` deliberately withholds that stamp on the
 *    DISPATCHED path: *"An optimistic `source: 'user'` stamp alongside the
 *    dispatch is exactly the fabricated provenance that produced [the 2.304
 *    defect]"* — the stamp rides with the undo and is written by
 *    `confirmOptimisticFactorEdit` only once CEE returns an applied receipt.
 *
 * Neither owner is wrong on its own terms, and that is why **no unit test in
 * the repo reds on it**: four CI shards and the typecheck gate were green on the
 * PR that hid the number.
 *
 * ## What this module is, and what it deliberately is NOT
 *
 * It is the missing third state: *this exact node was just given this exact
 * value by a person, and the engine has not yet acknowledged it.* Independent
 * review (Codex, 21 Sep 2026, `CHANGES_REQUIRED` on #1837 at
 * `ef1186b64331d429b4c11f08fb996f43169a0e99`) named the boundary precisely:
 *
 * > Canonical `source` is correctly withheld until acceptance; the UI currently
 * > has no way to render that pending fact. […] Do not stamp the graph
 * > optimistically, loosen generic-scale suppression globally, or classify
 * > "pending" as canonical provenance: **it is delivery state, not authorship
 * > evidence.**
 *
 * So:
 * - ⛔ **NOT in `useCanvasStore`.** The canonical graph is the team's shared
 *   model; an unacknowledged local keystroke is not part of it and must never
 *   be persisted, autosaved, exported or sent. Module-level transient state,
 *   the same shape `utils/userCameraClaim.ts` uses for the same reason.
 * - ⛔ **NOT a provenance class.** It writes nothing to `observedState.source`
 *   and `valueProvenance` never reads it, so no pill reads "confirmed by you",
 *   no "N to verify" counter moves, and no saved claim is made.
 * - ⛔ **NOT a display string.** It carries the MODEL-scale number that was
 *   sent, and the one projection (`formatFactorDisplayValue`) decides how to
 *   render it. A second formatter here is how five surfaces came to disagree
 *   about one quantity.
 *
 * ## Keyed by node AND value, which is the part that matters
 *
 * `{nodeId, sentValue}` is the same key `OptimisticFactorEdit` already uses as
 * its revert precondition, and for the same reason: if a newer edit has
 * happened, a late settlement for the OLD value must stand down rather than
 * clear the new one. `settleFactorEditInFlight` therefore clears only on an
 * exact match — which is why it takes the value it is settling and not just the
 * node id.
 */

/** The in-flight value per node. Absent key = nothing pending for that node. */
const inFlight = new Map<string, number>()

type Listener = () => void
const listeners = new Set<Listener>()

function emit(): void {
  // Copied before iterating: a listener that unsubscribes during the loop must
  // not mutate the set being walked.
  for (const l of [...listeners]) l()
}

/**
 * Record that `sentValue` for `nodeId` is with the engine and unacknowledged.
 * Called where the dispatch is ADMITTED, never where it is merely composed — a
 * value that was never sent has nothing to be pending on.
 *
 * A second edit to the same node replaces the first: there is only ever one
 * newest number a person typed, and the older one can no longer be restored to
 * the screen anyway.
 */
export function markFactorEditInFlight(nodeId: string, sentValue: number): void {
  if (!nodeId || !Number.isFinite(sentValue)) return
  if (inFlight.get(nodeId) === sentValue) return
  inFlight.set(nodeId, sentValue)
  emit()
}

/**
 * Settle the in-flight edit for `nodeId` — acceptance, refusal or interruption
 * alike, because all three end the pending state and only the CANONICAL graph
 * differs between them.
 *
 * ⚠ STANDS DOWN ON A MISMATCH. If the node's in-flight value is no longer
 * `sentValue`, a newer edit has superseded this one and clearing here would
 * blank a number the user can still see, re-creating the very defect. Returns
 * whether it actually settled, so a caller can assert it rather than assume.
 */
export function settleFactorEditInFlight(nodeId: string, sentValue: number): boolean {
  if (!inFlight.has(nodeId)) return false
  if (inFlight.get(nodeId) !== sentValue) return false
  inFlight.delete(nodeId)
  emit()
  return true
}

/** The unacknowledged value a person typed for this node, or `null`. */
export function pendingFactorEditValue(nodeId: string | null | undefined): number | null {
  if (!nodeId) return null
  const v = inFlight.get(nodeId)
  return typeof v === 'number' ? v : null
}

/** Subscribe to in-flight changes. Returns an unsubscribe. */
export function subscribePendingFactorEdits(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Test-only reset. Module-level state outlives a test file's `beforeEach`
 * otherwise, and a leaked pending value would make a later suppression test
 * pass for the wrong reason.
 */
export function __resetPendingFactorEditsForTest(): void {
  inFlight.clear()
  emit()
}
