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
import type { PreAnalysisData, ImprovementItem } from '../hooks/usePreAnalysisData'
import { useCanvasStore } from '../../../store'

// Mock the hook
vi.mock('../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(),
}))

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

// Store action spies
const mockUpdateNode = vi.fn()
const mockUpdateEdge = vi.fn()
const mockAddNode = vi.fn()
const mockAddEdge = vi.fn()
const mockSetCeeAnalysisReady = vi.fn()
const mockSetHighlightedNodes = vi.fn()

// Mock the canvas store
vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = {
      setHighlightedNodes: mockSetHighlightedNodes,
    }
    return selector(state)
  }),
}))

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
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup store mock to return getState with proper spies
    const mockState = {
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
      addNode: mockAddNode,
      addEdge: mockAddEdge,
      setCeeAnalysisReady: mockSetCeeAnalysisReady,
      setHighlightedNodes: mockSetHighlightedNodes,
    }

    // Mock useCanvasStore.getState()
    ;(useCanvasStore as unknown as { getState: () => typeof mockState }).getState = () => mockState
  })

  describe('Baseline Duplicate Prevention', () => {
    it('does not create duplicate baseline when one already exists', () => {
      // Setup: graph with existing baseline
      const mockStateWithBaseline = {
        nodes: [
          { id: 'o1', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option 1', is_baseline: true } },
          { id: 'o2', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option 2' } },
          { id: 'd1', type: 'decision', position: { x: 150, y: 50 }, data: { label: 'Decision' } },
        ],
        edges: [],
        updateNode: mockUpdateNode,
        updateEdge: mockUpdateEdge,
        addNode: mockAddNode,
        addEdge: mockAddEdge,
        setCeeAnalysisReady: mockSetCeeAnalysisReady,
        setHighlightedNodes: mockSetHighlightedNodes,
      }
      ;(useCanvasStore as unknown as { getState: () => typeof mockStateWithBaseline }).getState = () => mockStateWithBaseline

      const fixItem = {
        key: 'missing_baseline',
        category: 'fix' as const,
        label: 'Add baseline',
        detail: 'Compare against doing nothing',
        action: { label: 'Add', kind: 'add_baseline' as const },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [fixItem],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
        tiers: {
          mustAddress: { items: [fixItem], count: 1 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [], count: 0 },
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Find and click the Add baseline button (use aria-label for icon button)
      const addButtons = screen.getAllByRole('button', { name: /add/i })
      // Find the one that is for adding baseline (not "Add target")
      const addBaselineButton = addButtons.find(btn => btn.getAttribute('aria-label') === 'Add')
      if (addBaselineButton) {
        fireEvent.click(addBaselineButton)
      }

      // Verify: addNode was NOT called (baseline already exists)
      expect(mockAddNode).not.toHaveBeenCalled()

      // Verify: existing baseline was focused
      expect(mockSetHighlightedNodes).toHaveBeenCalledWith(['o1'])
    })

    it('creates baseline when none exists', () => {
      // Setup: graph without baseline
      const mockStateWithoutBaseline = {
        nodes: [
          { id: 'o1', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option 1' } },
          { id: 'o2', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option 2' } },
          { id: 'd1', type: 'decision', position: { x: 150, y: 50 }, data: { label: 'Decision' } },
        ],
        edges: [],
        updateNode: mockUpdateNode,
        updateEdge: mockUpdateEdge,
        addNode: mockAddNode,
        addEdge: mockAddEdge,
        setCeeAnalysisReady: mockSetCeeAnalysisReady,
        setHighlightedNodes: mockSetHighlightedNodes,
      }

      // After addNode, simulate the new node being added
      mockAddNode.mockImplementation(() => {
        mockStateWithoutBaseline.nodes.push({
          id: 'new1',
          type: 'option',
          position: { x: 300, y: 100 },
          data: { label: 'Node new1' },
        })
      })

      ;(useCanvasStore as unknown as { getState: () => typeof mockStateWithoutBaseline }).getState = () => mockStateWithoutBaseline

      const fixItem = {
        key: 'missing_baseline',
        category: 'fix' as const,
        label: 'Add baseline',
        detail: 'Compare against doing nothing',
        action: { label: 'Add', kind: 'add_baseline' as const },
      }

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [fixItem],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
        tiers: {
          mustAddress: { items: [fixItem], count: 1 },
          reviewAssumptions: { items: [], count: 0 },
          optional: { items: [], count: 0 },
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Must address tier is expanded by default, find the Add icon button (not "Add target" text button)
      const addButtons = screen.getAllByRole('button', { name: /add/i })
      // Find the one with aria-label="Add" (icon button, not "Add target" text button)
      const addBaselineButton = addButtons.find(btn => btn.getAttribute('aria-label') === 'Add')
      expect(addBaselineButton).toBeTruthy()
      fireEvent.click(addBaselineButton!)

      // Verify: addNode WAS called
      expect(mockAddNode).toHaveBeenCalled()
    })
  })

  describe('Evidence Input Sanitisation', () => {
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

      // Verify updateEdge was called with sanitised value
      expect(mockUpdateEdge).toHaveBeenCalledWith('e1', expect.objectContaining({
        data: expect.objectContaining({
          evidence: expect.objectContaining({
            source: 'source with spaces', // Trimmed and collapsed
          }),
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

      const mockStateWithFactor = {
        nodes: [factorWithAiSource],
        edges: [],
        updateNode: mockUpdateNode,
        updateEdge: mockUpdateEdge,
        addNode: mockAddNode,
        addEdge: mockAddEdge,
        setCeeAnalysisReady: mockSetCeeAnalysisReady,
        setHighlightedNodes: mockSetHighlightedNodes,
      }
      ;(useCanvasStore as unknown as { getState: () => typeof mockStateWithFactor }).getState = () => mockStateWithFactor

      const verifyItem = {
        key: 'verify_f1',
        category: 'verify' as const,
        label: 'Factor',
        detail: '0.5',
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

      // Review assumptions tier is expanded by default
      // Find and click the Confirm button (icon button with aria-label containing "Confirm")
      const confirmButtons = screen.getAllByRole('button', { name: /confirm/i })
      // Find the one that's the icon button (has aria-label="Confirm this value is correct")
      const confirmButton = confirmButtons.find(btn => btn.getAttribute('aria-label') === 'Confirm this value is correct')
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

    it('Assumption action sets source to user_assumption', () => {
      const factorWithAiSource = {
        id: 'f1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Factor', observed_state: { source: 'ai', value: 0.5 } },
      }

      const mockStateWithFactor = {
        nodes: [factorWithAiSource],
        edges: [],
        updateNode: mockUpdateNode,
        updateEdge: mockUpdateEdge,
        addNode: mockAddNode,
        addEdge: mockAddEdge,
        setCeeAnalysisReady: mockSetCeeAnalysisReady,
        setHighlightedNodes: mockSetHighlightedNodes,
      }
      ;(useCanvasStore as unknown as { getState: () => typeof mockStateWithFactor }).getState = () => mockStateWithFactor

      const verifyItem = {
        key: 'verify_f1',
        category: 'verify' as const,
        label: 'Factor',
        detail: '0.5',
        // Note: Verify category renders separate Confirm/Assumption/Edit buttons
        // regardless of action.kind - they use action.targetId directly
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
      // Find the one that's the icon button (has aria-label="Accept as assumption — won't ask again")
      const assumptionButton = assumptionButtons.find(btn => btn.getAttribute('aria-label') === 'Accept as assumption \u2014 won\u2019t ask again')
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

  describe('Edge Data Preservation', () => {
    it('preserves existing edge data when adding evidence', () => {
      const edgeWithData = {
        id: 'e1',
        source: 'f1',
        target: 'g1',
        data: { confidence: 0.8, belief: 0.7, weight: 1.5 },
      }

      const mockStateWithEdge = {
        nodes: [
          { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } },
          { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
        ],
        edges: [edgeWithData],
        updateNode: mockUpdateNode,
        updateEdge: mockUpdateEdge,
        addNode: mockAddNode,
        addEdge: mockAddEdge,
        setCeeAnalysisReady: mockSetCeeAnalysisReady,
        setHighlightedNodes: mockSetHighlightedNodes,
      }
      ;(useCanvasStore as unknown as { getState: () => typeof mockStateWithEdge }).getState = () => mockStateWithEdge

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

      // Verify updateEdge was called (store merges data, so only evidence field is passed)
      expect(mockUpdateEdge).toHaveBeenCalledWith('e1', {
        data: {
          evidence: {
            source: 'Research paper',
            added_at: expect.any(String),
          },
        },
      })

      // Verify that the call only adds evidence, doesn't overwrite other fields
      // (The store's shallow merge handles this - we're just verifying the caller's shape)
      const callArg = mockUpdateEdge.mock.calls[0][1]
      expect(callArg.data).not.toHaveProperty('confidence')
      expect(callArg.data).not.toHaveProperty('belief')
      expect(callArg.data).not.toHaveProperty('weight')
    })
  })
})
