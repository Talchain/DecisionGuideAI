/**
 * Integration tests for CopilotLayout
 *
 * Tests the complete user journey through the copilot variant
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import CopilotLayout from './CopilotLayout'
import { useCopilotStore } from './hooks/useCopilotStore'
import { useCanvasStore } from '@/canvas/store'
import { useResultsStore } from '@/canvas/stores/resultsStore'

// Mock ReactFlow
vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useReactFlow: () => ({
    getNode: vi.fn(),
    getEdge: vi.fn(),
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
  }),
  useOnNodesChange: vi.fn(),
  useOnEdgesChange: vi.fn(),
}))

// Mock ReactFlowGraph
vi.mock('@/canvas/ReactFlowGraph', () => ({
  ReactFlowGraph: () => <div data-testid="reactflow-graph">Canvas</div>,
}))

// Mock useResultsRun
vi.mock('@/canvas/hooks/useResultsRun', () => ({
  useResultsRun: () => ({
    run: vi.fn(),
  }),
}))

const renderLayout = () => {
  return render(
    <BrowserRouter>
      <CopilotLayout />
    </BrowserRouter>
  )
}

describe('CopilotLayout - Integration', () => {
  beforeEach(() => {
    // Reset all stores
    useCopilotStore.setState({
      journeyStage: 'empty',
      selectedElement: null,
      panelExpanded: true,
      compareMode: false,
    })

    useCanvasStore.setState({
      nodes: [],
      edges: [],
    })

    useResultsStore.setState({
      status: 'idle',
      report: null,
    })
  })

  it('should render all major components', () => {
    renderLayout()

    // Top bar
    expect(screen.getByText('Decision Coach')).toBeInTheDocument()

    // Canvas
    expect(screen.getByTestId('reactflow-graph')).toBeInTheDocument()

    // Panel - shows EmptyState
    expect(screen.getByText(/getting started/i)).toBeInTheDocument()

    // Bottom toolbar
    expect(screen.getByText(/Chat/)).toBeInTheDocument()
  })

  it('should show EmptyState initially', () => {
    renderLayout()

    expect(screen.getByText(/getting started/i)).toBeInTheDocument()
    expect(screen.getByText(/Build manually/i)).toBeInTheDocument()
  })

  it('should transition to BuildingState when nodes are added', async () => {
    renderLayout()

    // Add a node
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Test Outcome' } }],
      edges: [],
    })

    await waitFor(() => {
      expect(useCopilotStore.getState().journeyStage).toBe('building')
    })
  })

  it('should show PreRunBlockedState when graph has issues', async () => {
    renderLayout()

    // Add incomplete graph (no outcome)
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } }],
      edges: [],
    })

    await waitFor(() => {
      expect(useCopilotStore.getState().journeyStage).toBe('pre-run-blocked')
    })
  })

  it('should show InspectorState when element is selected', async () => {
    renderLayout()

    // Add node and select it
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: [],
    })

    useCopilotStore.getState().selectElement('n1')

    await waitFor(() => {
      expect(useCopilotStore.getState().journeyStage).toBe('inspector')
    })
  })

  it('should have keyboard shortcuts enabled', () => {
    renderLayout()

    // Help modal should not be visible initially
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()

    // TODO: Test keyboard shortcut triggering
    // This would require simulating keyboard events
  })

  it('should show top bar with journey stage', () => {
    useCopilotStore.setState({ journeyStage: 'building' })
    renderLayout()

    expect(screen.getByText('Building Model')).toBeInTheDocument()
  })

  it('should show bottom toolbar with actions', () => {
    renderLayout()

    expect(screen.getByText(/Chat/)).toBeInTheDocument()
    expect(screen.getByText(/shortcuts/i)).toBeInTheDocument()
  })
})
