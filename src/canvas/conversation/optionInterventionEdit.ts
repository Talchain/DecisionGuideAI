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
 * ── A REFUSAL TO ASSERT, NOT AN ERROR — AND IT SAYS WHICH ─────────────────
 * Every guard below refuses for the same reason its siblings do: the edit cannot
 * be asserted TRUTHFULLY. The caller decides what to do about that — and on this
 * surface the answer is to disclose, never to write locally and stay quiet,
 * because a local write behind a server-looking control is exactly the harm the
 * Model tab's notice exists to avoid.
 *
 * ⚠⚠ THE REFUSAL IS NAMED, AND THAT IS NOT DECORATION. This returned a bare
 * `null`, so a caller wanting to offer the ONE recoverable refusal — no
 * server-stamped base hash, the ordinary state after a reload — had to re-ask
 * the base-hash question for itself before calling. That is two spellings of one
 * rule (the defect this estate pays for most often), and it put the questions in
 * the WRONG ORDER: a non-finite value with a stale base was reported as
 * `needs_fresh_base`, sending the user to run a turn that cannot help, after
 * which the same number is refused again with a different sentence.
 *
 * The guards below run INPUTS FIRST and BASE HASH LAST, so the name is decided
 * where the rules are, once. `not_encodable` means no action by the user changes
 * the answer; `needs_fresh_base` means one turn does.
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

/**
 * The two ways this build can refuse, and the difference between them is what a
 * caller renders.
 *
 * - `not_encodable`    — nothing the user does changes the answer: an id that is
 *                        not a canonical identity, an option addressing itself,
 *                        a non-finite value, or a value off the model scale.
 * - `needs_fresh_base` — the ONE refusal the user can clear. There is no
 *                        CEE-stamped `graph_hash` to assert; any turn refreshes
 *                        it. Collapsed into `not_encodable` this reads as "your
 *                        edit was invalid", which is both false and unactionable.
 */
export type OptionInterventionEditRefusal = 'not_encodable' | 'needs_fresh_base'

export type OptionInterventionEditBuild =
  | { readonly ok: true; readonly event: WireSystemEvent }
  | { readonly ok: false; readonly refusal: OptionInterventionEditRefusal }

const REFUSE = (refusal: OptionInterventionEditRefusal): OptionInterventionEditBuild => ({
  ok: false,
  refusal,
})

export function buildOptionInterventionEditEvent({
  optionId,
  factorId,
  modelValue,
  baseGraphHash,
}: BuildOptionInterventionEditArgs): OptionInterventionEditBuild {
  // ⚠ ORDER IS PART OF THE CONTRACT BELOW THIS LINE. Everything the user cannot
  // fix is asked FIRST, so a bad number is never reported as a stale base.
  if (!isCanonicalNodeId(optionId) || !isCanonicalNodeId(factorId)) return REFUSE('not_encodable')
  // An option's effect on itself is not a thing the graph can hold, and the
  // server would refuse it as an unresolved relationship. Refuse here too, so
  // the surface never offers a control whose write cannot land.
  if (optionId === factorId) return REFUSE('not_encodable')

  if (typeof modelValue !== 'number' || !Number.isFinite(modelValue)) {
    return REFUSE('not_encodable')
  }
  // `value: z.number().finite().min(0).max(1)`. REFUSE rather than clamp — the
  // identical ruling `edgeStrengthEdit` makes for its own magnitude: a clamped
  // 1.5 → 1 sends a number the user never stated and CEE would persist it as
  // theirs. The bound is the served edit instruction's own stated scale.
  if (modelValue < 0 || modelValue > 1) return REFUSE('not_encodable')

  // ⚠ NO FALLBACK, NO EMPTY STRING, NO OMISSION. The field is required by the
  // contract, and a blank would be a hash that matches nothing — the server
  // would refuse it as stale, which reads to a user as "your edit conflicted"
  // when in fact the client never held a base to assert.
  //
  // ⭐ AND IT IS ASKED LAST, DELIBERATELY. This is the only refusal a user can
  // clear, so it must not be reached by an edit that would be refused anyway.
  if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) {
    return REFUSE('needs_fresh_base')
  }

  return {
    ok: true,
    event: {
      type: 'option_intervention_edit',
      payload: {
        option_id: optionId,
        factor_id: factorId,
        value: modelValue,
        base_graph_hash: baseGraphHash,
      },
    },
  }
}
