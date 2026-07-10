/**
 * ResultsBody — WhatChangedChip mount (seamlessness R6 / ROADMAP 2.1 slice 1).
 *
 * The run-delta chip mounts in the analysis-tab header stack, after the
 * freshness notice slot and above the hero block. It self-hides (<2 stored
 * runs or zero delta), so mounting it must be a no-op for first runs.
 * Fixture pattern mirrors ResultsBody.heroPlacement.spec.tsx.
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
}))

const { loadRunsMock, pulseMock } = vi.hoisted(() => ({
  loadRunsMock: vi.fn(),
  pulseMock: vi.fn(),
}))
vi.mock('../../../canvas/store/runHistory', () => ({ loadRuns: loadRunsMock }))
vi.mock('../../../canvas/utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
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
  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner],
    goalLabel: 'Maximise success',
    goalThreshold: 0.6,
    isSingleOption: true,
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

const nodeFx = (id: string, label: string) =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label } }) as any

const runFx = (nodes: any[], seq: number) => ({ id: `run-${seq}`, ts: 100 - seq, graph: { nodes, edges: [] } })

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

beforeEach(() => {
  loadRunsMock.mockReset()
  pulseMock.mockReset()
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
})

describe('ResultsBody — WhatChangedChip mount (R6)', () => {
  it('mounts the chip in the header stack when the last two runs differ', () => {
    loadRunsMock.mockReturnValue([
      runFx([nodeFx('a', 'A'), nodeFx('b', 'B')], 1), // latest
      runFx([nodeFx('a', 'A')], 2), // previous
    ])
    renderBody()
    const chip = screen.getByTestId('what-changed-chip')
    const existingHero = screen.getByTestId('decision-confidence-panel')
    expect(before(chip, existingHero), 'chip must precede the hero block').toBe(true)
  })

  it('renders no chip on a first run (fewer than 2 stored runs)', () => {
    loadRunsMock.mockReturnValue([runFx([nodeFx('a', 'A')], 1)])
    renderBody()
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
  })

  it('renders no chip when nothing changed between runs', () => {
    const same = [nodeFx('a', 'A')]
    loadRunsMock.mockReturnValue([runFx(same, 1), runFx(same, 2)])
    renderBody()
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
  })
})
