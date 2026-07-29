/**
 * Fixture: Normalised (post-hook shape)
 *
 * 2 options, normalised scores (isNormalised: true), stability 0.75
 * 6 fragile edges (SENSITIVE_ASSUMPTION), 2 evidence gaps
 * 3 drivers, tier: fair
 */

import type { ResultsSectionDataReturn } from '../components/results/useResultsSectionData'
import type { TornadoRow } from '../components/results/TornadoChart'

export const normalisedFixture: ResultsSectionDataReturn = {
  recommendation: {
    recommendedOption: {
      id: 'opt-expand',
      label: 'Expand into European Market',
      expected: 0.13,
      outcome: { mean: 0.13, p10: -0.17, p50: 0.13, p90: 0.43 },
      p10: -0.17,
      p50: 0.13,
      p90: 0.43,
      isRecommended: true,
      winProbability: 0.75,
      rank: 1,
    },
    allOptions: [
      {
        id: 'opt-expand',
        label: 'Expand into European Market',
        expected: 0.13,
        outcome: { mean: 0.13, p10: -0.17, p50: 0.13, p90: 0.43 },
        p10: -0.17,
        p50: 0.13,
        p90: 0.43,
        isRecommended: true,
        winProbability: 0.75,
        rank: 1,
      },
      {
        id: 'opt-hold',
        label: 'Maintain Current Focus',
        expected: -0.01,
        outcome: { mean: -0.01, p10: -0.05, p50: -0.01, p90: 0.03 },
        p10: -0.05,
        p50: -0.01,
        p90: 0.03,
        isRecommended: false,
        winProbability: 0.25,
        rank: 2,
      },
    ],
    goalLabel: 'Revenue growth',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.75,
    winProbability: 0.75,
    isNormalised: true,
  },
  drivers: {
    drivers: [
      {
        factorKey: 'factor-market-demand',
        factorLabel: 'Market demand strength',
        rawElasticity: 0.52,
        normalisedInfluence: 1.0,
        influenceScore: 0.52,
        rank: 1,
        direction: 'positive',
        semanticLabel: 'biggest',
        canFocus: true,
        confidence: 0.45,
      },
      {
        factorKey: 'factor-regulatory',
        factorLabel: 'Regulatory environment',
        rawElasticity: 0.33,
        normalisedInfluence: 0.63,
        influenceScore: 0.33,
        rank: 2,
        direction: 'negative',
        semanticLabel: 'strong',
        canFocus: true,
        confidence: 0.62,
      },
      {
        factorKey: 'factor-brand-recognition',
        factorLabel: 'Brand recognition',
        rawElasticity: 0.18,
        normalisedInfluence: 0.35,
        influenceScore: 0.18,
        rank: 3,
        direction: 'positive',
        semanticLabel: 'moderate',
        canFocus: true,
        confidence: 0.78,
      },
    ],
    driversStatus: 'computed',
    topDrivers: [
      {
        factorKey: 'factor-market-demand',
        factorLabel: 'Market demand strength',
        rawElasticity: 0.52,
        normalisedInfluence: 1.0,
        influenceScore: 0.52,
        rank: 1,
        direction: 'positive',
        semanticLabel: 'biggest',
        canFocus: true,
        confidence: 0.45,
      },
      {
        factorKey: 'factor-regulatory',
        factorLabel: 'Regulatory environment',
        rawElasticity: 0.33,
        normalisedInfluence: 0.63,
        influenceScore: 0.33,
        rank: 2,
        direction: 'negative',
        semanticLabel: 'strong',
        canFocus: true,
        confidence: 0.62,
      },
      {
        factorKey: 'factor-brand-recognition',
        factorLabel: 'Brand recognition',
        rawElasticity: 0.18,
        normalisedInfluence: 0.35,
        influenceScore: 0.18,
        rank: 3,
        direction: 'positive',
        semanticLabel: 'moderate',
        canFocus: true,
        confidence: 0.78,
      },
    ],
    totalCount: 3,
    hasMagnitudeData: true,
  },
  confidence: {
    tier: { tier: 'fair', icon: '⚡', label: 'Fair', description: 'Some assumptions need validation' },
    qualityScore: 58,
    uncertainties: [
      { code: 'SENSITIVE_ASSUMPTION', message: '"Market demand → Revenue" is sensitive — if wrong, Maintain Current Focus wins', severity: 'critical', factorConfidence: 0.45 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Regulatory environment → Revenue" could shift outcome significantly', severity: 'warning', factorConfidence: 0.62 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Brand recognition → Customer acquisition" has medium confidence', severity: 'warning', factorConfidence: 0.55 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Competitive pricing → Market share" relies on uncertain assumptions', severity: 'warning', factorConfidence: 0.50 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Partner availability → Distribution" is weakly evidenced', severity: 'info', factorConfidence: 0.68 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Economic conditions → Consumer spending" could vary widely', severity: 'info', factorConfidence: 0.42 },
      { code: 'LOW_EVIDENCE', message: 'Market demand estimates are based on limited data points', severity: 'warning' },
    ],
    topUncertainties: [],
    improvements: [
      { action: 'Research European market demand forecasts', reason: 'Biggest driver with lowest confidence', priority: 1, source: 'quality_factor' },
      { action: 'Review regulatory landscape in target markets', reason: 'Second driver with medium confidence', priority: 2, source: 'quality_factor' },
    ],
    topImprovements: [],
    robustnessStatus: 'computed',
    topFragileEdge: {
      fromId: 'factor-market-demand',
      fromLabel: 'Market demand strength',
      toId: 'goal-revenue',
      toLabel: 'Revenue growth',
      alternativeWinnerLabel: 'Maintain Current Focus',
      switchProbability: 0.25,
    },
    evidenceGaps: [
      { factorId: 'factor-market-demand', factorLabel: 'Market demand strength', confidence: 45, voi: 0.82, suggestion: 'Commission market research in target European regions' },
      { factorId: 'factor-regulatory', factorLabel: 'Regulatory environment', confidence: 62, voi: 0.55, suggestion: 'Consult with legal team about EU compliance requirements' },
    ],
  },
  improvements: {
    improvements: [
      { action: 'Research European market demand forecasts', reason: 'Biggest driver with lowest confidence', priority: 1, source: 'quality_factor' },
      { action: 'Review regulatory landscape in target markets', reason: 'Second driver with medium confidence', priority: 2, source: 'quality_factor' },
    ],
    count: 2,
    hasHighPriority: true,
  },
  isLoading: false,
  isError: false,
  goalLabel: 'Revenue growth',
  goalNodeId: 'goal-revenue',
  // V7-C slice 1 (ROADMAP 2.141): `null` is the honest-gate verdict — this
  // fixture predates the Resolve next view and asserts nothing about it.
  voiRanking: null,
}

/** Tornado data derived from the normalised fixture */
export const normalisedTornadoData: { rows: TornadoRow[]; expectedOutcome: number | null } = (() => {
  const rec = normalisedFixture.recommendation
  const expected = rec.recommendedOption!.expected!
  const p10 = rec.recommendedOption!.outcome.p10!
  const p90 = rec.recommendedOption!.outcome.p90!
  const downRange = expected - p10
  const upRange = p90 - expected

  const rows: TornadoRow[] = normalisedFixture.drivers.drivers
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
