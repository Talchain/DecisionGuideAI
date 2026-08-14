import type { CEEProvenance } from '../../../adapters/cee/types'
import {
  classifyNodeProvenance,
  classifyValueProvenance,
  type ValueProvenanceKind,
} from '../../domain/valueProvenance'

/**
 * Node-level provenance → pill.
 *
 * ROADMAP 2.638 S2. `user_set` used to return **null**: the one value in this
 * vocabulary that says a HUMAN owns the number had no pill, while both
 * machine-owned values had one. A reader could only conclude the value was
 * unattributed — the absence read as "nobody's".
 *
 * The copy is deliberately "Set by you", not "Confirmed by you". CEE writes
 * `provenance: 'user_set'` on every applied `set_factor_value`
 * (`set-factor-value.ts:450`) whether the user typed a number or endorsed the
 * one already there — so this stamp knows a person acted and cannot say which
 * act. Naming the act here would be an over-claim; the confirm/edit
 * distinction is carried by `observed_state.source` and rendered by the
 * surfaces that read it.
 *
 * The map is TOTAL over `ValueProvenanceKind`, so a kind added to the canonical
 * classification is a type error here rather than a silent fallback (trap 12).
 */
const PILL_BY_KIND: Record<ValueProvenanceKind, { label: string; borderClass: string }> = {
  confirmed: { label: 'Confirmed by you', borderClass: 'border-success/30' },
  edited: { label: 'Edited by you', borderClass: 'border-success/30' },
  assumption: { label: 'Your assumption', borderClass: 'border-success/30' },
  human: { label: 'Set by you', borderClass: 'border-success/30' },
  brief: { label: 'From brief', borderClass: 'border-success/30' },
  ai: { label: 'AI estimate', borderClass: 'border-info/30' },
  // 0.40.0 — a named colleague's panel answer, applied by the owner.
  panel: { label: 'From your panel', borderClass: 'border-info/30' },
}

/**
 * Node-level provenance → pill, with `observed_state.source` taking precedence.
 *
 * ⚠ THE SOURCE ARGUMENT IS NOT AN OPTIONAL EXTRA — WITHOUT IT THIS FUNCTION
 * LIES ABOUT AUTHORSHIP. CEE stamps `node.provenance = 'user_set'`
 * UNCONDITIONALLY on every applied `set_factor_value`, including one that
 * applied a named colleague's panel answer. `classifyNodeProvenance('user_set')`
 * is `'human'`, so a colleague's estimate rendered as **"Set by you"** — the
 * reader credited with a number somebody else gave.
 *
 * WHY THE FIX IS HERE AND NOT AT CEE'S STAMP, having traced both readers of
 * `node.provenance`:
 *
 *   · `buildEstimateRows.ts` ALREADY resolves
 *     `classifyValueProvenance(resolveReviewSource(node)) ?? classifyNodeProvenance(...)`
 *     — source first, node-provenance as fallback. It was already correct.
 *   · `provenanceToPill` was the only reader keyed on `node.provenance` ALONE.
 *
 * So this is not a special case being added; it is an existing INCONSISTENCY
 * between two readers of one field being removed, on the axis that actually
 * carries the identity. Branching CEE's stamp instead was rejected on two
 * derived grounds: `NodeV3.provenance` admits only `user_set | from_brief |
 * ai_inferred`, so there is no truthful value to write for a panel apply
 * without a contract change; and CEE's own comment records that the V3 response
 * transform RECOMPUTES `node.provenance` from `extractionType`, which is
 * precisely why it names `observed_state.source` "the carrier that actually
 * reaches the UI's rungs". A coarse, recomputed field is the wrong authority
 * for a fine-grained identity claim.
 *
 * Absent/unclassifiable source falls through to the node rung unchanged, so
 * every pre-0.40.0 caller behaves exactly as before.
 */
export function provenanceToPill(
  p: CEEProvenance | undefined,
  observedSource?: string | null,
): { label: string; borderClass: string } | null {
  const cls =
    (observedSource ? classifyValueProvenance(observedSource) : null) ??
    classifyNodeProvenance(p)
  if (!cls) return null
  return PILL_BY_KIND[cls.kind]
}
