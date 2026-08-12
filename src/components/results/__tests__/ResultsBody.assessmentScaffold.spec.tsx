/**
 * ResultsBody — the live surfaces survive the V7 scaffold's retirement,
 * exactly once and in their original order.
 *
 * HISTORY: until 12 Aug 2026 this file pinned the V7 L3 assessment-mode
 * scaffold (Paul's V6-RESPEC-2026-07-23 §1 ruling: a V7 top group ABOVE a
 * "Current view" divider, with today's components re-parented beneath — so
 * Paul could assess the two renderings in one scroll). Paul then ruled the
 * duplication off the working tab: the V7 group MOVED, unchanged, to the
 * temporary "Alt view" dock tab (`v7/V7ComparisonTabBody`). The scaffold's
 * absence from THIS tab is pinned in `ResultsBody.v7Retired.spec.tsx`; the
 * new home's presence in `v7/__tests__/V7ComparisonTabBody.spec.tsx`.
 *
 * What SURVIVES here is this file's other half — the "nothing lost" pins:
 *   (a) every live component still renders exactly ONCE (the retirement
 *       removed the duplicate rendering, not a component);
 *   (b) the live components keep their existing document order (everything
 *       below the old divider renders byte-identically — the wrapper
 *       `assessment-current-view-group` is deliberately retained for that).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    isStrengthenPanelEnabled: vi.fn(() => false),
    isAiPanelV2Enabled: vi.fn(() => true),
    isAnalysisHeroPanelEnabled: vi.fn(() => false),
  }
})

import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

function makeData(): ResultsSectionDataReturn {
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
    goalProbability: 0.7,
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
    goalProbability: 0.3,
  } as unknown as OptionResult
  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    goalThreshold: 0.6,
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

function renderBody() {
  return render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )
}

const before = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

// The live components' stable anchors — each must survive the scaffold's
// retirement, render exactly once, in the original order.
const LIVE_ANCHORS = [
  'decision-confidence-panel', // #3 hero (DecisionConfidencePanel, flag-off)
  'focus-now-panel', // Strengthen / Focus panel
  'section-header-options', // #2 options section (WinGauge + RiskAppetiteFilter + OptionCards)
  'option-cards',
  'accordion-drivers', // #7 DriversSection
  'accordion-stress-test', // #8 StressTestSection
  'accordion-advanced', // #12 AdvancedSection (KEEP, single instance)
] as const

describe('ResultsBody — live surfaces after the V7 scaffold retirement', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('(a) every live component renders exactly ONCE — the duplication is gone, the components are not', () => {
    renderBody()
    for (const anchor of LIVE_ANCHORS) {
      expect(screen.getAllByTestId(anchor), `${anchor} renders exactly once`).toHaveLength(1)
    }
  })

  it('(b) the live components keep their existing document order (byte-identical composition)', () => {
    renderBody()
    const hero = screen.getByTestId('decision-confidence-panel')
    const focus = screen.getByTestId('focus-now-panel')
    const options = screen.getByTestId('section-header-options')
    const drivers = screen.getByTestId('accordion-drivers')
    const advanced = screen.getByTestId('accordion-advanced')
    expect(before(hero, focus)).toBe(true)
    expect(before(focus, options)).toBe(true)
    expect(before(options, drivers)).toBe(true)
    expect(before(drivers, advanced)).toBe(true)
  })
})
