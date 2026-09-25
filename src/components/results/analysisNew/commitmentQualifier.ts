/**
 * ⭐ THE ONE PROVISIONAL QUALIFIER UNDER THE CHART (Reasoning V2).
 *
 * The prototype (`Olumi_Reasoning_Prototype_V2.html`, `commitHTML()`) puts one
 * borderless 11px line directly under the comparison it qualifies —
 * "Provisional · evidence and robustness not established." — where the served
 * tab put an amber bordered box above everything, a screen away from the chart.
 *
 * ⛔ EVERY CLAUSE IS A FACT THIS VIEW MODEL ALREADY STATES ELSEWHERE, read from
 * the same field, so the qualifier can never say more than About does:
 *   · whose figures the run consumed → `atAGlance.inputProvenance`
 *     (About's "Your inputs and Olumi's" row reads the same value);
 *   · evidence → the `evidence` check's code (About's "Evidence" row);
 *   · robustness → `atAGlance.verdict` (About's "Robustness" row says
 *     "Not established" on exactly the same `null`);
 *   · the engine's caveats → `deeper.critiques` + `deeper.caveats`, the very
 *     entries About › Limitations lists.
 * A clause whose fact is absent is omitted; with no clause there is no line.
 * Nothing here names, ranks or implies an option.
 *
 * ⭐⭐ WAVE 3 (25 Sep 2026): SHORTENED TO ONE LINE. #2025 was blocked on this —
 * the composed line ran to five clauses on a withheld automatic first pass,
 * pushing "Record your view" off the first screen. Two changes:
 *   1. `evidenceNotAssessed` and `robustnessNotEstablished` COMBINE into one
 *      clause when both are true ("evidence and robustness not established"),
 *      matching the prototype's own witness line exactly.
 *   2. The automatic-first-pass marker no longer joins the visible line at
 *      all. It still licenses "Provisional" on its own (an automatic run is
 *      never unlabelled), but the WORDS "automatic first pass" move to
 *      `detail` — one click away behind the qualifier's own disclosure
 *      (`CommitmentSummary`'s "Details" toggle) — because the reader needs
 *      "Provisional" and WHY at a glance, not the run's own provenance
 *      mechanics.
 * `estimated`/`partlyEstimated` and the caveat count stay on the visible
 * line: `theAnswerIsOnTheFirstScreen.spec.tsx` and `AnalysisNewTabBody.spec.tsx`
 * (outside this change's file set) both pin a fixture whose ONLY licensing
 * clause is the caveat count, so moving it behind a click would silence the
 * qualifier on that run. `openBullet` in `commitmentSynthesis.ts` never states
 * the estimates fact (checked directly, not assumed), so it stays visible too.
 */
import type { AnalysisNewViewModel } from './analysisNewTypes'

export const COMMITMENT_QUALIFIER_COPY = {
  lead: 'Provisional',
  estimated: "rests on Olumi's estimates",
  partlyEstimated: "rests partly on Olumi's estimates",
  /** Behind "Details": the rest of the estimates sentence (V2 one-line qualifier). */
  estimatesNotConfirmed: "Olumi's estimates are not yet confirmed by you",
  evidenceNotAssessed: 'evidence not assessed',
  robustnessNotEstablished: 'robustness not established',
  /** Both facts at once, in the prototype's own words — not two clauses. */
  evidenceAndRobustnessNotEstablished: 'evidence and robustness not established',
  caveats: (n: number): string => `${n} ${n === 1 ? 'caveat' : 'caveats'} in About`,
  /**
   * CEE's typed marker, `analysis_result.enrichment.run_provenance.provisional`
   * (RC 5818628860; Runtime 5818605567): the run Olumi started by itself after
   * building the model. Licensed ONLY by that marker, never inferred. Read
   * from `detail`, one click away — see the WAVE 3 note above.
   */
  automaticFirstPass: 'automatic first pass',
  /** The toggle beside the line that reveals `detail`, one click away. */
  detailToggle: { show: 'Details', hide: 'Hide details' },
} as const

/** Facts from outside the view model that license a clause. */
export interface QualifierFacts {
  /** `enrichment.run_provenance.provisional === true` on the displayed run. */
  readonly runProvisional?: boolean
}

/**
 * The one-line qualifier, plus whatever is one click away behind it.
 * `detail` is `null` when there is nothing further to disclose.
 */
export interface CommitmentQualifier {
  readonly text: string
  readonly detail: string | null
}

type QualifierInput = Pick<AnalysisNewViewModel, 'status' | 'atAGlance' | 'checks' | 'deeper'>

export function buildCommitmentQualifier(
  vm: QualifierInput,
  facts: QualifierFacts = {},
): CommitmentQualifier | null {
  if (vm.status.isPreRun) return null

  const lineClauses: string[] = []

  const detailClauses: string[] = []
  if (facts.runProvisional === true) detailClauses.push(COMMITMENT_QUALIFIER_COPY.automaticFirstPass)

  const inputs = vm.atAGlance.inputProvenance
  if (inputs === 'estimated') lineClauses.push(COMMITMENT_QUALIFIER_COPY.estimated)
  else if (inputs === 'partly_estimated' || inputs === 'mixed') {
    lineClauses.push(COMMITMENT_QUALIFIER_COPY.partlyEstimated)
  }
  if (inputs === 'estimated' || inputs === 'partly_estimated' || inputs === 'mixed') {
    detailClauses.push(COMMITMENT_QUALIFIER_COPY.estimatesNotConfirmed)
  }

  const evidence = vm.checks.items.find((i) => i.id === 'evidence')?.code ?? null
  const evidenceNotAssessed = evidence === 'evidence_not_assessed'
  const robustnessNotEstablished = vm.atAGlance.verdict === null
  if (evidenceNotAssessed && robustnessNotEstablished) {
    lineClauses.push(COMMITMENT_QUALIFIER_COPY.evidenceAndRobustnessNotEstablished)
  } else if (evidenceNotAssessed) {
    lineClauses.push(COMMITMENT_QUALIFIER_COPY.evidenceNotAssessed)
  } else if (robustnessNotEstablished) {
    lineClauses.push(COMMITMENT_QUALIFIER_COPY.robustnessNotEstablished)
  }

  // The engine's own caveats (critiques + strip-eligible inference warnings)
  // are listed in About › Limitations; the count keeps them visible at rest,
  // beside the chart, so moving them there never hides that they exist.
  // V2 one-line qualifier (Paul, 25 Sep): the count moves behind "Details"
  // whenever the line already says something; alone, it stays on the line so
  // the qualifier is never silenced.
  const limitations = vm.deeper.critiques.length + vm.deeper.caveats.length
  if (limitations > 0) {
    if (lineClauses.length === 0) lineClauses.push(COMMITMENT_QUALIFIER_COPY.caveats(limitations))
    else detailClauses.push(COMMITMENT_QUALIFIER_COPY.caveats(limitations))
  }

  const detail = detailClauses.length > 0 ? detailClauses.join(' · ') : null

  if (lineClauses.length === 0 && detail === null) return null

  return {
    text: [COMMITMENT_QUALIFIER_COPY.lead, ...lineClauses].join(' · '),
    detail,
  }
}
