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
 * side rather than taken on trust — and narrowed 6 Sep 2026 to what is measured
 * (the previous sentence claimed EVERY capture maxes at 1.0; a reviewer refuted
 * it): of the 21 JSON files under `src/` carrying `influence_score`, every one
 * whose maximum is non-zero maxes at exactly 1.0 (live staging responses among
 * them), none exceeds 1.0, and one real degenerate turn is uniformly 0. The
 * sweep is derived in `influenceIsNeverCalledAbsolute.spec.ts`.
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
import type { ZeroReasonCode } from './types'

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
 * 1.0 BY CONSTRUCTION. Measured on data rather than argued from code, and
 * stated as measured (see the module header for the 6 Sep narrowing): of the 21
 * JSON files under `src/` carrying the field, every one whose maximum is
 * non-zero maxes at EXACTLY 1.0 (live staging responses among them), none
 * exceeds 1.0, and one is uniformly 0. A quantity that is either exactly 1 at
 * its top or uniformly zero is a ratio to its own maximum.
 *
 * So the clause was false twice over, for two unrelated reasons, and neither
 * lane could see the other's. It is now the relative wording — which was true
 * of both bases the whole time.
 *
 * Kept as an ALIAS rather than deleted: canvas surfaces reach this copy through
 * `influenceExplanation()` below (`canvas/nodes/FactorNode.tsx`,
 * `canvas/nodes/shared/MetricPills.tsx`), so changing what it SAYS fixes every
 * consumer at once.
 *
 * ⚠ 7 Sep 2026 — THIS PARAGRAPH USED TO SAY "canvas surfaces outside this lane
 * import the symbol … deleting it would force an unrelated lane to take a
 * breaking change on my schedule", and the docblock below reused that premise to
 * justify keeping the name. MEASURED AT THIS HEAD AND FALSE.
 * `INFLUENCE_EXPLANATION_ABSOLUTE` is referenced in 5 files, ALL of them under
 * `src/components/results/`: this module, `DriversSection.tsx`, and three specs.
 * `src/canvas/` references it ZERO times, and there is no barrel or re-export
 * (`src/components/results/index.ts` does not exist). Contrast control in the
 * same sweep, so the zero is an absence rather than a blind probe:
 * `INFLUENCE_EXPLANATION_GENERIC` IS imported by name in two canvas files, and
 * eight canvas files import from this module. So renaming this symbol is a LOCAL
 * change, not a coordinated cross-lane one. What survives of the original
 * sentence is its true half: rewriting the STRING fixes every surface at once,
 * because canvas goes through the accessor rather than the constant.
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
 * The name is kept on judgement, not on coupling: per the measurement in the
 * docblock above, renaming `INFLUENCE_EXPLANATION_ABSOLUTE` is a local change
 * inside `src/components/results/`. It is a tidy-up this lane declined so the
 * diff stays about the copy, not one it was barred from making.
 */

/**
 * The producer's own basis stamp meaning "this score came from the model's
 * structure". Matched EXACTLY, and it is the only value that unlocks the
 * disclosure below.
 *
 * ⭐ WHY A VALUE AND NOT AN ASSUMPTION. Measured in this tree (base
 * `53dbd616`): `importance_basis` is `"graph_structural"` on 67/67 factor
 * rows across all 12 live capture fixtures (31 Jul - 17 Aug 2026), complete
 * manifest, no sampling; no row carries any other value. That is a complete
 * manifest of the CAPTURES HERE, not of every possible run. Keying the copy
 * on the value means that if the producer ever stamps a simulation-derived
 * basis, this module simply says nothing new — whereas copy keyed on "it is
 * always structural" would silently become the next false sentence, which is
 * exactly how "from the analysis" got here.
 */
export const STRUCTURAL_IMPORTANCE_BASIS = 'graph_structural'

/**
 * What the figure is derived from, in the user's terms.
 *
 * ⚠ WHAT THIS SENTENCE IS AND IS NOT CLAIMING. It states the BASIS the
 * producer itself stamped on the row. It deliberately does NOT claim the
 * number is invariant across runs: that is true on the graph path and is not
 * bounded from this repo (the fallback arm is unmeasured), so asserting it
 * would trade one unbounded claim for another. The user's question - "I
 * re-ran and these numbers did not move" - is answered by naming the basis,
 * without buying a claim nobody here has measured.
 */
export const INFLUENCE_STRUCTURAL_BASIS_NOTE =
  'Based on the structure of your model, not on this run’s simulated outcomes.'

/**
 * The structural-basis disclosure for a given (display basis, producer stamp)
 * pair, or null when nothing may be said.
 *
 * ⚠ GATED ON BOTH, AND THE SECOND GATE IS THE SUBTLE ONE. `importance_basis`
 * describes the producer's `influence_score`. When the display model falls
 * back to `normalised_elasticity` the number on screen is normalised
 * magnitude derived from the run, NOT the producer score - so the structural
 * sentence would be false about the figure the reader is looking at, even
 * though the stamp is genuinely present on the row. One name, two questions:
 * "what basis did the producer stamp" and "what is this number on screen".
 */
export function influenceStructuralBasisNote(
  provenance: DriverDisplayProvenance | null | undefined,
  importanceBasis: string | null | undefined,
): string | null {
  if (provenance !== 'influence_score') return null
  return importanceBasis === STRUCTURAL_IMPORTANCE_BASIS ? INFLUENCE_STRUCTURAL_BASIS_NOTE : null
}

/** Append the disclosure to a sentence, or return the sentence untouched. */
function withStructuralBasisNote(
  sentence: string,
  provenance: DriverDisplayProvenance | null | undefined,
  importanceBasis: string | null | undefined,
): string {
  const note = influenceStructuralBasisNote(provenance, importanceBasis)
  return note === null ? sentence : `${sentence} ${note}`
}

/**
 * Drivers panel ranking explainer — the FAIL-CLOSED arm, taken exactly when
 * `DriversSection` resolves `influenceBasis === 'unknown'`: no provenance stamp,
 * OR no visible driver rows, OR the fallback basis below its magnitude floor.
 *
 * ⚠ 7 Sep 2026 — THIS SAID "generic (absolute or unstamped basis)", AND THIS PR
 * FALSIFIED IT. It was true at `11b995d9`, where `DriversSection` gated the
 * explainer on `influenceBasis === 'relative'`, so the producer basis fell
 * through to this string. The Q2 widening routes BOTH stamped bases to the
 * relative explainer (`DriversSection.tsx`, `influenceScaleIsSetRelative`), so
 * this arm no longer serves the producer basis — and "absolute" is the scale
 * word this PR retires. Sole consumer: `DriversSection.tsx`.
 */
export const INFLUENCE_RANKING_EXPLAINER_GENERIC =
  'Ranked by how much each factor affects the outcome'

/**
 * Drivers panel ranking explainer — EITHER stamped basis.
 *
 * ⚠ 7 Sep 2026 — THIS SAID "set-relative fallback basis", naming one basis when
 * this PR widened it to two. Both stamped provenances are set-relative
 * normalisations, so both take this string; only the unstamped and degenerate
 * states fall through to the generic one above.
 */
export const INFLUENCE_RANKING_EXPLAINER_RELATIVE =
  'Ranked by how much each factor affects the outcome, relative to the strongest factor'

/**
 * Drivers panel always-visible caption — EITHER stamped basis.
 *
 * ⚠⚠ 7 Sep 2026 — THIS SAID "set-relative fallback basis ONLY", AND THAT WORD IS
 * THE DEFECT THIS PR EXISTS TO REMOVE. Withholding this caption on the producer
 * basis is what let a figure that is 100% BY CONSTRUCTION read as a causal
 * share, on the ordinary run. `DriversSection.tsx` now renders it whenever
 * `influenceScaleIsSetRelative` (i.e. any stamped basis with visible rows);
 * `DriversSection.influenceScaleDisclosure.spec.tsx` pins that by test id on
 * both bases and pins its ABSENCE in both degenerate states.
 */
export const INFLUENCE_SCALE_CAPTION =
  'Influence is relative to the strongest factor. The top driver always shows 100%.'

/**
 * Basis-aware explanation for tooltips / native titles. Fail-closed: an
 * absent provenance yields the generic wording.
 */
export function influenceExplanation(
  provenance: DriverDisplayProvenance | null | undefined,
  importanceBasis?: string | null,
): string {
  const base =
    provenance === 'normalised_elasticity'
      ? INFLUENCE_EXPLANATION_RELATIVE
      : provenance === 'influence_score'
        ? INFLUENCE_EXPLANATION_ABSOLUTE
        : INFLUENCE_EXPLANATION_GENERIC
  return withStructuralBasisNote(base, provenance, importanceBasis)
}

/**
 * Accessible name for the "I: NN%" pill. The pill's visible text is cryptic,
 * so the name carries both the number and the basis.
 */
export function influencePillAriaLabel(
  pct: number,
  provenance: DriverDisplayProvenance | null | undefined,
  importanceBasis?: string | null,
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
   * `max|influence|`, so the top row is 1.0 by construction.
   *
   * ⚠ 6 Sep 2026 — THE SENTENCE THAT STOOD HERE WAS THE REFUTED UNIVERSAL,
   * "every capture in this repo carrying the field maxes at exactly 1.0", and
   * THIS PR ADDED IT — in the module it designates as the single source of
   * truth, while narrowing the same claim correctly everywhere else in this
   * file. What is measured, swept over `src/` at `aa504187`: 21 JSON files
   * carry `influence_score`; 20 of them max at exactly 1.0; the twenty-first,
   * `seeded-2026-08-17-w2d-analysis-turn.json`, is uniformly 0 (one factor
   * stamped `input_quality: "degenerate_fallback"`). None exceeds 1.0, and
   * none maxes strictly between 0 and 1. That sweep is DERIVED, with the
   * all-zero file pinned by name as an exact set, in
   * `influenceIsNeverCalledAbsolute.spec.ts` — which is the guard. This
   * comment is not, which is exactly how the universal survived here.
   *
   * The `normalised_elasticity` arm has disclosed "The top driver always shows
   * 100%" the whole time, which is equally true of this one.
   *
   * The two arms therefore say the same thing to a reader. The distinction is
   * still real and is still carried — in `provenance`, where it belongs — but
   * it is not a difference a user can act on, and spending a false word on it
   * was the cost.
   */
  const base =
    provenance === 'normalised_elasticity' || provenance === 'influence_score'
      ? `Relative influence ${pct}%, scaled against the strongest factor. The top driver always shows 100%`
      : 'Influence basis unavailable'
  // The disclosure must reach a screen-reader user too: `title` is
  // pointer-only, so a note that lived there alone would be a disclosure a
  // whole class of readers never receives.
  const note = influenceStructuralBasisNote(provenance, importanceBasis)
  return note === null ? base : `${base}. ${note}`
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
  importanceBasis?: string | null,
): string {
  /* Same ruling as the pill: both provenances are set-relative normalisations,
     so both get the disclosure that the top driver always shows 100% — which
     was previously given to only one of the two it is true of. */
  const base =
    provenance === 'normalised_elasticity' || provenance === 'influence_score'
      ? 'Influence, relative to the strongest factor. The top driver always shows 100%'
      : 'Influence'
  const note = influenceStructuralBasisNote(provenance, importanceBasis)
  return note === null ? base : `${base}. ${note}`
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

/**
 * ⭐⭐ WHY A FACTOR THE PRODUCER RETURNED CARRIES NO SENSITIVITY — the
 * producer's own stamp, in one spelling.
 *
 * `ZeroReasonCode` (`results/types.ts`) is the producer's explanation for a
 * suppressed sensitivity, and the three codes differ in a way no summary
 * survives. `analysisNewCopy.ts` states the rule for its own empty state:
 * "three reasons cannot share one summary without one of them being described
 * wrongly". So every surface that discloses a suppression names the CODE.
 *
 * ⚠ MOVED HERE FROM `DriversSection.tsx`, WHERE IT WAS A FILE-LOCAL CONST, so
 * that the Reasoning tab's exclusion notice and the Drivers panel's row badge
 * cannot drift into two spellings of one producer stamp (CLAUDE.md trap 12).
 * `DriversSection` imports it rather than declaring it; nothing else changed
 * there.
 *
 * ⚠ TOTAL OVER THE CODE UNION, DELIBERATELY. Typed as a `Record` over
 * `NonNullable<ZeroReasonCode>` rather than `Record<string, string>`, so a
 * fourth code added to the union fails the BUILD instead of rendering a blank
 * reason. That is the derived half of the guard; the copy-hygiene cases above
 * are the corpus half.
 *
 * Display/label only — it reflects the producer's stamp and never fabricates
 * or recomputes a value.
 */
export const ZERO_REASON_BADGE_LABELS: Record<NonNullable<ZeroReasonCode>, string> = {
  intervention_override: 'Controlled by your options',
  disconnected: 'No path to the goal',
  zero_outcome_diff: "Doesn't change the outcome",
}
