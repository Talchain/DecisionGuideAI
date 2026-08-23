/** ResultsBody live mount — semantic controls require GraphV3 authority. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  EvidenceGapItem,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

/** The one factor this spec is about, named once. */
const TARGET_NODE_ID = 'node_underinformed_factor'
const TARGET_LABEL = 'Ramp-up time'

/** The testid of the mount path under test — the cockpit host, by identity. */
const LIVE_MOUNT = 'hero-arm-triage-actions'

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

  /**
   * An evidence gap is what mints a triage card carrying the inline value
   * editor + "Confirm AI estimate" (`mapEvidenceGapsToActions` → `TriageCard`
   * → `InlineValueControls`). `targetNodeId` is the id the confirm handler
   * must receive.
   */
  const gap: EvidenceGapItem = {
    factorId: 'fac_ramp',
    factorLabel: TARGET_LABEL,
    confidence: 40,
    voi: 0.5,
    suggestion: 'This estimate is the AI’s, not yours.',
    targetNodeId: TARGET_NODE_ID,
  }

  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [gap],
    topEvidenceGaps: [gap],
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

interface Handlers {
  onConfirmFactor: ReturnType<typeof vi.fn>
  onSetFactorValue: ReturnType<typeof vi.fn>
}

function renderBody(props: { isStale?: boolean; isRunning?: boolean } = {}): Handlers {
  const onConfirmFactor = vi.fn()
  const onSetFactorValue = vi.fn()
  render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onConfirmFactor={onConfirmFactor}
      onSetFactorValue={onSetFactorValue}
      nodeValueLookup={{
        [TARGET_NODE_ID]: { value: 12, unit: 'weeks', cap: null },
      }}
      isStale={props.isStale}
      isRunning={props.isRunning}
    />,
  )
  return { onConfirmFactor, onSetFactorValue }
}

/**
 * The triage card for THIS factor, by identity, scoped to a named root so a
 * card mounted by any OTHER arm cannot satisfy the assertion.
 */
function targetCardWithin(root: HTMLElement): HTMLElement {
  const label = within(root).getByText(TARGET_LABEL)
  const card = label.closest('[data-testid^="unified-triage-"]') as HTMLElement | null
  expect(card, `no triage card found for "${TARGET_LABEL}"`).not.toBeNull()
  return card!
}

/** The live host, asserted to BE the mount path. */
function liveMount(): HTMLElement {
  return screen.getByTestId(LIVE_MOUNT)
}

describe('ResultsBody — local-only estimate actions stay off the live surface', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      draftCoaching: null,
    })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('keeps the factor card in the live mount but withholds both mutation controls', () => {
    renderBody()
    const card = targetCardWithin(liveMount())
    expect(card).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Confirm AI estimate' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('spinbutton', { name: `Value for ${TARGET_LABEL}` })).not.toBeInTheDocument()
  })

  it.each([
    ['stale', { isStale: true }],
    ['running', { isRunning: true }],
  ] as const)('%s posture cannot re-enable a control with no carrier', (_name, posture) => {
    renderBody(posture)
    const card = targetCardWithin(liveMount())
    expect(within(card).queryByRole('button', { name: 'Confirm AI estimate' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  /**
   * ⚠ I-C — THE MOUNT PATH, ASSERTED BY IDENTITY AND FOR SINGULARITY.
   *
   * Not "the affordance exists somewhere" but "it exists on the one host that
   * mounts, and NOT twice". A re-host REDs this rather than leaving a green
   * suite pointed at a component no deployment renders.
   */
  it('mount path — the cockpit remains singular and no legacy panel survives', () => {
    renderBody()
    expect(screen.getByTestId('analysis-hero-panel')).toBeInTheDocument()
    expect(liveMount()).toBeInTheDocument()
    expect(screen.queryByTestId('decision-confidence-panel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm AI estimate' })).not.toBeInTheDocument()
  })
})
