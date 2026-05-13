/**
 * AnalysisHeroV17 view-model builder — orchestrator.
 *
 * Source of truth: docs/investigations/analysis-hero-v17.md §9–§11.
 *
 * This function is pure and deterministic. The component must consume the
 * VM and render — no further computation in JSX. State selection lives in
 * `stateSelection.ts`; row ranking + category lives in `rowRanking.ts`;
 * this module wires them together and resolves the key question, dimensions,
 * meta pills, footer checks, and CTA.
 *
 * v1 fallbacks (per Paul's approved direction):
 *   - The fourth strip segment is labelled "Verified" (not "User input")
 *     and sourced from confirmedFactorCount / totalFactorCount.
 *   - The verified count surfaces ONCE — via `checkedCount` rendered to the
 *     right of the dimension strip ("No inputs verified" / "1 input verified"
 *     / "N inputs verified"). The earlier separate `contribution` line below
 *     the strip was removed in Fix 1 of the Round-4 polish pass because it
 *     duplicated the strip's count. `contribution.text` is always `null` and
 *     the field is retained only for backward compatibility (deprecated;
 *     scheduled for removal in the next major VM bump).
 *   - Per-factor provenance ("You checked X · Olumi inferred Y") remains
 *     unimplemented because the data is not available upstream.
 *   - `decision_quality_prompts` is consumed when present; otherwise a
 *     category-driven template is used; if no safe grounded question can
 *     be produced, the Key-question card is hidden.
 */

import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { ResultsVM } from '../types'
import { selectHeroState } from './stateSelection'
import { rankHeroRows } from './rowRanking'
// Single canonical glossary matcher — shared across the production hero
// AND the test scanner so what production guards against == what tests
// catch. (Per P1.1 review feedback.)
import { containsBannedTerm, safeInterpolatedLabel as safeLabel } from './glossaryCheck'
// Genuine Structure + Coverage signal derivation (P1.1 round-3 review).
import {
  deriveStructureScore,
  deriveCoverageScore,
  type StructureSignals,
  type CoverageSignals,
} from './canvasSignals'
import type {
  AnalysisHeroVM,
  DimensionSegment,
  HeroRow,
  HeroState,
  KeyQuestion,
  MetaPill,
  FooterCheck,
  FooterCta,
  AlsoLink,
} from './analysisHeroVM.types'

// ── Dimensions ──────────────────────────────────────────────────────────────
//
// v17 prescribes a 4-segment strip: Structure / Evidence / Coverage / Verified.
// Each segment is grounded in real signals (P1.1 round-3 review):
//
//   - "Structure"  ← canvasSignals.deriveStructureScore(
//                       { hasGoal, hasMultipleOptions, hasFactors, hasConnections })
//                    Equal-weight composite over four model-completeness
//                    checks. Matches v17 prototype's "structural completeness"
//                    intent — distinct from robustness, which measures result
//                    stability, not model completeness.
//
//   - "Evidence"   ← data.recommendation.coachingReadinessDimensions.evidence
//                    Verbatim — this dimension's semantic already matches
//                    v17's "evidence/calibration quality" intent.
//
//   - "Coverage"   ← canvasSignals.deriveCoverageScore(
//                       { hasMultipleOptions, hasRisks, hasBaseline, hasGoalThreshold })
//                    Equal-weight composite over four coverage checks. Matches
//                    v17 prototype's "option/risk/goal coverage" intent —
//                    distinct from clarity, which measures framing quality.
//
//   - "Verified"   ← confirmedFactorCount / totalFactorCount
//                    Counts of factor nodes the user has explicitly confirmed.
//                    Stands in for "User input" until per-factor provenance is
//                    plumbed; relabelled to be honest about what it measures.
function buildDimensions(
  data: ResultsSectionDataReturn,
  confirmedFactorCount: number,
  totalFactorCount: number,
  structureSignals: StructureSignals,
  coverageSignals: CoverageSignals,
): DimensionSegment[] {
  const dims = data?.recommendation?.coachingReadinessDimensions
  const verified = totalFactorCount > 0
    ? Math.min(1, confirmedFactorCount / totalFactorCount)
    : 0
  return [
    {
      label: 'Structure',
      value: deriveStructureScore(structureSignals),
      token: 'success',
      tooltip: 'Model completeness: goal, options, factors, and connections.',
    },
    {
      label: 'Evidence',
      value: clamp01(dims?.evidence),
      token: 'warning',
      tooltip: 'How well-supported your factor estimates are.',
    },
    {
      label: 'Coverage',
      value: deriveCoverageScore(coverageSignals),
      token: 'info',
      tooltip: 'Coverage of options, risks, baseline, and goal target.',
    },
    {
      label: 'Verified',
      value: verified,
      token: 'option',
      tooltip: 'Share of factors you have explicitly confirmed.',
    },
  ]
}

function clamp01(v: number | undefined | null): number {
  if (v == null || !Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

// ── Result context ──────────────────────────────────────────────────────────

function buildResultLine(data: ResultsSectionDataReturn): string {
  const winner = data?.recommendation?.recommendedOption
  if (!winner) return 'No option currently leads clearly.'
  const label = safeLabel(winner.label, 'The leading option')
  return `${label} currently leads.`
}

function buildReasonLine(data: ResultsSectionDataReturn): string | null {
  const fragile = data?.confidence?.topFragileEdge ?? data?.confidence?.m1CoachingTopFragileEdge
  if (fragile) {
    const from = safeLabel(fragile.fromLabel, 'a key factor')
    const alt = safeLabel(fragile.alternativeWinnerLabel ?? null, 'the next option')
    return `If ${from} shifts, ${alt} could come out ahead.`
  }
  // No fragile signal — leave the reason line absent rather than fabricate one.
  return null
}

function buildMetaPills(
  data: ResultsSectionDataReturn,
  vm: ResultsVM,
  state: HeroState,
): MetaPill[] {
  const pills: MetaPill[] = []
  const stability = data?.recommendation?.recommendationStability
  // Result-state pill bound to stability bands (glossary §3). Copy
  // normalised so all four bands have the same shape (Fix 2): noun-led
  // or noun-trailing was inconsistent across "Result fragile" vs
  // "Stable result" vs "Highly stable". The new shape keeps the glossary
  // band label (Fragile / Moderate / Stable / Highly stable) front and
  // centre with consistent context.
  if (typeof stability === 'number' && Number.isFinite(stability)) {
    if (stability < 0.5) {
      pills.push({ label: 'Fragile result', tone: 'danger' })
    } else if (stability < 0.7) {
      pills.push({ label: 'Moderate stability', tone: 'warn' })
    } else if (stability < 0.85) {
      pills.push({ label: 'Stable result', tone: 'neutral' })
    } else {
      pills.push({ label: 'Highly stable', tone: 'neutral' })
    }
  }
  // Evidence pill driven by evidenceLevel from the VM. Defensive `?.`
  // because `vm` may be missing in a degraded bundle. Labels reflowed
  // (Fix 2): "Evidence thin" → "Evidence limited" (the awkward word goes);
  // "Evidence limited" (fair) → "Evidence moderate" (mid-tier rename so
  // there's no collision); good stays "Evidence adequate".
  if (vm?.evidenceLevel === 'needs_work') {
    pills.push({ label: 'Evidence limited', tone: 'danger' })
  } else if (vm?.evidenceLevel === 'fair') {
    pills.push({ label: 'Evidence moderate', tone: 'warn' })
  } else {
    pills.push({ label: 'Evidence adequate', tone: 'neutral' })
  }
  // Reflective pill — only when state === 'reflect'.
  if (state === 'reflect') {
    pills.push({ label: 'Reflective check', tone: 'reflect' })
  }
  return pills
}

// ── Key question ────────────────────────────────────────────────────────────

function selectKeyQuestion(
  data: ResultsSectionDataReturn,
  topRow: HeroRow | undefined,
  state: HeroState,
): KeyQuestion | null {
  // Strong-state CTA already invites the brief — no key question needed.
  if (state === 'strong') return null

  // 1. Decision-review prompt verbatim (if clean).
  const dqps = data?.confidence?.m2DecisionQualityPrompts ?? []
  const dqp = dqps[0]?.question
  if (dqp && !containsBannedTerm(dqp)) {
    return {
      text: dqp,
      extras: dqps.slice(1, 4).map(p => p.question).filter(q => q && !containsBannedTerm(q)),
      chips: ['High', 'Some', 'Not sure', 'Add note'],
    }
  }

  // 2. Template from the top row's category + label.
  if (topRow && topRow.title) {
    const label = safeLabel(topRow.title, 'this factor')
    let candidate: string | null = null
    switch (topRow.category) {
      case 'evidence':
      case 'causal':
        candidate = `How confident are you in the ${label} estimate?`
        break
      case 'risk':
        candidate = `What would make ${label} underperform?`
        break
      case 'coverage':
        candidate = 'Are the alternatives genuinely different?'
        break
      case 'reflect':
        candidate = 'Could early preference for one route be influencing the framing?'
        break
      case 'ready':
        candidate = null
        break
    }
    if (candidate && !containsBannedTerm(candidate)) {
      return {
        text: candidate,
        extras: [],
        chips: ['High', 'Some', 'Not sure', 'Add note'],
      }
    }
  }

  // 3. No safe grounded question — hide the card.
  return null
}

// ── Also-line + footer + CTA ───────────────────────────────────────────────

function buildAlsoLinks(state: HeroState): AlsoLink[] {
  // Strong state: 3 guided-chat items about the brief content. All
  // contract-safe (no run_* exercise handlers implied).
  if (state === 'strong') {
    return [
      { label: 'Caveats', chatPrompt: 'Help me list the main caveats that should appear in the decision brief.' },
      { label: 'Next closest option', chatPrompt: 'Explain why the next closest option performs lower under current assumptions.' },
      { label: 'Revisit trigger', chatPrompt: 'What would trigger me to revisit this decision later?' },
    ]
  }
  // Non-strong: previously included "Outside view" and "Pre-mortem", both
  // of which map to needs-handler intents in V5 contract v1.3 §3 and
  // were removed. Only "Main connection" survived the contract filter —
  // a single item triggers the minimum-items rule (Fix 7) at the
  // HeroFooter level, which hides the line entirely. Returning the
  // single item keeps the data structure honest; the renderer handles
  // the visual hide.
  return [
    { label: 'Main connection', chatPrompt: 'Review the main connection driving the result with me.' },
  ]
}

function buildFooterChecks(
  data: ResultsSectionDataReturn,
  vm: ResultsVM,
  state: HeroState,
): FooterCheck[] {
  const hasWinner = !!data?.recommendation?.recommendedOption
  const stability = data?.recommendation?.recommendationStability
  const stable = typeof stability === 'number' && Number.isFinite(stability) && stability >= 0.85
  const evidenceOk = vm?.evidenceLevel === 'good'

  return [
    { label: hasWinner ? 'Result clear' : 'No clear result', tone: hasWinner ? 'ok' : 'warn' },
    { label: stable ? 'Stable' : 'Sensitive', tone: stable ? 'ok' : 'warn' },
    { label: evidenceOk ? 'Evidence covered' : 'Evidence gaps', tone: evidenceOk ? 'ok' : 'warn' },
    { label: state === 'reflect' ? 'Reflective check' : 'Framing OK', tone: state === 'reflect' ? 'reflect' : 'ok' },
  ]
}

function buildFooterCta(state: HeroState, topRow: HeroRow | undefined): FooterCta {
  // Source of truth: investigation §11.4 + brief §3 step 6. Sequencing is
  // enforced at the call site (component dispatches via prop handlers).
  switch (state) {
    case 'weak':
      return {
        label: 'Review weak inputs',
        kind: 'review-weak-inputs',
        chatPrompt: 'Walk me through the highest-priority inputs one at a time. Ask what I know before suggesting changes.',
        focusTargetId: undefined,
      }
    case 'moderate':
      return {
        label: 'Check key estimate',
        kind: 'check-key-estimate',
        chatPrompt: topRow?.title
          ? `Check whether the estimate for ${safeLabel(topRow.title, 'this factor')} matches my experience.`
          : 'Check whether the highest-priority estimate matches my experience.',
        focusTargetId: topRow?.targetNodeId,
      }
    case 'reflect':
      return {
        // Internal kind retained for compatibility; user-facing copy is
        // "Test the result" to avoid implying a formal devil's advocacy
        // handler (which is `Needs handler` per V5 contract v1.3 §3).
        // The dispatcher in AnalysisHeroV17.handleCtaClick uses
        // prefillChat for this kind — no auto-send anywhere in the hero.
        label: 'Test the result',
        kind: 'challenge-result',
        chatPrompt: 'Challenge the current leading option. Make the strongest case for the next closest option.',
        focusTargetId: undefined,
      }
    case 'strong':
      return {
        label: 'Create decision brief',
        kind: 'create-decision-brief',
        chatPrompt: 'Help me capture the result, rationale, key assumptions and caveats as a decision brief.',
        focusTargetId: undefined,
      }
  }
}

function buildFooterHint(state: HeroState): string {
  switch (state) {
    case 'weak': return 'Improve inputs first'
    case 'moderate': return 'Check the highest-priority input'
    case 'reflect': return 'Challenge before deciding'
    case 'strong': return 'Ready to brief'
  }
}

// ── Public builder ──────────────────────────────────────────────────────────

export interface AnalysisHeroBuilderArgs {
  data: ResultsSectionDataReturn
  vm: ResultsVM
  /** Number of factor nodes the user has explicitly confirmed. */
  confirmedFactorCount: number
  /** Total factor-node count in the model. */
  totalFactorCount: number
  /** Fragile-edge count from `meta.fragileEdgeCount` (for state selection). */
  fragileEdgeCount: number
  /** Canvas-derived signals for the Structure strip segment. */
  structureSignals: StructureSignals
  /** Canvas + recommendation-derived signals for the Coverage strip segment. */
  coverageSignals: CoverageSignals
}

export function buildAnalysisHeroViewModel(args: AnalysisHeroBuilderArgs): AnalysisHeroVM {
  const {
    data, vm, confirmedFactorCount, totalFactorCount, fragileEdgeCount,
    structureSignals, coverageSignals,
  } = args

  // Defensive accessors. Bundles in flight or in error states may omit
  // slices the hero reads. The SectionErrorBoundary catches crashes, but
  // a graceful empty-state render is preferable to a fallback panel.
  const recommendation = data?.recommendation
  const confidence = data?.confidence
  const allOptions = recommendation?.allOptions ?? []
  const evidenceGaps = confidence?.topEvidenceGaps ?? confidence?.evidenceGaps ?? []
  const biasFindings = confidence?.m2BiasFindings ?? []

  const state = selectHeroState({
    hasWinner: !!recommendation?.recommendedOption,
    decisionState: vm?.decisionState ?? 'indeterminate',
    stability: recommendation?.recommendationStability ?? null,
    evidenceGapCount: evidenceGaps.length,
    fragileEdgeCount,
    optionCount: allOptions.length,
    biasFindings: biasFindings.length,
    framingFlag: false, // Not plumbed in v1.
  })

  const allRows = rankHeroRows(data, state)
  const inputRows = allRows.slice(0, 3)
  const hiddenRows = allRows.slice(3, 6)
  const topRow = inputRows[0]

  const dimensions = buildDimensions(data, confirmedFactorCount, totalFactorCount, structureSignals, coverageSignals)
  const resultLine = buildResultLine(data)
  const reasonLine = buildReasonLine(data)
  const metaPills = buildMetaPills(data, vm, state)
  const keyQuestion = selectKeyQuestion(data, topRow, state)
  const footerChecks = buildFooterChecks(data, vm, state)
  const footerCta = buildFooterCta(state, topRow)
  const footerHint = buildFooterHint(state)
  const alsoLinks = buildAlsoLinks(state)

  // checkedCount: count-only phrasing (Fix 1). The old "0 of 4 verified"
  // form read against the four-segment strip — a coincidence in some
  // models, but visually misleading. New form drops the total entirely
  // and uses singular/plural "input(s)" so it's unambiguously about
  // inputs, not dimensions.
  //
  // Hidden when there are no factors in the model.
  let checkedCount: string | null
  if (totalFactorCount === 0) {
    checkedCount = null
  } else if (confirmedFactorCount === 0) {
    checkedCount = 'No inputs verified'
  } else if (confirmedFactorCount === 1) {
    checkedCount = '1 input verified'
  } else {
    checkedCount = `${confirmedFactorCount} inputs verified`
  }

  // `contribution` was a second redundant line below the strip showing
  // the same count. Removed (Fix 1): `checkedCount` is the single source
  // of truth. Field retained on the VM for backward compatibility but
  // always returns `{ text: null }` so the renderer (which already
  // hides null text) renders nothing.
  const contribution = { text: null as string | null }

  return {
    state,
    checkedCount,
    contribution,
    dimensions,
    resultLine,
    reasonLine,
    metaPills,
    keyQuestion,
    inputRows,
    hiddenRows,
    alsoLinks,
    footerChecks,
    footerHint,
    footerCta,
  }
}
