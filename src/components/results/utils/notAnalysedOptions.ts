/**
 * notAnalysedOptions — "was this option in the analysis at all?", derived.
 *
 * Ruling (Paul, 14 Aug 2026): an unanalysable/placeholder option must NOT be
 * included in comparative ranking or probabilities. It stays visible as a
 * proposed/unanalysed alternative with a clear reason and an action to resolve
 * it.
 *
 * ## Why this is DERIVED and not a wire field
 *
 * CEE excludes an option with no interventions from the PLoT submission, so the
 * producer already tells us by OMISSION: there is no `option_probabilities`
 * entry for it. Adding a boolean to the wire for a fact that is already on the
 * wire would be a second authority on one question (CLAUDE.md trap 21) and a
 * new field with one reader is exactly the dark-field failure this estate keeps
 * paying for. The fact is derivable at the join; it is derived at the join.
 *
 * ## TWO QUESTIONS, KEPT APART (trap 21)
 *
 *   1. **WAS IT ANALYSED?** — {@link isAnalysedOption} / {@link runAnalysedAnyOption}.
 *      A property of the RESULT.
 *   2. **WHY NOT?** — {@link deriveNotAnalysedReason}. A property of the GRAPH.
 *
 * They have different sources, different failure modes and different honest
 * copy. Collapsing them would produce the estate's signature defect: one
 * `return null` answering two questions.
 *
 * ## THE DOMAIN GUARD IS THE LOAD-BEARING PART
 *
 * "No entry for this option" is true in three worlds, and only one of them is
 * this ruling's:
 *
 *   (a) the run analysed other options and left this one out — the ruling's case;
 *   (b) the run produced NO per-option results at all (a failed/degenerate run,
 *       a producer gap, a schema-pin skew that ate the block);
 *   (c) the result ids do not match the graph ids at all.
 *
 * In (b) and (c) EVERY option reads "missing", and marking them all
 * not-analysed would tell a user who configured everything correctly that they
 * configured nothing. So the predicate is *"absent from a result set that HAS
 * results"*, never *"absent"* — {@link runAnalysedAnyOption} is that guard, and
 * it also makes this change a strict no-op on every run that has no excluded
 * option. It fails toward saying less.
 *
 * ---
 *
 * # ⭐ A THIRD QUESTION LIVES IN THIS FILE, BESIDE THE OTHER TWO — NEVER INSIDE
 *
 *   3. **DID THE COMPUTATION PRODUCE A USABLE RESULT?** —
 *      {@link optionComputationProducedResult}. A property of the PRODUCER'S
 *      STATED CLASSIFICATION.
 *
 * ⚠⚠ **AN OPTION CAN BE ANALYSED AND NOT COMPUTED, AND THAT INTERSECTION IS
 * WHY THIS IS A SECOND PREDICATE RATHER THAN A WIDENING OF THE FIRST.** The
 * option was submitted, ISL ran on it, and got ZERO finite Monte Carlo samples
 * — so {@link isAnalysedOption} says `true` (there IS an entry) and
 * {@link optionComputationProducedResult} says `false` (the entry is a
 * classified failure). Both answers are correct. Widening `isAnalysedOption` to
 * cover it would break its own documented promise — a present entry is present,
 * and re-badging it "you did not configure this option" is a lie about whose
 * fault it is — while narrowing this one into that flag would put a
 * producer-stated fact behind a derived one.
 *
 * **They also fail in OPPOSITE DIRECTIONS on absence, deliberately.** An absent
 * ENTRY is meaningful (guarded by {@link runAnalysedAnyOption}). An absent
 * STATUS is NOT: it is the legacy V1 shape, which has no status field at all,
 * and it keeps the option on the ordinary path. Reconciling those two defaults
 * would be the wrong fix (CLAUDE.md trap 21 — two authorities answering
 * different questions look like an inconsistency, and aligning them destroys
 * one of the answers).
 *
 * The honest copy differs too, which is the practical tell that these are two
 * questions: "you have not set this up yet" is actionable and true of case (1);
 * "the analysis could not compute a result for this one" is not actionable and
 * is the only true thing to say about case (3).
 */

import type { OptionComputeStatus } from '../../../adapters/plot/optionComputeStatus'

/** Why an option carries no analysis. Two facts, never one boolean. */
export type NotAnalysedReason =
  /**
   * The option has no intervention edges on the graph, so there was nothing to
   * submit. USER-ACTIONABLE: saying what it changes resolves it.
   */
  | 'no_interventions'
  /**
   * The option looks configured and the run still returned nothing for it.
   * NOT user-actionable — the honest copy reports it and prescribes no step
   * (a disclosure that prescribes a futile action is worse than one that
   * reports).
   */
  | 'not_returned'

/** The shape this module needs off a canvas edge. */
export interface OptionEdgeLike {
  readonly source: string
  readonly target: string
}

/**
 * True when the run returned a per-option result for this node.
 *
 * `null` counts as absent: a null entry is not a computation. A present
 * non-object entry counts as PRESENT — that is a malformed producer payload,
 * a different defect, and silently re-badging it as "you did not configure
 * this option" would be a lie about whose fault it is.
 *
 * ⚠ THIS IS PRESENCE ONLY, AND IT STAYS THAT WAY. It says nothing about whether
 * the present entry contains a usable computation — that is
 * {@link optionComputationProducedResult}, and an option can satisfy this
 * predicate while failing that one.
 */
export function isAnalysedOption(
  optionProbabilities: Readonly<Record<string, unknown>> | null | undefined,
  nodeId: string,
): boolean {
  if (!optionProbabilities) return false
  const entry = optionProbabilities[nodeId]
  return entry !== undefined && entry !== null
}

/**
 * THE DOMAIN GUARD. True when at least one of the graph's option nodes has a
 * result — i.e. the run actually produced per-option output, so an absence is
 * about THIS option rather than about the whole run.
 */
export function runAnalysedAnyOption(
  optionProbabilities: Readonly<Record<string, unknown>> | null | undefined,
  optionNodeIds: readonly string[],
): boolean {
  return optionNodeIds.some((id) => isAnalysedOption(optionProbabilities, id))
}

/**
 * Why this option was not analysed, read off the GRAPH the user built.
 *
 * The intervention predicate is deliberately the SAME one the pre-run
 * validator already uses to raise `OPTIONS_NEED_MAPPING`
 * (`usePreRunValidation.ts`: an edge from the option to a non-option node), so
 * the results panel and the pre-analysis panel cannot disagree about whether
 * an option is configured. A second spelling of "configured" is how two
 * surfaces end up contradicting each other about one option.
 */
export function deriveNotAnalysedReason(
  nodeId: string,
  edges: readonly OptionEdgeLike[],
  optionNodeIds: readonly string[],
): NotAnalysedReason {
  const optionIds = new Set(optionNodeIds)
  const hasInterventionEdge = edges.some((e) => e.source === nodeId && !optionIds.has(e.target))
  return hasInterventionEdge ? 'not_returned' : 'no_interventions'
}

/**
 * ⭐ DID THE COMPUTATION PRODUCE A USABLE RESULT FOR THIS OPTION?
 *
 * The PRODUCER's answer, read — never re-derived. See
 * {@link isAnalysedOption} for the OTHER question this file answers and why the
 * two are kept apart rather than reconciled.
 *
 * ## Gated on the EMITTED VALUE, never on falsiness
 *
 * The only status that means "there is no computation here" is `'failed'`,
 * which ISL emits exactly when `n_valid === 0` — zero finite Monte Carlo
 * samples, so no distribution, so no share and no percentile behind any number
 * attached to the option.
 *
 * ⛔ **`'partial'` IS NOT A FAILURE AND MUST NOT BE TREATED AS ONE.** It means
 * `0 < n_valid/n_total < 0.8`: the samples EXIST, ISL emits a full `outcome`
 * block, and it raises a LOW_EFFECTIVE_SAMPLES critique alongside. It is a
 * DISCLOSURE. A `status !== 'computed'` predicate would swallow it and discard
 * results ISL honestly computed — which is why this is written against the
 * failing token and not against the passing one. PLoT's own `isFailedIslOption`
 * (`src/routes/v2/run.ts`) is spelled the same way for the same reason, and the
 * two must not drift.
 *
 * ⛔ **`undefined` IMPLIES NOTHING AND STAYS ON THE ORDINARY PATH.** It is the
 * legacy V1 shape — ISL's V1 `OptionResult` carries no `status` field at all —
 * and it is also what both mappers produce for a token outside the producer's
 * vocabulary (the shared contract types this as a bare string, so that is a
 * legal payload). Reading silence as failure would suppress a real result and
 * tell the user their option could not be computed when it was. This matches
 * PLoT's `isCrownableCandidate`, which treats an absent status as computed.
 *
 * @param status The narrowed per-option status, from
 *   `option_probabilities[id].status` / `OptionResult.computeStatus`. Already
 *   narrowed at the mapper: an unrecognised wire token arrives here as
 *   `undefined`, so this predicate never sees a string it does not know.
 */
export function optionComputationProducedResult(
  status: OptionComputeStatus | undefined,
): boolean {
  return status !== 'failed'
}

/**
 * The negation, named — for the one place that FORKS on it.
 *
 * Exists so a render site reads `optionComputationFailed(...)` rather than
 * `!optionComputationProducedResult(...)`: the fork in `OptionCards` is about
 * the failing case, and a negated positive at a fork is where an accidental
 * De Morgan lands. Both spellings resolve to the same single comparison above,
 * so there is no second authority here — only a second name for the same one.
 */
export function optionComputationFailed(
  status: OptionComputeStatus | undefined,
): boolean {
  return !optionComputationProducedResult(status)
}
