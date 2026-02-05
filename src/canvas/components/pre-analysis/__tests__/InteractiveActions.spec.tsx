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

// Mock focusNodeById
vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

describe('Interactive Actions Hardening', () => {
  const mockOnAnalyse = vi.fn()

  const createMockData = (overrides: Partial<PreAnalysisData> = {}): PreAnalysisData => ({
    improvementsByCategory: {
      fix: [],
      verify: [],
      add_evidence: [],
      strengthen: [],
    },
    totalImprovements: 0,
    topActions: [],
    evidenceQuality: { level: 'medium', ratio: 0.5 },
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
    ...overrides,
  })

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

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [{
            key: 'missing_baseline',
            category: 'fix',
            label: 'Add baseline',
            detail: 'Compare against doing nothing',
            action: { label: 'Add', kind: 'add_baseline' },
          }],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Find and click the Add baseline button
      const addBaselineButton = screen.getByRole('button', { name: /add/i })
      fireEvent.click(addBaselineButton)

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

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [{
            key: 'missing_baseline',
            category: 'fix',
            label: 'Add baseline',
            detail: 'Compare against doing nothing',
            action: { label: 'Add', kind: 'add_baseline' },
          }],
          verify: [],
          add_evidence: [],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Find and click the Add baseline button
      const addBaselineButton = screen.getByRole('button', { name: /add/i })
      fireEvent.click(addBaselineButton)

      // Verify: addNode WAS called
      expect(mockAddNode).toHaveBeenCalled()
    })
  })

  describe('Evidence Input Sanitisation', () => {
    it('renders evidence input with maxLength=500', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [{
            key: 'evidence_e1',
            category: 'add_evidence',
            label: 'Factor → Goal',
            detail: 'No evidence',
            action: { label: 'Add', kind: 'add', targetId: 'e1', targetType: 'edge' },
            focus: { type: 'edge', id: 'e1', label: 'Edge' },
          }],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Add Evidence section is collapsed by default - click "View all" to expand
      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      fireEvent.click(viewAllButton)

      // Click the Add button to show evidence input
      const addButton = screen.getByRole('button', { name: /add/i })
      fireEvent.click(addButton)

      // Find the input
      const input = screen.getByPlaceholderText(/enter evidence source/i)
      expect(input).toHaveAttribute('maxLength', '500')
    })

    it('disables Save button for whitespace-only input', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [{
            key: 'evidence_e1',
            category: 'add_evidence',
            label: 'Factor → Goal',
            detail: 'No evidence',
            action: { label: 'Add', kind: 'add', targetId: 'e1', targetType: 'edge' },
            focus: { type: 'edge', id: 'e1', label: 'Edge' },
          }],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Add Evidence section is collapsed by default - click "View all" to expand
      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      fireEvent.click(viewAllButton)

      // Click the Add button to show evidence input
      const addButton = screen.getByRole('button', { name: /add/i })
      fireEvent.click(addButton)

      // Enter whitespace-only
      const input = screen.getByPlaceholderText(/enter evidence source/i)
      fireEvent.change(input, { target: { value: '   ' } })

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    })

    it('trims and collapses whitespace in evidence input', () => {
      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [{
            key: 'evidence_e1',
            category: 'add_evidence',
            label: 'Factor → Goal',
            detail: 'No evidence',
            action: { label: 'Add', kind: 'add', targetId: 'e1', targetType: 'edge' },
            focus: { type: 'edge', id: 'e1', label: 'Edge' },
          }],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Add Evidence section is collapsed by default - click "View all" to expand
      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      fireEvent.click(viewAllButton)

      // Click the Add button to show evidence input
      const addButton = screen.getByRole('button', { name: /add/i })
      fireEvent.click(addButton)

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
          verify: [{
            key: 'verify_f1',
            category: 'verify',
            label: 'Factor',
            detail: '0.5',
            action: { label: 'Confirm', kind: 'confirm', targetId: 'f1', targetType: 'node' },
            focus: { type: 'node', id: 'f1', label: 'Factor' },
          }],
          add_evidence: [],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Find and click the Confirm button (checkmark icon)
      const confirmButtons = screen.getAllByRole('button', { name: /confirm/i })
      fireEvent.click(confirmButtons[0])

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
          verify: [{
            key: 'verify_f1',
            category: 'verify',
            label: 'Factor',
            detail: '0.5',
            // Note: Verify category renders separate Confirm/Assumption/Edit buttons
            // regardless of action.kind - they use action.targetId directly
            action: { label: 'Assumption', kind: 'assumption', targetId: 'f1', targetType: 'node' },
            focus: { type: 'node', id: 'f1', label: 'Factor' },
          }],
          add_evidence: [],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Find and click the Assumption button (question mark icon)
      const assumptionButtons = screen.getAllByRole('button', { name: /assumption/i })
      fireEvent.click(assumptionButtons[0])

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

      mockUsePreAnalysisData.mockReturnValue(createMockData({
        improvementsByCategory: {
          fix: [],
          verify: [],
          add_evidence: [{
            key: 'evidence_e1',
            category: 'add_evidence',
            label: 'Factor → Goal',
            detail: 'No evidence',
            action: { label: 'Add', kind: 'add', targetId: 'e1', targetType: 'edge' },
            focus: { type: 'edge', id: 'e1', label: 'Edge' },
          }],
          strengthen: [],
        },
        totalImprovements: 1,
      }))

      render(<PreAnalysisPanel onAnalyse={mockOnAnalyse} />)

      // Add Evidence section is collapsed by default - click "View all" to expand
      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      fireEvent.click(viewAllButton)

      // Click the Add button to show evidence input
      const addButton = screen.getByRole('button', { name: /add/i })
      fireEvent.click(addButton)

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
