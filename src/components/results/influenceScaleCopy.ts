/**
 * influenceScaleCopy — the ONE home for influence-scale disclosure wording
 * (lane C4), shared by every surface that renders the display model's
 * influence number: the results Drivers panel (DriversSection header tooltip,
 * ranking explainer, visible caption) and the canvas surfaces (MetricPills
 * "I: NN%" pill, FactorNode detailed-view Influence row). Centralised so the
 * surfaces cannot drift ("keep in step" comments are not a mechanism) and so
 * the copy-hygiene spec has one import to police.
 *
 * Basis semantics (driverDisplayModel). ⚠⚠ CORRECTED 5 Sep 2026 — this
 * paragraph said 'influence_score' was "the producer's ABSOLUTE causal
 * influence score", and that sentence is where the false wording downstream
 * came from.
 *
 * BOTH stamped provenances are SET-RELATIVE. They are two different
 * NORMALISATIONS: 'normalised_elasticity' is this app's own, and
 * 'influence_score' is the producer's, against `max|influence|` — so its top
 * row is 1.0 by construction exactly as the other's is. Verified from this
 * side rather than taken on trust: every capture in this repo carrying
 * `influence_score` has a maximum of exactly 1.0, twelve files including live
 * staging responses.
 *
 * So BOTH must be disclosed, in the same words. No provenance (legacy fixtures
 * / cached payloads) still fails closed to the generic wording, never claiming
 * a basis the pipeline did not stamp.
 *
 * ⚠ The distinction between the two normalisations is real and is still carried
 * in `provenance`. It is not a difference a reader can act on, which is why it
 * no longer buys a separate — and false — vocabulary.
 *
 * Copy hygiene (influenceScaleCopy.copyHygiene.spec.ts): sentence case,
 * en-GB, no internal analytical vocabulary, and NO em dashes (DS ban) in any
 * user-facing string exported here.
 */
import type {
  DriverDisplayProvenance,
  ResolvedAnalysisMetric,
} from './driverDisplayModel'

/** Header tooltip / pill title — no basis stamped (fail-closed). */
export const INFLUENCE_EXPLANATION_GENERIC =
  'Influence: how much this factor affects the outcome'

/** Header tooltip / pill title — set-relative fallback basis. */
export const INFLUENCE_EXPLANATION_RELATIVE =
  'Influence: how much this factor affects the outcome, relative to the strongest. The top driver always shows 100%.'

/**
 * Header tooltip / pill title.
 *
 * ⚠⚠ TWO LANES FOUND TWO DIFFERENT FALSEHOODS IN ONE CLAUSE. BOTH FIXES STAND.
 *
 * ── #1221 (canvas lane, merged 5 Sep): "from the analysis" is FALSE ────────
 * DO NOT RESTORE IT. `influence_score` is `normalised_influence`, a normalised
 * product of authored edge `strength.mean` along the paths to the goal, with
 * option and decision nodes filtered OUT, computed BEFORE the ISL result
 * exists. Witnessed: a founder added a fourth option and flipped the leader
 * outright, and all five canvas influence numbers were byte-identical across
 * both runs. They could not have moved; the tooltip attributed them to the run.
 *
 * That lane deliberately did NOT replace it with an invariance claim, because
 * invariance is true on the graph path and unbounded from this repo. Correct,
 * and untouched.
 *
 * ── #1228 (this lane, 6 Sep): "an absolute causal influence score" is ALSO
 *    FALSE, and the same lane kept it in good faith ────────────────────────
 * It kept the scale clause on the explicit grounds that it is "the producer's
 * own declared semantics (`driverDisplayModel.ts`, 'an absolute producer scale,
 * not a share')". **That premise was wrong, and it was wrong in our own type
 * file** — which is why a careful lane relied on it.
 *
 * `influence_score` is normalised against `max|influence|`, so the top row is
 * 1.0 BY CONSTRUCTION. Measured on data rather than argued from code: every
 * capture in this repo carrying the field has a maximum of EXACTLY 1.0 —
 * twelve files, live staging responses among them. A quantity whose maximum is
 * always exactly 1 is a ratio to that maximum.
 *
 * So the clause was false twice over, for two unrelated reasons, and neither
 * lane could see the other's. It is now the relative wording — which was true
 * of both bases the whole time.
 *
 * Kept as an ALIAS rather than deleted: canvas surfaces outside this lane
 * import the symbol, so changing what it SAYS fixes every consumer at once,
 * where deleting it would force an unrelated lane to take a breaking change on
 * my schedule.
 */
export const INFLUENCE_EXPLANATION_ABSOLUTE =
  "Influence: Olumi's structural influence score, relative to the strongest factor in this run. The top driver always shows 100%."

/**
 * ⚠⚠ THE TWO ARMS STAY DISTINCT, AND THAT IS #1221'S GUARD DOING ITS JOB.
 *
 * My first cut aliased this constant to the relative one, on the reasoning that
 * both bases are set-relative so the sentence is the same. `influenceScaleCopy.
 * noRunProvenance.spec.ts` REDded — a positive control written by the canvas
 * lane asserting "the two arms still make their OWN distinct claims, so a later
 * change that collapsed them into one bland string would be visible here."
 *
 * It was right and I was wrong. The SCALE is shared; the QUANTITY is not.
 * `influence_score` is the producer's structural score and
 * `normalised_elasticity` is this app's own normalisation of a raw elasticity —
 * which is exactly why only the first licenses a figure. A reader hovering the
 * pill needs to know which one they are looking at, and an alias would have
 * taken that away to fix something else.
 *
 * So both arms name their own quantity and NEITHER claims an absolute scale.
 * The symbol keeps its name because canvas surfaces import it; renaming it is a
 * coordinated change, not mine to make unilaterally.
 */

/** Drivers panel ranking explainer — generic (absolute or unstamped basis). */
export const INFLUENCE_RANKING_EXPLAINER_GENERIC =
  'Ranked by how much each factor affects the outcome'

/** Drivers panel ranking explainer — set-relative fallback basis. */
export const INFLUENCE_RANKING_EXPLAINER_RELATIVE =
  'Ranked by how much each factor affects the outcome, relative to the strongest factor'

/** Drivers panel always-visible caption — set-relative fallback basis only. */
export const INFLUENCE_SCALE_CAPTION =
  'Influence is relative to the strongest factor. The top driver always shows 100%.'

/**
 * Basis-aware explanation for tooltips / native titles. Fail-closed: an
 * absent provenance yields the generic wording.
 */
export function influenceExplanation(
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  return provenance === 'normalised_elasticity'
    ? INFLUENCE_EXPLANATION_RELATIVE
    : provenance === 'influence_score'
      ? INFLUENCE_EXPLANATION_ABSOLUTE
      : INFLUENCE_EXPLANATION_GENERIC
}

/**
 * Accessible name for the "I: NN%" pill. The pill's visible text is cryptic,
 * so the name carries both the number and the basis.
 */
export function influencePillAriaLabel(
  pct: number,
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  // ⚠ THE NAME LEADS WITH THE SAME NOUN THE PILL NOW SHOWS. When the visible
  // string gained its basis, this label still opened with the bare noun — one
  // quantity under two names, which is the exact shape the visible change was
  // made to close. The explanatory clause stays: it says what the noun means.
  /**
   * ⚠⚠ THE `influence_score` ARM SAID "an absolute causal influence score from
   * the analysis". IT IS NOT ABSOLUTE, AND THE ARM BESIDE IT ALREADY SAID SO.
   *
   * Both provenances are set-relative — they are two different NORMALISATIONS,
   * not absolute-vs-relative. `influence_score` is the producer's, against
   * `max|influence|`, so the top row is 1.0 by construction; every capture in
   * this repo carrying the field maxes at exactly 1.0. The
   * `normalised_elasticity` arm has disclosed "The top driver always shows
   * 100%" the whole time, which is equally true of this one.
   *
   * The two arms therefore say the same thing to a reader. The distinction is
   * still real and is still carried — in `provenance`, where it belongs — but
   * it is not a difference a user can act on, and spending a false word on it
   * was the cost.
   */
  return provenance === 'normalised_elasticity' || provenance === 'influence_score'
    ? `Relative influence ${pct}%, scaled against the strongest factor. The top driver always shows 100%`
    : 'Influence basis unavailable'
}

/**
 * The VISIBLE noun for an influence figure, basis-aware.
 *
 * ⭐ WHY THE BASIS MOVED INTO THE VISIBLE STRING. On the set-relative basis the
 * value is scaled against the strongest factor in the run, so the leader reads
 * 100% by construction and three near-equal factors read 91% each. A bare
 * percentage there is taken for an absolute share of the outcome — a deployed
 * graph showed exactly that. The basis was disclosed only through `title` and
 * `aria-label`: a pointer user never opens the first and a sighted user never
 * hears the second.
 *
 * Fail-closed to the plain noun when nothing is stamped. Both canvas call sites
 * already withhold the figure entirely in that state, so this arm asserts
 * nothing about a basis it does not know.
 */
export function influenceBasisNoun(
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  /* ⚠ Same ruling as `influencePillAriaLabel`: both provenances are
     set-relative, so both take the relative noun. "Influence score" as a bare
     noun invited exactly the absolute reading this function's own docblock
     describes a deployed graph producing. */
  return provenance === 'normalised_elasticity' || provenance === 'influence_score'
    ? 'Relative influence'
    : 'Influence'
}

/**
 * Accessible name for the detailed-view Influence DataBar. The value is
 * announced separately via aria-valuenow, so the name carries the basis only.
 */
export function influenceBarAriaLabel(
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  /* Same ruling as the pill: both provenances are set-relative normalisations,
     so both get the disclosure that the top driver always shows 100% — which
     was previously given to only one of the two it is true of. */
  return provenance === 'normalised_elasticity' || provenance === 'influence_score'
    ? 'Influence, relative to the strongest factor. The top driver always shows 100%'
    : 'Influence'
}

/** Convert a resolved metric to display percent without rescaling its value. */
export function analysisMetricPercent(metric: ResolvedAnalysisMetric): number {
  return Math.round(metric.value * 100)
}

/** Compact visible label. Every number names its licensed metric. */
export function analysisMetricVisibleLabel(metric: ResolvedAnalysisMetric): string {
  const pct = analysisMetricPercent(metric)
  switch (metric.permittedLanguage) {
    case 'set_relative_influence':
      return `Relative influence ${pct}%`
    case 'pre_analysis_influence_score':
      return `Pre-analysis influence score ${pct}%`
    case 'value_of_information':
      return `Value of information ${pct}%`
  }
}

/** Standalone title and accessible description for a resolved metric. */
export function analysisMetricTitle(metric: ResolvedAnalysisMetric): string {
  const pct = analysisMetricPercent(metric)
  switch (metric.permittedLanguage) {
    case 'set_relative_influence':
      return `Influence ${pct}%, relative to the strongest factor in this analysis`
    case 'pre_analysis_influence_score':
      return `Pre-analysis influence score ${pct}%`
    case 'value_of_information':
      return `Value of information ${pct}%`
  }
}

/** Predicate slot for generated prose after a factor name. */
export function analysisMetricPredicate(metric: ResolvedAnalysisMetric): string {
  const pct = analysisMetricPercent(metric)
  switch (metric.permittedLanguage) {
    case 'set_relative_influence':
      return `has relative influence of ${pct}% within this analysis`
    case 'pre_analysis_influence_score':
      return `has a pre-analysis influence score of ${pct}%`
    case 'value_of_information':
      return `has a value of information score of ${pct}%`
  }
}

/** Complete context sentence used by compact coaching surfaces. */
export function analysisMetricContextSentence(metric: ResolvedAnalysisMetric): string {
  return `${analysisMetricTitle(metric)}.`
}
