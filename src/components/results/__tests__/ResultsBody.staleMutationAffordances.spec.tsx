/** ResultsBody posture cannot override the central mutation-authority gate. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

/**
 * The one factor this spec is about, named once. Every assertion below binds
 * to THIS id — never to "a card with an editor" or "the first confirm button"
 * (CLAUDE.md trap 19: an assertion must bind to its object by identity, never
 * by a predicate another object could satisfy). The handler-call assertions
 * check the argument, which is the strongest identity binding available: only
 * this card can produce this id.
 */
const TARGET_NODE_ID = 'node_underinformed_factor'
const TARGET_LABEL = 'Ramp-up time'

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
   * editor + "Confirm AI estimate" (`mapEvidenceGapsToActions` →
   * `TriageCard` → `InlineValueControls`). `targetNodeId` is the id the
   * confirm handler must receive.
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
 * The triage card for THIS factor, by identity — scoped to the triage queue
 * (the factor's label also appears in the v7 sharpen line, which carries no
 * affordance) and then narrowed to the enclosing card element. A second card
 * appearing later cannot satisfy these assertions by accident, and the
 * handler-argument checks pin the identity a second time at the call.
 */
function targetCard(): HTMLElement {
  const queue = screen.getByTestId('unified-triage-queue')
  const label = within(queue).getByText(TARGET_LABEL)
  const card = label.closest('[data-testid^="unified-triage-"]') as HTMLElement | null
  expect(card, `no triage card found for "${TARGET_LABEL}"`).not.toBeNull()
  return card!
}

describe('ResultsBody — posture cannot re-enable a mutation with no carrier', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      draftCoaching: null,
    })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it.each([
    ['current', { isStale: false, isRunning: false }],
    ['stale', { isStale: true, isRunning: false }],
    ['running', { isStale: false, isRunning: true }],
    ['stale and running', { isStale: true, isRunning: true }],
  ] as const)('%s results withhold confirm and inline value controls', (_name, posture) => {
    renderBody(posture)
    const card = targetCard()
    expect(card).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Confirm AI estimate' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('spinbutton', { name: `Value for ${TARGET_LABEL}` })).not.toBeInTheDocument()
  })

  /**
   * ⚠ TRAP 3b — THE MOUNT PATH ITSELF, ASSERTED BY IDENTITY.
   *
   * Asserted here so this file states its own scope as an executable fact
   * rather than a comment that can rot: everything above drives the ONE
   * analysis surface, and this test proves WHICH components that surface
   * mounts. Was a two-direction fork pair over the analysis-hero flag; the
   * fork is deleted, so both directions collapse into this one case and every
   * assertion the pair made about the live surface survives here.
   *
   * The affordance's behaviour on this surface is also owned by
   * `ResultsBody.confirmEstimateLiveMount.spec.tsx`, which drives the real
   * component tree — so the two files cannot drift into asserting opposite
   * things about the same surface.
   */
  it('mount path — the cockpit keeps one triage surface and no legacy panel survives', () => {
    renderBody({ isStale: false, isRunning: false })
    expect(screen.getByTestId('analysis-hero-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('decision-confidence-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('unified-triage-queue')).toBeInTheDocument()
    expect(screen.getByTestId('hero-arm-triage-actions')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm AI estimate' })).not.toBeInTheDocument()
  })
})
