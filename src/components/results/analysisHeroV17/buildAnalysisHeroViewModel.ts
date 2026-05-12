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
 *   - The contribution line shows "{n} inputs verified" or is hidden — no
 *     "You checked X · Olumi inferred Y" because per-factor provenance is
 *     not available.
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
// The data layer supplies three readiness dimensions:
//   - `coachingReadinessDimensions.evidence`   → "Evidence"
//   - `coachingReadinessDimensions.robustness` → "Structure"   (mapped — model robustness IS the available structural signal)
//   - `coachingReadinessDimensions.clarity`    → "Coverage"    (mapped — framing clarity IS the available coverage signal)
// The fourth segment ("Verified") uses the canvas store's
// confirmedFactorCount / totalFactorCount ratio. Documented in the
// implementation close-out report.
function buildDimensions(
  data: ResultsSectionDataReturn,
  confirmedFactorCount: number,
  totalFactorCount: number,
): DimensionSegment[] {
  const dims = data.recommendation.coachingReadinessDimensions
  const verified = totalFactorCount > 0
    ? Math.min(1, confirmedFactorCount / totalFactorCount)
    : 0
  return [
    {
      label: 'Structure',
      value: clamp01(dims?.robustness),
      token: 'success',
      tooltip: 'How dependable the model structure is — based on robustness signals.',
    },
    {
      label: 'Evidence',
      value: clamp01(dims?.evidence),
      token: 'warning',
      tooltip: 'How well-supported your factor estimates are.',
    },
    {
      label: 'Coverage',
      value: clamp01(dims?.clarity),
      token: 'info',
      tooltip: 'How clearly the decision and options are framed.',
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
  const winner = data.recommendation.recommendedOption
  if (!winner) return 'No option currently leads clearly.'
  const label = safeLabel(winner.label, 'The leading option')
  return `${label} currently leads.`
}

function buildReasonLine(data: ResultsSectionDataReturn): string | null {
  const fragile = data.confidence.topFragileEdge ?? data.confidence.m1CoachingTopFragileEdge
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
  const stability = data.recommendation.recommendationStability
  // Result-state pill bound to stability bands (glossary §3).
  if (typeof stability === 'number' && Number.isFinite(stability)) {
    if (stability < 0.5) {
      pills.push({ label: 'Result fragile', tone: 'danger' })
    } else if (stability < 0.7) {
      pills.push({ label: 'Result moderate', tone: 'warn' })
    } else if (stability < 0.85) {
      pills.push({ label: 'Stable result', tone: 'neutral' })
    } else {
      pills.push({ label: 'Highly stable', tone: 'neutral' })
    }
  }
  // Evidence pill driven by evidenceLevel from the VM.
  if (vm.evidenceLevel === 'needs_work') {
    pills.push({ label: 'Evidence thin', tone: 'danger' })
  } else if (vm.evidenceLevel === 'fair') {
    pills.push({ label: 'Evidence limited', tone: 'warn' })
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
  const dqp = data.confidence.m2DecisionQualityPrompts?.[0]?.question
  if (dqp && !containsBannedTerm(dqp)) {
    return {
      text: dqp,
      extras: (data.confidence.m2DecisionQualityPrompts ?? []).slice(1, 4).map(p => p.question).filter(q => q && !containsBannedTerm(q)),
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
  // Static, glossary-aligned set. Same trio across most states; strong state
  // surfaces a brief-oriented set instead.
  if (state === 'strong') {
    return [
      { label: 'Caveats', chatPrompt: 'Help me list the main caveats that should appear in the decision brief.' },
      { label: 'Next closest option', chatPrompt: 'Explain why the next closest option performs lower under current assumptions.' },
      { label: 'Revisit trigger', chatPrompt: 'What would trigger me to revisit this decision later?' },
    ]
  }
  return [
    { label: 'Outside view', chatPrompt: 'Help me reason from base rates of similar decisions. Ask what comparable decisions I know.' },
    { label: 'Main connection', chatPrompt: 'Review the main connection driving the result with me.' },
    { label: 'Pre-mortem', chatPrompt: 'If the leading option underperformed, what most likely went wrong?' },
  ]
}

function buildFooterChecks(
  data: ResultsSectionDataReturn,
  vm: ResultsVM,
  state: HeroState,
): FooterCheck[] {
  const hasWinner = !!data.recommendation.recommendedOption
  const stability = data.recommendation.recommendationStability
  const stable = typeof stability === 'number' && Number.isFinite(stability) && stability >= 0.85
  const evidenceOk = vm.evidenceLevel === 'good'

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
        label: 'Challenge result',
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
}

export function buildAnalysisHeroViewModel(args: AnalysisHeroBuilderArgs): AnalysisHeroVM {
  const { data, vm, confirmedFactorCount, totalFactorCount, fragileEdgeCount } = args

  const state = selectHeroState({
    hasWinner: !!data.recommendation.recommendedOption,
    decisionState: vm.decisionState,
    stability: data.recommendation.recommendationStability ?? null,
    evidenceGapCount: (data.confidence.topEvidenceGaps ?? data.confidence.evidenceGaps ?? []).length,
    fragileEdgeCount,
    optionCount: data.recommendation.allOptions.length,
    biasFindings: (data.confidence.m2BiasFindings ?? []).length,
    framingFlag: false, // Not plumbed in v1.
  })

  const allRows = rankHeroRows(data, state)
  const inputRows = allRows.slice(0, 3)
  const hiddenRows = allRows.slice(3, 6)
  const topRow = inputRows[0]

  const dimensions = buildDimensions(data, confirmedFactorCount, totalFactorCount)
  const resultLine = buildResultLine(data)
  const reasonLine = buildReasonLine(data)
  const metaPills = buildMetaPills(data, vm, state)
  const keyQuestion = selectKeyQuestion(data, topRow, state)
  const footerChecks = buildFooterChecks(data, vm, state)
  const footerCta = buildFooterCta(state, topRow)
  const footerHint = buildFooterHint(state)
  const alsoLinks = buildAlsoLinks(state)

  // Contribution line: only show grounded verified count.
  const contribution = confirmedFactorCount > 0
    ? { text: `${confirmedFactorCount} input${confirmedFactorCount === 1 ? '' : 's'} verified` }
    : { text: null }

  // checkedCount mirrors v17's "3 of 7 checked" pattern. Hidden when no
  // total is known.
  const checkedCount = totalFactorCount > 0
    ? `${confirmedFactorCount} of ${totalFactorCount} verified`
    : null

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
