/**
 * ResultsBody — V7 Lane L3: assessment-mode scaffold.
 *
 * Paul's ruling (V6-RESPEC-2026-07-23 §1): the Analysis panel renders in TWO
 * stacked groups for the assessment window — a V7 (new) top group above a
 * "Current view" divider, with today's shipped components re-parented UNCHANGED
 * beneath it. L3 is re-parenting + a divider only: no component deleted, no
 * logic changed, no flag.
 *
 * These pins lock the additive shape:
 *   (a) render-parity — every pushed-down component still mounts exactly ONCE,
 *       and BELOW the "Current view" divider;
 *   (b) the divider renders;
 *   (c) count-pin — no current component is lost in the re-parent;
 *   (d) the empty V7 top group mounts ABOVE the divider (the L4–L6 slot).
 *
 * RED-first: with the scaffold absent the divider/group testids do not exist,
 * so every pin below fails until the scaffold lands.
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

// The current (pushed-down) components' stable anchors — each must survive the
// re-parent, render exactly once, and sit BELOW the "Current view" divider.
const PUSHED_DOWN_ANCHORS = [
  'decision-confidence-panel', // #3 hero (DecisionConfidencePanel, flag-off)
  'focus-now-panel', // Strengthen / Focus panel
  'section-header-options', // #2 options section (WinGauge + RiskAppetiteFilter + OptionCards)
  'option-cards',
  'accordion-drivers', // #7 DriversSection
  'accordion-stress-test', // #8 StressTestSection
  'accordion-advanced', // #12 AdvancedSection (KEEP, single instance)
] as const

describe('ResultsBody — V7 L3 assessment-mode scaffold', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('(b) renders the "Current view" divider', () => {
    renderBody()
    const divider = screen.getByTestId('assessment-current-view-divider')
    expect(divider).toBeInTheDocument()
    expect(divider).toHaveTextContent('Current view')
  })

  it('(d) mounts the empty V7 top group ABOVE the divider', () => {
    renderBody()
    const topGroup = screen.getByTestId('v7-top-group')
    const divider = screen.getByTestId('assessment-current-view-divider')
    expect(topGroup).toBeInTheDocument()
    expect(before(topGroup, divider), 'V7 top group precedes the divider').toBe(true)
  })

  it('(a) every pushed-down component renders exactly ONCE and BELOW the divider', () => {
    renderBody()
    const divider = screen.getByTestId('assessment-current-view-divider')
    for (const anchor of PUSHED_DOWN_ANCHORS) {
      const matches = screen.getAllByTestId(anchor)
      expect(matches, `${anchor} renders exactly once`).toHaveLength(1)
      expect(before(divider, matches[0]), `${anchor} sits below the divider`).toBe(true)
    }
  })

  it('(c) count-pin: the current components are all present (nothing lost in the re-parent)', () => {
    renderBody()
    for (const anchor of PUSHED_DOWN_ANCHORS) {
      expect(screen.queryByTestId(anchor), `${anchor} present`).toBeInTheDocument()
    }
  })

  it('re-parented components keep their existing document order (byte-identical composition)', () => {
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
