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
 */
import type { AnalysisNewViewModel } from './analysisNewTypes'

export const COMMITMENT_QUALIFIER_COPY = {
  lead: 'Provisional',
  estimated: "rests on Olumi's estimates, not yet confirmed",
  partlyEstimated: "rests partly on Olumi's estimates, not yet confirmed",
  evidenceNotAssessed: 'evidence not assessed',
  robustnessNotEstablished: 'robustness not established',
  caveats: (n: number): string => `${n} ${n === 1 ? 'caveat' : 'caveats'} in About`,
  /**
   * CEE's typed marker, `analysis_result.enrichment.run_provenance.provisional`
   * (RC 5818628860; Runtime 5818605567): the run Olumi started by itself after
   * building the model. Licensed ONLY by that marker, never inferred.
   */
  automaticFirstPass: 'automatic first pass',
} as const

/** Facts from outside the view model that license a clause. */
export interface QualifierFacts {
  /** `enrichment.run_provenance.provisional === true` on the displayed run. */
  readonly runProvisional?: boolean
}

type QualifierInput = Pick<AnalysisNewViewModel, 'status' | 'atAGlance' | 'checks' | 'deeper'>

export function buildCommitmentQualifier(vm: QualifierInput, facts: QualifierFacts = {}): string | null {
  if (vm.status.isPreRun) return null
  const clauses: string[] = []

  // ⭐ First, because it is WHY the run is provisional; the rest say how much.
  // It licenses the line on its own, so an automatic run is never unlabelled
  // even when every other clause is absent.
  if (facts.runProvisional === true) clauses.push(COMMITMENT_QUALIFIER_COPY.automaticFirstPass)

  const inputs = vm.atAGlance.inputProvenance
  if (inputs === 'estimated') clauses.push(COMMITMENT_QUALIFIER_COPY.estimated)
  else if (inputs === 'partly_estimated' || inputs === 'mixed') {
    clauses.push(COMMITMENT_QUALIFIER_COPY.partlyEstimated)
  }

  const evidence = vm.checks.items.find((i) => i.id === 'evidence')?.code ?? null
  if (evidence === 'evidence_not_assessed') clauses.push(COMMITMENT_QUALIFIER_COPY.evidenceNotAssessed)

  if (vm.atAGlance.verdict === null) clauses.push(COMMITMENT_QUALIFIER_COPY.robustnessNotEstablished)

  // The engine's own caveats (critiques + strip-eligible inference warnings)
  // are listed in About › Limitations; the count keeps them visible at rest,
  // beside the chart, so moving them there never hides that they exist.
  const limitations = vm.deeper.critiques.length + vm.deeper.caveats.length
  if (limitations > 0) clauses.push(COMMITMENT_QUALIFIER_COPY.caveats(limitations))

  if (clauses.length === 0) return null
  return [COMMITMENT_QUALIFIER_COPY.lead, ...clauses].join(' · ')
}
