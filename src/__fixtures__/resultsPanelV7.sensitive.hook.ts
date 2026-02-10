/**
 * Fixture: Sensitive / Close Call (post-hook shape)
 *
 * 2 options, close call, stability 0.48
 * 4 fragile edges (SENSITIVE_ASSUMPTION), 1 evidence gap
 * 2 drivers, tier: needs_work, near-tie
 */

import type { ResultsSectionDataReturn } from '../components/results/useResultsSectionData'
import type { TornadoRow } from '../components/results/TornadoChart'

export const sensitiveFixture: ResultsSectionDataReturn = {
  recommendation: {
    recommendedOption: {
      id: 'opt-launch',
      label: 'Launch new product line',
      expected: 420,
      outcome: { mean: 420, p10: 180, p50: 400, p90: 680 },
      p10: 180,
      p50: 400,
      p90: 680,
      isRecommended: true,
      winProbability: 0.52,
      goalProbability: 0.38,
      rank: 1,
    },
    allOptions: [
      {
        id: 'opt-launch',
        label: 'Launch new product line',
        expected: 420,
        outcome: { mean: 420, p10: 180, p50: 400, p90: 680 },
        p10: 180,
        p50: 400,
        p90: 680,
        isRecommended: true,
        winProbability: 0.52,
        goalProbability: 0.38,
        rank: 1,
      },
      {
        id: 'opt-iterate',
        label: 'Iterate on existing products',
        expected: 395,
        outcome: { mean: 395, p10: 210, p50: 380, p90: 590 },
        p10: 210,
        p50: 380,
        p90: 590,
        isRecommended: false,
        winProbability: 0.48,
        goalProbability: 0.32,
        rank: 2,
      },
    ],
    goalLabel: 'Annual revenue ($K)',
    isSingleOption: false,
    analysisStatus: 'computed',
    outcomeUnit: 'currency',
    outcomeUnitSymbol: '$',
    goalThreshold: 500,
    recommendationStability: 0.48,
    winProbability: 0.52,
    nearTie: {
      isNearTie: true,
      margin: 0.04,
      winnerLabel: 'Launch new product line',
      runnerUpLabel: 'Iterate on existing products',
    },
  },
  drivers: {
    drivers: [
      {
        factorKey: 'factor-customer-adoption',
        factorLabel: 'Customer adoption rate',
        rawElasticity: 0.61,
        normalisedInfluence: 1.0,
        influenceScore: 0.61,
        rank: 1,
        direction: 'positive',
        semanticLabel: 'biggest',
        canFocus: true,
        confidence: 0.32,
      },
      {
        factorKey: 'factor-dev-cost',
        factorLabel: 'Development cost',
        rawElasticity: 0.38,
        normalisedInfluence: 0.62,
        influenceScore: 0.38,
        rank: 2,
        direction: 'negative',
        semanticLabel: 'strong',
        canFocus: true,
        confidence: 0.55,
      },
    ],
    driversStatus: 'computed',
    topDrivers: [
      {
        factorKey: 'factor-customer-adoption',
        factorLabel: 'Customer adoption rate',
        rawElasticity: 0.61,
        normalisedInfluence: 1.0,
        influenceScore: 0.61,
        rank: 1,
        direction: 'positive',
        semanticLabel: 'biggest',
        canFocus: true,
        confidence: 0.32,
      },
      {
        factorKey: 'factor-dev-cost',
        factorLabel: 'Development cost',
        rawElasticity: 0.38,
        normalisedInfluence: 0.62,
        influenceScore: 0.38,
        rank: 2,
        direction: 'negative',
        semanticLabel: 'strong',
        canFocus: true,
        confidence: 0.55,
      },
    ],
    totalCount: 2,
    hasMagnitudeData: true,
  },
  confidence: {
    tier: { tier: 'needs_work', icon: '⚠️', label: 'Needs work', description: 'Key assumptions are fragile' },
    qualityScore: 34,
    uncertainties: [
      { code: 'SENSITIVE_ASSUMPTION', message: '"Customer adoption → Revenue" is highly sensitive — if wrong, Iterate wins', severity: 'critical', factorConfidence: 0.32 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Development cost → Profit margin" could swing the outcome', severity: 'warning', factorConfidence: 0.55 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Market timing → Customer adoption" has low confidence', severity: 'warning', factorConfidence: 0.40 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Competitor response → Market share" is uncertain', severity: 'info', factorConfidence: 0.48 },
      { code: 'LOW_EVIDENCE', message: 'Customer adoption estimates rely on a single pilot study', severity: 'warning' },
    ],
    topUncertainties: [],
    improvements: [
      { action: 'Run expanded customer pilot', reason: 'Biggest driver with very low confidence', priority: 1, source: 'quality_factor' },
      { action: 'Get development cost quotes', reason: 'Second driver with medium confidence', priority: 2, source: 'quality_factor' },
    ],
    topImprovements: [],
    robustnessStatus: 'computed',
    topFragileEdge: {
      fromId: 'factor-customer-adoption',
      fromLabel: 'Customer adoption rate',
      toId: 'goal-revenue',
      toLabel: 'Annual revenue',
      alternativeWinnerLabel: 'Iterate on existing products',
      switchProbability: 0.48,
    },
    evidenceGaps: [
      { factorId: 'factor-customer-adoption', factorLabel: 'Customer adoption rate', confidence: 32, voi: 0.91, suggestion: 'Conduct larger customer pilot in target segment' },
    ],
  },
  improvements: {
    improvements: [
      { action: 'Run expanded customer pilot', reason: 'Biggest driver with very low confidence', priority: 1, source: 'quality_factor' },
      { action: 'Get development cost quotes', reason: 'Second driver with medium confidence', priority: 2, source: 'quality_factor' },
    ],
    count: 2,
    hasHighPriority: true,
  },
  isLoading: false,
  isError: false,
  goalLabel: 'Annual revenue ($K)',
  goalNodeId: 'goal-revenue',
}

/** Tornado data derived from the sensitive fixture */
export const sensitiveTornadoData: { rows: TornadoRow[]; expectedOutcome: number | null } = (() => {
  const rec = sensitiveFixture.recommendation
  const expected = rec.recommendedOption!.expected!
  const p10 = rec.recommendedOption!.outcome.p10!
  const p90 = rec.recommendedOption!.outcome.p90!
  const downRange = expected - p10
  const upRange = p90 - expected

  const rows: TornadoRow[] = sensitiveFixture.drivers.drivers
    .filter(d => (d.influenceScore ?? d.normalisedInfluence) > 0.01)
    .sort((a, b) => (b.influenceScore ?? b.normalisedInfluence) - (a.influenceScore ?? a.normalisedInfluence))
    .slice(0, 5)
    .map(d => {
      const influence = d.influenceScore ?? d.normalisedInfluence
      return {
        factorKey: d.factorKey,
        label: d.factorLabel,
        lowOutcome: expected - influence * downRange,
        highOutcome: expected + influence * upRange,
        canFocus: d.canFocus,
        matchedNodeId: d.matchedNodeId,
      }
    })

  return { rows, expectedOutcome: expected }
})()
