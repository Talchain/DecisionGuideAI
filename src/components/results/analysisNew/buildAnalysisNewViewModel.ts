/**
 * Analysis (New) — THE adapter. One mapping site, so the IA can be re-tuned in
 * one file and so no component ever reinterprets a raw analysis field.
 *
 * ⭐ IT SELECTS, RANKS, GROUPS AND FORMATS. IT DOES NOT COMPUTE.
 * Every value it emits is either (a) a producer field carried verbatim,
 * (b) a producer field formatted for display, or (c) a selection among producer
 * fields. There is no arithmetic here that constitutes a finding, and no
 * sentence about the user's situation that the producer did not supply.
 *
 * ── THE SEMANTIC RULES THIS FILE IS ANSWERABLE FOR ──────────────────────────
 *  1. LEADER ENTITLEMENT. Nothing may name or presuppose a leading option
 *     unless `recommendation.verdict.hasLeadingOption === true`. A completed
 *     analysis is not an entitlement. Comparative copy is "currently scores
 *     higher", never "wins".
 *  2. INFLUENCE IS NOT A CAUSAL SHARE. `displayProvenance` decides: only
 *     `'influence_score'` is an absolute producer scale; `'normalised_elasticity'`
 *     means "largest in this set" and must carry the caveat.
 *  3. ROBUSTNESS. The display-safe verdict is `robustnessVerdict` (+ its
 *     producer-authored reason, rendered VERBATIM). `robustnessLevel` is
 *     structured data and never drives the headline.
 *  4. ABSENCE IS NOT ZERO. A null confidence suppresses the sentence; it never
 *     prints 0. `evidenceGapsAssessed` separates "assessed, none found" from
 *     "never assessed".
 *  5. COVERAGE IS NOT READINESS. Nothing here reads or speaks for
 *     `RunAdmission`. Incomplete coverage is disclosed as provenance.
 *  6. NO EVPI IN PERCENTAGE POINTS, EVER. `evpi_percentage_points` is refuted
 *     upstream (tests/contracts/no-evpi-display.contract.test.ts). Whole-
 *     decision VOI crosses this boundary as a VERDICT only, never a number.
 *  7. NO WITHHELD-FIELD READS. `recommendation_stability` and
 *     `ranking_stability` are never read here. PLoT withholds the first (ISL
 *     derives it as the leader's win probability RELABELLED — "zero independent
 *     information") and never emitted the second. Rendering either produces a
 *     fabricated SECOND statistic beside the honest one.
 *     `__tests__/withheldFieldReadBan.spec.ts` enforces this estate-wide and
 *     caught exactly that here before it shipped.
 */

import type { Recommendation } from '../strengthen/strengthenTypes'
import type {
  ConditionalWinner,
  DriverItem,
  EvidenceGapItem,
  UncertaintyItem,
} from '../types'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import type {
  AnalysisNewFinding,
  AnalysisNewStatus,
  AnalysisNewViewModel,
  ContextualIntervention,
  InspectRow,
  ScienceGrounding,
} from './analysisNewTypes'

/** §2 of the brief: "a very small number of high-value insights". */
const KEY_INSIGHT_CAP = 4
/** §2: "1–3 prioritised reasoning interventions". */
const STRENGTHEN_CAP = 3
/** Level-1 rows before "Show more". */
const DRIVER_PREVIEW = 3
const UNCERTAINTY_PREVIEW = 3

export interface AnalysisNewViewModelInputs {
  data: ResultsSectionDataReturn
  /** Engine output, already lifecycle-filtered by the hook. */
  recommendations: Recommendation[]
  /** Total active engine output BEFORE the cap, for honest disclosure. */
  recommendationCandidateCount: number
  isPreRun: boolean
  isRunning: boolean
  /** The displayed report predates the current model (freshness only). */
  isStale: boolean
  /** Monte Carlo sample count, when the producer disclosed one. */
  nSamples?: number
  /** Deterministic seed, when disclosed. */
  seedUsed?: number | string
  /** Response hash — the run identity both tabs share. */
  responseHash?: string
  /**
   * Producer DSK attestation keyed by recommendation id, joined by the hook.
   * Sparse: an absent key means the producer attested nothing. Never defaulted.
   */
  scienceGrounding?: Record<string, ScienceGrounding>
}

// ── formatting helpers (display only — none of these decide anything) ────────

const pct = (v: number): string => `${Math.round(v * 100)}%`

/** Absence-safe percentage. `null`/`undefined` yields null, NEVER "0%". */
const pctOrNull = (v: number | null | undefined): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? pct(v) : null

/** A 0-100 confidence, absence-safe. Rule 4: absence suppresses, never zeroes. */
const conf100OrNull = (v: number | null | undefined): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}%` : null

const rows = (...maybe: Array<InspectRow | null>): InspectRow[] =>
  maybe.filter((r): r is InspectRow => r !== null)

const row = (label: string, value: string | null | undefined): InspectRow | null =>
  value == null || value === '' ? null : { label, value }

/**
 * Prefer the producer's humanised text over its raw one.
 *
 * ⚠ ORDER MATTERS AND IS NOT ARBITRARY: `displayText` is the data layer's
 * pre-sanitised render-safe string (it has already passed the internal-token
 * guard), `userMessage` is PLoT's humanised copy, `message` is the raw code-ish
 * fallback. Reaching past a sanitised string to a raw one is how internal
 * tokens reach a user.
 */
const humanised = (u: UncertaintyItem): string => u.displayText || u.userMessage || u.message

/**
 * Join an engine recommendation to a finding, by TARGET IDENTITY.
 *
 * ⚠ BINDS BY ID, NEVER BY A VALUE PREDICATE (CLAUDE.md trap 19). An earlier
 * shape matched on label text, and two factors sharing a label would each have
 * claimed the other's intervention. `targetId` is the join or there is none.
 */
function interventionFor(
  recommendations: Recommendation[],
  targetId: string | undefined,
): ContextualIntervention | undefined {
  if (!targetId) return undefined
  const rec = recommendations.find((r) => r.targetId === targetId)
  if (!rec) return undefined
  return { recommendationId: rec.id, label: rec.action.label, targetId: rec.targetId }
}

// ── KEY INSIGHTS ────────────────────────────────────────────────────────────

/**
 * Candidate insights, most-consequential first.
 *
 * ⚠ THE ORDER OF THE PUSHES IS THE PRIORITY LADDER, and it is deliberately NOT
 * decision-first. A robustness verdict, a strategic tension and a concentration
 * risk all outrank "which option scores higher", because a decision may not
 * exist in the scenario at all — and when it does not, a decision-first ladder
 * produces an empty section for a perfectly well-analysed problem.
 */
function buildKeyInsights(
  data: ResultsSectionDataReturn,
  recommendations: Recommendation[],
  isStale: boolean,
): { insights: AnalysisNewFinding[]; candidateCount: number } {
  const rec = data.recommendation
  const conf = data.confidence
  const out: AnalysisNewFinding[] = []
  const staleMarker = isStale ? ('stale' as const) : undefined

  // 1. The producer's own executive statement, when it sent one. Verbatim.
  //    This is M1 coaching — deterministic, not LLM-generated.
  if (rec.coachingDecisionStatement || rec.coachingHeadline) {
    out.push({
      id: 'insight:executive-summary',
      headline: rec.coachingHeadline || 'What this run found',
      implication: rec.coachingDecisionStatement || rec.coachingParagraph || '',
      detail: rec.coachingKeyQualifier || undefined,
      groundedIn: 'the analysis executive summary',
      marker: staleMarker,
      inspect: rows(
        row('Action implication', rec.coachingActionImplication),
        row('Readiness', rec.coachingReadiness),
      ),
    })
  }

  // 2. Robustness — the display-safe verdict only, with the producer's own
  //    reason rendered verbatim. Rule 3.
  //
  // ⚠⚠ THE VOCABULARY HAS FOUR MEMBERS AND A BINARY SPLIT OVER IT IS A
  // FABRICATION. An earlier draft here read `=== 'robust' ? "holds up" :
  // "is sensitive"`, which is correct for exactly one of the four:
  //   · 'moderate'     → rendered as "sensitive", overstating fragility;
  //   · 'not_assessed' → the producer's own STATED ABSENCE ("robustness not
  //     computed"), rendered as a claim that the result IS sensitive.
  // The last one is the worst thing this surface could do: turn "we did not
  // measure this" into a measurement. `not_assessed` therefore produces NO
  // insight at all — absence is not a verdict (CLAUDE.md trap 22: the defect
  // lives in the BREADTH of a predicate, not in the case you had in mind).
  const ROBUSTNESS_HEADLINE: Record<string, string> = {
    robust: 'This result holds up under uncertainty',
    moderate: 'This result holds up, but not strongly',
    fragile: 'This result is sensitive to uncertainty',
  }
  if (rec.robustnessVerdict && ROBUSTNESS_HEADLINE[rec.robustnessVerdict]) {
    out.push({
      id: 'insight:robustness',
      headline: ROBUSTNESS_HEADLINE[rec.robustnessVerdict],
      // The producer authors this sentence. The UI never authors robustness prose.
      implication: rec.robustnessVerdictReason ?? '',
      groundedIn: 'the robustness verdict from the simulation',
      marker: staleMarker,
      // ⛔ `ranking_stability` IS NOT RENDERED — see the withheld-field note on
      // the comparative insight below. PLoT never emitted it at all.
      inspect: rows(row('Structured level', rec.robustnessLevel)),
    })
  }

  // 3. Strategic tension: the leading option DEPENDS on a factor's value.
  //    A genuine "it depends" finding, and the most reasoning-shaped thing the
  //    producer emits. Neutral arm when the winner identity was withheld.
  const cw: ConditionalWinner | undefined = conf.conditionalWinners?.[0]
  if (cw) {
    const high = cw.high_bucket?.winner_label
    const low = cw.low_bucket?.winner_label
    const namesBoth = Boolean(high && low && high !== low)
    out.push({
      id: `insight:conditional-winner:${cw.factor_id}`,
      headline: `The answer turns on ${cw.factor_label}`,
      implication: namesBoth
        ? `Above ${cw.split_value}${cw.split_unit ? ` ${cw.split_unit}` : ''}, ${high} scores higher; below it, ${low} does.`
        : `The preferred direction changes around ${cw.split_value}${cw.split_unit ? ` ${cw.split_unit}` : ''}.`,
      groundedIn: 'the conditional-winner split from the simulation',
      marker: staleMarker,
      targetId: cw.factor_id,
      inspect: rows(row('Split value', String(cw.split_value)), row('Factor', cw.factor_label)),
      intervention: interventionFor(recommendations, cw.factor_id),
    })
  }

  // 4. Concentration: one factor carries most of the influence. A structural
  //    finding about the MODEL, not about a decision.
  if (rec.dominantFactorLabel) {
    out.push({
      id: 'insight:dominant-factor',
      headline: `${rec.dominantFactorLabel} dominates the model`,
      implication:
        'One factor carries most of the influence here, so the conclusion largely rests on it being right.',
      groundedIn: 'the influence concentration check',
      marker: staleMarker,
      targetId: rec.dominantFactorId,
      inspect: [],
      intervention: interventionFor(recommendations, rec.dominantFactorId),
    })
  }

  // 5. The relationship most able to change the answer.
  const hinge = conf.m1CoachingTopFragileEdge ?? conf.topFragileEdge
  if (hinge && typeof hinge.switchProbability === 'number') {
    out.push({
      id: 'insight:hinge',
      headline: `${hinge.fromLabel} is the hinge`,
      implication: `Its effect on ${hinge.toLabel} is the relationship most able to change the outcome.`,
      groundedIn: 'the fragile-relationship analysis',
      marker: staleMarker,
      targetId: hinge.fromId,
      inspect: rows(row('Chance the result flips', pctOrNull(hinge.switchProbability))),
      intervention: interventionFor(recommendations, hinge.fromId),
    })
  }

  // 6. COMPARATIVE — LAST, and only when the single verdict entitles it.
  //    Rule 1. "Currently scores higher", never "wins".
  const leader = rec.recommendedOption
  if (rec.verdict?.hasLeadingOption === true && leader && !rec.isSingleOption) {
    const winPct = pctOrNull(leader.winProbability ?? rec.winProbability)
    out.push({
      id: 'insight:comparative',
      headline: `${leader.label} currently scores higher`,
      implication: winPct
        ? `It comes out ahead in ${winPct} of simulated futures.`
        : 'It comes out ahead across the simulated futures.',
      detail: rec.nearTie ? 'The top options are close enough that this ordering is not settled.' : undefined,
      groundedIn: 'the option comparison',
      marker: staleMarker,
      targetId: leader.id,
      // ⛔⛔ NEITHER `recommendation_stability` NOR `ranking_stability` IS
      // RENDERED ANYWHERE ON THIS SURFACE, AND THIS IS NOT AN OVERSIGHT.
      //
      // PLoT deliberately WITHHOLDS `robustness.recommendation_stability`: ISL
      // derives it as `option_wins[winner] / n_samples` — the leader's win
      // probability RELABELLED, carrying (the producer's words) "zero
      // independent information". `ranking_stability` was never emitted at all.
      //
      // An earlier draft of this list printed BOTH `Win probability` and
      // `Recommendation stability` — the SAME quantity twice, once honestly and
      // once under a name implying an independent robustness measurement. That
      // is a fabricated second statistic, and it is exactly what
      // `withheldFieldReadBan.spec.ts` exists to stop; it caught this before
      // the surface shipped. A hydrated pre-withdrawal payload can still carry
      // a legacy value, so reading the field at all is the hazard, not just
      // rendering a fresh one.
      inspect: rows(row('Win probability', winPct), row('Determined by', rec.determinedBy)),
      intervention: interventionFor(recommendations, leader.id),
    })
  }

  // Insights with no implication sentence say nothing — drop rather than
  // render a headline with an empty body.
  const usable = out.filter((i) => i.implication.trim().length > 0 || i.detail)
  return { insights: usable.slice(0, KEY_INSIGHT_CAP), candidateCount: usable.length }
}

// ── DRIVERS AND DYNAMICS ────────────────────────────────────────────────────

function driverFinding(
  d: DriverItem,
  setRelative: boolean,
  recommendations: Recommendation[],
): AnalysisNewFinding {
  const target = d.matchedNodeId ?? d.factorKey
  const influence = d.displayInfluence ?? d.influenceScore ?? d.normalisedInfluence
  // ⚠ THE PRODUCER'S DOMAIN IS `positive | negative | mixed | unknown`, and the
  // last two are NOT a direction. `'moves'` is the honest verb for them: a
  // factor whose direction the producer declined to resolve must not be
  // rendered as raising or lowering anything. (An earlier draft compared
  // against `'increase'`/`'decrease'` — tokens that do not exist in this union
  // — so every row silently fell through to the neutral arm and the two real
  // directions were never rendered at all. The typecheck gate caught it.)
  const directionWord =
    d.direction === 'positive' ? 'raises' : d.direction === 'negative' ? 'lowers' : 'moves'

  return {
    id: `driver:${d.factorKey}`,
    headline: d.factorLabel,
    // ⚠ Rule 2. Under a set-relative basis this says "among the strongest in
    // this run" — a RANK claim. It never says "drives N% of the outcome",
    // which would be an absolute causal share the basis does not license.
    implication: setRelative
      ? `Among the strongest influences in this run; ${directionWord} the outcome.`
      : `Structural influence ${pct(influence)}; ${directionWord} the outcome.`,
    detail:
      d.fragileEdgeInfo?.switchProbability != null
        ? `This relationship is one the result is sensitive to.`
        : undefined,
    groundedIn: setRelative
      ? 'factor sensitivity, ranked within this run'
      : 'the producer influence score',
    // A defaulted confidence is a placeholder, not a measurement — say so
    // rather than rendering it as evidence.
    marker: d.isDefaultedConfidence ? 'not_assessed' : undefined,
    targetId: d.canFocus ? target : undefined,
    inspect: rows(
      row('Influence', pctOrNull(influence)),
      row('Rank', d.influenceRank != null ? String(d.influenceRank) : String(d.rank)),
      row('Basis', d.displayProvenance === 'influence_score' ? 'producer influence score' : 'ranked within this run'),
      // Absence-safe: a defaulted or absent confidence prints nothing.
      row('Confidence', d.isDefaultedConfidence ? null : pctOrNull(d.confidence)),
      row('Attribution stability', d.attributionStability),
      row('Chance the result flips', pctOrNull(d.fragileEdgeInfo?.switchProbability)),
    ),
    intervention: interventionFor(recommendations, target),
  }
}

function buildDrivers(
  data: ResultsSectionDataReturn,
  recommendations: Recommendation[],
): AnalysisNewViewModel['drivers'] {
  const drivers = data.drivers.drivers ?? []
  // Rule 2: the basis is the PRODUCER's token, not the adapter's taste. Any
  // row on a set-relative basis makes the whole list set-relative — mixing
  // bases in one list is the defect the token exists to prevent.
  const influenceIsSetRelative =
    drivers.length > 0 && drivers.some((d) => d.displayProvenance !== 'influence_score')

  const findings = drivers
    .filter((d) => d.zeroReason == null)
    .map((d) => driverFinding(d, influenceIsSetRelative, recommendations))

  return {
    findings,
    influenceIsSetRelative,
    referenceOptionLabel: data.sensitivityReference?.optionLabel ?? null,
    totalCount: findings.length,
  }
}

// ── UNCERTAINTY AND GAPS ────────────────────────────────────────────────────

function evidenceGapFinding(
  g: EvidenceGapItem,
  recommendations: Recommendation[],
): AnalysisNewFinding {
  const target = g.targetNodeId ?? g.factorId
  return {
    id: `gap:${g.factorId}`,
    headline: `${g.factorLabel} is weakly evidenced`,
    // Producer-authored suggestion, verbatim.
    implication: g.suggestion,
    groundedIn: 'the evidence-gap assessment',
    // Rule 4: a null confidence is "we were not told", not "zero".
    marker: g.confidence == null ? 'not_assessed' : undefined,
    targetId: target,
    inspect: rows(
      row('Confidence', conf100OrNull(g.confidence)),
      // ⛔ evpi_percentage_points is never rendered — refuted upstream.
      row('Expected value of perfect information', g.evpi != null ? String(g.evpi) : null),
    ),
    intervention: interventionFor(recommendations, target),
  }
}

function buildUncertainty(
  data: ResultsSectionDataReturn,
  recommendations: Recommendation[],
): AnalysisNewViewModel['uncertainty'] {
  const conf = data.confidence
  const findings: AnalysisNewFinding[] = []

  // 1. Consequential uncertainties first — these carry a threshold or an
  //    E-value, i.e. they are quantified, not merely noted.
  for (const u of conf.uncertainties ?? []) {
    const text = humanised(u)
    if (!text) continue
    findings.push({
      id: `uncertainty:${u.code}`,
      headline: u.threshold ? `${u.threshold.variable} could tip the result` : text.slice(0, 80),
      implication: u.suggestion || text,
      // Same union as the drivers' direction. `mixed`/`unknown` get the
      // direction-free phrasing rather than a guessed one.
      detail: u.threshold
        ? `The ordering changes around ${u.threshold.value}${
            u.threshold.direction === 'positive'
              ? ' — above it, the ordering differs'
              : u.threshold.direction === 'negative'
                ? ' — below it, the ordering differs'
                : ''
          }.`
        : undefined,
      groundedIn: 'the sensitivity and critique analysis',
      marker: u.factorConfidence == null ? undefined : undefined,
      targetId: u.affectedNodes?.[0],
      inspect: rows(
        row('Severity', u.severity),
        row('E-value', u.eValue != null ? String(u.eValue) : null),
        row('Factor confidence', pctOrNull(u.factorConfidence)),
      ),
      intervention: interventionFor(recommendations, u.affectedNodes?.[0]),
    })
  }

  // 2. Evidence gaps, in the producer's own emission order (PLoT already
  //    selected and ordered these — no client-side re-rank).
  for (const g of conf.evidenceGaps ?? []) findings.push(evidenceGapFinding(g, recommendations))

  // 3. Producer-owned assumptions from the ledger.
  for (const a of conf.assumptions ?? []) {
    findings.push({
      id: `assumption:${a.target ?? a.message.slice(0, 40)}`,
      headline: a.target ? `Assumption about ${a.target}` : 'Assumption in the model',
      implication: a.message,
      groundedIn: 'the assumption ledger',
      targetId: a.target,
      inspect: rows(row('Severity', a.severity)),
      intervention: interventionFor(recommendations, a.target),
    })
  }

  // 4. Model-gap warnings the producer raised about its own inference.
  for (const w of conf.inferenceWarnings ?? []) {
    const message = (w as { message?: string; description?: string }).message
      ?? (w as { description?: string }).description
    if (!message) continue
    findings.push({
      id: `inference-warning:${(w as { code?: string }).code ?? message.slice(0, 32)}`,
      headline: 'The model has a gap the analysis had to work around',
      implication: message,
      groundedIn: 'an inference warning from the engine',
      inspect: [],
    })
  }

  return {
    findings,
    // Rule 4 — the load-bearing distinction for this section's empty state.
    evidenceAssessed: conf.evidenceGapsAssessed === true,
    decisionVoi: data.decisionVoi,
    totalCount: findings.length,
  }
}

// ── DEEPER ANALYSIS (level 3) ───────────────────────────────────────────────

function buildDeeper(inputs: AnalysisNewViewModelInputs): AnalysisNewViewModel['deeper'] {
  const { data } = inputs
  const conf = data.confidence
  const groups: AnalysisNewViewModel['deeper']['groups'] = []

  const run = rows(
    row('Run identity', inputs.responseHash),
    row('Simulations', inputs.nSamples != null ? String(inputs.nSamples) : null),
    row('Seed', inputs.seedUsed != null ? String(inputs.seedUsed) : null),
    row('Analysis status', data.recommendation.analysisStatus),
    row('Drivers status', data.drivers.driversStatus),
    row('Robustness status', conf.robustnessStatus),
  )
  if (run.length) groups.push({ title: 'This run', rows: run })

  // ⚠ COVERAGE, NOT READINESS (rule 5). These rows say what the run did and did
  // not cover. None of them is a statement about whether analysis may run.
  const coverage = rows(
    row('Result completeness', data.completeness.status),
    row(
      'Fields the producer did not supply',
      data.completeness.missing.length ? data.completeness.missing.join(', ') : null,
    ),
    row(
      'Evidence coverage',
      conf.evidenceCoverage
        ? `${conf.evidenceCoverage.backedByData} backed by data, ${conf.evidenceCoverage.needsValidation} need validation`
        : null,
    ),
    row('Factors ranked for information value', data.voiRanking ? String(data.voiRanking.resolved.length) : null),
    row(
      'Some factors unassessed',
      data.voiRanking?.someFactorsUnassessed ? 'yes' : null,
    ),
    row('Relationships hidden below the display threshold', conf.filteredFragileEdges ? String(conf.filteredFragileEdges.filteredCount) : null),
    row('Zero-impact factors hidden', data.drivers.hiddenZeroImpactCount ? String(data.drivers.hiddenZeroImpactCount) : null),
  )
  if (coverage.length) groups.push({ title: 'What this run covered', rows: coverage })

  const provenance = rows(
    row(
      'Sensitivities measured against',
      data.sensitivityReference?.optionLabel ?? null,
    ),
    // Only disclosed when the producer says it was applied AND provisional —
    // the same gate the existing surfaces use.
    row(
      'Automatic noise applied',
      data.autoNoiseProvenance?.applied && data.autoNoiseProvenance?.isProvisional ? 'yes, provisional' : null,
    ),
    row('Per-factor attribution withheld', data.attributionSuppression === 'not_attested' ? null : String(data.attributionSuppression ?? '')),
  )
  if (provenance.length) groups.push({ title: 'Provenance', rows: provenance })

  // Decision-quality prompts carry DSK grounding ONLY when the producer
  // attested a claim id. Presence IS the attestation — never defaulted.
  const dsk = (conf.m2DecisionQualityPrompts ?? [])
    .filter((p) => p.dskClaimId)
    .map((p) => ({ label: p.principle, value: `${p.question} (${p.dskClaimId})` }))
  if (dsk.length) groups.push({ title: 'Grounded decision-quality prompts', rows: dsk })

  return { groups }
}

// ── STATUS ──────────────────────────────────────────────────────────────────

function buildStatus(inputs: AnalysisNewViewModelInputs): AnalysisNewStatus {
  const { data } = inputs
  const status = data.recommendation.analysisStatus
  return {
    isPreRun: inputs.isPreRun,
    isRunning: inputs.isRunning,
    isStale: inputs.isStale,
    // 'partial' is the producer's own word for an incomplete result. The
    // completeness verdict is the second, independent source.
    isProvisional: status === 'partial' || data.completeness.status === 'partial',
    // Producer-owned, verbatim. Never authored here.
    statusNote: data.recommendation.statusReason ?? null,
  }
}

// ── THE ADAPTER ─────────────────────────────────────────────────────────────

export function buildAnalysisNewViewModel(
  inputs: AnalysisNewViewModelInputs,
): AnalysisNewViewModel {
  const { data, recommendations, recommendationCandidateCount, isStale } = inputs

  return {
    status: buildStatus(inputs),
    keyInsights: buildKeyInsights(data, recommendations, isStale),
    strengthen: {
      interventions: recommendations.slice(0, STRENGTHEN_CAP),
      candidateCount: recommendationCandidateCount,
      scienceGrounding: inputs.scienceGrounding ?? {},
    },
    drivers: buildDrivers(data, recommendations),
    uncertainty: buildUncertainty(data, recommendations),
    deeper: buildDeeper(inputs),
  }
}

export const ANALYSIS_NEW_LIMITS = {
  KEY_INSIGHT_CAP,
  STRENGTHEN_CAP,
  DRIVER_PREVIEW,
  UNCERTAINTY_PREVIEW,
} as const

export { COPY as ANALYSIS_NEW_VIEW_COPY }
