/**
 * ResultsBody — P4's "Confirm AI estimate" MUST RENDER ON THE LIVE ANALYSIS
 * SURFACE (ROADMAP 2.661; the corrected premise of 2.651).
 *
 * ## The defect this file exists to prevent, stated bluntly
 *
 * `ResultsBody` used to mount BOTH triage-carrying surfaces — `AnalysisHeroV17`
 * and `DecisionConfidencePanel` — inside a flag arm no deployment rendered, so
 * on the posture real users loaded the confirm/set-value affordance did not
 * exist at all. A user could not confirm an AI estimate after an analysis.
 * That fork is now closed: the cockpit mounts unconditionally and hosts the
 * affordance, and these tests bind to that one host.
 *
 * ## Identity binding (CLAUDE.md trap 19)
 *
 * Every assertion binds to ONE named factor by its `targetNodeId`, and the
 * handler-argument checks pin that identity a second time at the call: only
 * this card can produce this id. Nothing here finds "the first confirm
 * button" or "a card with an editor".
 *
 * ⚠ SCOPE (CLAUDE.md trap 3): DOM-presence and handler-call assertions only.
 * jsdom cannot prove visibility, layout, or that anything is above the fold.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
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

describe('ResultsBody — "Confirm AI estimate" on the live analysis surface (2.661)', () => {
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

  /**
   * ⭐ I-A, THE ROW'S CAPABILITY CLAIM. RED at pristine: on the posture real
   * staging users loaded, the button did not exist.
   */
  it('the affordance RENDERS, inside the live mount path', () => {
    renderBody()
    expect(
      within(targetCardWithin(liveMount())).getByRole('button', {
        name: 'Confirm AI estimate',
      }),
    ).toBeInTheDocument()
  })

  /**
   * I-A, second half: it does not merely DRAW — the confirmation LANDS, with
   * the same argument the default-posture control asserts. A button that
   * renders but reports nothing satisfies presence and still fails the user.
   */
  it('the confirmation LANDS with this factor’s id', () => {
    const { onConfirmFactor } = renderBody()
    fireEvent.click(
      within(targetCardWithin(liveMount())).getByRole('button', {
        name: 'Confirm AI estimate',
      }),
    )
    expect(onConfirmFactor).toHaveBeenCalledTimes(1)
    expect(onConfirmFactor).toHaveBeenCalledWith(TARGET_NODE_ID)
  })

  /** I-A: the set-value control is the other half of P4 and must also land. */
  it('the inline value editor commits an override for this factor', () => {
    const { onSetFactorValue } = renderBody()
    const card = targetCardWithin(liveMount())
    const input = within(card).getByRole('spinbutton', { name: `Value for ${TARGET_LABEL}` })
    fireEvent.change(input, { target: { value: '20' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Edit value' }))
    expect(onSetFactorValue).toHaveBeenCalledWith(TARGET_NODE_ID, 20)
  })

  /**
   * ⭐ I-B, limb 1 — the run gate #609 shipped still applies on this surface.
   * The new host must inherit the gating, not route around it.
   */
  it('while a run is IN FLIGHT the affordance stays suppressed', () => {
    renderBody({ isRunning: true })
    const card = targetCardWithin(liveMount())
    expect(
      within(card).queryByRole('button', { name: 'Confirm AI estimate' }),
    ).not.toBeInTheDocument()
    expect(
      within(card).queryByRole('spinbutton', { name: `Value for ${TARGET_LABEL}` }),
    ).not.toBeInTheDocument()
  })

  /**
   * ⭐ I-B, limb 2 — staleness must NEVER suppress (Paul's Ruling 3, the lock
   * #609 retired). This is the limb that would silently come back if someone
   * re-derived `suppressMutations` on the new host.
   */
  it('STALE results still offer the affordance, and it lands', () => {
    const { onConfirmFactor } = renderBody({ isStale: true })
    fireEvent.click(
      within(targetCardWithin(liveMount())).getByRole('button', {
        name: 'Confirm AI estimate',
      }),
    )
    expect(onConfirmFactor).toHaveBeenCalledWith(TARGET_NODE_ID)
  })

  /**
   * ⚠ I-C — THE MOUNT PATH, ASSERTED BY IDENTITY AND FOR SINGULARITY.
   *
   * Not "the affordance exists somewhere" but "it exists on the one host that
   * mounts, and NOT twice". A re-host REDs this rather than leaving a green
   * suite pointed at a component no deployment renders.
   */
  it('mount path — the cockpit host carries the affordance exactly once, and no legacy panel survives', () => {
    renderBody()
    expect(screen.getByTestId('analysis-hero-panel')).toBeInTheDocument()
    expect(liveMount()).toBeInTheDocument()
    expect(screen.queryByTestId('decision-confidence-panel')).not.toBeInTheDocument()
    // Exactly one confirm affordance for this factor — the cockpit must not
    // double-render what the deleted legacy arm used to own.
    expect(screen.getAllByRole('button', { name: 'Confirm AI estimate' })).toHaveLength(1)
  })
})
