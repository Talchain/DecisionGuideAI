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
 */

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
