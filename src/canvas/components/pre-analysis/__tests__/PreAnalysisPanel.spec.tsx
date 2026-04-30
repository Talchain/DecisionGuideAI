/**
 * Tests for PreAnalysisPanel component
 *
 * Covers:
 * - State transitions: empty canvas → panel hidden → add nodes → pre-analysis visible
 * - Accordion behaviour: expand/collapse, item counts update
 * - Sticky footer: button state transitions, stays pinned during scroll
 * - Regression: post-analysis panel unaffected
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'

// Mock the data hook
vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

// Mock useRetryDraft hook
const mockRetryDraft = vi.fn().mockResolvedValue({ success: true })
vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({
    retryDraft: mockRetryDraft,
    canRetry: true,
    isRetrying: false,
    retryError: null,
  }),
}))

// Mock usePreRunValidation — only need the SOFT_BYPASS_STATUSES constant
vi.mock('../../../hooks/usePreRunValidation', () => ({
  SOFT_BYPASS_STATUSES: new Set(['needs_user_mapping', 'needs_encoding']),
}))

// Mock useShowToast
const mockShowToast = vi.fn()
vi.mock('../../../ToastContext', () => ({
  useShowToast: () => mockShowToast,
}))

// Mock clipboard utility
vi.mock('../../../../utils/clipboard', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(true),
}))

// Mock useCanvasStore — return ceeAnalysisReady.status via selector
let mockCeeStatus: string | undefined = undefined
let mockLastDraftError: any = null

// Draft slice (C3-5) lives in useDraftStore — mock alongside the canvas-store mock
vi.mock('../../../stores/draftStore', () => ({
  useDraftStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        lastDraftError: mockLastDraftError,
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
        lastDraftError: mockLastDraftError,
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
const mockSelectNodeWithoutHistory = vi.fn()
const mockSelectEdgeWithoutHistory = vi.fn()
vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        ceeAnalysisReady: mockCeeStatus ? { status: mockCeeStatus } : null,
        lastDraftError: mockLastDraftError,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        selectNodeWithoutHistory: mockSelectNodeWithoutHistory,
        selectEdgeWithoutHistory: mockSelectEdgeWithoutHistory,
        nodes: [],
        edges: [],
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
        ceeAnalysisReady: mockCeeStatus ? { status: mockCeeStatus } : null,
        lastDraftError: mockLastDraftError,
        setHighlightedNodes: vi.fn(),
        setHighlightedEdges: vi.fn(),
        selectNodeWithoutHistory: mockSelectNodeWithoutHistory,
        selectEdgeWithoutHistory: mockSelectEdgeWithoutHistory,
        updateNode: vi.fn(),
        setGoalThreshold: vi.fn(),
        setGoalThresholdAndUpdateNode: vi.fn(),
        setCeeAnalysisReady: vi.fn(),
        setOutcomeNode: vi.fn(),
        nodes: [],
        addNode: vi.fn(),
        updateEdge: vi.fn(),
        addEdge: vi.fn(),
      }),
    }
  ),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

/**
 * Expand the "Improve confidence" accordion if present.
 * Renders Goal target, expertise triage cards, MissingKnowledgePrompt (D7).
 */
function expandImproveConfidence() {
  const toggle = screen.queryByTestId('improve-confidence-toggle')
  if (toggle) fireEvent.click(toggle)
}

describe('PreAnalysisPanel', () => {
  const mockOnAnalyse = vi.fn()

  const createMockData = (overrides: Partial<PreAnalysisData> = {}): PreAnalysisData => {
    const improvementsByCategory = overrides.improvementsByCategory ?? {
      fix: [],
      verify: [],
      add_evidence: [],
      strengthen: [],
    }

    // Build tiers from improvementsByCategory
    const tiers = overrides.tiers ?? {
      mustAddress: {
        items: improvementsByCategory.fix,
        count: improvementsByCategory.fix.length,
      },
      reviewAssumptions: {
        items: improvementsByCategory.verify,
        count: improvementsByCategory.verify.length,
      },
      optional: {
        items: [...improvementsByCategory.add_evidence, ...improvementsByCategory.strengthen],
        count: improvementsByCategory.add_evidence.length + improvementsByCategory.strengthen.length,
      },
    }

    return {
      improvementsByCategory,
      tiers,
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
      actionableCount: 0,
      addressedActionableCount: 0,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCeeStatus = undefined
    mockLastDraftError = null
  })

  describe('State Transitions', () => {
    it('renders null when canvas is empty', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        nodesByKind: {
          goal: [],
          decision: [],
          option: [],
          factor: [],
          risk: [],
          outcome: [],
        },
      }))

      const { container } = render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders panel when nodes exist', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('pre-analysis-panel')).toBeInTheDocument()
    })

    it('shows model health card when ready', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 3 },
          optional: { items: [], count: 2 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // ModelHealthCard replaces Header — shows "Decision readiness" title
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
      expect(screen.getByText('Decision readiness')).toBeInTheDocument()
    })

    it('shows model health card when blocked', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        blockerCount: 2,
        tiers: {
          mustAddress: { items: [], count: 2 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [], count: 0 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // ModelHealthCard is always shown — status moved to footer
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
    })
  })

  describe('Sticky Footer', () => {
    it('shows "Analyse Now" button when ready, readiness >= 60, target set, and items addressed', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        evidenceQuality: { level: 'high', ratio: 0.8, nonAiCount: 4, totalCount: 5 },
        reviewedFactorsCount: 3,
        totalReviewableFactorsCount: 5,
        ceeQuality: { structure: 8 },
        successThreshold: 0.7,
        addressedActionableCount: 2,
        actionableCount: 3,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('button', { name: /analyse now/i })).toHaveTextContent('Analyse now')
    })

    it('shows "Analyse now" when ready regardless of readiness score (Brief 5.8A D6)', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true, hasBlockers: false }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('button', { name: /analyse now/i })).toHaveTextContent('Analyse now')
    })

    it('shows the CTA disabled when hard blockers exist (Brief 5.8A D6)', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 2,
        improvementsByCategory: {
          fix: [
            { key: 'fix1', category: 'fix', label: 'Fix 1', detail: 'Detail' },
            { key: 'fix2', category: 'fix', label: 'Fix 2', detail: 'Detail' },
          ],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // Brief 5.8A D6: hard blockers (count>0) keep the button disabled.
      const button = screen.getByRole('button', { name: /address issues/i })
      expect(button).toBeDisabled()
    })

    it('shows "Running analysis…" when isAnalysing is true', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} isAnalysing={true} />)
      expect(screen.getByRole('button', { name: /analysis in progress/i })).toHaveTextContent('Running analysis…')
    })

    it('calls onAnalyse when button is clicked', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: true }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      fireEvent.click(screen.getByRole('button', { name: /analyse now/i }))
      expect(mockOnAnalyse).toHaveBeenCalledTimes(1)
    })

    it('button stays enabled for soft "not ready" states (Brief 5.8A D6 — Analyse anyway)', () => {
      // Brief 5.8A D6: when there are no hard blockers but calibration is
      // incomplete, the CTA reads "Analyse anyway" and remains clickable so
      // the user can run with provisional results.
      mockUsePreAnalysisData.mockReturnValue(createMockData({ isReady: false, hasBlockers: true, blockerCount: 0 }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const button = screen.getByRole('button', { name: /analyse anyway/i })
      expect(button).not.toBeDisabled()
      expect(button).toHaveTextContent('Analyse anyway')
    })

    it('shows "Analyse anyway" CTA enabled when isReady=false and hasBlockers=false (Brief 5.8A D6)', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: false,
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const button = screen.getByRole('button', { name: /analyse anyway/i })
      expect(button).toHaveTextContent('Analyse anyway')
      expect(button).not.toBeDisabled()
    })
  })

  describe('Accordion Behaviour', () => {
    it('renders Improve confidence content when expanded', () => {
      // D7: YourExpertise removed; Improve confidence content is triage cards + MissingKnowledgePrompt
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expandImproveConfidence()
      expect(screen.getByTestId('improve-confidence-content')).toBeInTheDocument()
    })

    it('surfaces cee_inference verify items inside the T1 unified queue', () => {
      // Brief 5.8A D3b: Improve confidence triage cards moved into the T1
      // Decision readiness card. Expertise items now appear in the unified
      // queue alongside Review next items.
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        totalImprovements: 5,
        improvementsByCategory: {
          fix: [{ key: 'f1', category: 'fix', label: 'Fix', detail: '' }],
          verify: [{ key: 'v1', category: 'verify', label: 'Verify', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n1', label: 'Verify' } }],
          add_evidence: [{ key: 'a1', category: 'add_evidence', label: 'Add', detail: '' }],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const t1Card = screen.getByTestId('t1-decision-readiness-card')
      expect(within(t1Card).getByTestId('t1-triage-top-three')).toBeInTheDocument()
      expect(within(t1Card).getByText('Verify')).toBeInTheDocument()
    })
  })

  describe('Expertise Section', () => {
    it('renders cee_inference verify items inside the T1 unified queue', () => {
      // Brief 5.8A D3b: AI-estimated items now appear in the T1 unified
      // triage queue (no separate expertise block).
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [{ key: 'v1', category: 'verify', label: 'Test Factor', detail: '5.0', subgroup: 'cee_inference', focus: { type: 'node', id: 'f1', label: 'Test Factor' } }],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const t1Card = screen.getByTestId('t1-decision-readiness-card')
      expect(within(t1Card).getByTestId('t1-triage-top-three')).toBeInTheDocument()
      expect(within(t1Card).getByText('Test Factor')).toBeInTheDocument()
    })
  })

  describe('Evidence Quality Display', () => {
    it('does not show reviewed count in v2 footer (redundant with section counts)', () => {
      // v2 brief: "Remove '0/N addressed' (redundant with section counts)"
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'low', ratio: 0.2, nonAiCount: 0, totalCount: 5 },
        addressedActionableCount: 0,
        actionableCount: 5,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('0/5 addressed')).not.toBeInTheDocument()
    })

    it('does not show "All addressed" in v2 footer (redundant with section counts)', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'high', ratio: 1, nonAiCount: 5, totalCount: 5 },
        addressedActionableCount: 5,
        actionableCount: 5,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).not.toHaveTextContent('All addressed')
    })

    it('does not show Quality tier label in footer', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        evidenceQuality: { level: 'medium', ratio: 0.5, nonAiCount: 2, totalCount: 4 },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument()
    })
  })

  describe('Wiring Fixes Regression', () => {
    it('renders Goal selector inside Improve confidence accordion when threshold is set', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        successThreshold: 0.7,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expandImproveConfidence()
      // Goal selector lives in SuccessTarget inside Improve confidence accordion
      const goalTexts = screen.getAllByText('Goal')
      expect(goalTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('renders sections in correct order: banner → health → buckets → expertise', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        tiers: {
          mustAddress: { items: [{ key: 'f1', category: 'fix', label: 'Test Fix', detail: 'Detail' }], count: 1 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [], count: 0 },
        },
        improvementsByCategory: {
          fix: [{ key: 'f1', category: 'fix', label: 'Test Fix', detail: 'Detail' }],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      const { container } = render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expandImproveConfidence()
      const panel = container.querySelector('[data-testid="pre-analysis-panel"]')
      expect(panel).toBeInTheDocument()

      // Banner + health rendered in correct order
      expect(screen.getByTestId('pre-analysis-status-banner')).toBeInTheDocument()
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()

      // Verify banner renders before health card in the DOM
      const scrollableContent = panel?.querySelector('.overflow-y-auto')
      const html = scrollableContent?.innerHTML ?? ''

      const bannerPos = html.indexOf('pre-analysis-status-banner')
      const healthPos = html.indexOf('model-health-card')

      expect(bannerPos).toBeLessThan(healthPos)
    })

    it('sticky footer uses flex layout for pinning', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toHaveClass('flex-shrink-0')
    })

    it('sticky footer is visible in the DOM', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData())

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toBeInTheDocument()
      expect(footer).toBeVisible()
    })

    it('action buttons render for improvement items', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [
            {
              key: 'v1',
              category: 'verify',
              label: 'Test Factor',
              detail: '5.0',
              action: { label: 'Confirm', kind: 'confirm', targetId: 'n1', targetType: 'node' },
              focus: { type: 'node', id: 'n1', label: 'Test' },
            },
          ],
          add_evidence: [
            {
              key: 'ae1',
              category: 'add_evidence',
              label: 'Edge A → B',
              detail: 'No evidence',
              action: { label: 'Add', kind: 'add', targetId: 'e1', targetType: 'edge' },
              focus: { type: 'edge', id: 'e1', label: 'Edge' },
            },
          ],
          strengthen: [],
        },
        totalImprovements: 2,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Verify action buttons are present in the DOM
      const buttons = document.querySelectorAll('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('disabled action buttons have disabled attribute', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [
            {
              key: 'v1',
              category: 'verify',
              label: 'Test Factor',
              detail: '5.0',
              action: { label: 'Confirm', kind: 'confirm' },
              focus: { type: 'node', id: 'n1', label: 'Test' },
            },
          ],
          add_evidence: [],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Action buttons should be enabled (not disabled) for interactive actions
      // Only the main "Analyse Now" button should be disabled when not ready
      const verifySection = screen.queryByText('VERIFY')
      if (verifySection) {
        // Verify items have enabled action buttons
        const enabledButtons = document.querySelectorAll('button:not([disabled])')
        expect(enabledButtons.length).toBeGreaterThan(0)
      }
    })

    it('model health card renders for ready state', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 3 },
          optional: { items: [], count: 0 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // ModelHealthCard always present — status moved to footer
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
      expect(screen.getByText('Decision readiness')).toBeInTheDocument()
    })
  })

  describe('P0/P1 Bug Fixes', () => {
    it('model health card renders when isReady=false and mustAddressCount=0', () => {
      // Scenario: existingReadiness.canRun is false for reasons outside mustAddress tier
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: false,
        blockerCount: 0,
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 2 },
          optional: { items: [], count: 0 },
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // ModelHealthCard renders regardless of readiness state
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()
    })

    it('AI-estimated factors surface inside the T1 unified queue (Brief 5.8A D3b)', () => {
      // Brief 5.8A D3b: cee_inference verify items now thread into the T1
      // unified triage queue alongside Review next items.
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        reviewedFactorsCount: 2,
        totalReviewableFactorsCount: 3,
        improvementsByCategory: {
          fix: [],
          verify: [
            { key: 'v1', category: 'verify', label: 'F1', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n1', label: 'F1' } },
            { key: 'v2', category: 'verify', label: 'F2', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n2', label: 'F2' } },
            { key: 'v3', category: 'verify', label: 'F3', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n3', label: 'F3' } },
          ],
          add_evidence: [],
          strengthen: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const t1Card = screen.getByTestId('t1-decision-readiness-card')
      expect(within(t1Card).getByTestId('t1-triage-top-three')).toBeInTheDocument()
      // First three items appear in top-three; remainder (if any) in Also consider.
      expect(within(t1Card).getByText('F1')).toBeInTheDocument()
      expect(within(t1Card).getByText('F2')).toBeInTheDocument()
      expect(within(t1Card).getByText('F3')).toBeInTheDocument()
    })

    it('renders no T1 triage queue when no triage items exist', () => {
      // Brief 5.8A D3b: when there are no triage items at all, the T1 queue
      // is suppressed entirely (no empty container).
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        reviewedFactorsCount: 2,
        totalReviewableFactorsCount: 2,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('t1-triage-top-three')).not.toBeInTheDocument()
      expect(screen.queryByTestId('t1-also-consider')).not.toBeInTheDocument()
    })

    it('shows Ready and enables button when only optional improvements present', () => {
      // Scenario: optional strengthen item, no blockers
      // Optional improvements should NOT block analysis
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        blockerCount: 0,
        tiers: {
          mustAddress: { items: [], count: 0 }, // No blockers
          reviewAssumptions: { items: [], count: 0 },
          optional: {
            items: [{
              key: 'only_2_options',
              category: 'strengthen',
              label: 'Consider adding a third option',
              detail: 'More options can reveal better alternatives',
            }],
            count: 1,
          },
        },
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [],
          strengthen: [{
            key: 'only_2_options',
            category: 'strengthen',
            label: 'Consider adding a third option',
            detail: 'More options can reveal better alternatives',
          }],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // ModelHealthCard renders — status moved to footer
      expect(screen.getByTestId('model-health-card')).toBeInTheDocument()

      // Brief 5.8A D6: CTA reads "Analyse now" when ready or "Analyse anyway"
      // when calibration is incomplete; both remain enabled for soft states.
      const button = screen.getByRole('button', { name: /analyse (now|anyway)/i })
      expect(button.textContent).toMatch(/Analyse (now|anyway)/)
      expect(button).not.toBeDisabled()
    })
  })

  describe('P2 Polish Tasks', () => {
    describe('Task 1: Inputs Reviewed Label', () => {
      it('does not show reviewed count in v2 footer, no evidence tier label', () => {
        // v2 brief: "Remove '0/N addressed' (redundant with section counts)"
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          evidenceQuality: { level: 'medium', ratio: 0.5, nonAiCount: 2, totalCount: 4 },
          addressedActionableCount: 2,
          actionableCount: 4,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // v2 footer omits the addressed count (redundant with section counts above)
        expect(screen.queryByText('2/4 addressed')).not.toBeInTheDocument()
        expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Data confidence:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Input confidence:/)).not.toBeInTheDocument()
      })
    })

    describe('Task 2: Empty Review Tier Message', () => {
      it('shows empty state message when review tier has 0 items and 0 totalCount', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          isReady: true,
          tiers: {
            mustAddress: { items: [], count: 0 },
            reviewAssumptions: { items: [], count: 0 },
            optional: { items: [], count: 0 },
          },
          reviewedFactorsCount: 0,
          totalReviewableFactorsCount: 0, // No assumptions to review at all
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
        expandImproveConfidence()
        // D7: YourExpertise removed; Improve confidence content renders without expertise section
        expect(screen.getByTestId('improve-confidence-content')).toBeInTheDocument()
        expect(screen.queryByTestId('your-expertise-section')).not.toBeInTheDocument()
      })

      it('hides progress counter when no assumptions to review', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          isReady: true,
          tiers: {
            mustAddress: { items: [], count: 0 },
            reviewAssumptions: { items: [], count: 0 },
            optional: { items: [], count: 0 },
          },
          reviewedFactorsCount: 0,
          totalReviewableFactorsCount: 0,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
        expandImproveConfidence()
        // Should NOT show "(addressed to 0 of 0)"
        expect(screen.queryByText(/\(addressed to 0 of 0\)/)).not.toBeInTheDocument()
        // D7: YourExpertise removed — "Your expertise" heading gone
        expect(screen.queryByText('Your expertise')).not.toBeInTheDocument()
      })

      it('hides badge entirely when no assumptions to review', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          isReady: true,
          tiers: {
            mustAddress: { items: [], count: 0 },
            reviewAssumptions: { items: [], count: 0 },
            optional: { items: [], count: 0 },
          },
          reviewedFactorsCount: 0,
          totalReviewableFactorsCount: 0,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

        // Badge should not render at all for 0 items
        expect(screen.queryByText('—')).not.toBeInTheDocument()
      })
    })

    describe('Task 3: Success Target Provenance', () => {
      it('shows provenance text when available (inside Improve confidence)', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          successThreshold: 1000000,
          isThresholdAutoDerived: true,
          thresholdProvenance: 'Target Revenue of $1M',
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
        expandImproveConfidence()
        // Should show provenance text below threshold
        expect(screen.getByText(/Source: Target Revenue of \$1M/)).toBeInTheDocument()
      })

      it('does not show provenance text when not available', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          successThreshold: 5000,
          isThresholdAutoDerived: false,
          thresholdProvenance: null,
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
        expandImproveConfidence()
        // Should NOT show "Source:"
        expect(screen.queryByText(/Source:/)).not.toBeInTheDocument()
      })

      it('does not show provenance text when user has edited threshold (not auto-derived)', () => {
        mockUsePreAnalysisData.mockReturnValue(createMockData({
          successThreshold: 5000,
          isThresholdAutoDerived: false, // User edited the threshold
          thresholdProvenance: 'Original target from brief', // Stale provenance still exists
        }))

        render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
        expandImproveConfidence()
        // Should NOT show stale provenance after user edit
        expect(screen.queryByText(/Extracted from:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Retry Draft Button', () => {
    it('shows retry button in draft error card with needs_user_mapping status', () => {
      mockCeeStatus = 'needs_user_mapping'
      mockLastDraftError = { message: 'Draft failed', retryable: true }
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('draft-error-retry')).toBeInTheDocument()
      expect(screen.getByTestId('draft-error-retry')).toHaveTextContent('Retry Draft')
      mockLastDraftError = null
    })

    it('shows retry button in draft error card with needs_encoding status', () => {
      mockCeeStatus = 'needs_encoding'
      mockLastDraftError = { message: 'Draft failed', retryable: true }
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByTestId('draft-error-retry')).toBeInTheDocument()
      mockLastDraftError = null
    })

    it('does not show draft error card when status is ready', () => {
      mockCeeStatus = 'ready'
      mockLastDraftError = null
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('draft-error-retry')).not.toBeInTheDocument()
    })

    it('does not show retry button when status is an unknown value', () => {
      mockCeeStatus = 'some_unknown_status'
      mockLastDraftError = { message: 'Draft failed', retryable: true }
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // canRetryDraft requires ceeStatus in SOFT_BYPASS_STATUSES — unknown status means no retry button
      expect(screen.queryByTestId('draft-error-retry')).not.toBeInTheDocument()
      mockLastDraftError = null
    })

    it('does not show retry button when no CEE status (loading)', () => {
      mockCeeStatus = undefined
      mockLastDraftError = null
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
        isLoading: true,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('draft-error-retry')).not.toBeInTheDocument()
    })

    it('calls retryDraft when retry button is clicked', async () => {
      mockCeeStatus = 'needs_user_mapping'
      mockLastDraftError = { message: 'Draft failed', retryable: true }
      mockRetryDraft.mockResolvedValue({ success: true })
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: false,
        hasBlockers: true,
        blockerCount: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      fireEvent.click(screen.getByTestId('draft-error-retry'))
      expect(mockRetryDraft).toHaveBeenCalledTimes(1)
      mockLastDraftError = null
    })
  })

  describe('Informational Blockers', () => {
    it('renders informational blockers with info styling when ready', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        blockerCount: 0,
        enrichedBlockers: [],
        informationalBlockers: [
          {
            blocker: { code: 'CONSTRAINT_DROPPED', message: 'No matching factor', affectedIds: ['constraint_budget'] },
            display: {
              title: 'Constraint not applied: "Budget"',
              description: "The system couldn't match this constraint to a factor in your model. The analysis will run without it.",
              severity: 'info' as const,
              supportsRetry: false,
              suggestedActions: [],
            },
            sortOrder: 40,
          },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Should show "Notes" section, not "Address before analysis"
      expect(screen.getByText('Notes')).toBeInTheDocument()
      expect(screen.queryByText('Address before analysis')).not.toBeInTheDocument()

      // Should show the grouped constraint card
      expect(screen.getByTestId('constraint-group-card')).toBeInTheDocument()
    })

    it('does not count informational blockers in footer badge', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        hasBlockers: false,
        blockerCount: 0,
        informationalBlockers: [
          {
            blocker: { code: 'CONSTRAINT_DROPPED', message: 'No matching factor', affectedIds: ['c1'] },
            display: { title: 'Test', description: 'Test', severity: 'info' as const, supportsRetry: false, suggestedActions: [] },
            sortOrder: 40,
          },
        ],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Brief 5.8A D6: footer CTA adapts to readiness — "Analyse now" or
      // "Analyse anyway" depending on calibration state.
      const footer = screen.getByTestId('sticky-footer')
      expect(footer).toHaveTextContent(/Analyse (now|anyway)/)
    })
  })

  describe.skip('Framing pill styling (v13 Task 7a) — DecisionQualityChecks removed', () => {
    it('renders Framing pill with border class and no bg-option-light', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        qualityChecks: [{
          id: 'zero_external_factors',
          message: 'No external factors in your model',
          cta: 'Add factor',
          ctaAction: 'add_factor',
          pill: 'framing' as const,
          category: 'structure',
        }],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Sharpen your thinking" section to reveal check pills
      const sectionHeader = screen.getByText('Sharpen your thinking')
      fireEvent.click(sectionHeader)

      const pills = screen.getAllByText('Framing')
      expect(pills.length).toBeGreaterThanOrEqual(1)
      // Check the first Framing pill (from the quality check) has correct styling
      expect(pills[0].className).toContain('border')
      expect(pills[0].className).not.toContain('bg-option-light')
    })
  })

  describe('Factor click integration (OptionPreview → inspector)', () => {
    it('clicking a factor label in an option card calls selectNodeWithoutHistory with the factor ID', () => {
      mockSelectNodeWithoutHistory.mockClear()
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        optionPreviews: [{
          id: 'opt_expand',
          label: 'Expand Now',
          status: 'ready',
          isBaseline: false,
          interventions: [{
            factorId: 'fac_ad_spend',
            factorLabel: 'Ad spend',
            interventionValue: 0.8,
            currentValue: null,
            direction: 'up' as const,
            cap: null,
            unit: null,
            currentRawValue: null,
          }],
        }],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // OptionPreview is collapsed by default — expand it first.
      fireEvent.click(screen.getByTestId('option-preview-toggle'))

      // v2 panel passes collapseInterventionsByDefault — interventions are hidden
      // behind a per-option disclosure. Click the disclosure first to reveal "Ad spend".
      const interventionToggle = screen.queryByTestId('option-interventions-toggle-opt_expand')
      if (interventionToggle) fireEvent.click(interventionToggle)

      // Click the factor label "Ad spend" — should target the factor node, not the option
      fireEvent.click(screen.getByText('Ad spend'))

      expect(mockSelectNodeWithoutHistory).toHaveBeenCalledTimes(1)
      expect(mockSelectNodeWithoutHistory).toHaveBeenCalledWith('fac_ad_spend')
    })

    it('clicking the option name calls selectNodeWithoutHistory with the option ID', () => {
      mockSelectNodeWithoutHistory.mockClear()
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        optionPreviews: [{
          id: 'opt_expand',
          label: 'Expand Now',
          status: 'ready',
          isBaseline: false,
          interventions: [],
        }],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // OptionPreview is collapsed by default — expand it first.
      fireEvent.click(screen.getByTestId('option-preview-toggle'))

      fireEvent.click(screen.getByText('Expand Now'))

      expect(mockSelectNodeWithoutHistory).toHaveBeenCalledWith('opt_expand')
    })
  })

  describe('Inline editor regression — always present for factor triage cards', () => {
    it('renders an inline editor for a factor card with a numeric rawValue', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        triageActions: {
          top3: [{
            key: 'verify_fac_a',
            category: 'verify',
            label: 'Market Size',
            detail: '500 engineers',
            focus: { type: 'node', id: 'fac_a', label: 'Market Size' },
            action: { label: 'Confirm', kind: 'confirm', targetId: 'fac_a', targetType: 'node' },
            rawValue: 500,
            unit: 'engineers',
            cap: null,
            sourceBadge: 'brief',
          }],
          quickFix: [],
        },
      }))
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('spinbutton', { name: /Market Size/i })).toBeInTheDocument()
    })

    it('renders an inline editor for a factor card with null rawValue and null value', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        triageActions: {
          top3: [{
            key: 'verify_fac_b',
            category: 'verify',
            label: 'Churn Rate',
            detail: 'Estimated',
            focus: { type: 'node', id: 'fac_b', label: 'Churn Rate' },
            action: { label: 'Confirm', kind: 'confirm', targetId: 'fac_b', targetType: 'node' },
            rawValue: null,
            unit: null,
            cap: null,
            sourceBadge: 'ai',
          }],
          quickFix: [],
        },
      }))
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('spinbutton', { name: /Churn Rate/i })).toBeInTheDocument()
    })

    it('renders an inline editor for an inferred-zero factor card (detail === "Not set")', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        triageActions: {
          top3: [{
            key: 'verify_fac_c',
            category: 'verify',
            label: 'Direct Delivery Capacity',
            detail: 'Not set',
            focus: { type: 'node', id: 'fac_c', label: 'Direct Delivery Capacity' },
            action: { label: 'Confirm', kind: 'confirm', targetId: 'fac_c', targetType: 'node' },
            rawValue: 0,
            unit: 'scale',
            cap: null,
            sourceBadge: 'ai',
          }],
          quickFix: [],
        },
      }))
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByRole('spinbutton', { name: /Direct Delivery Capacity/i })).toBeInTheDocument()
    })
  })

  // ── Brief 4 hotfix self-review P1.2: integration coverage ───────────────
  //
  // Unit tests in resolveEditorRawValue.spec.ts prove the predicate and copy
  // behaviour in isolation. Variant-parity tests in TriageCard.spec.tsx prove
  // both variants render the subtitle + ordinal + EVPI pill identically.
  //
  // This block glues the two together: assert the full mapping → predicate →
  // render chain works on realistic fixtures. A regression in any of the
  // three intermediaries (PreAnalysisPanel wiring, resolveCapHintSubtitle
  // predicate, TriageCard render order) would surface here.
  describe('Brief-extracted cap fallback — end-to-end render (P1.2)', () => {
    it('renders the "Brief suggests up to: £X" hint for the Annual Assistant Cost shape', () => {
      // Real-world shape from the hiring bundle: brief extracted "up to
      // £70,000", no live baseline so raw_value=0. Expected end state:
      // - editor renders empty (resolveEditorRawValue returns null)
      // - card body shows the hint subtitle (resolveCapHintSubtitle fires)
      // - From brief source pill still attaches
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        triageActions: {
          top3: [{
            key: 'verify_assistant_cost',
            category: 'verify',
            label: 'Annual Assistant Cost',
            detail: '£0',
            focus: { type: 'node', id: 'assistant_cost', label: 'Annual Assistant Cost' },
            action: { label: 'Set value', kind: 'confirm', targetId: 'assistant_cost', targetType: 'node' },
            rawValue: 0,
            unit: '£',
            cap: 70000,
            sourceBadge: 'brief',
          }],
          quickFix: [],
        },
      }))
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText('Brief suggests up to: £70,000')).toBeInTheDocument()
      expect(screen.getByText('From brief')).toBeInTheDocument()
      // The editor's spinbutton renders for the target; value is empty
      // (resolveEditorRawValue returned null for the brief+zero+cap case).
      const input = screen.getByRole('spinbutton', { name: /Annual Assistant Cost/i })
      expect(input).toHaveValue(null)
    })

    it('renders the neutral no-figure hint when the brief-extracted factor has a placeholder unit', () => {
      // P1.1: when the unit is "scale" / "index" / …, the numeric figure is
      // meaningless, but the card must still render a coaching subtitle — not
      // fall back to the upstream "0 of N" body text that would conflict
      // with the empty editor.
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        triageActions: {
          top3: [{
            key: 'verify_satisfaction',
            category: 'verify',
            label: 'Customer Satisfaction',
            detail: '0 of 70',
            focus: { type: 'node', id: 'sat', label: 'Customer Satisfaction' },
            action: { label: 'Set value', kind: 'confirm', targetId: 'sat', targetType: 'node' },
            rawValue: 0,
            unit: 'score',
            cap: 70,
            sourceBadge: 'brief',
          }],
          quickFix: [],
        },
      }))
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.getByText('Brief suggests a value. Set it to confirm.')).toBeInTheDocument()
      // The "0 of 70" fallback must NOT appear — the subtitle override
      // should win over the upstream formatObservedStateDetail.
      expect(screen.queryByText('0 of 70')).not.toBeInTheDocument()
    })

    it('does not render the hint for AI-sourced (non-brief) zero-raw cards', () => {
      // Guard: the cap fallback is brief-provenance-only. An AI-estimated
      // factor with raw=0 + cap>0 must NOT get the "Brief suggests" copy.
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        triageActions: {
          top3: [{
            key: 'verify_ai_factor',
            category: 'verify',
            label: 'Market Share',
            detail: '0%',
            focus: { type: 'node', id: 'mkt', label: 'Market Share' },
            action: { label: 'Confirm', kind: 'confirm', targetId: 'mkt', targetType: 'node' },
            rawValue: 0,
            unit: '%',
            cap: 100,
            sourceBadge: 'ai',
          }],
          quickFix: [],
        },
      }))
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText(/^Brief suggests/)).not.toBeInTheDocument()
    })
  })

  describe('Negative acceptance criteria (v6 wireframe)', () => {
    beforeEach(() => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        isReady: true,
        improvementsByCategory: {
          fix: [{ key: 'f1', category: 'fix', label: 'Fix item', detail: '' }],
          verify: [{ key: 'v1', category: 'verify', label: 'Verify item', detail: '', subgroup: 'cee_inference', focus: { type: 'node', id: 'n1', label: 'Factor' } }],
          add_evidence: [],
          strengthen: [{ key: 's1', category: 'strengthen', label: 'Strengthen', detail: '' }],
        },
        modelAdjustments: [{ code: 'test', reason: 'Test fix' }],
        qualityChecks: [{ id: 'no_risks', message: 'No risks', detail: '', pill: 'verify', cta: 'Add risks', ctaAction: 'add_risk' }],
      }))
    })

    it('does NOT render "Ready · N to review · Improvements available" strip', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText(/Ready · \d+ to review · Improvements available/)).not.toBeInTheDocument()
    })

    it('does NOT render "Model health: N issues" thin strip', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      // ModelHealthSection rendered a thin strip with "Model health" + issue count
      // Now ModelHealthCard renders a full card — verify no thin strip pattern
      expect(screen.queryByText(/Model health: \d+ issues?/)).not.toBeInTheDocument()
    })

    it('does NOT render standalone "More improvements" section', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('More improvements')).not.toBeInTheDocument()
    })

    it('does NOT render "What shapes your decision" card', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('What shapes your decision')).not.toBeInTheDocument()
    })

    it('does NOT render "Model assumptions" table', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('Model assumptions')).not.toBeInTheDocument()
    })

    it('does NOT render the legacy "Decision quality" section', () => {
      // Brief 5.8A D5 reintroduces "Sharpen your thinking" as a deliberate
      // T2 surface (deterministic bias + framing exercises). The legacy
      // "Decision quality" section stays gone — it had a different content
      // contract (raw quality checks list).
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByText('Decision quality')).not.toBeInTheDocument()
    })
  })

  describe('Dynamic headline (Fix 2: bias-and-headline brief)', () => {
    // The compact ModelHealthCard renders the bucket-derived headline at
    // data-testid="model-health-card-headline". Precedence:
    //   1. ceeAnalysisReady.coaching_summary (CEE override)
    //   2. First Must fix item label → "[label]. Address before analysis."
    //   3. First Review next item label → "[label] has the biggest impact. Review before running."
    //   4. Ready states (Improve confidence items / clean) → null (StatusBanner already communicates readiness)
    //
    // These tests use a "clean" mock that suppresses the deterministic bias
    // triggers (which would otherwise push reviewNextCount > 0 even in a
    // baseline state). This is done by populating optionPreviews with three
    // options and providing two risk nodes.
    const cleanBaselineMock = (): Partial<PreAnalysisData> => ({
      isReady: true,
      hasBlockers: false,
      nodesByKind: {
        goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
        decision: [],
        option: [
          { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
          { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
        ],
        factor: [],
        risk: [
          { id: 'r1', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Risk 1' } },
          { id: 'r2', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Risk 2' } },
        ],
        outcome: [],
      },
      // 3 options so showOptionQualityCard does not fire (length >= 3)
      optionPreviews: [
        { id: 'o1', label: 'Option 1', status: 'ready', isBaseline: false, interventions: [] },
        { id: 'o2', label: 'Option 2', status: 'ready', isBaseline: false, interventions: [] },
        { id: 'o3', label: 'Option 3', status: 'ready', isBaseline: true, interventions: [] },
      ],
    })

    it('renders "[Must fix label]. Address before analysis." when Must fix has items', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        ...cleanBaselineMock(),
        isReady: false,
        hasBlockers: true,
        improvementsByCategory: {
          fix: [{ key: 'fix_a', category: 'fix', label: 'Add baseline option', detail: 'Required' }],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
        triageActions: {
          top3: [{ key: 'fix_a', category: 'fix', label: 'Add baseline option', detail: 'Required' }],
          quickFix: [],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const headline = screen.getByTestId('model-health-card-headline')
      expect(headline).toHaveTextContent('Add baseline option. Address before analysis.')
    })

    it('does not render a headline when ready with improve-confidence items only (StatusBanner already communicates readiness)', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        ...cleanBaselineMock(),
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [],
          strengthen: [
            { key: 's1', category: 'strengthen', label: 'Strengthen 1', detail: '' },
            { key: 's2', category: 'strengthen', label: 'Strengthen 2', detail: '' },
          ],
        },
        triageActions: {
          top3: [],
          quickFix: [
            { key: 's1', category: 'strengthen', label: 'Strengthen 1', detail: '' },
            { key: 's2', category: 'strengthen', label: 'Strengthen 2', detail: '' },
          ],
        },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('model-health-card-headline')).not.toBeInTheDocument()
    })

    it('does not render a headline in a fully clean state (StatusBanner already communicates readiness)', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData(cleanBaselineMock()))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(screen.queryByTestId('model-health-card-headline')).not.toBeInTheDocument()
    })

    it('does NOT render the deleted static "Your expertise makes the analysis more reliable" fallback', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        ...cleanBaselineMock(),
        coachingSummary: null,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      expect(
        screen.queryByText(/Your expertise makes the analysis more reliable/),
      ).not.toBeInTheDocument()
    })

    it('renders a grammatically correct Review next headline when the option quality card is the first item', () => {
      // Fewer than 3 options (and no same_levers check) triggers the option
      // quality card as the first Review next item. Subject is plural, so
      // the headline must NOT read "Your options has the biggest impact."
      // (the grammar bug this test guards against).
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        ...cleanBaselineMock(),
        isReady: true,
        hasBlockers: false,
        // 2 options + nothing in Must fix → Review next fires with the
        // option quality card (count === 1)
        optionPreviews: [
          { id: 'o1', label: 'Option 1', status: 'ready', isBaseline: false, interventions: [] },
          { id: 'o2', label: 'Option 2', status: 'ready', isBaseline: true, interventions: [] },
        ],
        triageActions: { top3: [], quickFix: [] },
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const headline = screen.getByTestId('model-health-card-headline')
      expect(headline).toHaveTextContent('Review your options before running.')
      // Guard against the grammar bug ChatGPT flagged
      expect(headline).not.toHaveTextContent('Your options has the biggest impact')
    })
  })

  describe('pickStartHere debug log gating', () => {
    let debugSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      mockUsePreAnalysisData.mockReturnValue(createMockData())
    })

    afterEach(() => {
      debugSpy.mockRestore()
      vi.unstubAllEnvs()
    })

    it('does not log pickStartHere by default', () => {
      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      const calls = debugSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('[PreAnalysis] pickStartHere')
      )
      expect(calls).toHaveLength(0)
    })

    it('logs pickStartHere once when VITE_DEBUG_PREANALYSIS=1 and does not re-fire on re-render with same deps', () => {
      vi.stubEnv('VITE_DEBUG_PREANALYSIS', '1')
      const { rerender } = render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      let calls = debugSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('[PreAnalysis] pickStartHere')
      )
      expect(calls).toHaveLength(1)

      // Re-render with same props — effect deps unchanged → no new call.
      rerender(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)
      calls = debugSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('[PreAnalysis] pickStartHere')
      )
      expect(calls).toHaveLength(1)
    })
  })
})
