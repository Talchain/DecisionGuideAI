/**
 * influenceScaleCopy — the ONE home for influence-scale disclosure wording
 * (lane C4), shared by every surface that renders the display model's
 * influence number: the results Drivers panel (DriversSection header tooltip,
 * ranking explainer, visible caption) and the canvas surfaces (MetricPills
 * "I: NN%" pill, FactorNode detailed-view Influence row). Centralised so the
 * surfaces cannot drift ("keep in step" comments are not a mechanism) and so
 * the copy-hygiene spec has one import to police.
 *
 * Basis semantics (driverDisplayModel): 'normalised_elasticity' is the
 * set-relative fallback (top driver shows 100% by construction) and MUST be
 * disclosed; 'influence_score' is the producer's absolute causal influence
 * score; no provenance (legacy fixtures / cached payloads) fails closed to
 * the generic wording, never claiming a basis the pipeline did not stamp.
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
 * Header tooltip / pill title — absolute producer basis.
 *
 * ⚠⚠ DO NOT RESTORE "from the analysis". It was removed 5 Sep 2026 because it
 * is FALSE, and it is the kind of clause that reads as harmless polish on the
 * way back in.
 *
 * WHAT WAS MEASURED (PLoT `d37c8cfd`). The producer's `influence_score` is
 * `normalised_influence` — a normalised product of authored edge `strength.mean`
 * along the paths to the goal (`lib/factor-influence.ts:546-556, :798`). Its own
 * header states *"No dependency on parameter_uncertainties — derived purely from
 * edge data"* (`:505`), and `routes/v2/run.ts:5503-5504` filters option and
 * decision nodes OUT of the graph it is computed over, at a line that runs
 * BEFORE the ISL result exists (`:7610`). The graph path is PRIMARY and ISL is
 * the fallback (`run.ts:7983`).
 *
 * THE CONSEQUENCE A USER SEES, and the reason this matters. A founder ran an
 * analysis twice — adding a fourth option and flipping the leader outright,
 * win probabilities fully redistributed — and the five canvas influence numbers
 * were byte-identical across both runs. They could not have moved. The tooltip
 * meanwhile attributed them to the run.
 *
 * ⭐ WHAT THIS FILE DELIBERATELY DOES NOT SAY. It no longer claims the number
 * comes FROM the run, and it does not claim it is INVARIANT ACROSS runs either.
 * The second claim is true on the graph path and is NOT bounded from this repo:
 * the ISL fallback arm is unmeasured, and the CEE→PLoT round trip for edge
 * weights was never derived. Stating only the scale — which is the producer's
 * own declared semantics (`driverDisplayModel.ts:36`, "an absolute producer
 * scale, not a share") — removes a false claim without buying an unbounded one.
 *
 * ⚠ THE `normalised_elasticity` ARM IS UNTOUCHED ON PURPOSE. Its wording makes a
 * SCALING claim ("relative to the strongest"), never a provenance claim, so it
 * was not false and re-wording it would assert something not derived here.
 */
export const INFLUENCE_EXPLANATION_ABSOLUTE =
  'Influence: how much this factor affects the outcome, as an absolute causal influence score.'

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
  const base =
    provenance === 'normalised_elasticity'
      ? `Relative influence ${pct}%, scaled against the strongest factor. The top driver always shows 100%`
      : provenance === 'influence_score'
        ? `Influence score ${pct}%, an absolute causal influence score`
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
  return provenance === 'normalised_elasticity'
    ? 'Relative influence'
    : provenance === 'influence_score'
      ? 'Influence score'
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
  const base =
    provenance === 'normalised_elasticity'
      ? 'Influence, relative to the strongest factor. The top driver always shows 100%'
      : provenance === 'influence_score'
        ? 'Influence, an absolute causal influence score'
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
    case 'absolute_influence_score':
      return `Influence score ${pct}%`
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
    case 'absolute_influence_score':
      return `Influence score ${pct}% on the analysis scale`
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
    case 'absolute_influence_score':
      return `has an influence score of ${pct}%`
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
