/**
 * Bias-surface liveness gate — the UI surface leg of the deletion-resistance
 * gate (bias-coaching proposal 2026-07-16 §4.3).
 *
 * DERIVE-DON'T-MIRROR (rule-12). The expected-surface set is the design record:
 * amendment §1.5 names EXACTLY THREE bias-coaching surfaces, one per journey
 * beat, and this file carries one case per named surface, each bound to its
 * §1.5 clause below. The estate vanished three ways before — an undisclosed
 * code removal (the 30-Mar node-icon strip, `7259d089`, shipped under a "reuse
 * unchanged" commit message), a prompt that never asked, and a redesign that
 * did not name the feature. This gate makes the FIRST class RED regardless of
 * the commit message: unmount a named surface, or drop its bias feeder, and a
 * case here goes RED.
 *
 *   §1.5(1) FRAME        — pre-analysis panel bias cards (deterministic engine
 *                          + draft `bias_signals`); mounted as PreAnalysisPanel.
 *   §1.5(2) EXPLORE      — canvas node icons (the single useScienceIcons /
 *                          ScienceIcon system, max 2/node), with the popover +
 *                          "discuss with AI" affordance.
 *   §1.5(3) REALITY-TEST — decision_review bias cards (the primary LLM bias
 *                          surface); mounted as V7BiasSection.
 *
 * WHAT THIS GATE DOES NOT COVER (named in the PR body, CEE-owned): the §4
 * positive-control fixture, the wire leg (CEE `analysis_ready` / decision_review
 * emit non-empty bias findings), and the behavioural prompt leg. A UI test
 * cannot see PMS-served prompt content, so those legs live in CEE.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, screen, within, fireEvent, cleanup } from '@testing-library/react'

// ── One mocked canvas store serves all three surfaces (module id is shared, so
//    every importer — PreAnalysisPanel, useScienceIcons, useNodeDisplayMetadata,
//    V7BiasSection — resolves to this mock). Mutable vars drive per-case state.
let mockNodes: any[] = []
let mockEdges: any[] = []
let mockCeeAnalysisReady: any = null
let mockDraftCoaching: any = null
let mockRunMeta: any = null

vi.mock('../../../store', () => {
  const makeState = () => ({
    ceeAnalysisReady: mockCeeAnalysisReady,
    draftCoaching: mockDraftCoaching,
    runMeta: mockRunMeta,
    nodes: mockNodes,
    edges: mockEdges,
    // useNodeDisplayMetadata reads results.status/report — never null here.
    results: { status: 'idle', report: null },
    lastDraftError: null,
    preAnalysisSensitivity: undefined,
    repairsApplied: null,
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    selectNodeWithoutHistory: vi.fn(),
    selectEdgeWithoutHistory: vi.fn(),
    setShowDraftChat: vi.fn(),
    updateEdgeData: vi.fn(),
  })
  return {
    useCanvasStore: Object.assign(
      (selector: (state: any) => any) => selector(makeState()),
      {
        getState: () => ({
          ...makeState(),
          updateNode: vi.fn(),
          setGoalThreshold: vi.fn(),
          setGoalThresholdAndUpdateNode: vi.fn(),
          setCeeAnalysisReady: vi.fn(),
          setOutcomeNode: vi.fn(),
          addNode: vi.fn(),
          updateEdge: vi.fn(),
          addEdge: vi.fn(),
        }),
      },
    ),
  }
})

// Non-store dependencies of PreAnalysisPanel (mirrors the proven biasTriggerFilter
// harness — these need providers or throw otherwise).
vi.mock('../hooks/usePreAnalysisData', () => ({ usePreAnalysisData: vi.fn() }))
vi.mock('../../../stores/draftStore', () => ({
  useDraftStore: Object.assign(
    (selector: (state: any) => any) =>
      selector({
        lastDraftError: null,
        lastDraftDescription: '',
        selectedGenerationModel: null,
        selectedRepairModel: null,
        selectedEnrichmentModel: null,
        isGenerating: false,
        fullDraftAppliedAt: null,
      }),
    { getState: () => ({ lastDraftError: null, isGenerating: false, setLastDraftError: vi.fn() }) },
  ),
}))
vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({ retryDraft: vi.fn(), canRetry: true, isRetrying: false, retryError: null }),
}))
vi.mock('../../../hooks/usePreRunValidation', () => ({
  SOFT_BYPASS_STATUSES: new Set(['needs_user_mapping', 'needs_encoding']),
}))
vi.mock('../../../ToastContext', () => ({ useShowToast: () => vi.fn() }))
vi.mock('../../../../utils/clipboard', () => ({ copyTextToClipboard: vi.fn().mockResolvedValue(true) }))

import { PreAnalysisPanel } from '../PreAnalysisPanel'
import { V7BiasSection } from '../../../../components/results/v7/V7BiasSection'
import { ScienceIcon } from '../../../nodes/shared/ScienceIcon'
import { useScienceIcons } from '../../../hooks/useScienceIcons'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

const baseData = (): PreAnalysisData =>
  ({
    improvementsByCategory: { fix: [], verify: [], add_evidence: [], strengthen: [] },
    tiers: {
      mustAddress: { items: [], count: 0 },
      reviewAssumptions: { items: [], count: 0 },
      optional: { items: [], count: 0 },
    },
    totalImprovements: 0,
    topActions: [],
    evidenceQuality: { level: 'medium', ratio: 0.5, nonAiCount: 2, totalCount: 4 },
    isReady: true,
    hasBlockers: false,
    blockerCount: 0,
    nodesByKind: {
      goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
      decision: [],
      option: [
        { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
      ],
      factor: [],
      risk: [],
      outcome: [],
    },
    edgeCount: 2,
    goalNode: { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
    successThreshold: null,
    isThresholdAutoDerived: false,
    isThresholdConfirmed: false,
    thresholdProvenance: null,
    isLoading: false,
    reviewedFactorsCount: 0,
    totalReviewableFactorsCount: 0,
    enrichedBlockers: [],
    informationalBlockers: [],
    modelAdjustments: [],
    preMortem: null,
    goalThresholdRaw: null,
    goalThresholdUnit: null,
    isGoalConfirmed: false,
    optionPreviews: [],
    qualityChecks: [],
    repairActions: [],
    ceeQuality: null,
    hasDefaultStrengths: false,
    defaultStrengthPercent: 0,
    contestedEdges: [],
    coachingSummary: null,
    thresholdSourceBadge: null,
    assumptionsLedger: null,
    triageActions: { top3: [], quickFix: [] },
  }) as unknown as PreAnalysisData

beforeEach(() => {
  vi.clearAllMocks()
  mockNodes = []
  mockEdges = []
  mockCeeAnalysisReady = null
  mockDraftCoaching = null
  mockRunMeta = null
  useGuidanceStore.setState({ _sendMessage: null })
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _sendMessage: null })
})

describe('bias-surface liveness gate (§4.3 UI surface leg)', () => {
  // ── §1.5(1) FRAME — pre-analysis panel bias cards ────────────────────────
  it('§1.5(1) FRAME: a resolvable CEE bias finding renders a pre-analysis bias card', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'bf1',
          code: 'CONFIRMATION_BIAS',
          severity: 'medium',
          explanation: 'Pattern of agreeable estimates.',
          target_factor_id: 'fac-velocity',
        },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    const t1Card = screen.getByTestId('t1-decision-readiness-card')
    const nudges = within(t1Card).getAllByTestId(/^t1-bias-nudge-/)
    expect(nudges.length).toBeGreaterThanOrEqual(1)
    expect(nudges[0].textContent).toContain('Pattern of agreeable estimates')
  })

  // ── §1.5(2) EXPLORE — canvas node icons (useScienceIcons / ScienceIcon) ───
  it('§1.5(2) EXPLORE: a baseline option feeds a status-quo-bias node icon', () => {
    mockNodes = [
      { id: 'opt-1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Do nothing', is_baseline: true } },
    ]
    const { result } = renderHook(() => useScienceIcons('opt-1', 'option'))
    // Feeder alive: the deterministic system still emits the status-quo bias
    // trigger for a baseline option. Drop the trigger → this goes RED.
    expect(result.current.some((i) => i.id === 'status-quo-bias')).toBe(true)
  })

  it('§1.5(2) EXPLORE: the node-icon surface renders bias content + the discuss-with-AI turn', () => {
    mockNodes = [
      { id: 'opt-1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Do nothing', is_baseline: true } },
    ]
    const { result } = renderHook(() => useScienceIcons('opt-1', 'option'))
    const bias = result.current.find((i) => i.id === 'status-quo-bias')!
    expect(bias).toBeTruthy()

    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    render(
      <ScienceIcon icon={bias.icon} tooltip={bias.tooltip} action={bias.action} colour={bias.colour} />,
    )

    // Surface alive: the icon opens a popover with the explicit AI affordance,
    // and the affordance forwards the trigger's action. Unmount the popover or
    // its discuss button → this goes RED.
    fireEvent.click(screen.getByLabelText(bias.tooltip))
    const discuss = screen.getByTestId('science-icon-discuss')
    expect(discuss.textContent).toMatch(/discuss with ai/i)
    fireEvent.click(discuss)
    expect(send).toHaveBeenCalledWith(bias.action)
  })

  // ── §1.5(3) REALITY-TEST — decision_review bias cards (V7BiasSection) ─────
  it('§1.5(3) REALITY-TEST: a decision_review bias finding renders a bias card', () => {
    mockRunMeta = {
      ceeReviewV1: {
        bias_findings: [
          {
            id: 'rev-bias-1',
            type: 'SUNK_COST',
            description: 'Past spend is shaping the preference more than the outcome does.',
            micro_intervention: {
              steps: ['List the choice ignoring money already spent.'],
              estimated_minutes: 5,
            },
          },
        ],
      },
    }

    render(<V7BiasSection />)

    expect(screen.getByTestId('v7-bias-section')).toBeTruthy()
    const card = screen.getByTestId('v7-bias-card')
    expect(card.textContent).toContain('Past spend is shaping the preference')
    expect(screen.getByTestId('v7-bias-kind').textContent).toMatch(/sunk cost/i)
  })

  // ── Honest absence: no bias content on any surface renders nothing ────────
  it('REALITY-TEST honest absence: no findings → the section renders nothing', () => {
    mockRunMeta = { ceeReviewV1: { bias_findings: [] } }
    const { container } = render(<V7BiasSection />)
    expect(container.querySelector('[data-testid="v7-bias-section"]')).toBeNull()
  })
})
