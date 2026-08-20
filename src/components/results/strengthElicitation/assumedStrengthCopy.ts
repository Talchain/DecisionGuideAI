/**
 * Copy for the assumed-strength elicitation. TEMPLATED FROM DERIVED FACTS —
 * every variable slot is filled from a value the producer measured or the canvas
 * holds, and there is no free generation anywhere on this path.
 *
 * That is a deliberate choice about EVIDENCE, not about tone. A predicate over
 * natural language needs a corpus written outside the author's head before
 * anyone can claim its breadth is bounded; a template with four typed slots has
 * no breadth to bound — the only thing that can vary is what the producer sent,
 * and that is pinned by the selector's types. There is no sentence this module
 * can emit that is not enumerable from its inputs.
 *
 * ── THE CLAIM BOUNDARY (derived from the producer, not from the field name) ──
 * `switch_probability` is declared by ISL as "Proportion of MC samples where
 * alternative wins WHEN EDGE IS WEAK" (`src/models/response_v2.py:569-575`,
 * staging `28fe0c95`). It is CONDITIONAL on the edge being weak, and it is not
 * an isolating measure of this edge's own contribution.
 *
 * MAY SAY:
 *   · "if this link is weaker than we assumed, {alt} came out ahead in NN% of runs"
 *     — the conditional, which is exactly what was measured.
 *   · "your team has not confirmed this estimate" — only when existing graph
 *     provenance says the value is `ai_inferred`.
 *   · "nobody has set this strength" — only when the value source is absent.
 *   · "highest such rate" — because the selector takes the maximum existing
 *     `switch_probability` among eligible unresolved strengths. It is a claim
 *     about that conditional rate, never about structural importance or VOI.
 *
 * MUST NOT SAY:
 *   (a) "the most important relationship" / "this link decides it" — an
 *       unconditional, isolating claim. `switch_probability` partitions samples
 *       in which every OTHER edge is varying too, so a high value is not
 *       attributable to this edge alone. The isolating quantity is
 *       `marginal_switch_probability`, which is a different sweep and is zero in
 *       83 of the 98 live rows that carry it.
 *   (b) "resolving this will change your decision" — the measurement is about
 *       what happens IF the link is weak, not about what setting a number does.
 *       Setting a strength changes the model; whether the answer moves is what
 *       the rerun is for, and promising it in advance is the thing this whole
 *       interaction exists to avoid.
 *   (c) "value of information" / "worth learning" — that vocabulary belongs to
 *       `factor_evppi`/`decision_evpi`, is in outcome units, and is under a live
 *       ISL ban ("EVPI user-facing language remains banned pending doctrine",
 *       `docs/science-validation/REPORT.md` §5).
 *   (d) any number other than the measured `switch_probability` — and never the
 *       assumed weight itself dressed as a measurement. The default (0.5 / 0.3)
 *       is a placeholder; printing it as "currently 50%" would be the exact
 *       defect `edgeValueProvenance` was built to stop.
 *
 * These are held MECHANICALLY by `__tests__/assumedStrengthCopy.claims.spec.ts`,
 * not by this comment. A comment is not a guard.
 */

import type {
  AssumedStrengthRefusal,
  AssumedStrengthSelection,
} from './selectAssumedStrengthToResolve'

/** Section heading. Names the ACT (pin down an assumption), not a verdict. */
export const ASSUMED_STRENGTH_TITLE = 'One assumption worth pinning down'

/**
 * The lead sentence: names the relationship whose strength nobody set.
 * `{from} → {to}` are canvas labels — the team's own words for their own model.
 */
export function assumedStrengthLead(s: AssumedStrengthSelection): string {
  return s.strengthProvenance === 'ai_inferred'
    ? `Olumi estimated how strongly ${s.fromLabel} affects ${s.toLabel}, but your team has not confirmed it.`
    : `Nobody has set how strongly ${s.fromLabel} affects ${s.toLabel} yet.`
}

/**
 * WHY IT MATTERS, grounded in the measured number. Two shapes, because the
 * producer may omit `alternative_winner_label`, and a sentence that names an
 * alternative it does not have would be inventing the most persuasive part.
 */
export function assumedStrengthWhy(s: AssumedStrengthSelection): string {
  const pct = Math.round(s.switchProbability * 100)
  const measured = s.alternativeWinnerLabel !== null
    ? `In the runs where that link came out weak, ${s.alternativeWinnerLabel} was the stronger option ${pct}% of the time.`
    : `In the runs where that link came out weak, a different option came out ahead ${pct}% of the time.`
  return `${measured} Of the unconfirmed relationship strengths you can resolve here, this had the highest such rate in this run.`
}

/** The ask. An invitation to supply judgement, never an instruction to agree. */
export function assumedStrengthAsk(s: AssumedStrengthSelection): string {
  return s.strengthProvenance === 'ai_inferred'
    ? 'Confirm Olumi’s estimate or change it to what your team believes. If the value changes, re-run to see whether it changes the answer.'
    : 'Set it to what your team believes, then re-run to see whether it changes the answer.'
}

/**
 * The "and others" clause. Only ever rendered when the count EXCEEDS one, and it
 * counts the same population the selection came from — fragile edges, above the
 * floor, canvas-matched, strength unset.
 */
export function assumedStrengthOthers(assumedFragileCount: number): string | null {
  if (assumedFragileCount <= 1) return null
  const n = assumedFragileCount - 1
  return n === 1
    ? 'One other sensitive relationship also has an unconfirmed strength.'
    : `${n} other sensitive relationships also have unconfirmed strengths.`
}

/**
 * The action label. It says "Set", so the control it opens must be the one that
 * SETS — see `AssumedStrengthCard`'s wiring note. If that route ever degrades to
 * a focus-only jump again, this label becomes a promise the product does not
 * keep, and the honest move is to change the wiring back, not this string.
 */
export const ASSUMED_STRENGTH_ACTION = 'Set this strength'

/**
 * REFUSALS. Each names a DIFFERENT fact, and none of them denies anything.
 *
 * `null` means RENDER NOTHING. Two of the four refusals are states in which a
 * sentence would be noise on a surface the user is reading for an answer:
 * `no_robustness_data` (there is no analysis to be sensitive to yet) and
 * `no_edge_identity` (an internal matching failure the user cannot act on — the
 * honest response to our own gap is silence, not an apology that reads as a
 * finding about their model).
 *
 * `all_strengths_set` DOES speak, but it reports only the selector's bounded
 * result. It must not infer that a person supplied every numeric strength or
 * that no placeholder affects the answer: older edges can carry a producer
 * value without the finer provenance that would license either claim.
 * `no_fragile_edges` speaks for the same reason, and both are careful to be
 * about THIS RUN — "nothing stood out in this run", never "your model is sound".
 */
export const ASSUMED_STRENGTH_REFUSAL_COPY: Record<AssumedStrengthRefusal, string | null> = {
  no_robustness_data: null,
  no_edge_identity: null,
  all_strengths_set:
    'No unresolved assumed strength was found among the relationships this run was sensitive to.',
  no_fragile_edges:
    'This run found no relationship with a measured weak-link rate high enough to surface here.',
}
