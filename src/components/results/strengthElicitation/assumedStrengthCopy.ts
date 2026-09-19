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
 *   · "if this link is weaker than we assumed, {alt} was the stronger option in
 *     NN% of runs" (⚠ WORDING UPDATED 9 Sep 2026 — this line prescribed
 *     "came out ahead", which Paul's 8 Sep no-contest ruling retired. A MAY SAY
 *     rule that contradicts a later ruling teaches the next author to reopen it.)
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
    /*
     * ⚠ "came out ahead" WAS RETIRED BY PAUL'S 8 SEP 2026 NO-CONTEST RULING AND
     * SURVIVED HERE, IN THE UNNAMED BRANCH ONLY. Its twin above was reframed to
     * "was the stronger option"; this one was not, and no guard could see it:
     * `noWinnerVocabulary.spec.ts` swept a hand-list of four files and this is
     * not one of them, though `buildAnalysisNewViewModel.ts:52` imports this
     * very function. One fix, one branch — the estate's signature defect.
     *
     * The wording is its own twin's, so the two branches now differ only in
     * whether they can name the alternative. The rate is unchanged and still
     * conditional: the ruling retired the PLACING, never the measurement.
     */
    : `In the runs where that link came out weak, a different option was the stronger one ${pct}% of the time.`
  return `${measured} Of the unconfirmed relationship strengths you can resolve here, this had the highest such rate in this run.`
}

/**
 * The ask. An invitation to supply judgement, never an instruction to agree.
 *
 * ⛔⛔ IT PRESCRIBES ONLY WHAT THE SURFACE CAN SERVE — 13 Sep 2026, and BOTH
 * halves of that were violated by the sentence this replaces.
 *
 * 1. IT SAID "CONFIRM OLUMI'S ESTIMATE", AND CONFIRMING IS A DIFFERENT ACT THE
 *    ROUTE CANNOT PERFORM. The editor commits through `edge_strength_edit` with
 *    `intent: 'set'` (`canvas/conversation/edgeStrengthEdit.ts`), and CEE
 *    REFUSES a `set` that resolves to the strength and direction already
 *    persisted — `set_target_unchanged`, whose own text says *"Confirm the
 *    current strength explicitly if you want to adopt the existing value."*
 *    Ratifying an existing number is `intent: 'confirm_current'`, a
 *    provenance-only act no UI builder emits today. So a reader who AGREED with
 *    Olumi — the single most likely response to "we estimated this, you have
 *    not confirmed it" — would have followed the instruction and been refused.
 *    "Review" is what the route delivers, so "review" is what this says.
 *
 * 2. IT INSTRUCTED EVEN WHERE NO CONTROL EXISTS. The act renders only where the
 *    Model tab established it can serve this edge (`strengthEditReachable`).
 *    Where it cannot, an imperative is an instruction to press something that
 *    is not there — and the honest response is to stop instructing, NOT to
 *    invent a different move or to claim no move exists anywhere. The naming,
 *    the measured rate and the falsification framing are this card's value and
 *    they survive a missing route untouched.
 *
 * ⚠ `null`, NOT A SUBSTITUTE SENTENCE. This surface does not know WHY the
 * destination declined — no causal row, or a strength nothing proves — and it
 * does not know whether some other surface could serve it. A sentence
 * explaining an absence it cannot characterise would be a new claim, which is
 * the thing this module exists not to make.
 */
export function assumedStrengthAsk(s: AssumedStrengthSelection): string | null {
  if (!s.strengthEditReachable) return null
  return s.strengthProvenance === 'ai_inferred'
    ? 'Review Olumi’s estimate or change it to what your team believes. If the value changes, re-run to see whether it changes the answer.'
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
/**
 * ⭐ "ASK OLUMI TO", NOT "SET". The button used to read "Set this strength" and
 * pointed at `openEdgeStrengthEditor` -> the Inspector.
 *
 * ⚠⚠ THE RECORDED REASON WAS "the Inspector … is read-only because
 * `InspectorRouter` wraps every panel in an unconditional `<fieldset disabled>`".
 * THAT IS FALSE AT THE TIP, and for the EDGE panel it is false twice over:
 * `InspectorRouter.tsx:192` early-returns the edge branch, which carries NO
 * blanket fence — `:300-313` records the removal in its own words — and the
 * node branch's fence at `:541-551` is conditional on `AUTHORITY_OWNING_PANELS`
 * (`:441`). `EdgePanel` self-fences instead, per edge.
 * (The paragraph also cited the `EDGE_SETTER_AUTHORITY` manifest in
 * `inspector-v2/useInspectorMutations.ts`; deleted 27 Aug 2026, PR #886 — zero
 * code consumers, so it recorded a verdict rather than making one.)
 *
 * ⭐ THE WORDING STANDS ANYWAY, ON THE PREDICATE THAT ACTUALLY DECIDES IT.
 * `EdgePanel.tsx:699` disables the strength control on `!strengthReachesTheModel`
 * — `edgeStrengthEditIsAssertable(edge)`, which asks
 * `buildEdgeStrengthEditEvent` whether an `edge_strength_edit` could be built at
 * all, and answers NO for an edge with no server-stated `expected` tuple. That
 * is precisely the `'missing'` half of this module's own population
 * (`selectAssumedStrengthToResolve`: `valueSource === null` — an AI-drawn edge
 * still carrying a default). For those edges there is still nothing to route to,
 * and "Set" would still be a promise the product cannot keep.
 *
 * ⚠ WHAT IS NOW GENUINELY OPEN, STATED RATHER THAN BURIED: for the
 * `'ai_inferred'` half (`valueSource === 'cee'`, a producer-supplied weight) the
 * strength control IS reachable, so a DIRECT route exists for part of this
 * population where none existed before. Routing the card there would mean one
 * surface with two destinations chosen by a predicate the copy would also have
 * to explain — a design decision with its own blast radius, not a comment fix,
 * and deliberately NOT taken here. The ask serves both halves with one sentence.
 *
 * OLUMI can change an edge either way: `update_edge` is a first-class op in the
 * model-facing tool schema and CEE applies it through the canonical commit path.
 * So the honest act is to ask, and the wording says exactly that. It promises
 * the ASK, never the outcome — a single live trial proved the router elects this
 * path, which is existence, not reliability.
 */
export const ASSUMED_STRENGTH_ACTION = 'Ask Olumi to set this strength'

/**
 * The drawer's context line — chrome, never sent. It carries the two things the
 * draft cannot: that the number is the user's to choose, and that the analysis
 * does not silently update itself.
 *
 * ⚠ "CAN CHANGE", NOT "WILL CHANGE". The button's own guard forbids `will` for a
 * stated reason — this interaction promises the ASK, never the outcome, because
 * the router electing the graph-edit path was shown by ONE live trial, which is
 * existence and not reliability. The first cut of this constant said *"Olumi
 * will change the model"* and shipped past that guard, because the guard was
 * pointed at the BUTTON while this is the string the user reads at the moment
 * they decide to send. The principle was right and its coverage was one
 * constant wide. Both are fixed: the wording states capability, and the guard
 * is now enumerated from the module's own exports.
 */
export const ASSUMED_STRENGTH_ASK_CONTEXT =
  'Replace the number with your own judgement before sending. Olumi can change the model; the analysis then needs rerunning.'

/**
 * The prefilled EDITABLE draft.
 *
 * ⚠ THE PHRASING IS EVIDENCE-LED, NOT STYLE. A live probe showed the router
 * elects the graph-edit path for an explicit, fully-specified instruction naming
 * both endpoints and a number, and does NOT elect it for a vague one ("set X to
 * low" returned a clarifying question instead). So the draft names both labels
 * verbatim and carries an explicit value.
 *
 * ⚠ AND IT DOES NOT STATE A "BEFORE". The selection carries no current numeric
 * strength — only whether it is Olumi's estimate or unset — so asserting one
 * would be inventing it. `0.8` is a starting point the user edits, and the
 * context line says so; it is not a claim about what the value is now.
 */
export function assumedStrengthAskDraft(s: {
  fromLabel: string
  toLabel: string
}): string {
  return `Change the strength of the link from ${s.fromLabel} to ${s.toLabel} to 0.8.`
}

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
