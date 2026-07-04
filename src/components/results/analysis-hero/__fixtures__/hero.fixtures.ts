/**
 * Analysis hero — test fixtures.
 *
 * Builds ResultsSectionDataReturn-shaped objects with distinct, easily
 * assertable values. The default scenario deliberately diverges the two
 * leaders: Option B is the Results Panel's recommended option (goal-fit
 * headline leader) while Option A has the highest expected outcome — the
 * tension subline case.
 */
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriverItem,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../../types'
import type { ResultCompleteness } from '../../useResultCompleteness'

export function makeOption(overrides: Partial<OptionResult> & { id: string; label: string }): OptionResult {
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

/** Option A — highest expected outcome, weaker goal fit. */
export const OPTION_A = makeOption({
  id: 'opt_a',
  label: 'Two developers',
  expected: 68,
  outcome: { mean: 68, p10: 54, p50: 67, p90: 82 },
  winProbability: 0.3,
  goalProbability: 0.34,
})

/** Option B — the recommended option (goal-fit leader). */
export const OPTION_B = makeOption({
  id: 'opt_b',
  label: 'Upskill the team',
  expected: 62,
  outcome: { mean: 62, p10: 46, p50: 61, p90: 78 },
  winProbability: 0.29,
  isRecommended: true,
  goalProbability: 0.49,
})

export const FULL_COMPLETENESS: ResultCompleteness = {
  status: 'full',
  missing: [],
  reasons: [],
} as ResultCompleteness

export function makeDriver(label: string): DriverItem {
  return {
    factorKey: `fac_${label.toLowerCase().replace(/\s+/g, '_')}`,
    factorLabel: label,
    rawElasticity: 0.8,
    normalisedInfluence: 1,
    rank: 1,
    semanticLabel: 'strongest',
    canFocus: false,
  } as unknown as DriverItem
}

export interface MakeHeroDataOptions {
  recommendation?: Partial<DecisionResultData>
  options?: OptionResult[]
  topDriverLabel?: string | null
  completeness?: ResultCompleteness
  isLoading?: boolean
  isError?: boolean
}

export function makeHeroData(opts: MakeHeroDataOptions = {}): ResultsSectionDataReturn {
  const options = opts.options ?? [OPTION_A, OPTION_B]
  const recommendedOption = options.find((o) => o.isRecommended) ?? null

  const recommendation: DecisionResultData = {
    recommendedOption,
    allOptions: options,
    goalLabel: 'Team productivity',
    isSingleOption: options.length <= 1,
    analysisStatus: 'computed',
    outcomeUnit: 'count',
    goalThreshold: 62,
    isNormalised: false,
    storyHeadlines: {
      opt_b: 'Best placed once the goal and limits are both counted.',
    },
    flipThresholds: [
      {
        label: 'Team capacity',
        node_id: 'fac_capacity',
        current_value: 40,
        flip_value: 30,
        unit: '%',
        alternative_winner_label: 'Two developers',
      },
    ],
    ...opts.recommendation,
  }

  const driverLabel = opts.topDriverLabel === undefined ? 'Developer capacity' : opts.topDriverLabel
  const topDrivers = driverLabel ? [makeDriver(driverLabel)] : []
  const drivers: DriversSectionData = {
    drivers: topDrivers,
    topDrivers,
    driversStatus: 'computed',
    totalCount: topDrivers.length,
    hasMagnitudeData: topDrivers.length > 0,
  }

  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
  } as unknown as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  } as ImprovementsSectionData

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    goalLabel: 'Team productivity',
    completeness: opts.completeness ?? FULL_COMPLETENESS,
    autoNoiseProvenance: null,
  } as ResultsSectionDataReturn
}
