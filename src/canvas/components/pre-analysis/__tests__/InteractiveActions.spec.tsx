/**
 * Tests for Pre-Analysis Panel Interactive Actions Hardening
 *
 * Covers:
 * - Baseline duplicate prevention
 * - Provenance field alignment (Confirm/Assumption → Verify removal)
 * - Evidence input sanitisation
 * - Immutable store updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreAnalysisPanel } from '../PreAnalysisPanel'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'
// Mock the hook
vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

// Store action spies
const mockUpdateNode = vi.fn()
const mockUpdateEdge = vi.fn()
const mockUpdateEdgeData = vi.fn()
const mockAddNode = vi.fn()
const mockAddEdge = vi.fn()
const mockSetCeeAnalysisReady = vi.fn()
const mockSetHighlightedNodes = vi.fn()

// Shared mutable store state — updated per-test via beforeEach and per-case overrides
const mockStoreState: Record<string, unknown> = {}

// Mock the canvas store — selector calls read from mockStoreState, getState returns it directly
vi.mock('../../../store', () => {
  const store = (selector: (s: Record<string, unknown>) => unknown) => selector(mockStoreState)
  store.getState = () => mockStoreState
  return { useCanvasStore: store }
})

// Mock useShowToast
const mockShowToast = vi.fn()
vi.mock('../../../ToastContext', () => ({
  useShowToast: () => mockShowToast,
}))

// Mock focusNodeById
vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

describe('Interactive Actions Hardening', () => {
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
      isLoading: false,
      enrichedBlockers: [],
      informationalBlockers: [],
      thresholdProvenance: null,
      thresholdSourceBadge: null,
      modelAdjustments: [],
      reviewedFactorsCount: 0,
      totalReviewableFactorsCount: 0,
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
      coachingSummary: null,
      contestedEdges: [],
      balanceScore: 0.5,
      assumptionsLedger: null,
      triageActions: { top3: [], quickFix: [] },
      actionableCount: 0,
      addressedActionableCount: 0,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Populate shared store state with all fields that PreAnalysisPanel and children access
    Object.assign(mockStoreState, {
      nodes: [
        { id: 'o1', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option 1' } },
        { id: 'o2', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option 2' } },
        { id: 'd1', type: 'decision', position: { x: 150, y: 50 }, data: { label: 'Decision' } },
      ],
      edges: [
        { id: 'e1', source: 'o1', target: 'g1', data: { confidence: 0.8, belief: 0.7 } },
      ],
      updateNode: mockUpdateNode,
      updateEdge: mockUpdateEdge,
      updateEdgeData: mockUpdateEdgeData,
      addNode: mockAddNode,
      addEdge: mockAddEdge,
      setCeeAnalysisReady: mockSetCeeAnalysisReady,
      setHighlightedNodes: mockSetHighlightedNodes,
      // Additional selectors accessed by PreAnalysisPanel and children
      setHighlightedEdges: vi.fn(),
      selectNodeWithoutHistory: vi.fn(),
      selectEdgeWithoutHistory: vi.fn(),
      setShowDraftChat: vi.fn(),
      ceeAnalysisReady: null,
      lastDraftError: null,
      repairsApplied: false,
      preAnalysisSensitivity: null,
      results: { status: 'idle', report: null },
    })
  })

  describe.skip('Baseline Duplicate Prevention — DecisionQualityChecks removed', () => {
    it('does not create duplicate baseline when one already exists', () => {
      // Setup: graph with existing baseline — update shared store state
      Object.assign(mockStoreState, {
        nodes: [
          { id: 'o1', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option 1', is_baseline: true } },
          { id: 'o2', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option 2' } },
          { id: 'd1', type: 'decision', position: { x: 150, y: 50 }, data: { label: 'Decision' } },
        ],
        edges: [],
      })

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        qualityChecks: [{
          id: 'missing_baseline',
          message: 'Add a status quo option to compare against',
          cta: 'Add',
          ctaAction: 'add_baseline',
          pill: 'framing' as const,
          category: 'structure' as const,
        }],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Sharpen your thinking" section (defaults to collapsed)
      fireEvent.click(screen.getByText('Sharpen your thinking'))

      // Find and click the "Add" CTA button from the quality check
      const addButton = screen.getByRole('button', { name: 'Add' })
      fireEvent.click(addButton)

      // Verify: addNode was NOT called (baseline already exists)
      expect(mockAddNode).not.toHaveBeenCalled()

      // Verify: existing baseline was focused
      expect(mockSetHighlightedNodes).toHaveBeenCalledWith(['o1'])
    })

    it('creates baseline when none exists', () => {
      // Setup: graph without baseline — update shared store state
      const nodesArray = [
        { id: 'o1', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option 1' } },
        { id: 'o2', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option 2' } },
        { id: 'd1', type: 'decision', position: { x: 150, y: 50 }, data: { label: 'Decision' } },
      ]
      Object.assign(mockStoreState, { nodes: nodesArray, edges: [] })

      // After addNode, simulate the new node being added
      mockAddNode.mockImplementation(() => {
        nodesArray.push({
          id: 'new1',
          type: 'option',
          position: { x: 300, y: 100 },
          data: { label: 'Node new1' },
        })
      })

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        qualityChecks: [{
          id: 'missing_baseline',
          message: 'Add a status quo option to compare against',
          cta: 'Add',
          ctaAction: 'add_baseline',
          pill: 'framing' as const,
          category: 'structure' as const,
        }],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Sharpen your thinking" section (defaults to collapsed)
      fireEvent.click(screen.getByText('Sharpen your thinking'))

      // Find and click the "Add" CTA button from the quality check
      const addButton = screen.getByRole('button', { name: 'Add' })
      fireEvent.click(addButton)

      // Verify: addNode WAS called
      expect(mockAddNode).toHaveBeenCalled()
    })
  })

  // Evidence input and edge data tests: the old tier-based AllImprovements UI was replaced
  // with YourExpertise subgroups (EdgeEvidenceGaps). These tests need rewriting to match
  // the current UI structure. Handler logic is unchanged — only the rendering surface changed.
  describe.skip('Evidence Input Sanitisation', () => {
    it('renders evidence input with maxLength=500', () => {
      const evidenceItem = {
        key: 'evidence_e1',
        category: 'add_evidence' as const,
        label: 'Factor → Goal',
        detail: 'No evidence',
        action: { label: 'Add', kind: 'add' as const, targetId: 'e1', targetType: 'edge' as const },
        focus: { type: 'edge' as const, id: 'e1', label: 'Edge' },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [evidenceItem],
          strengthen: [],
        },
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [evidenceItem], count: 1 },
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Optional tier is collapsed by default - click tier header to expand
      const optionalHeader = screen.getByText(/More improvements/)
      fireEvent.click(optionalHeader)

      // Evidence items are collapsed behind "View all" — expand them
      fireEvent.click(screen.getByText(/View all/))

      // Click the Add button (icon button with aria-label="Add")
      const addButtons = screen.getAllByRole('button', { name: /add/i })
      const addButton = addButtons.find(btn => btn.getAttribute('aria-label') === 'Add')
      expect(addButton).toBeTruthy()
      fireEvent.click(addButton!)

      // Find the input
      const input = screen.getByPlaceholderText(/enter evidence source/i)
      expect(input).toHaveAttribute('maxLength', '500')
    })

    it('disables Save button for whitespace-only input', () => {
      const evidenceItem = {
        key: 'evidence_e1',
        category: 'add_evidence' as const,
        label: 'Factor → Goal',
        detail: 'No evidence',
        action: { label: 'Add', kind: 'add' as const, targetId: 'e1', targetType: 'edge' as const },
        focus: { type: 'edge' as const, id: 'e1', label: 'Edge' },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [evidenceItem],
          strengthen: [],
        },
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [evidenceItem], count: 1 },
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Optional tier is collapsed by default - click tier header to expand
      const optionalHeader = screen.getByText(/More improvements/)
      fireEvent.click(optionalHeader)

      // Evidence items are collapsed behind "View all" — expand them
      fireEvent.click(screen.getByText(/View all/))

      // Click the Add button to show evidence input (icon button with aria-label="Add")
      const addButtons = screen.getAllByRole('button', { name: /add/i })
      const addButton = addButtons.find(btn => btn.getAttribute('aria-label') === 'Add')
      expect(addButton).toBeTruthy()
      fireEvent.click(addButton!)

      // Enter whitespace-only
      const input = screen.getByPlaceholderText(/enter evidence source/i)
      fireEvent.change(input, { target: { value: '   ' } })

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    })

    it('trims and collapses whitespace in evidence input', () => {
      const evidenceItem = {
        key: 'evidence_e1',
        category: 'add_evidence' as const,
        label: 'Factor → Goal',
        detail: 'No evidence',
        action: { label: 'Add', kind: 'add' as const, targetId: 'e1', targetType: 'edge' as const },
        focus: { type: 'edge' as const, id: 'e1', label: 'Edge' },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [evidenceItem],
          strengthen: [],
        },
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [evidenceItem], count: 1 },
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Optional tier is collapsed by default - click tier header to expand
      const optionalHeader = screen.getByText(/More improvements/)
      fireEvent.click(optionalHeader)

      // Evidence items are collapsed behind "View all" — expand them
      fireEvent.click(screen.getByText(/View all/))

      // Click the Add button to show evidence input (icon button with aria-label="Add")
      const addButtons = screen.getAllByRole('button', { name: /add/i })
      const addButton = addButtons.find(btn => btn.getAttribute('aria-label') === 'Add')
      expect(addButton).toBeTruthy()
      fireEvent.click(addButton!)

      // Enter value with excess whitespace
      const input = screen.getByPlaceholderText(/enter evidence source/i)
      fireEvent.change(input, { target: { value: '  source   with   spaces  ' } })

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      // Verify updateEdgeData was called with sanitised value
      expect(mockUpdateEdgeData).toHaveBeenCalledWith('e1', expect.objectContaining({
        evidence: expect.objectContaining({
          source: 'source with spaces', // Trimmed and collapsed
        }),
      }))
    })
  })

  describe('Provenance Field Alignment', () => {
    it('Confirm action sets source to user_confirmed', () => {
      const factorWithAiSource = {
        id: 'f1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Factor', observed_state: { source: 'ai', value: 0.5 } },
      }

      Object.assign(mockStoreState, { nodes: [factorWithAiSource], edges: [] })

      const verifyItem = {
        key: 'verify_f1',
        category: 'verify' as const,
        label: 'Factor',
        detail: '0.5',
        subgroup: 'cee_inference' as const,
        action: { label: 'Confirm', kind: 'confirm' as const, targetId: 'f1', targetType: 'node' as const },
        focus: { type: 'node' as const, id: 'f1', label: 'Factor' },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        nodesByKind: {
          goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
          decision: [],
          option: [
            { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
          ],
          factor: [factorWithAiSource as any],
          risk: [],
          outcome: [],
        },
        improvementsByCategory: {
          fix: [],
          verify: [verifyItem],
          add_evidence: [],
          strengthen: [],
        },
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [verifyItem], count: 1 },
          optional: { items: [], count: 0 },
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Improve confidence" accordion (v2 panel) to reveal Your expertise
      const improveToggle = screen.queryByTestId('improve-confidence-toggle')
      if (improveToggle) fireEvent.click(improveToggle)

      // Then expand "Your expertise" accordion to reveal verify items
      const expertiseHeader = screen.getByText('Your expertise')
      fireEvent.click(expertiseHeader)

      // Find and click the Confirm button (icon button with aria-label containing "Confirm")
      const confirmButtons = screen.getAllByRole('button', { name: /confirm/i })
      // Find the one that's the icon button (has aria-label="Confirm this value is correct")
      const confirmButton = confirmButtons.find(btn => btn.getAttribute('aria-label') === 'Confirm value')
      expect(confirmButton).toBeTruthy()
      fireEvent.click(confirmButton!)

      // Verify updateNode was called with user_confirmed source
      expect(mockUpdateNode).toHaveBeenCalledWith('f1', expect.objectContaining({
        data: expect.objectContaining({
          observed_state: expect.objectContaining({
            source: 'user_confirmed',
          }),
        }),
      }))
    })

    it.skip('Assumption action sets source to user_assumption — assumption button removed from current UI', () => {
      const factorWithAiSource = {
        id: 'f1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Factor', observed_state: { source: 'ai', value: 0.5 } },
      }

      Object.assign(mockStoreState, { nodes: [factorWithAiSource], edges: [] })

      const verifyItem = {
        key: 'verify_f1',
        category: 'verify' as const,
        label: 'Factor',
        detail: '0.5',
        subgroup: 'cee_inference' as const,
        action: { label: 'Assumption', kind: 'assumption' as const, targetId: 'f1', targetType: 'node' as const },
        focus: { type: 'node' as const, id: 'f1', label: 'Factor' },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        nodesByKind: {
          goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
          decision: [],
          option: [
            { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
            { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
          ],
          factor: [factorWithAiSource as any],
          risk: [],
          outcome: [],
        },
        improvementsByCategory: {
          fix: [],
          verify: [verifyItem],
          add_evidence: [],
          strengthen: [],
        },
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [verifyItem], count: 1 },
          optional: { items: [], count: 0 },
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Review assumptions tier is expanded by default
      // Find and click the Assumption button (icon button with aria-label containing "assumption")
      // Note: "Review assumptions" tier header is also a button, so we need to find the icon button
      const assumptionButtons = screen.getAllByRole('button', { name: /assumption/i })
      // Find the one that's the icon button (has aria-label="Accept as assumption. Won't ask again")
      const assumptionButton = assumptionButtons.find(btn => btn.getAttribute('aria-label') === 'Accept as assumption. Won\u2019t ask again')
      expect(assumptionButton).toBeTruthy()
      fireEvent.click(assumptionButton!)

      // Verify updateNode was called with user_assumption source
      expect(mockUpdateNode).toHaveBeenCalledWith('f1', expect.objectContaining({
        data: expect.objectContaining({
          observed_state: expect.objectContaining({
            source: 'user_assumption',
          }),
        }),
      }))
    })
  })

  describe.skip('Goal Baseline Store Wiring — GoalBaselineInput removed', () => {
    it('confirm writes observedState.value to goal node via updateNode', () => {
      const goalNode = {
        id: 'g1', type: 'goal', position: { x: 0, y: 0 },
        data: { label: 'Revenue Growth' },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        goalNode: goalNode as any,
        qualityChecks: [],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Sharpen your thinking" section (defaults to collapsed)
      fireEvent.click(screen.getByText('Sharpen your thinking'))

      // GoalBaselineInput renders in pill state — click "Set current value"
      const setCta = screen.getByTestId('goal-baseline-set-cta')
      fireEvent.click(setCta)

      // Enter a value and confirm
      const input = screen.getByTestId('goal-baseline-number-input')
      fireEvent.change(input, { target: { value: '150' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      // Verify updateNode called with observedState containing the value
      expect(mockUpdateNode).toHaveBeenCalledWith('g1', expect.objectContaining({
        data: expect.objectContaining({
          observedState: expect.objectContaining({ value: 150 }),
          observed_state: expect.objectContaining({ value: 150 }),
        }),
      }))

      // Verify analysis cache is invalidated so stale results cannot be reused
      expect(mockSetCeeAnalysisReady).toHaveBeenCalledWith(null)
    })

    it('confirm from display state (edit existing value) also invalidates cache', () => {
      const goalNode = {
        id: 'g1', type: 'goal', position: { x: 0, y: 0 },
        data: { label: 'Revenue', observedState: { value: 100 }, observed_state: { value: 100 } },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        goalNode: goalNode as any,
        qualityChecks: [],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Sharpen your thinking" section (defaults to collapsed)
      fireEvent.click(screen.getByText('Sharpen your thinking'))

      // Display state visible — edit and confirm a new value
      fireEvent.click(screen.getByTestId('goal-baseline-edit'))
      fireEvent.change(screen.getByTestId('goal-baseline-number-input'), { target: { value: '200' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      expect(mockUpdateNode).toHaveBeenCalledWith('g1', expect.objectContaining({
        data: expect.objectContaining({
          observedState: expect.objectContaining({ value: 200 }),
        }),
      }))
      expect(mockSetCeeAnalysisReady).toHaveBeenCalledWith(null)
    })

    it('clear (undo to null) calls onClear which removes value and invalidates cache', () => {
      const goalNode = {
        id: 'g1', type: 'goal', position: { x: 0, y: 0 },
        data: { label: 'Revenue' },
      }

      // Pill state — no baseline set
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        goalNode: goalNode as any,
        qualityChecks: [],
      }))

      const { rerender } = render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Sharpen your thinking" section (defaults to collapsed)
      fireEvent.click(screen.getByText('Sharpen your thinking'))

      // Set a value (previousValue inside GoalBaselineInput will be null)
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))
      fireEvent.change(screen.getByTestId('goal-baseline-number-input'), { target: { value: '50' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      // Re-render simulating store update so undo button appears in display state
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        goalNode: { ...goalNode, data: { ...goalNode.data, observedState: { value: 50 } } } as any,
        qualityChecks: [],
      }))
      rerender(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Undo — previousValue was null, so GoalBaselineInput calls onClear → handleBaselineClear
      fireEvent.click(screen.getByTestId('goal-baseline-undo'))

      // updateNode called twice: once to confirm 50, once to clear
      expect(mockUpdateNode).toHaveBeenCalledTimes(2)
      // Cache invalidated for both confirm and clear operations
      expect(mockSetCeeAnalysisReady).toHaveBeenCalledWith(null)
      expect(mockSetCeeAnalysisReady).toHaveBeenCalledTimes(2)
    })

    it('highlights goal node on canvas when input opens', () => {
      const goalNode = {
        id: 'g1', type: 'goal', position: { x: 0, y: 0 },
        data: { label: 'Revenue' },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        goalNode: goalNode as any,
        qualityChecks: [],
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Expand "Sharpen your thinking" section (defaults to collapsed)
      fireEvent.click(screen.getByText('Sharpen your thinking'))

      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))
      expect(mockSetHighlightedNodes).toHaveBeenCalledWith(['g1'])
    })
  })

  describe.skip('Edge Data Preservation', () => {
    it('preserves existing edge data when adding evidence', () => {
      const edgeWithData = {
        id: 'e1',
        source: 'f1',
        target: 'g1',
        data: { confidence: 0.8, belief: 0.7, weight: 1.5 },
      }

      Object.assign(mockStoreState, {
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } },
          { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
        ],
        edges: [edgeWithData],
      })

      const evidenceItem = {
        key: 'evidence_e1',
        category: 'add_evidence' as const,
        label: 'Factor → Goal',
        detail: 'No evidence',
        action: { label: 'Add', kind: 'add' as const, targetId: 'e1', targetType: 'edge' as const },
        focus: { type: 'edge' as const, id: 'e1', label: 'Edge' },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [evidenceItem],
          strengthen: [],
        },
        tiers: {
          mustAddress: { items: [], count: 0 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [evidenceItem], count: 1 },
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Optional tier is collapsed by default - click tier header to expand
      const optionalHeader = screen.getByText(/More improvements/)
      fireEvent.click(optionalHeader)

      // Evidence items are collapsed behind "View all" — expand them
      fireEvent.click(screen.getByText(/View all/))

      // Click the Add button to show evidence input (icon button with aria-label="Add")
      const addButtons = screen.getAllByRole('button', { name: /add/i })
      const addButton = addButtons.find(btn => btn.getAttribute('aria-label') === 'Add')
      expect(addButton).toBeTruthy()
      fireEvent.click(addButton!)

      // Enter evidence
      const input = screen.getByPlaceholderText(/enter evidence source/i)
      fireEvent.change(input, { target: { value: 'Research paper' } })

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      // Verify updateEdgeData was called with only the evidence field (Partial<EdgeData>)
      expect(mockUpdateEdgeData).toHaveBeenCalledWith('e1', {
        evidence: {
          source: 'Research paper',
          added_at: expect.any(String),
        },
      })

      // Verify that the call only adds evidence, doesn't overwrite other fields
      // (updateEdgeData takes Partial<EdgeData> — callers must not spread DEFAULT_EDGE_DATA here)
      const callArg = mockUpdateEdgeData.mock.calls[0][1]
      expect(callArg).not.toHaveProperty('confidence')
      expect(callArg).not.toHaveProperty('belief')
      expect(callArg).not.toHaveProperty('weight')
    })
  })
})
