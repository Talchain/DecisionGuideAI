/**
 * Fixture: Rich (post-hook shape)
 *
 * 3 options, 5 factors, stability 0.82, denormalised (currency units)
 * 7 fragile edges (SENSITIVE_ASSUMPTION), 3 evidence gaps
 * Goal threshold present, goal probability values
 * tier: strong
 */

import type { ResultsSectionDataReturn } from '../components/results/useResultsSectionData'
import type { TornadoRow } from '../components/results/TornadoChart'

const drivers = [
  {
    factorKey: 'factor-tech-lead',
    factorLabel: 'Tech lead hired',
    rawElasticity: 0.48,
    normalisedInfluence: 1.0,
    influenceScore: 0.48,
    rank: 1 as const,
    direction: 'positive' as const,
    semanticLabel: 'biggest' as const,
    canFocus: true,
    confidence: 0.60,
  },
  {
    factorKey: 'factor-market-timing',
    factorLabel: 'Market timing',
    rawElasticity: 0.35,
    normalisedInfluence: 0.73,
    influenceScore: 0.35,
    rank: 2 as const,
    direction: 'positive' as const,
    semanticLabel: 'strong' as const,
    canFocus: true,
    confidence: 0.72,
  },
  {
    factorKey: 'factor-budget',
    factorLabel: 'Budget available',
    rawElasticity: 0.22,
    normalisedInfluence: 0.46,
    influenceScore: 0.22,
    rank: 3 as const,
    direction: 'positive' as const,
    semanticLabel: 'moderate' as const,
    canFocus: true,
    confidence: 0.88,
  },
  {
    factorKey: 'factor-team-morale',
    factorLabel: 'Team morale',
    rawElasticity: 0.14,
    normalisedInfluence: 0.29,
    influenceScore: 0.14,
    rank: 4 as const,
    direction: 'positive' as const,
    semanticLabel: 'moderate' as const,
    canFocus: true,
    confidence: 0.65,
  },
  {
    factorKey: 'factor-competition',
    factorLabel: 'Competitive pressure',
    rawElasticity: 0.09,
    normalisedInfluence: 0.19,
    influenceScore: 0.09,
    rank: 5 as const,
    direction: 'negative' as const,
    semanticLabel: 'minor' as const,
    canFocus: true,
    confidence: 0.50,
  },
]

export const richFixture: ResultsSectionDataReturn = {
  recommendation: {
    recommendedOption: {
      id: 'opt-build',
      label: 'Build in-house',
      expected: 640000,
      outcome: { mean: 640000, p10: 380000, p50: 620000, p90: 890000 },
      p10: 380000,
      p50: 620000,
      p90: 890000,
      isRecommended: true,
      winProbability: 0.71,
      goalProbability: 0.64,
      rank: 1,
    },
    allOptions: [
      {
        id: 'opt-build',
        label: 'Build in-house',
        expected: 640000,
        outcome: { mean: 640000, p10: 380000, p50: 620000, p90: 890000 },
        p10: 380000,
        p50: 620000,
        p90: 890000,
        isRecommended: true,
        winProbability: 0.71,
        goalProbability: 0.64,
        rank: 1,
      },
      {
        id: 'opt-outsource',
        label: 'Outsource',
        expected: 480000,
        outcome: { mean: 480000, p10: 260000, p50: 460000, p90: 710000 },
        p10: 260000,
        p50: 460000,
        p90: 710000,
        isRecommended: false,
        winProbability: 0.22,
        goalProbability: 0.31,
        rank: 2,
      },
      {
        id: 'opt-hybrid',
        label: 'Hybrid approach',
        expected: 410000,
        outcome: { mean: 410000, p10: 190000, p50: 390000, p90: 640000 },
        p10: 190000,
        p50: 390000,
        p90: 640000,
        isRecommended: false,
        winProbability: 0.07,
        goalProbability: 0.18,
        rank: 3,
      },
    ],
    goalLabel: 'Annual recurring revenue',
    isSingleOption: false,
    analysisStatus: 'computed',
    outcomeUnit: 'currency',
    outcomeUnitSymbol: '$',
    goalThreshold: 800000,
    recommendationStability: 0.82,
    winProbability: 0.71,
  },
  drivers: {
    drivers,
    driversStatus: 'computed',
    topDrivers: drivers.slice(0, 3),
    totalCount: 5,
    hasMagnitudeData: true,
  },
  confidence: {
    tier: { tier: 'strong', icon: '✅', label: 'Strong', description: 'Analysis is well-supported' },
    qualityScore: 76,
    uncertainties: [
      { code: 'SENSITIVE_ASSUMPTION', message: '"Tech lead hired → Product velocity" is sensitive — if wrong, Outsource wins', severity: 'warning', factorConfidence: 0.60 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Market timing → Customer acquisition" could shift outcome', severity: 'warning', factorConfidence: 0.72 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Budget → Development speed" has moderate confidence', severity: 'info', factorConfidence: 0.88 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Team morale → Retention" affects long-term outcomes', severity: 'info', factorConfidence: 0.65 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Competitive pricing → Win rate" is moderately uncertain', severity: 'info', factorConfidence: 0.50 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Partner channel → Distribution" depends on timing', severity: 'info', factorConfidence: 0.58 },
      { code: 'SENSITIVE_ASSUMPTION', message: '"Economic conditions → Enterprise budget" is cyclical', severity: 'info', factorConfidence: 0.70 },
      { code: 'LOW_EVIDENCE', message: 'Tech lead hiring timeline is based on optimistic estimates', severity: 'warning' },
    ],
    topUncertainties: [],
    improvements: [
      { action: 'Confirm tech lead hiring timeline', reason: 'Biggest driver with medium confidence', priority: 1, source: 'quality_factor' },
      { action: 'Validate market timing assumptions', reason: 'Second driver', priority: 2, source: 'quality_factor' },
      { action: 'Review competitive landscape', reason: 'Low confidence factor', priority: 3, source: 'quality_factor' },
    ],
    topImprovements: [],
    robustnessStatus: 'computed',
    topFragileEdge: {
      fromId: 'factor-tech-lead',
      fromLabel: 'Tech lead hired',
      toId: 'goal-arr',
      toLabel: 'Annual recurring revenue',
      alternativeWinnerLabel: 'Outsource',
      switchProbability: 0.22,
    },
    evidenceGaps: [
      { factorId: 'factor-tech-lead', factorLabel: 'Tech lead hired', confidence: 60, voi: 0.75, suggestion: 'Confirm hiring pipeline status and timeline' },
      { factorId: 'factor-competition', factorLabel: 'Competitive pressure', confidence: 50, voi: 0.62, suggestion: 'Conduct competitive analysis of key players' },
      { factorId: 'factor-team-morale', factorLabel: 'Team morale', confidence: 65, voi: 0.45, suggestion: 'Run anonymous team survey on project appetite' },
    ],
  },
  improvements: {
    improvements: [
      { action: 'Confirm tech lead hiring timeline', reason: 'Biggest driver with medium confidence', priority: 1, source: 'quality_factor' },
      { action: 'Validate market timing assumptions', reason: 'Second driver', priority: 2, source: 'quality_factor' },
      { action: 'Review competitive landscape', reason: 'Low confidence factor', priority: 3, source: 'quality_factor' },
    ],
    count: 3,
    hasHighPriority: true,
  },
  isLoading: false,
  isError: false,
  goalLabel: 'Annual recurring revenue',
  goalNodeId: 'goal-arr',
}

/** Tornado data derived from the rich fixture */
export const richTornadoData: { rows: TornadoRow[]; expectedOutcome: number | null } = (() => {
  const rec = richFixture.recommendation
  const expected = rec.recommendedOption!.expected!
  const p10 = rec.recommendedOption!.outcome.p10!
  const p90 = rec.recommendedOption!.outcome.p90!
  const downRange = expected - p10
  const upRange = p90 - expected

  const rows: TornadoRow[] = richFixture.drivers.drivers
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
