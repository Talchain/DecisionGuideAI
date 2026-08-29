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
import { saveAutosave } from '../store/scenarios'
import { autosaveSourceFromStore, projectAutosaveData } from '../store/autosaveProjection'
import { withObservedStateUpdate, type ObservedStateData } from '../utils/observedStateHelpers'
import { clearConfirmationWithdrawal } from '../utils/hydrateProvenance'
import { unwrapInterventionValue, classifyUnit } from '../utils/labelUtils'
import {
  formatValueWithUnit,
  formatNumber,
  DOUBLE_ROUND_TRIP_SIGNIFICANT_DIGITS,
} from '../utils/formatValueWithUnit'

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
 * ⚠ WHAT THE RECEIPT PROVES IS A DIFFERENCE, NOT A DIRECTION — and the copy
 * must not exceed it. The stale-boot walk above is the case that MOTIVATED this
 * guard, but it is not the only way the two bases part company, and the receipt
 * cannot tell them apart. The CANVAS-AHEAD case is live and ungated: a factor
 * with no `raw_value` on either side, written locally via a one-argument
 * `setObservedValue(0.6)` over a server-held `0.4`, produces exactly the same
 * evidence as a stale canvas. An earlier draft of this module asserted "Your
 * canvas was out of date" and would have reported that case — canvas AHEAD of
 * the engine — as the canvas being behind. Diagnosing a cause the evidence does
 * not carry is the same defect class as the silence it replaces, so the
 * disclosure now states only what the receipt witnesses: the engine applied the
 * change on top of one number, and a different number was on screen.
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
 * not survive is the implicit claim that the number on screen was the one the
 * change was applied to. So the value stands, the stamp stands, and the
 * divergence is SAID.
 *
 * FAIL-SAFE DIRECTION, and it is the opposite of `responseAppliedFactorEdit`'s.
 * That predicate assumes APPLIED when it cannot tell, because a false revert
 * destroys accepted work. This one reports NOTHING when it cannot tell, because
 * a false rebase warning is an accusation about the user's own data that would
 * teach them to ignore a true one (CLAUDE.md trap 7b — a broken alarm is worse
 * than no alarm). Every unreadable, unattributable, unit-mismatched or
 * scale-ambiguous case returns null.
 */

/**
 * A proven DIFFERENCE between the base the user saw and the base the server
 * applied to. Deliberately not a claim about which of the two is older — see
 * the direction note above.
 */
export interface RebaseDivergence {
  /** The factor the receipt and the snapshot agree they are both talking about. */
  nodeId: string
  /** The magnitude that was on the operator's screen when they typed. */
  shownBase: number
  /** The magnitude the engine applied the change to, per its own receipt. */
  serverBase: number
  /**
   * Which field the two sides were compared on. `raw_value` is a user-unit
   * magnitude and is preferred because it is the number a person recognises;
   * `value` is model scale and is used only when neither side states a raw one.
   */
  basis: 'raw_value' | 'value'
  /**
   * The unit to render these magnitudes in: the SERVER's when it states one,
   * otherwise the snapshot's. Not an agreed value — a disagreement between the
   * two units means the magnitudes are not comparable at all and
   * `detectSilentRebase` has already returned null, so the only case where the
   * two differ here is one side saying nothing. CEE is the unit authority, so
   * its answer wins when both are present.
   */
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
 * the user was just looking at.
 *
 * ⚠ BUT IT IS NOT SAFE TO CALL UNCONDITIONALLY, AND THE BASIS ALONE DOES NOT
 * MAKE IT SAFE. An earlier draft of this comment claimed the `raw_value` basis
 * was enough. It is not: `formatValueWithUnit` keys its qualitative branch on
 * `classifyUnit(unit).kind ∈ {none, placeholder}` AND `0 ≤ v ≤ 1`
 * (`formatValueWithUnit.ts:51-53`) — the BASIS is not part of that test. A
 * raw-basis 0–1 magnitude with no unit therefore rendered as a word, and the
 * sentence refuted itself:
 *
 *   "it showed Team morale as low, but the model held low.
 *    Your change has been applied on top of low."
 *
 * That is reachable, not hypothetical: an UNCAPPED factor stores the same
 * number in `value` and `raw_value` (CEE `normalise-factor-value.ts:12-16`,
 * `:138-141`) and `snapshotObservedState` (`set-factor-value.ts:194-203`)
 * copies it into `before` verbatim, so both sides carry a raw magnitude that
 * can sit in 0–1 with no unit attached.
 *
 * So the guard is the CONDITION ITSELF, derived from the same `classifyUnit`
 * the formatter uses rather than mirrored from its behaviour (CLAUDE.md trap
 * 12): whenever the unit is one the formatter would treat as absent or
 * placeholder, render a bare number instead. The model-scale `value` basis
 * takes the same bare-number path for a different reason — a normalised
 * fraction has no unit to wear, so attaching the factor's would print "£0.8".
 *
 * NO REMEDY IS OFFERED THAT DOES NOT WORK. "Reload to get the current figures"
 * is the obvious closing line and it is FALSE — the boot path restores
 * localStorage and fetches no graph (ROADMAP 2.312, the defect this guard
 * exists under). Asking in chat genuinely does work: CEE answers from its own
 * graph, which is how the probe caught the divergence in the first place
 * ("Your model currently has monthly observability spend set to £3,300" while
 * the Model tab said £4,000). So that is the remedy named.
 */

/**
 * Precision rungs for a CONTRAST, walked only when the house rendering collapses
 * two proven-different magnitudes into one string.
 *
 * ⭐ THE INVARIANT, written against the SPEC and not against the bound that
 * exposed it:
 *
 *     THE PRECISION AT WHICH A DIFFERENCE IS DETECTED AND THE PRECISION AT
 *     WHICH IT IS DISPLAYED MUST NEVER DISAGREE.
 *
 * `sameMagnitude` (`:305-307`) proves a difference at a RELATIVE `1e-9`. Every
 * display path this sentence can take is coarser than that by construction —
 * `formatNumber` bounds to four fraction digits below 1000, and en-GB's default
 * to three at and above it — so a PROVEN divergence could render as one string
 * and the sentence refuted itself:
 *
 *   "The engine applied your change to Team morale on top of 0.1235,
 *    not the 0.1235 shown on your canvas."
 *
 * That is the same harm the header above records ("on top of low") reached by a
 * second mechanism: there a QUALITATIVE collapse, here a PRECISION one. The
 * previous guard keys on `classifyUnit`, so it could not see this one — which
 * is why the remedy here is structural rather than a third special case. It
 * holds for any future display bound, on either basis, at any magnitude.
 *
 * WHY SIGNIFICANT DIGITS RATHER THAN FRACTION DIGITS. Model-scale magnitudes
 * cluster near zero, where fraction digits run out first: `0.00004` and
 * `0.00002` both render "0" at four fraction digits but distinctly at four
 * SIGNIFICANT ones, and readably so.
 *
 * TERMINATION IS PROVEN, NOT HOPED FOR. Seventeen significant decimal digits
 * uniquely determine an IEEE-754 double, so two distinct finite doubles are
 * guaranteed to differ at the final rung — and `detectSilentRebase` has already
 * established the two are distinct before this function is ever called (both
 * bases pass `Number.isFinite` at `readNumeric`, and `sameMagnitude` returns
 * null when they match). There is deliberately no fallback below this ladder:
 * anything it cannot separate is the same double, which nothing could separate,
 * and a dead branch pretending otherwise would be the theatre this module
 * exists to avoid.
 *
 * The ladder starts ABOVE the house rendering's own resolution and climbs in
 * small steps, so a widened sentence shows the LEAST extra precision that tells
 * the truth rather than seventeen figures every time.
 */
const DIVERGENCE_PRECISION_RUNGS: readonly number[] = [
  5, 6, 7, 8, 9, 10, 12, 14, DOUBLE_ROUND_TRIP_SIGNIFICANT_DIGITS,
]

export function describeRebaseDivergence(
  divergence: RebaseDivergence,
  factorLabel: string,
): string {
  const render = (n: number, significantDigits?: number): string => {
    // Model scale wears no unit, so it never goes near the unit-aware helper.
    if (divergence.basis !== 'raw_value') return formatNumber(n, significantDigits)
    // Otherwise: only hand it to the formatter when the formatter's qualitative
    // branch CANNOT fire — i.e. when the unit is a real one. Same predicate the
    // formatter consults, not a copy of its output.
    const { kind } = classifyUnit(divergence.unit ?? null)
    if (kind === 'none' || kind === 'placeholder') return formatNumber(n, significantDigits)
    return formatValueWithUnit(n, divergence.unit, significantDigits)
  }

  let shown = render(divergence.shownBase)
  let server = render(divergence.serverBase)
  // ⚠ THE HOUSE RENDERING CAN COLLAPSE A PROVEN DIVERGENCE INTO ONE STRING.
  // See DIVERGENCE_PRECISION_RUNGS. Widen ONLY when it has — every sentence
  // that already distinguishes its two magnitudes is left byte-identical.
  for (const digits of DIVERGENCE_PRECISION_RUNGS) {
    if (shown !== server) break
    shown = render(divergence.shownBase, digits)
    server = render(divergence.serverBase, digits)
  }
  return (
    `The engine applied your change to ${factorLabel} on top of ${server}, ` +
    `not the ${shown} shown on your canvas. ` +
    `Other values on this canvas may also differ from the model — ask me and I'll tell you what the model currently holds.`
  )
}

/**
 * The one honest sentence for a value edit whose turn FAILED, keyed by OUTCOME
 * rather than composed at each site — the same shape, and for the same reason,
 * as `STRUCTURAL_DELETE_NOTICE`.
 *
 * ⚠ THESE FILL A SILENCE, THEY DO NOT COMPETE WITH CEE'S OWN PROSE. A 200
 * refusal ("Value 25 months exceeds the factor's cap of 6 months. I haven't
 * changed anything.") renders through the normal `assistant_text` branch and is
 * resolved by `responseAppliedFactorEdit` — untouched by any of this. A typed
 * error and a transport failure render NO bubble in system mode; that silence
 * is what these three fill, and until they existed the canvas simply kept a
 * number the server had declined.
 */
export const OPTIMISTIC_FACTOR_EDIT_NOTICE = {
  /**
   * The server PROVED it wrote nothing (a `conflict_category` in the closed
   * `PROVEN_NO_WRITE_CONFLICT_CATEGORIES` set, `retryable: false` by CEE's own
   * envelope). The previous value is back, so the copy may say so.
   *
   * ⚠ THE REMEDY IS DERIVED FROM WHAT ACTUALLY REFRESHES THE BASE, and the two
   * more obvious instructions are both affordances terminating in refusal —
   * exactly as documented for the delete's twin in `STRUCTURAL_DELETE_NOTICE`:
   * a bare retry re-sends the SAME `base_graph_hash` and refuses identically,
   * forever; and a reload hydrates from localStorage with no CEE turn, so the
   * base hash is null and the next edit is unresolvable in the same way. What
   * DOES refresh it is a turn — `applyV5State` captures the top-level
   * `graph_hash` off every response — so the copy asks for the one thing that
   * works, and it works in-session with no reload at all.
   */
  proven_no_write:
    "The saved model changed since you typed that, so your edit wasn't applied — I've put the previous value back rather than show you a number the model never took. Ask me anything about this decision and I'll re-sync with the saved model, then you can make the change again.",
  /**
   * The turn reached the server and failed there, but nothing states the write
   * did not land — the untyped 500 a contended commit actually returns, an
   * unknown conflict category, a fence verdict. We hold no committed bytes, so
   * "couldn't confirm" is the only claim the evidence supports, and the value
   * stands because discarding it would be data loss on a guess.
   *
   * ⚠ THIS COVERS THE NETWORK FAILURE TOO, AND THERE IS DELIBERATELY NO
   * SEPARATE "didn't reach the server" COPY. Its twin
   * `STRUCTURAL_DELETE_NOTICE.unconfirmed_transport` has one, and copying that
   * here would have been a fresh untruth of exactly the class this module
   * exists to remove: `callV5Turn` rethrows ONLY `AbortError` and converts
   * every other fetch failure into a typed error, so a network failure arrives
   * here indistinguishable from a lost response — and the client genuinely
   * cannot tell "never left the browser" from "reached CEE, reply lost".
   * "Couldn't confirm" is the strongest claim the evidence supports for both.
   */
  unconfirmed_server:
    "I couldn't confirm that your change reached the saved model. It's still on your canvas, but the model may hold a different number — ask me what the model currently has before you rely on the analysis.",
} as const

export type OptimisticFactorEditNoticeKey = keyof typeof OPTIMISTIC_FACTOR_EDIT_NOTICE

/**
 * The turn carrying this edit was ABORTED — cancelled client-side by whatever
 * the user did next — so no reply ever existed to resolve it against.
 *
 * ⚠ A SEPARATE SENTENCE FROM `unconfirmed_server`, AND NOT A TIDY-UP. That copy
 * says "It's still on your canvas". Here that promise expires within seconds:
 * the turn that cancelled this one applies its own graph on return, and CEE's
 * value — the one it holds precisely BECAUSE this edit never landed — is
 * written over the user's. Measured on staging `9308a30c`: the row went from
 * "Not set · User edited" to "Not set · Olumi: Moderate (0.5) · AI estimate"
 * across the analysis. A sentence that told the user their number was safe on
 * the canvas would be false by the time they read it.
 *
 * ⚠ IT NAMES THE FACTOR, and that is load-bearing rather than decorative. The
 * measured canvas carried five factors; an unnamed sentence tells the user
 * something went wrong and leaves them to find out which of five it was.
 *
 * ⚠ WHAT IT DELIBERATELY DOES NOT OFFER: a way back. For a guest there is
 * none — server versions refuse outright (`store-adapter.ts` → MV001
 * `ModelVersionSignInRequiredError`), and local version history, though it
 * works, is never written automatically: the only non-test caller of
 * `saveVersion` is a manual save button. A user who never pressed it has
 * nothing to restore, so the copy stops at the two things that ARE true and
 * available — check the factor, and set it again.
 */
/**
 * Does this edit's number still stand, unchanged, on the node it named?
 *
 * ⭐ ONE DEFINITION, TWO READERS, AND THAT IS THE POINT. It decides both whether
 * `resolveInterruptedOptimisticFactorEdit` speaks AND whether `cancelTurn`
 * stands its draft-stop notice down — and those two must never disagree, because
 * a disagreement in either direction is a defect the review already caught once:
 * both speaking is the contradictory pair, neither speaking is silence on a Stop
 * the user pressed. Two copies of this predicate would be two questions wearing
 * one name, which is exactly how the estate's worst seams have been built.
 *
 * The two stand-down reasons are the same pair `revertOptimisticFactorEdit`
 * uses, for the same reasons: a node that is gone cannot be checked, and a value
 * that has moved on belongs to a newer edit that will resolve itself.
 */
export function optimisticFactorEditStillStands(edit: OptimisticFactorEdit): boolean {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === edit.nodeId)
  if (!node) return false
  const observed = (readObservedState(node.data) ?? {}) as Record<string, unknown>
  return observed.value === edit.sentValue
}

export function buildInterruptedFactorEditNotice(label: string | null | undefined): string {
  const named =
    typeof label === 'string' && label.trim().length > 0
      ? `your change to ${label.trim()}`
      : 'your change to that factor'
  return (
    `I couldn't confirm ${named} with the saved model — the turn carrying it was interrupted ` +
    `before the model replied, so the model may still hold its previous value. Check that ` +
    `factor before you rely on any analysis, and set the value again if you need it counted.`
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

  // ROADMAP 2.638 S2 — a new receipted claim ENDS any prior withdrawal.
  //
  // `withdrawUserConfirmation` records the retraction as a positive top-level
  // marker so the boot merge cannot resurrect the claim (CEE re-sends its own
  // `user_override` stamp on the unchanged value). That marker must not outlive
  // the retraction: this is the one place a user claim is earned, so it is the
  // one place the door reopens. Clearing it anywhere else — or not at all —
  // would make a re-confirmation invisible.
  // ⚠ NOT A USER EDIT — this writes the PROVENANCE STAMP onto the value the user
  // already edited a moment ago. It touches `observedState`, which IS analytical,
  // so the bounded predicate does not exempt it: without this window the stamp
  // wipes the coaching a beat after the edit that earned it.
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    store.updateNode(edit.nodeId, {
      data: clearConfirmationWithdrawal(
        withObservedStateUpdate(node.data, edit.reviewedStamp) as Record<string, unknown>,
      ),
    } as never)
  } finally {
    store.endExternalGraphMutation?.()
  }

  // Persist the earned stamp NOW (L66, final-walk defect 0, P1). The stamp is
  // the ONE thing only the client holds — the value round-trips through CEE,
  // but `observed_state.source` cannot (the server enum has no user member,
  // rowed 2.396(b)) — and before this flush nothing persisted it at the moment
  // it was earned: the autosave writers were the 30 s timer, draft apply,
  // auto-apply patches, draft undo, resultsComplete and the crash flush.
  // Witnessed cost (runE, build 610ed5f7): a reload ~3 s after the receipt
  // restored a pre-stamp slot and the row regressed to "Olumi estimate /
  // check first" with the value intact. Flushing on 'stamped' — and ONLY on
  // 'stamped': the other outcomes wrote nothing, so persisting on them would
  // record a claim this function just declined to make — closes that window.
  // Through the canonical projection, like every other writer (the
  // autosave-projection-single-source ci-guard derives this list from the
  // filesystem). Best-effort like its sibling call sites: a quota failure
  // must not turn a successful receipt into a thrown error.
  try {
    saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
  } catch {
    // Non-critical: the in-memory stamp is already applied; the periodic
    // autosave remains the fallback writer.
  }
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

  // ⚠ NOT A USER EDIT — a ROLLBACK to the value that was there before. The graph
  // ends up back where the coaching was authored, so treating it as an edit
  // destroys coaching that the revert has just made valid again.
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    store.updateNode(edit.nodeId, {
      data: {
        ...(node.data as Record<string, unknown>),
        observedState: edit.prevObservedState,
        display_value: edit.prevDisplayValue,
      },
    } as never)
  } finally {
    store.endExternalGraphMutation?.()
  }

  // PERSIST THE REVERT NOW — the same flush `confirmOptimisticFactorEdit` does
  // on 'stamped', and here it is load-bearing rather than a nicety.
  //
  // The optimistic write is DURABLE, not session-only: `saveAutosave` writes
  // `localStorage['olumi-canvas-autosave']` with no hash check, and the boot
  // path restores from it and fetches no graph (2.312). So the refused number
  // is already in the slot, and an in-memory-only revert would be undone by the
  // next reload — the user would see the server's value blink back to the one
  // it refused. Flushing here closes that window instead of waiting for the
  // 30 s timer.
  //
  // ⚠ ONLY ON THE 'reverted' PATH. The early returns above wrote nothing, so
  // persisting on them would record a change this function just declined to
  // make. Through the canonical projection, like every other writer, and
  // best-effort like its sibling call site: a quota failure must not turn a
  // successful revert into a thrown error.
  try {
    saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
  } catch {
    // Non-critical: the in-memory revert is already applied; the periodic
    // autosave remains the fallback writer.
  }
  return 'reverted'
}
