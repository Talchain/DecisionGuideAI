/**
 * Brief 5.8A D2 — single bias filter integration test.
 *
 * Asserts the rendered DOM consequences of `hasResolvableBiasTarget` applied
 * to both LLM-sourced bias paths (CEE bias_findings via target_factor_id and
 * coaching bias_signals via target). Closes the live gap where coaching
 * bias_signals could render without any target check.
 *
 * DOM-leakage assertions on `container.innerHTML` confirm no internal id
 * prefixes (`fac_`, `opt_`, `node_`) and no raw target fixture values escape
 * into the rendered output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'

vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

let mockNodes: any[] = []
let mockEdges: any[] = []
let mockCeeAnalysisReady: any = null
let mockDraftCoaching: any = null

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        ceeAnalysisReady: mockCeeAnalysisReady,
        draftCoaching: mockDraftCoaching,
        lastDraftError: null,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        selectNodeWithoutHistory: vi.fn(),
        selectEdgeWithoutHistory: vi.fn(),
        nodes: mockNodes,
        edges: mockEdges,
        preAnalysisSensitivity: undefined,
        repairsApplied: null,
        results: null,
        setShowDraftChat: vi.fn(),
        updateEdgeData: vi.fn(),
      }
      return selector(state)
    },
    {
      getState: () => ({
        ceeAnalysisReady: mockCeeAnalysisReady,
        draftCoaching: mockDraftCoaching,
        nodes: mockNodes,
        edges: mockEdges,
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
}))

vi.mock('../../../stores/draftStore', () => ({
  useDraftStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        lastDraftError: null,
        lastDraftDescription: '',
        selectedGenerationModel: null,
        selectedRepairModel: null,
        selectedEnrichmentModel: null,
        isGenerating: false,
        fullDraftAppliedAt: null,
      }
      return selector(state)
    },
    {
      getState: () => ({
        lastDraftError: null,
        lastDraftDescription: '',
        selectedGenerationModel: null,
        selectedRepairModel: null,
        selectedEnrichmentModel: null,
        isGenerating: false,
        fullDraftAppliedAt: null,
        setLastDraftError: vi.fn(),
        setLastDraftDescription: vi.fn(),
        setIsGenerating: vi.fn(),
        setFullDraftAppliedAt: vi.fn(),
        setSelectedGenerationModel: vi.fn(),
        setSelectedRepairModel: vi.fn(),
        setSelectedEnrichmentModel: vi.fn(),
        resetModelToDefault: vi.fn(),
        resetAllModels: vi.fn(),
        resetDraft: vi.fn(),
      }),
    },
  ),
}))

vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({ retryDraft: vi.fn(), canRetry: true, isRetrying: false, retryError: null }),
}))
vi.mock('../../../hooks/usePreRunValidation', () => ({
  SOFT_BYPASS_STATUSES: new Set(['needs_user_mapping', 'needs_encoding']),
}))
vi.mock('../../../ToastContext', () => ({
  useShowToast: () => vi.fn(),
}))
vi.mock('../../../../utils/clipboard', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(true),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

const baseData = (): PreAnalysisData => ({
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
})

beforeEach(() => {
  vi.clearAllMocks()
  mockNodes = []
  mockEdges = []
  mockCeeAnalysisReady = null
  mockDraftCoaching = null
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null })
})

afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null })
})

describe('reasoning observation reaches the editable discussion draft', () => {
  it.each([
    ['CEE finding', 'confirmation_bias', 'Confirmation bias'],
    ['CEE finding', 'uncategorised_producer_check', null],
    ['CEE finding', 'fac_mistaken_type', null],
    ['draft coaching', 'confirmation_bias', 'Confirmation bias'],
    ['draft coaching', 'uncategorised_producer_check', null],
    ['draft coaching', 'omission / status-quo bias', null],
    ['draft coaching', 'fac_mistaken_type', null],
  ] as const)('preserves %s context for %s through both mounted controls', (carrier, code, expectedRiskLabel) => {
    const observation = 'The current estimate uses only favourable interviews. '.repeat(7)
      + 'The missing interviews concern customers who chose the alternative.'
    const technique = 'Seek one interview that could challenge the estimate.'
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    if (carrier === 'CEE finding') {
      mockCeeAnalysisReady = {
        goal_node_id: 'g1', options: [],
        bias_findings: [{
          id: 'context-check', code, severity: 'medium', explanation: observation,
          target_factor_id: 'fac-velocity',
          micro_intervention: { steps: [{ text: technique }] },
        }],
      }
    } else {
      mockDraftCoaching = {
        summary: null, strengthenItems: [], wideningLog: [],
        biasSignals: [{ type: code, detail: observation, target: 'fac-velocity' }],
      }
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())
    const prefill = vi.fn()
    const send = vi.fn()
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: dispatch })
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    // Use the real producer/normaliser, two production construction sites,
    // DiscussWithAiButton, prompt builder and requestAsk. The receivers are
    // spies: this proves the editable draft, not provider or browser quality.
    for (const surface of ['t1-bias-nudge-0', 'sharpen-bias-0']) {
      prefill.mockClear()
      const card = screen.getByTestId(surface)
      fireEvent.click(within(card).getByTestId('discuss-with-ai'))
      expect(prefill).toHaveBeenCalledTimes(1)
      const prompt = prefill.mock.calls[0][0] as string
      expect(prompt).toContain(JSON.stringify(observation))
      expect(prompt).toContain('Related model item: "Engineering velocity".')
      expect(prompt).not.toContain('fac-velocity')
      expect(prompt).not.toMatch(/I.m noticing|my thinking|I have .*bias/i)
      if (expectedRiskLabel) expect(prompt).toContain(`Possible reasoning risk: ${expectedRiskLabel}.`)
      else expect(prompt).not.toContain('Possible reasoning risk:')
      expect(prompt).not.toContain('fac_mistaken_type')
      if (carrier === 'CEE finding') expect(prompt).toContain(technique)
      else expect(prompt).not.toContain('Suggested technique:')
      expect(send).not.toHaveBeenCalled()
      expect(dispatch).not.toHaveBeenCalled()
    }
  })

  it('keeps two unfamiliar observations distinct when their headings are the same', () => {
    const cases = [
      { type: 'anchoring_maybe', detail: 'Check which interviews support the capacity estimate.', target: 'fac-velocity', label: 'Engineering velocity' },
      { type: 'alternative_not_considered', detail: 'Consider the cheaper delivery route before committing.', target: 'fac-cost', label: 'Delivery cost' },
    ]
    mockNodes = cases.map(item => ({ id: item.target, type: 'factor', position: { x: 0, y: 0 }, data: { label: item.label } }))
    mockDraftCoaching = {
      summary: null, strengthenItems: [], wideningLog: [],
      biasSignals: cases.map(({ type, detail, target }) => ({ type, detail, target })),
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())
    const prefill = vi.fn()
    const send = vi.fn()
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: dispatch })
    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    for (const [index, item] of cases.entries()) {
      for (const surface of ['t1-bias-nudge', 'sharpen-bias']) {
        prefill.mockClear()
        fireEvent.click(within(screen.getByTestId(`${surface}-${index}`)).getByTestId('discuss-with-ai'))
        expect(prefill).toHaveBeenCalledTimes(1)
        const prompt = prefill.mock.calls[0][0] as string
        expect(prompt).toContain(JSON.stringify(item.detail))
        expect(prompt).toContain(JSON.stringify(item.label))
        expect(prompt).not.toContain(cases[1 - index].detail)
        expect(prompt).not.toContain('Possible reasoning risk:')
        expect(prompt).not.toContain(item.type)
      }
    }
    expect(send).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('Brief 5.8A D2 — bias_signals (coaching) target filter', () => {
  it('drops a coaching bias_signal whose target is an empty string', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored on initial estimate.', target: '' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/Anchored on initial estimate/)
    expect(container.innerHTML).not.toMatch(/Anchoring/)
  })

  it('keeps a coaching bias_signal whose target resolves to a current node', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored on initial estimate.', target: 'fac-velocity' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    // The bias text appears in both the T1 nudge row and the SharpenYourThinking
    // preview/card. Asserting the row presence is sufficient for the filter test.
    const t1Card = screen.getByTestId('t1-decision-readiness-card')
    expect(within(t1Card).getAllByTestId(/^t1-bias-nudge-/)).toHaveLength(1)
  })

  it('drops a coaching bias_signal whose target does not resolve to any current node', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored on initial estimate.', target: 'fac-unknown-id' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/Anchored on initial estimate/)
  })

  it('drops a coaching bias_signal whose target is undefined', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored on initial estimate.' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/Anchored on initial estimate/)
  })
})

describe('Brief 5.8A D2 — bias_findings (CEE) target filter', () => {
  it('keeps a finding whose target_factor_id resolves to a current node', () => {
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

    // bias text appears in both the T1 nudge and the SharpenYourThinking
    // accordion; assert presence inside the T1 card to scope cleanly.
    const t1Card = screen.getByTestId('t1-decision-readiness-card')
    const nudges = within(t1Card).getAllByTestId(/^t1-bias-nudge-/)
    expect(nudges).toHaveLength(1)
    expect(nudges[0].textContent).toContain('Pattern of agreeable estimates')
  })

  it('drops a finding whose target_factor_id is missing (deliberate D2 tightening)', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'bf2',
          code: 'CONFIRMATION_BIAS',
          severity: 'medium',
          explanation: 'Pattern of agreeable estimates.',
        },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    expect(container.innerHTML).not.toMatch(/Pattern of agreeable estimates/)
  })
})

describe('Brief 5.8A D2 — DOM leakage assertions', () => {
  it('does not leak any internal id prefixes or raw target fixture values into the rendered output', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'bf-keep',
          code: 'CONFIRMATION_BIAS',
          severity: 'medium',
          explanation: 'Confirmed pattern detail.',
          target_factor_id: 'fac-velocity',
        },
      ],
    }
    mockDraftCoaching = {
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Anchored signal detail.', target: 'fac-velocity' },
        { type: 'framing', detail: 'Filtered fixture.', target: 'fac_unknown' },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    const { container } = render(<PreAnalysisPanel onAnalyse={vi.fn()} />)
    const html = container.innerHTML

    // No raw target fixture id leaks (those are the fixture ids supplied above).
    expect(html).not.toMatch(/fac-velocity/)
    expect(html).not.toMatch(/fac_unknown/)

    // No internal id prefixes appear anywhere.
    expect(html).not.toMatch(/\bfac_/)
    expect(html).not.toMatch(/\bopt_/)
    expect(html).not.toMatch(/\bnode_/)

    // The filtered signal's detail must not appear; the kept ones should.
    expect(html).not.toMatch(/Filtered fixture/)
    expect(html).toMatch(/Confirmed pattern detail/)
  })
})
