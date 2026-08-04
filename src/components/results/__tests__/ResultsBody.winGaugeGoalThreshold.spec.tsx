/**
 * L65 — the MOUNT SITE carries the target signal to WinGauge.
 *
 * `winGauge.targetSetNotScored.spec.tsx` pins the component's discrimination
 * by mounting WinGauge directly — which proves nothing about ResultsBody.
 * Without this file, deleting the `goalThreshold` passthrough at the
 * ResultsBody call site would leave every test green while the shipped panel
 * regressed to the wrong invitation (the exact unwitnessed-seam class the
 * mutation discipline exists to catch). Harness mirrors
 * `ResultsBody.heroPlacement.spec.tsx` (local fixtures; no analysis-hero
 * imports — its inertness guard allow-lists ResultsBody as sole importer).
 *
 * Identity binding (trap 19): exact testids, never value predicates.
 * jsdom scope (trap 3): presence/absence only, no layout claims.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
    isFocusNowPanelEnabled: vi.fn(() => true),
    isAiPanelV2Enabled: vi.fn(() => true),
    isAnalysisHeroPanelEnabled: vi.fn(() => false),
  }
})

/**
 * Two options, NO goal probabilities anywhere (basis 'none' on every option,
 * nothing withheld) — the post-#308 shape of a frame-broken run.
 */
function makeData(goalThreshold: number | null): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: 'Option A',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.7,
    goalProbability: null,
    goalFitWithheld: false,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: 'Option B',
    expected: 0.4,
    outcome: { mean: 0.4, p10: 0.2, p50: 0.38, p90: 0.6 },
    p10: 0.2,
    p50: 0.38,
    p90: 0.6,
    isRecommended: false,
    winProbability: 0.3,
    goalProbability: null,
    goalFitWithheld: false,
  } as unknown as OptionResult
  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    goalThreshold,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    isNormalised: false,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData
  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
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
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

function renderBody(goalThreshold: number | null) {
  return render(
    <ResultsBody
      resultsSectionData={makeData(goalThreshold)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )
}

describe('L65 / ResultsBody threads recommendation.goalThreshold into WinGauge', () => {
  it('target set + no goal numbers → the gauge shows the producer-gap sentence, not the invitation', () => {
    const { container } = renderBody(250000)
    expect(container.querySelector('[data-testid="win-gauge-goal-producer-gap"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-no-target"]')).toBeNull()
  })

  it('POSITIVE CONTROL: no target anywhere → the invitation, not the producer-gap sentence', () => {
    const { container } = renderBody(null)
    expect(container.querySelector('[data-testid="win-gauge-no-target"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-goal-producer-gap"]')).toBeNull()
  })
})
