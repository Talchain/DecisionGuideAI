/**
 * ResultsBody — WhatChangedChip mount (seamlessness R6 / ROADMAP 2.1 slice 1). ⛔ SUPERSEDED by #2470: the chip
 * is no longer mounted here (see the describe below). The history is kept because it explains the fixtures.
 *
 * The run-delta chip mounts in the analysis-tab header stack, after the
 * freshness notice slot and above the hero block. F2B (2026-07-22): its MOUNT
 * is decoupled from the local run count — it renders whenever THIS analysis
 * surface (ResultsBody) renders, even with an EMPTY run history (the live
 * finding: a real guest session's runHistory stays empty after completed
 * analyses). It STAYS mounted and actionable because its CEE send fires
 * unconditionally (the SERVER owns comparison honesty — its gate answers
 * insufficient_runs / stale / unconfirmed / incomparable; see
 * WhatChangedChip.sendUnconditional.spec.tsx). Only the canvas pulse/highlight
 * extras are gated on local-diff availability. Fixture pattern mirrors
 * ResultsBody.heroPlacement.spec.tsx.
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
    isFocusNowPanelEnabled: vi.fn(() => true),
    isAiPanelV2Enabled: vi.fn(() => true),
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

beforeEach(() => {
  loadRunsMock.mockReset()
  pulseMock.mockReset()
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
})

/**
 * ⛔ REMOVED BY DESIGN (#2470, 4 Oct 2026): the chat-only "What changed since the last run?" chip stuck on
 * "Thinking", and Compare is the run-change surface. The four rows that pinned its mount went red on staging and
 * stayed red, because DGAI PR CI runs no test shards. They now pin the removal across the same four run-history
 * states, each with the hero as a contrast so "absent" cannot pass on a body that rendered nothing.
 */
describe('ResultsBody — the What-changed chip is not mounted (Compare is the run-change surface, #2470)', () => {
  const same = [nodeFx('a', 'A')]
  it.each([
    ['the last two runs differ', () => [runFx([nodeFx('a', 'A'), nodeFx('b', 'B')], 1), runFx([nodeFx('a', 'A')], 2)]],
    ['runHistory is empty', () => []],
    ['one stored run', () => [runFx([nodeFx('a', 'A')], 1)]],
    ['nothing changed between runs', () => [runFx(same, 1), runFx(same, 2)]],
  ])('no chip when %s, while the analysis surface renders', (_state, runs) => {
    loadRunsMock.mockReturnValue(runs())
    renderBody()
    expect(screen.getByTestId('analysis-hero-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('what-changed-chip')).not.toBeInTheDocument()
    expect(screen.queryByText(/what changed since the last analysis run\?/i)).not.toBeInTheDocument()
  })
})
