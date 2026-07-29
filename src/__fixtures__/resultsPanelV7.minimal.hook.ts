/**
 * Fixture: Minimal (post-hook shape)
 *
 * 2 options, empty sensitivity/fragile edges, no evidence gaps
 * 0 drivers, tier: unknown
 * No goal threshold, no fragile edges — tests graceful degradation
 */

import type { ResultsSectionDataReturn } from '../components/results/useResultsSectionData'
import type { TornadoRow } from '../components/results/TornadoChart'

export const minimalFixture: ResultsSectionDataReturn = {
  recommendation: {
    recommendedOption: {
      id: 'opt-a',
      label: 'Option A',
      expected: 0.55,
      outcome: { mean: 0.55, p10: 0.20, p50: 0.53, p90: 0.88 },
      p10: 0.20,
      p50: 0.53,
      p90: 0.88,
      isRecommended: true,
      winProbability: 0.65,
      rank: 1,
    },
    allOptions: [
      {
        id: 'opt-a',
        label: 'Option A',
        expected: 0.55,
        outcome: { mean: 0.55, p10: 0.20, p50: 0.53, p90: 0.88 },
        p10: 0.20,
        p50: 0.53,
        p90: 0.88,
        isRecommended: true,
        winProbability: 0.65,
        rank: 1,
      },
      {
        id: 'opt-b',
        label: 'Option B',
        expected: 0.42,
        outcome: { mean: 0.42, p10: 0.12, p50: 0.40, p90: 0.74 },
        p10: 0.12,
        p50: 0.40,
        p90: 0.74,
        isRecommended: false,
        winProbability: 0.35,
        rank: 2,
      },
    ],
    goalLabel: 'Success metric',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.65,
    winProbability: 0.65,
    isNormalised: true,
  },
  drivers: {
    drivers: [],
    driversStatus: 'unavailable',
    topDrivers: [],
    totalCount: 0,
    hasMagnitudeData: false,
  },
  confidence: {
    tier: { tier: 'unknown', icon: '❓', label: 'Unknown', description: 'Insufficient data to assess' },
    qualityScore: null,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    robustnessStatus: 'unavailable' as any,
  },
  improvements: {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  },
  isLoading: false,
  isError: false,
  goalLabel: 'Success metric',
  goalNodeId: 'goal-success',
  voiRanking: null,
}

/** Tornado data for minimal fixture — empty since no drivers */
export const minimalTornadoData: { rows: TornadoRow[]; expectedOutcome: number | null } = {
  rows: [],
  expectedOutcome: null,
}
