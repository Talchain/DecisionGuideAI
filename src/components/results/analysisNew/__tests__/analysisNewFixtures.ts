/**
 * Analysis (New) — fixtures for the three scenario CLASSES the experiment must
 * behave correctly across (brief §24F).
 *
 *   1. OPEN STRATEGIC CHALLENGE — no decision exists. The surface must not
 *      manufacture a winner or an option frame.
 *   2. GENUINE DECISION — a leader the single verdict entitles naming.
 *      Comparative material may appear, phrased as "currently scores higher".
 *   3. HIGH UNCERTAINTY — uncertainty becomes prominent WITHOUT the surface
 *      falsely blocking the analysis or equating coverage with readiness.
 *
 * ⚠ THESE ARE HAND-BUILT AND THAT IS A KNOWN LIMIT (CLAUDE.md trap 22): a
 * corpus from the author's head cannot see the class the author did not
 * imagine. They are therefore used to pin SEMANTIC RULES that are checkable
 * from the producer's own declared field semantics (leader entitlement,
 * absence-is-not-zero, set-relative influence, assessed-vs-unassessed), NOT to
 * certify that the IA is right. The IA question is what Paul's side-by-side
 * comparison answers, and no fixture can stand in for it.
 */

import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriverItem,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../../types'
import type { ResultCompleteness } from '../../useResultCompleteness'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

export function makeOption(
  overrides: Partial<OptionResult> & { id: string; label: string },
): OptionResult {
  return {
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    ...overrides,
  } as OptionResult
}

export function makeDriver(overrides: Partial<DriverItem> & { factorKey: string; factorLabel: string }): DriverItem {
  return {
    rawElasticity: 0.4,
    normalisedInfluence: 0.6,
    rank: 1,
    semanticLabel: 'primary',
    canFocus: true,
    displayInfluence: 0.6,
    displayProvenance: 'influence_score',
    ...overrides,
  } as DriverItem
}

const EMPTY_COMPLETENESS: ResultCompleteness = { status: 'full', missing: [], reasons: [] }

export interface MakeDataOptions {
  recommendation?: Partial<DecisionResultData>
  drivers?: Partial<DriversSectionData>
  confidence?: Partial<ConfidenceSectionData>
  completeness?: ResultCompleteness
  decisionVoi?: ResultsSectionDataReturn['decisionVoi']
  sensitivityReference?: ResultsSectionDataReturn['sensitivityReference']
  voiRanking?: ResultsSectionDataReturn['voiRanking']
}

export function makeData(opts: MakeDataOptions = {}): ResultsSectionDataReturn {
  const recommendation: DecisionResultData = {
    recommendedOption: null,
    allOptions: [],
    goalLabel: 'Sustained margin',
    isSingleOption: false,
    analysisStatus: 'computed',
    ...opts.recommendation,
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    driversStatus: 'computed',
    topDrivers: [],
    totalCount: 0,
    hasMagnitudeData: true,
    ...opts.drivers,
  } as DriversSectionData

  const confidence: ConfidenceSectionData = {
    // The vocabulary is strong | fair | needs_work | unknown — not a
    // high/medium/low scale. Using an invented token here would have made every
    // case below assert against a tier the producer can never send.
    tier: { tier: 'fair', icon: '', label: 'Fair', description: '' },
    qualityScore: 60,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    ...opts.confidence,
  } as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: recommendation.goalLabel,
    completeness: opts.completeness ?? EMPTY_COMPLETENESS,
    autoNoiseProvenance: null,
    sensitivityReference: opts.sensitivityReference ?? null,
    voiRanking: opts.voiRanking ?? null,
    decisionVoi: opts.decisionVoi ?? 'not_computed',
    assumedStrength: { selected: null, refusalReason: null, assumedFragileCount: 0 },
  } as ResultsSectionDataReturn
}

// ── 1. OPEN STRATEGIC CHALLENGE ─────────────────────────────────────────────
// No options, no leader, no verdict entitlement. A well-analysed problem that
// simply is not a decision.
export function openStrategicChallenge(): ResultsSectionDataReturn {
  return makeData({
    recommendation: {
      allOptions: [],
      recommendedOption: null,
      isSingleOption: true,
      // No `verdict` at all — the producer never named one.
      robustnessVerdict: 'fragile',
      robustnessVerdictReason:
        'Small changes in supplier lead time change which direction looks better.',
      dominantFactorId: 'f_leadtime',
      dominantFactorLabel: 'Supplier lead time',
    },
    drivers: {
      drivers: [
        makeDriver({ factorKey: 'f_leadtime', factorLabel: 'Supplier lead time', direction: 'negative' }),
        makeDriver({ factorKey: 'f_demand', factorLabel: 'Demand volatility', rank: 2, displayInfluence: 0.35, direction: 'mixed' }),
      ],
    },
    confidence: { evidenceGapsAssessed: true, robustnessStatus: 'computed' },
  })
}

// ── 2. GENUINE DECISION ─────────────────────────────────────────────────────
export function genuineDecision(): ResultsSectionDataReturn {
  const a = makeOption({ id: 'opt_a', label: 'Hold price', winProbability: 0.31 })
  const b = makeOption({ id: 'opt_b', label: 'Raise price', isRecommended: true, winProbability: 0.69 })
  return makeData({
    recommendation: {
      allOptions: [a, b],
      recommendedOption: b,
      isSingleOption: false,
      winProbability: 0.69,
      determinedBy: 'win_probability',
      // The ONE boolean that entitles naming a leader.
      verdict: { leaderId: 'opt_b', hasLeadingOption: true } as DecisionResultData['verdict'],
      robustnessVerdict: 'robust',
      robustnessVerdictReason: 'The ordering held across the simulated range.',
    },
    drivers: {
      drivers: [makeDriver({ factorKey: 'f_elasticity', factorLabel: 'Price elasticity', direction: 'negative' })],
    },
    confidence: { evidenceGapsAssessed: true },
  })
}

/** The same decision, but the producer WITHHELD the leader entitlement. */
export function decisionWithLeaderWithheld(): ResultsSectionDataReturn {
  const data = genuineDecision()
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      verdict: { leaderId: 'opt_b', hasLeadingOption: false } as DecisionResultData['verdict'],
    },
  }
}

// ── 3. HIGH UNCERTAINTY ─────────────────────────────────────────────────────
// Consequential uncertainty everywhere, incomplete coverage — and STILL a valid
// analysis. Nothing here may read as "the analysis is blocked".
export function highUncertainty(): ResultsSectionDataReturn {
  return makeData({
    recommendation: {
      analysisStatus: 'partial',
      statusReason: 'Two factors could not be sampled to the requested precision.',
      robustnessVerdict: 'fragile',
      robustnessVerdictReason: 'The ordering changed in a substantial share of the simulated range.',
    },
    drivers: {
      drivers: [
        // Set-relative basis — the caveat must fire.
        makeDriver({
          factorKey: 'f_adopt',
          factorLabel: 'Customer adoption',
          displayProvenance: 'normalised_elasticity',
          isDefaultedConfidence: true,
          confidence: 0.25,
          direction: 'positive',
        }),
      ],
    },
    confidence: {
      // Producer NEVER assessed evidence on this run — distinct from "assessed,
      // none found". The empty-state copy must differ.
      evidenceGapsAssessed: false,
      evidenceGaps: [],
      uncertainties: [
        {
          code: 'SENSITIVE_ASSUMPTION',
          message: 'RAW_TOKEN_SHOULD_NOT_RENDER',
          userMessage: 'Customer adoption is the assumption the result is most sensitive to.',
          displayText: 'Customer adoption is the assumption the result is most sensitive to.',
          suggestion: 'Test the adoption assumption before committing.',
          severity: 'critical',
          affectedNodes: ['f_adopt'],
          eValue: 1.8,
        },
      ],
      robustnessStatus: 'computed',
    },
    completeness: { status: 'partial', missing: ['robustness'], reasons: [] } as unknown as ResultCompleteness,
    decisionVoi: 'measured_non_zero',
  })
}

/** Evidence gaps present, but with a NULL confidence — absence, not zero. */
export function evidenceGapWithNullConfidence(): ResultsSectionDataReturn {
  return makeData({
    confidence: {
      evidenceGapsAssessed: true,
      evidenceGaps: [
        {
          factorId: 'f_churn',
          factorLabel: 'Churn rate',
          confidence: null,
          voi: null,
          suggestion: 'Pull the last four quarters of churn before relying on this.',
        },
      ],
    },
  })
}
