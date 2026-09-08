/**
 * `option_intervention_edit` (schemas 0.54.0) — the wire event for ONE option's
 * effect value on ONE factor.
 *
 * ── WHAT IT CLOSES ─────────────────────────────────────────────────────────
 * The Model tab's option-effect editor is fully built and deliberately dark:
 * `CANONICAL_EDIT_AUTHORITY.modelOptionIntervention` is `'disabled'`, so the
 * value cell renders a `<span>` and the section shows a notice instead of a
 * control. That is honest — and it is the missing capability. The gate was never
 * the UI; it was that no wire verb could carry the value, so an edit reached CEE
 * only as the debounced, VALUE-LESS `direct_graph_edit` ping.
 *
 * ── ⚠ NOT `factor_value_edit`, AND THE DISTINCTION IS A WITNESSED DEFECT ────
 * That member moves a FACTOR's own `observed_state.value` — what the factor IS.
 * This moves what ONE OPTION would make that factor become. On the captured
 * journey a user answering an option-effect question had a factor BASELINE
 * written instead: interventions stayed `0` on all four options and the
 * missing-value blocker survived by identity. Two questions, two members.
 *
 * ── WHAT THE CLIENT MAY ASSERT, AND WHAT IT MAY NOT ────────────────────────
 * Four fields, `.strict()`: two canonical ids, a model-scale value, and the base
 * graph hash last read. No unit, no raw value, no provenance, no actor — the
 * server owns all of those, and a field the client cannot honestly populate is a
 * field a later reader will populate anyway.
 *
 * ⚠ `base_graph_hash` IS NON-OPTIONAL AND HAS NO CLIENT-SIDE DEFAULT. It is the
 * stale gate: CEE recomputes the analysis-affecting hash from the graph it
 * loaded and refuses on a mismatch. A build with no server-stamped hash to send
 * therefore returns `null` — see `store.lastServerGraphHash`, which is null on a
 * restored session until a turn refreshes it.
 *
 * ── `null` IS A REFUSAL TO ASSERT, NOT AN ERROR ────────────────────────────
 * Every guard below returns `null` for the same reason its siblings do: the edit
 * cannot be asserted TRUTHFULLY. The caller decides what to do about that — and
 * on this surface the answer is to disclose, never to write locally and stay
 * quiet, because a local write behind a server-looking control is exactly the
 * harm the Model tab's notice exists to avoid.
 */
import type { WireSystemEvent } from './types'

export interface BuildOptionInterventionEditArgs {
  /** The OPTION whose effect is being set. Canonical id, never a label. */
  optionId: string
  /** The FACTOR that option would move. Canonical id, never a label. */
  factorId: string
  /** The effect value on the MODEL scale. */
  modelValue: number
  /**
   * The last CEE-stamped `graph_hash`, or `null` when none has been seen this
   * session (`useCanvasStore.lastServerGraphHash`). Null REFUSES the build.
   */
  baseGraphHash: string | null
}

/**
 * Canonical ids are open strings — CEE's persisted ids are the authority, so do
 * NOT narrow to the lowercase NodeV3 pattern. What the contract requires is
 * exact, non-blank bytes with neither of the two composite delimiters, and no
 * trimming: changing an identity byte would be silent retargeting.
 */
function isCanonicalNodeId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id === id.trim() &&
    !id.includes('→') &&
    !id.includes('->')
  )
}

export function buildOptionInterventionEditEvent({
  optionId,
  factorId,
  modelValue,
  baseGraphHash,
}: BuildOptionInterventionEditArgs): WireSystemEvent | null {
  if (!isCanonicalNodeId(optionId) || !isCanonicalNodeId(factorId)) return null
  // An option's effect on itself is not a thing the graph can hold, and the
  // server would refuse it as an unresolved relationship. Refuse here too, so
  // the surface never offers a control whose write cannot land.
  if (optionId === factorId) return null

  if (typeof modelValue !== 'number' || !Number.isFinite(modelValue)) return null
  // `value: z.number().finite().min(0).max(1)`. REFUSE rather than clamp — the
  // identical ruling `edgeStrengthEdit` makes for its own magnitude: a clamped
  // 1.5 → 1 sends a number the user never stated and CEE would persist it as
  // theirs. The bound is the served edit instruction's own stated scale.
  if (modelValue < 0 || modelValue > 1) return null

  // ⚠ NO FALLBACK, NO EMPTY STRING, NO OMISSION. The field is required by the
  // contract, and a blank would be a hash that matches nothing — the server
  // would refuse it as stale, which reads to a user as "your edit conflicted"
  // when in fact the client never held a base to assert.
  if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) return null

  return {
    type: 'option_intervention_edit',
    payload: {
      option_id: optionId,
      factor_id: factorId,
      value: modelValue,
      base_graph_hash: baseGraphHash,
    },
  }
}
