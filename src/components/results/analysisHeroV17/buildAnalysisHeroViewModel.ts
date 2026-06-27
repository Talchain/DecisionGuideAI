/**
 * AnalysisHeroV17 view-model builder — orchestrator.
 *
 * Source of truth: docs/investigations/analysis-hero-v17.md §9–§11
 * (initial) + docs/investigations/analysis-hero-v17-top-section.md
 * (2026-05-21 top-section optimisation passes).
 *
 * This function is pure and deterministic. The component must consume the
 * VM and render — no further computation in JSX. State selection lives in
 * `stateSelection.ts`; row ranking + category + verb-led title composition
 * lives in `rowRanking.ts`; this module wires them together and resolves
 * the key question, dimensions, dependency line, and CTA.
 *
 * v1 fallbacks (per Paul's approved direction):
 *   - The fourth strip segment is labelled "Verified" (not "User input")
 *     and sourced from confirmedFactorCount / totalFactorCount.
 *   - The verified count surfaces ONLY via the Verified strip-segment's
 *     tooltip + aria-label — no visible header text. The VM exposes
 *     `checkedCount` ("No inputs verified" / "1 input verified" / "N inputs
 *     verified") which the renderer threads into that composite tooltip.
 *   - The `contribution` field is dead-deprecated: text is always `null`
 *     and the field is retained only for backward compatibility (scheduled
 *     for removal in the next major VM bump).
 *   - Per-factor provenance ("You checked X · Olumi inferred Y") remains
 *     unimplemented because the data is not available upstream.
 *   - Result line uses probabilistic framing: "{label} comes out ahead
 *     most often." A dependency line "The result depends most on {factor}."
 *     renders below only when `recommendation.dominantFactor*` is populated
 *     AND the named factor IS the rank-1 driver AND a dominance check
 *     passes: prefer `influenceScore >= 0.5` (absolute ISL structural
 *     causal influence) when present, else require `top1/top2
 *     normalisedInfluence ratio >= 2.0` (the same 2:1 threshold the
 *     legacy heuristic uses internally, applied here as a guard not a
 *     selector). Suppresses low-confidence M1 emissions and tie cases.
 *     See `buildDependencyLine` below for the full gate.
 *   - Stability/evidence meta pills were removed entirely. The
 *     `footerChecks` and `footerHint` VM fields are also no longer
 *     rendered by HeroFooter (corrections pass) — they remain on the VM
 *     with `@deprecated` JSDoc, scheduled for removal in the next major
 *     VM bump. Stability + evidence signals continue to surface via the
 *     readiness colour-strip at the top of the hero.
 *   - Row titles are verb-led ("Verify {factor}", "Challenge {bias type}",
 *     "Add an alternative option"); see `verbLeadTitle` in rowRanking.ts.
 *     User labels are preserved verbatim after the verb prefix.
 *   - Footer CTA (moderate state only) mirrors Row 1 via a cleaned
 *     `targetLabel` derived from Row 1's verb-led title; weak / reflect /
 *     strong keep state-specific CTAs. See `buildFooterCta` below.
 *   - Key-question card renders only when a real `m2DecisionQualityPrompts[0]`
 *     is present, `reviewStatus === 'complete'`, and the prompt passes the
 *     glossary gate. No category-driven template fallback — generic
 *     templated questions on M1 burned space without adding signal.
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
import { stripEncodingNotation } from '../utils/cleanFactorLabel'
import type {
  AnalysisHeroVM,
  DimensionSegment,
  HeroRow,
  HeroState,
  KeyQuestion,
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
  if (!winner) return 'No option currently comes out ahead clearly.'
  const label = safeLabel(winner.label, 'The leading option')
  // Sensitivity caveat is gated on the display-safe robustness verdict ONLY —
  // never raw recommendation_stability (single-source rule, see
  // ROBUSTNESS-VERDICT-CONTRACT). A known non-'high' verdict means the result
  // is sensitive; with a concrete fragile edge also present we append the
  // clarifying clause so the headline isn't read as unconditional. No
  // display-safe verdict exists in the contract today → the verdict is
  // undefined → the caveat never fires and the headline stays neutral
  // ("…comes out ahead most often."), in lock-step with the certified
  // "Robustness unknown" glyph rather than deriving a sensitivity claim from
  // an uncertified stability number.
  const verdict = data?.recommendation?.robustnessVerdict
  const verdictSensitive = verdict != null && verdict !== 'high'
  const hasFragile = !!(
    data?.confidence?.topFragileEdge ?? data?.confidence?.m1CoachingTopFragileEdge
  )
  if (verdictSensitive && hasFragile) {
    return `${label} comes out ahead most often, but the result is sensitive to assumptions.`
  }
  return `${label} comes out ahead most often.`
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

/**
 * Dependency line: "The result depends most on {factor}."
 *
 * Source + corroboration gates (rewritten 2026-05-21 after review):
 *
 *   1. `data.recommendation.dominantFactorId` + `dominantFactorLabel` must
 *      both be populated. That `recommendation` path
 *      (`useResultsSectionData.ts:1465–1476`) collapses two safe sources —
 *      PLoT B1 (`report.dominant_factor`) and M1
 *      (`m1Coaching.key_drivers.dominant_factor`) — and never emits the
 *      legacy heuristic (which only contaminates
 *      `data.drivers.dominantFactor*`, deliberately not read here).
 *
 *   2. Rank-1 consistency: the named factor MUST be the top-ranked driver
 *      in `data.drivers.drivers[]`. If `dominantFactorId` doesn't match
 *      the rank-1 driver, the recommendation and the underlying driver
 *      array disagree — render nothing rather than over-claim.
 *
 *   3. Dominance gate. `normalisedInfluence` is relative — the top driver
 *      is ALWAYS 1.0 when any real elasticity exists
 *      (`computeNormalisedInfluences` at `useResultsSectionData.ts:420–446`),
 *      so it can't distinguish dominance from a near-tie on its own.
 *      Two checks:
 *        (a) prefer `influenceScore` when present — that's the ISL
 *            structural causal influence on an absolute 0–1 scale;
 *            require `>= 0.5` (genuine dominance, not just "more than
 *            half of the max");
 *        (b) otherwise fall back to the top1/top2 normalisedInfluence
 *            ratio `>= 2.0` — the same 2:1 threshold the legacy
 *            heuristic uses, applied here as a guard (NOT a selector,
 *            so it doesn't taint anything).
 *      Either guard satisfies dominance; both failing omits the line.
 *
 *   4. Cleaned factor label passes the glossary banned-term gate.
 *
 * Returns `null` whenever any gate fails — the result-context block then
 * renders the result line alone.
 */
function buildDependencyLine(data: ResultsSectionDataReturn): string | null {
  const rec = data?.recommendation
  const id = rec?.dominantFactorId
  const rawLabel = rec?.dominantFactorLabel
  if (!id || !rawLabel) return null

  const drivers = data?.drivers?.drivers
  if (!drivers || drivers.length === 0) return null

  // Rank-1 consistency. Sort defensively rather than trusting source order.
  const sorted = [...drivers].sort((a, b) => a.rank - b.rank)
  const top1 = sorted[0]
  if (!top1 || top1.factorKey !== id) return null

  // Dominance gate.
  let isDominant = false
  if (typeof top1.influenceScore === 'number' && Number.isFinite(top1.influenceScore)) {
    // Absolute scale (ISL structural causal influence): 0.5 floor.
    isDominant = top1.influenceScore >= 0.5
  } else {
    // Relative-only data: require a clear gap between top-1 and top-2.
    const ni1 = top1.normalisedInfluence
    if (!Number.isFinite(ni1) || ni1 <= 0) return null
    const top2 = sorted[1]
    const ni2 = top2?.normalisedInfluence ?? 0
    if (ni2 > 0) {
      isDominant = (ni1 / ni2) >= 2.0
    } else {
      // Only one driver with non-zero influence — genuinely dominant.
      isDominant = true
    }
  }
  if (!isDominant) return null

  const cleaned = stripEncodingNotation(rawLabel)
  if (!cleaned) return null
  if (containsBannedTerm(cleaned)) return null
  return `The result depends most on ${cleaned}.`
}

// ── Key question ────────────────────────────────────────────────────────────

function selectKeyQuestion(
  data: ResultsSectionDataReturn,
  state: HeroState,
): KeyQuestion | null {
  // Strong-state CTA already invites the brief — no key question needed.
  if (state === 'strong') return null

  // Decision-review prompt verbatim (if clean). When V5 Phase 3 wires
  // `decision_review`, real DQPs populate automatically.
  //
  // Three gates (post review-feedback 2026-05-21):
  //   1. reviewStatus === 'complete' — mirrors the gate `m2NarrativeSummary`
  //      uses (see useResultsSectionData.ts:1461). The upstream selector
  //      exposes `m2DecisionQualityPrompts` even when the review is still
  //      in progress / stale; without this gate the card could render
  //      partial or out-of-date prompts.
  //   2. Question text passes `containsBannedTerm` (glossary safety).
  //   3. State is not 'strong' (handled above).
  //
  // The category-driven template fallback was removed (2026-05-21): on M1
  // it produced generic, repetitive questions across every decision and
  // burned vertical space without adding signal. When no real DQP is
  // present (or the gates fail), the card is hidden — coaching intent
  // moves into the input row's AI action prompt instead.
  if (data?.confidence?.reviewStatus !== 'complete') return null
  const dqps = data?.confidence?.m2DecisionQualityPrompts ?? []
  const dqp = dqps[0]?.question
  if (dqp && !containsBannedTerm(dqp)) {
    return {
      text: dqp,
      extras: dqps.slice(1, 4).map(p => p.question).filter(q => q && !containsBannedTerm(q)),
      chips: ['High', 'Some', 'Not sure', 'Add note'],
    }
  }

  // No safe gated DQP — hide the card.
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
  hasFragileFactor: boolean,
): FooterCheck[] {
  const hasWinner = !!data?.recommendation?.recommendedOption
  const stability = data?.recommendation?.recommendationStability
  const stable = typeof stability === 'number' && Number.isFinite(stability) && stability >= 0.85
  const evidenceOk = vm?.evidenceLevel === 'good'

  // Stability check is grounded: only name a specific "Sensitive
  // assumption" when a fragile/sensitive factor actually exists in the
  // data. Otherwise use the generic "Stability limited" — describes the
  // system-level state without implying a single named driver.
  let stabilityLabel: string
  if (stable) {
    stabilityLabel = 'Stable'
  } else if (hasFragileFactor) {
    stabilityLabel = 'Sensitive assumption'
  } else {
    stabilityLabel = 'Stability limited'
  }

  return [
    { label: hasWinner ? 'Result clear' : 'No clear result', tone: hasWinner ? 'ok' : 'warn' },
    { label: stabilityLabel, tone: stable ? 'ok' : 'warn' },
    { label: evidenceOk ? 'Evidence covered' : 'Evidence gaps', tone: evidenceOk ? 'ok' : 'warn' },
    { label: state === 'reflect' ? 'Reflective check' : 'Framing OK', tone: state === 'reflect' ? 'reflect' : 'ok' },
  ]
}

function buildFooterCta(state: HeroState, topRow: HeroRow | undefined): FooterCta {
  // Source of truth: investigation §11.4 + 2026-05-21 corrections pass.
  // Sequencing is enforced at the call site (component dispatches via
  // prop handlers).
  //
  // CTA mirroring policy (corrections pass §7a):
  //   - weak / reflect / strong → state-specific CTA (intent isn't
  //     "check one estimate"; mirroring would produce mismatched copy).
  //   - moderate → mirror Row 1's verb-led title via a cleaned
  //     `targetLabel`. See §7 in the plan for the derivation.
  switch (state) {
    case 'weak':
      return {
        label: 'Review weak inputs',
        kind: 'review-weak-inputs',
        chatPrompt: 'Walk me through the highest-priority inputs one at a time. Ask what I know before suggesting changes.',
        focusTargetId: undefined,
        targetLabel: null,
      }
    case 'moderate': {
      // Step 1: strip the "Verify " prefix Row 1 carries, so the result
      // composes with "Check " / "Focus " without producing
      // "Check Verify Tech Lead in Place".
      const row1Title = topRow?.title ?? ''
      const stripped = row1Title.startsWith('Verify ')
        ? row1Title.slice('Verify '.length)
        : ''
      // Step 2: glossary-safe handling on the stripped label. If the
      // underlying user label trips the banned-term scanner, fall back
      // to the safe generic — never amplify the banned term into CTA
      // copy or the chat prompt.
      const safeTargetLabel = stripped && !containsBannedTerm(stripped)
        ? stripped
        : null
      // Step 3: compose label + chatPrompt from the single safe target.
      const label = safeTargetLabel
        ? `Check ${safeTargetLabel}`
        : 'Check top estimate'
      const chatPrompt = safeTargetLabel
        ? `Check whether the estimate for ${safeTargetLabel} matches my experience.`
        : 'Check whether the highest-priority estimate matches my experience.'
      return {
        label,
        kind: 'check-key-estimate',
        chatPrompt,
        focusTargetId: topRow?.targetNodeId,
        targetLabel: safeTargetLabel,
      }
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
        targetLabel: null,
      }
    case 'strong':
      return {
        label: 'Create decision brief',
        kind: 'create-decision-brief',
        chatPrompt: 'Help me capture the result, rationale, key assumptions and caveats as a decision brief.',
        focusTargetId: undefined,
        targetLabel: null,
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
    // Display-safe verdict gates the confident 'strong' posture — raw stability
    // alone must not unlock "Ready to brief" (ROBUSTNESS-VERDICT-CONTRACT).
    robustnessVerdict: recommendation?.robustnessVerdict ?? null,
  })

  const allRows = rankHeroRows(data, state)
  const inputRows = allRows.slice(0, 3)
  const hiddenRows = allRows.slice(3, 6)
  const topRow = inputRows[0]

  // A fragile/sensitive factor exists when PLoT surfaces one as the top
  // fragile edge (preferred) or via the M1 coaching fallback. This is the
  // same signal `fragileEdgeRow` and `buildReasonLine` already use, kept
  // in one place so meta-pill softening and footer-check grounding stay
  // in lock-step with what the user actually sees.
  const hasFragileFactor = !!(
    data?.confidence?.topFragileEdge ?? data?.confidence?.m1CoachingTopFragileEdge
  )

  const dimensions = buildDimensions(data, confirmedFactorCount, totalFactorCount, structureSignals, coverageSignals)
  const resultLine = buildResultLine(data)
  const reasonLine = buildReasonLine(data)
  const dependencyLine = buildDependencyLine(data)
  const keyQuestion = selectKeyQuestion(data, state)
  const footerChecks = buildFooterChecks(data, vm, state, hasFragileFactor)
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
    dependencyLine,
    keyQuestion,
    inputRows,
    hiddenRows,
    alsoLinks,
    footerChecks,
    footerHint,
    footerCta,
  }
}
