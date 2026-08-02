/**
 * `factor_value_edit` — resolving the OPTIMISTIC local write against the reply.
 *
 * ROADMAP 2.129 (b). Live-proven on staging `98aae72e`
 * (`PHASE0-EVIDENCE-2026-07-28/fix-2121-slice1-liveproof.md` §3 sub-finding): a
 * Model-tab value commit writes locally FIRST (so the canvas moves even if the
 * turn is slow) and then fires the turn fire-and-forget. Nothing read the reply
 * back. So when CEE REFUSED the edit —
 *
 *   "Value 25 months exceeds the factor's cap of 6 months. I haven't changed
 *    anything." (blocks: [], no analysis_ready, no graph_hash)
 *
 * — the canvas kept showing `25 months`, the Model tab stamped the value
 * **"User edited"**, and the next re-run returned byte-identical numbers because
 * the engine still held `3`. A split-brain on a trust surface: the user is shown
 * a number, and a provenance claim about that number, that the engine explicitly
 * declined.
 *
 * WHY THE RESOLUTION IS CENTRAL AND NOT A `.catch` AT THE CALL SITE.
 * A refusal is not a FAILURE: the promise resolves normally (there is no
 * `SystemEventSendError`), so no `catch` can see it. And an `await` at the call
 * site cannot work either — an edit committed while an analysis is running is
 * queued in `useConversation`'s deferral buffer and the caller's promise has
 * ALREADY resolved with `SEND_DEFERRED`. The snapshot therefore rides on
 * `SendTurnOpts`, which the buffer holds verbatim, so the immediate dispatch and
 * the deferred flush are resolved by ONE code path rather than two that have to
 * stay in sync.
 *
 * WHY THE REJECTION SIGNAL IS AN ABSENCE, and what that forces.
 * There is no positive rejection signal on the wire — the refusal reply carries
 * `blocks: []`, not a `graph_patch` with `status: 'rejected'`. The only
 * machine-readable evidence is that the reply to a `factor_value_edit` turn
 * contains no APPLIED `graph_patch` receipt for the target the turn named
 * (contrast the accepted reply:
 * `{type:'graph_patch',status:'applied',operation:'set_factor_value',target_id:'fac_delivery_time',before:{…},after:{…}}`).
 * An absence-based rule must fail SAFE, because a FALSE revert would discard a
 * value the server DID accept — strictly worse than the bug being fixed. So:
 * anything that could be an applied patch for this target, including an applied
 * patch whose targets cannot be attributed at all, counts as APPLIED.
 */

import { useCanvasStore } from '../store'
import { withObservedStateUpdate, type ObservedStateData } from '../utils/observedStateHelpers'
import { unwrapInterventionValue } from '../utils/labelUtils'
import { formatValueWithUnit } from '../utils/formatValueWithUnit'

/**
 * Everything needed to undo one optimistic value write, captured BEFORE it.
 *
 * Data, not a closure: the deferral buffer's last-write-wins replacement has to
 * be able to KEEP THE EARLIER snapshot of two queued edits to the same factor
 * (see `mergeOptimisticFactorEdit`), which an opaque `() => void` cannot express.
 */
export interface OptimisticFactorEdit {
  /** The factor node's id — also the `target_id` the wire event names. */
  nodeId: string
  /**
   * The MODEL-scale number this edit sent (`event.payload.value`). Used as the
   * revert's own precondition: if the node no longer holds it, something newer
   * has happened and the revert must stand down.
   */
  sentValue: number
  /** The node's `observedState` as it was before the write, verbatim. */
  prevObservedState: unknown
  /**
   * The node's TOP-LEVEL `display_value` before the write. CEE authors this
   * prose ("£30k") at either level and `setObservedValue` clears both, so a
   * revert that restored only `observedState` would leave the canvas rendering
   * its live fallback instead of the server's own string.
   */
  prevDisplayValue: unknown
  /**
   * ROADMAP 2.304 — the provenance patch to apply ONLY when the reply carries
   * an APPLIED receipt for this target. Optional: a caller that supplies none
   * keeps the pre-2.304 behaviour (revert-on-refusal, nothing on acceptance).
   *
   * WHY THE STAMP TRAVELS WITH THE UNDO rather than being written at commit.
   * `observedState.source` is a TRUST CLAIM — it is what paints "checked by
   * you" and drops the factor out of the "N to verify" count. Written at commit
   * or at dispatch it asserts a review the engine has not acknowledged, which
   * is the 2.304 defect verbatim (the pre-analysis drill-in stamped
   * `user_override` on a write that never left the browser). Riding on the same
   * `SendTurnOpts` as the undo means ONE code path resolves BOTH directions —
   * refusal reverts, acceptance stamps — for the immediate dispatch and for a
   * deferred flush alike, rather than two that have to stay in sync.
   */
  reviewedStamp?: Partial<ObservedStateData>
}

/**
 * Read a node's observed state defensively — CEE and legacy paths write it under
 * either casing. The RESTORE always writes the canonical `observedState`, which
 * is the key the optimistic write (`setObservedValue`) created, so the two halves
 * cannot end up disagreeing about which copy is live.
 */
function readObservedState(nodeData: unknown): unknown {
  const d = (nodeData ?? {}) as Record<string, unknown>
  return d.observedState ?? d.observed_state
}

/**
 * Snapshot the pre-edit state of a factor value.
 *
 * MUST be called with the node data as it was BEFORE the local write — the same
 * `nodeData` the wire event was built from, which is why both call sites build
 * the event and the snapshot from one read.
 */
export function captureOptimisticFactorEdit(
  nodeId: string,
  sentValue: number,
  nodeData: unknown,
  reviewedStamp?: Partial<ObservedStateData>,
): OptimisticFactorEdit | null {
  if (!nodeId) return null
  if (typeof sentValue !== 'number' || !Number.isFinite(sentValue)) return null
  const d = (nodeData ?? {}) as Record<string, unknown>
  return {
    nodeId,
    sentValue,
    prevObservedState: readObservedState(nodeData),
    prevDisplayValue: d.display_value,
    ...(reviewedStamp ? { reviewedStamp } : {}),
  }
}

/**
 * Combine an already-queued snapshot with a newer one for the SAME target.
 *
 * LAST-WRITE-WINS on the value, FIRST-WRITE-WINS on the snapshot. If the user
 * commits 3→25 and then corrects it to 25→30 while both are still undispatched,
 * the server has seen NEITHER, so it still holds 3 — and a rejection of 30 must
 * restore 3, not the intermediate 25 the server never held.
 */
export function mergeOptimisticFactorEdit(
  queued: OptimisticFactorEdit | undefined,
  incoming: OptimisticFactorEdit | undefined,
): OptimisticFactorEdit | undefined {
  if (!queued) return incoming
  if (!incoming) return queued
  if (queued.nodeId !== incoming.nodeId) return incoming
  // Keep the ORIGINAL pre-edit state; adopt the NEW value being sent, because
  // that is the number whose fate the reply will decide — and with it the
  // INCOMING stamp, which describes the commit that is actually going to be
  // sent (a value edit and a "confirm as is" stamp different provenance, and
  // the reply decides the later one's fate, not the superseded one's).
  return { ...queued, sentValue: incoming.sentValue, reviewedStamp: incoming.reviewedStamp }
}

/** Collect every target id a graph_patch block can be read to address. */
function patchTargets(block: Record<string, unknown>): string[] {
  const out: string[] = []
  if (typeof block.target_id === 'string' && block.target_id) out.push(block.target_id)
  const ops = block.operations
  if (Array.isArray(ops)) {
    for (const op of ops) {
      const t = (op as Record<string, unknown>)?.target_id
      if (typeof t === 'string' && t) out.push(t)
    }
  }
  return out
}

/**
 * Did this reply apply a graph patch for `targetId`?
 *
 * PURE — no store, no React. FAIL-SAFE in the applied direction:
 *   - `status` must not be a recognised NON-applied value. An absent or unknown
 *     status counts as applied, because a receipt we cannot classify may well be
 *     one, and reverting over it would corrupt an accepted value.
 *   - a patch that names NO target at all counts as applying to this target, for
 *     the same reason. (Both shapes exist in the contract: block-level
 *     `target_id` on the edit receipt, `operations[].target_id` on proposal
 *     blocks.)
 */
export function responseAppliedFactorEdit(response: unknown, targetId: string): boolean {
  if (!targetId) return true // unattributable edit — never revert on a guess
  const blocks = (response as { blocks?: unknown })?.blocks
  if (!Array.isArray(blocks)) return false
  const NOT_APPLIED = new Set(['rejected', 'proposed', 'dismissed', 'failed', 'error', 'pending'])
  for (const raw of blocks) {
    const block = (raw ?? {}) as Record<string, unknown>
    if (block.type !== 'graph_patch') continue
    const status = typeof block.status === 'string' ? block.status.toLowerCase() : undefined
    if (status && NOT_APPLIED.has(status)) continue
    const targets = patchTargets(block)
    if (targets.length === 0) return true // applied-but-unattributable → assume ours
    if (targets.includes(targetId)) return true
  }
  return false
}

/**
 * THE SILENT REBASE — what this next section detects, and why it is here.
 *
 * ROADMAP 2.312. Live-measured on the deployed guest build
 * (`PHASE0-EVIDENCE-2026-07-28/probe-560-confirm-as-is-receipt.md` §6): the
 * canvas does NOT hydrate from the server on boot — it restores
 * `localStorage['olumi-canvas-autosave']`, and the complete boot request
 * manifest contains no graph fetch. So after a reload the tab can be showing a
 * number the engine stopped holding some time ago.
 *
 * The consequence is not a display bug. With the tab showing £4,000 the
 * operator typed £4,200, and CEE recorded
 *
 *   "Updated Monthly Observability Spend from £3,500 to £4,200"
 *
 * — a BEFORE-value the user was never shown, on a base they never chose. The
 * wire event carries only the new value (`buildFactorValueEditEvent`); the
 * server derives `before` from its OWN graph. So the edit is applied against a
 * base the operator did not see, and nothing anywhere says so. That is a
 * data-integrity defect on the canonical graph, not a rendering one.
 *
 * WHY DETECTION AND DISCLOSURE, RATHER THAN PREVENTION.
 * Prevention needs the operator's base ON THE WIRE and a server that refuses a
 * mismatch — a CEE-side change, and a bigger piece of work. What the UI can do
 * ALONE it can do completely: the applied receipt already carries the server's
 * own `before` (see `responseAppliedFactorEdit`'s contract note), and
 * `OptimisticFactorEdit.prevObservedState` is, by construction, the state the
 * operator was looking at when they typed. Comparing those two is an exact
 * test for "was this edit rebased?", answerable on every applied edit, with no
 * new wire field and no new round trip.
 *
 * WHY THE VALUE IS KEPT AND NOT REVERTED.
 * The server DID apply the number the operator chose, so that number is true and
 * reverting it would replace one lie with another. The defect is the SILENCE.
 * Correspondingly the reviewed stamp is NOT withheld: "checked by you" is a
 * claim about the number now on the engine, and that claim survives — what does
 * not survive is the implicit claim that the canvas the operator was reading
 * matched the engine. So the value stands, the stamp stands, and the divergence
 * is SAID.
 *
 * FAIL-SAFE DIRECTION, and it is the opposite of `responseAppliedFactorEdit`'s.
 * That predicate assumes APPLIED when it cannot tell, because a false revert
 * destroys accepted work. This one reports NOTHING when it cannot tell, because
 * a false rebase warning is an accusation about the user's own data that would
 * teach them to ignore a true one (CLAUDE.md trap 7b — a broken alarm is worse
 * than no alarm). Every unreadable, unattributable, unit-mismatched or
 * scale-ambiguous case returns null.
 */

/** A proven mismatch between the base the user saw and the base the server had. */
export interface RebaseDivergence {
  /** The factor the receipt and the snapshot agree they are both talking about. */
  nodeId: string
  /** The magnitude the operator was looking at when they typed. */
  shownBase: number
  /** The magnitude the engine actually held, per its own receipt. */
  serverBase: number
  /**
   * Which field the two sides were compared on. `raw_value` is a user-unit
   * magnitude and is preferred because it is the number a person recognises;
   * `value` is model scale and is used only when neither side states a raw one.
   */
  basis: 'raw_value' | 'value'
  /** The unit both sides agreed on, when either stated one. */
  unit?: string
}

/** Read one numeric field off a receipt/observed-state object, defensively. */
function readNumeric(field: unknown): number | undefined {
  const n = unwrapInterventionValue(field).value
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

function readUnit(source: Record<string, unknown> | undefined): string | undefined {
  const u = source?.unit
  return typeof u === 'string' && u.length > 0 ? u : undefined
}

/**
 * Are these two magnitudes the same number?
 *
 * A relative epsilon, not equality: both sides have been through JSON and, on
 * the `value` basis, through a divide-by-cap, so an exact `===` would report a
 * float artefact as a rebase. The tolerance is nowhere near any real
 * divergence — the measured defect was £4,000 against £3,500.
 */
function sameMagnitude(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
}

/**
 * The `before` snapshot this reply's receipt carries for `targetId`, if any.
 *
 * ATTRIBUTABLE RECEIPTS ONLY — deliberately stricter than
 * `responseAppliedFactorEdit`, which treats an untargeted patch as ours. A
 * patch that does not name this factor cannot prove anything about this
 * factor's base, and guessing here would manufacture the false alarm this
 * module exists to avoid. Both contract shapes are read: block-level
 * `before` beside a block-level `target_id`, and a per-operation `before`
 * inside `operations[]`.
 */
export function readReceiptBaseline(
  response: unknown,
  targetId: string,
): Record<string, unknown> | null {
  if (!targetId) return null
  const blocks = (response as { blocks?: unknown })?.blocks
  if (!Array.isArray(blocks)) return null
  const NOT_APPLIED = new Set(['rejected', 'proposed', 'dismissed', 'failed', 'error', 'pending'])

  for (const raw of blocks) {
    const block = (raw ?? {}) as Record<string, unknown>
    if (block.type !== 'graph_patch') continue
    const status = typeof block.status === 'string' ? block.status.toLowerCase() : undefined
    if (status && NOT_APPLIED.has(status)) continue

    if (block.target_id === targetId && block.before && typeof block.before === 'object') {
      return block.before as Record<string, unknown>
    }
    const ops = block.operations
    if (Array.isArray(ops)) {
      for (const rawOp of ops) {
        const op = (rawOp ?? {}) as Record<string, unknown>
        if (op.target_id === targetId && op.before && typeof op.before === 'object') {
          return op.before as Record<string, unknown>
        }
      }
    }
  }
  return null
}

/**
 * Did the engine apply this edit against a base the operator never saw?
 *
 * PURE — no store, no React, so the whole rule is testable without a canvas.
 * Returns null unless a rebase can be PROVEN; see the fail-safe note above.
 */
export function detectSilentRebase(
  edit: OptimisticFactorEdit,
  response: unknown,
): RebaseDivergence | null {
  const serverBefore = readReceiptBaseline(response, edit.nodeId)
  if (!serverBefore) return null

  const shown = (edit.prevObservedState ?? undefined) as Record<string, unknown> | undefined
  if (!shown || typeof shown !== 'object') return null

  // Units first: two magnitudes in different units are not comparable, and
  // "£3,500 vs 3,500 hours" is a units bug to be reported elsewhere, not a
  // rebase. Compared only when BOTH sides state one — an absent unit is "not
  // stated", never a claim of dimensionlessness.
  const serverUnit = readUnit(serverBefore)
  const shownUnit = readUnit(shown)
  if (serverUnit && shownUnit && serverUnit !== shownUnit) return null

  // Prefer the user-unit magnitude. Fall back to model scale only when NEITHER
  // side states a raw one — mixing the two bases would compare £4,000 with 0.8.
  const serverRaw = readNumeric(serverBefore.raw_value)
  const shownRaw = readNumeric(shown.raw_value)
  let basis: 'raw_value' | 'value'
  let serverBase: number | undefined
  let shownBase: number | undefined

  if (serverRaw != null && shownRaw != null) {
    basis = 'raw_value'
    serverBase = serverRaw
    shownBase = shownRaw
  } else if (serverRaw == null && shownRaw == null) {
    basis = 'value'
    serverBase = readNumeric(serverBefore.value)
    shownBase = readNumeric(shown.value)
  } else {
    // One side states a raw magnitude and the other does not. The scales are
    // not known to match, so no comparison is honest here.
    return null
  }

  if (serverBase == null || shownBase == null) return null
  if (sameMagnitude(serverBase, shownBase)) return null

  return {
    nodeId: edit.nodeId,
    shownBase,
    serverBase,
    basis,
    ...(serverUnit || shownUnit ? { unit: serverUnit ?? shownUnit } : {}),
  }
}

/**
 * The sentence a proven rebase earns, in the transcript.
 *
 * PURE and exported so the COPY is testable — the precedent is
 * `noticeForUnsentEdit` in `useConversation`, whose whole point is that a value
 * edit the user can see on the canvas must never fail quietly.
 *
 * THE MAGNITUDES ARE RENDERED, NOT PRINTED RAW. `formatValueWithUnit` is the
 * repo's single source of truth for "a raw value with its unit" (£3,500, not
 * 3500), so the numbers in this sentence read the same as the ones on the row
 * the user was just looking at. It is applied ONLY on the `raw_value` basis: on
 * the model-scale `value` basis that helper maps 0–1 to a qualitative word
 * ("moderate"), which would turn a precise statement about two specific numbers
 * into an unfalsifiable one.
 *
 * NO REMEDY IS OFFERED THAT DOES NOT WORK. "Reload to get the current figures"
 * is the obvious closing line and it is FALSE — the boot path restores
 * localStorage and fetches no graph (ROADMAP 2.312, the defect this guard
 * exists under). Asking in chat genuinely does work: CEE answers from its own
 * graph, which is how the probe caught the divergence in the first place
 * ("Your model currently has monthly observability spend set to £3,300" while
 * the Model tab said £4,000). So that is the remedy named.
 */
export function describeRebaseDivergence(
  divergence: RebaseDivergence,
  factorLabel: string,
): string {
  const render = (n: number): string =>
    divergence.basis === 'raw_value' ? formatValueWithUnit(n, divergence.unit) : String(n)
  const shown = render(divergence.shownBase)
  const server = render(divergence.serverBase)
  return (
    `Your canvas was out of date: it showed ${factorLabel} as ${shown}, but the model held ${server}. ` +
    `Your change has been applied on top of ${server}. ` +
    `Other values on this canvas may also be stale — ask me and I'll tell you what the model currently holds.`
  )
}

/** What `revertOptimisticFactorEdit` did, for tests and DEV logging. */
export type RevertOutcome = 'reverted' | 'node_gone' | 'value_moved_on'

/** What `confirmOptimisticFactorEdit` did, for tests and DEV logging. */
export type ConfirmOutcome = 'stamped' | 'no_stamp' | 'node_gone' | 'value_moved_on'

/**
 * Write the provenance stamp the RECEIPT has now earned (ROADMAP 2.304).
 *
 * The mirror image of `revertOptimisticFactorEdit`, and deliberately built from
 * the same parts: same snapshot, same `updateNode` chokepoint, same
 * still-holds-`sentValue` precondition. The precondition is the whole safety
 * story in this direction too — a late receipt for a value that has since been
 * re-edited, undone, or overwritten by a server patch must NOT stamp the
 * CURRENT number as reviewed, because the user reviewed a different one.
 *
 * Writes through `withObservedStateUpdate`, which writes BOTH the camelCase and
 * snake_case keys. That is not decoration: `isReviewedByUser` — the predicate
 * that paints "checked by you" — resolves `observed_state.source` BEFORE
 * `observedState.source`, the opposite precedence to `getObservedState`. On a
 * node carrying both keys (every node any `withObservedStateUpdate` call site
 * has ever touched), a camelCase-only stamp would be read straight past.
 *
 * Returns `'no_stamp'` when the edit carries none — the pre-2.304 callers
 * (Model tab, inspector) pass no stamp and are byte-identical through here.
 */
export function confirmOptimisticFactorEdit(edit: OptimisticFactorEdit): ConfirmOutcome {
  if (!edit.reviewedStamp) return 'no_stamp'
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === edit.nodeId)
  if (!node) return 'node_gone'

  const obs = (readObservedState(node.data) ?? {}) as Record<string, unknown>
  if (obs.value !== edit.sentValue) return 'value_moved_on'

  store.updateNode(edit.nodeId, {
    data: withObservedStateUpdate(node.data, edit.reviewedStamp),
  } as never)
  return 'stamped'
}

/**
 * Put the pre-edit value (and its provenance stamp) back.
 *
 * Restores the whole `observedState` object plus the top-level `display_value`,
 * rather than patching individual keys: the write being undone set `value`,
 * `raw_value`, `source: 'user'` and cleared TWO `display_value`s in one update,
 * and restoring a subset would leave a different split-brain behind (a `source`
 * stamp with no matching number). Restoring the captured object also restores
 * the ABSENCE of keys that were absent, which no per-key setter can express.
 *
 * Goes through the store's `updateNode` chokepoint, so the analytical-change
 * recognition (and with it the freshness overlay) sees the revert exactly as it
 * saw the edit. It writes only `observedState` + `display_value` — the two
 * fields `setObservedValue` already declares in `NODE_SETTER_FIELDS`, so the
 * editor-written-field registry is unchanged by this path.
 *
 * PRECONDITION, and it is the whole safety story: the node must still hold the
 * number we sent. A later edit to the same factor, an undo, a scenario load or
 * a server patch that moved the value all mean this revert is stale — and a
 * stale revert is a silent overwrite of newer truth.
 */
export function revertOptimisticFactorEdit(edit: OptimisticFactorEdit): RevertOutcome {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === edit.nodeId)
  if (!node) return 'node_gone'

  const obs = (readObservedState(node.data) ?? {}) as Record<string, unknown>
  const currentValue = obs.value
  if (currentValue !== edit.sentValue) return 'value_moved_on'

  store.updateNode(edit.nodeId, {
    data: {
      ...(node.data as Record<string, unknown>),
      observedState: edit.prevObservedState,
      display_value: edit.prevDisplayValue,
    },
  } as never)
  return 'reverted'
}
