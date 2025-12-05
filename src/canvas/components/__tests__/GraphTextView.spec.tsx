import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GraphTextView } from '../GraphTextView'
import type { Node, Edge } from '@xyflow/react'

const createMockNode = (id: string, type: string, label: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label },
})

const createMockEdge = (id: string, source: string, target: string, weight?: number): Edge => ({
  id,
  source,
  target,
  data: weight !== undefined ? { weight } : undefined,
})

describe('GraphTextView', () => {
  const mockNodes: Node[] = [
    createMockNode('goal-1', 'goal', 'Maximize Revenue'),
    createMockNode('decision-1', 'decision', 'Pricing Strategy'),
    createMockNode('option-1', 'option', 'Premium Pricing'),
    createMockNode('option-2', 'option', 'Competitive Pricing'),
    createMockNode('factor-1', 'factor', 'Market Size'),
    createMockNode('risk-1', 'risk', 'Market Volatility'),
    createMockNode('outcome-1', 'outcome', 'Expected Profit'),
  ]

  const mockEdges: Edge[] = [
    createMockEdge('e1', 'decision-1', 'option-1'),
    createMockEdge('e2', 'decision-1', 'option-2'),
    createMockEdge('e3', 'option-1', 'outcome-1', 0.7),
    createMockEdge('e4', 'factor-1', 'outcome-1', 0.5),
    createMockEdge('e5', 'risk-1', 'outcome-1', -0.3),
  ]

  it('renders empty state when no nodes', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={[]} edges={[]} onNodeClick={onNodeClick} />)

    expect(screen.getByTestId('graph-text-view-empty')).toBeInTheDocument()
    expect(screen.getByText('Add nodes to see structure')).toBeInTheDocument()
  })

  it('renders all node type sections with counts', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    expect(screen.getByTestId('graph-text-view')).toBeInTheDocument()
    expect(screen.getByText('Goals')).toBeInTheDocument()
    expect(screen.getByText('Decisions')).toBeInTheDocument()
    expect(screen.getByText('Options')).toBeInTheDocument()
    expect(screen.getByText('Factors')).toBeInTheDocument()
    expect(screen.getByText('Risks')).toBeInTheDocument()
    expect(screen.getByText('Outcomes')).toBeInTheDocument()
  })

  it('displays enhanced summary with node breakdown and statistics', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    // Enhanced summary shows node breakdown
    expect(screen.getByText('Node breakdown')).toBeInTheDocument()

    // Shows connected count
    expect(screen.getByText('Connected')).toBeInTheDocument()

    // Shows edges with evidence section
    expect(screen.getByText('Edges with evidence')).toBeInTheDocument()
  })

  it('calls onNodeClick when a node is clicked', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    const nodeButton = screen.getByTestId('graph-text-view-node-goal-1')
    fireEvent.click(nodeButton)

    expect(onNodeClick).toHaveBeenCalledWith('goal-1')
  })

  it('filters nodes by search query', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    const searchInput = screen.getByTestId('graph-text-view-search')
    fireEvent.change(searchInput, { target: { value: 'Pricing' } })

    // Should show nodes matching "Pricing" - use testid for precise matching
    expect(screen.getByTestId('graph-text-view-node-decision-1')).toBeInTheDocument()
    expect(screen.getByTestId('graph-text-view-node-option-1')).toBeInTheDocument()
    expect(screen.getByTestId('graph-text-view-node-option-2')).toBeInTheDocument()

    // Should not show non-matching nodes in their sections
    expect(screen.queryByTestId('graph-text-view-node-goal-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('graph-text-view-node-factor-1')).not.toBeInTheDocument()
  })

  it('toggles section expansion when section header is clicked', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    // Initially expanded, node should be visible
    expect(screen.getByTestId('graph-text-view-node-goal-1')).toBeInTheDocument()

    // Find and click the Goals section toggle
    const goalsSection = screen.getByTestId('graph-text-view-section-goal')
    const toggleButton = goalsSection.querySelector('button[aria-expanded]')
    expect(toggleButton).toBeInTheDocument()

    fireEvent.click(toggleButton!)

    // After collapsing, node should not be visible
    expect(screen.queryByTestId('graph-text-view-node-goal-1')).not.toBeInTheDocument()

    // Click again to expand
    fireEvent.click(toggleButton!)

    // Node should be visible again
    expect(screen.getByTestId('graph-text-view-node-goal-1')).toBeInTheDocument()
  })

  it('displays outgoing connections with edge weights', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    // Option-1 has an edge to outcome-1 with weight 0.7
    const optionSection = screen.getByTestId('graph-text-view-section-option')
    expect(optionSection).toHaveTextContent('Expected Profit')
    expect(optionSection).toHaveTextContent('weight: +0.7')
  })

  it('copy button copies structure to clipboard', async () => {
    const onNodeClick = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    const copyButton = screen.getByTestId('graph-text-view-copy')
    fireEvent.click(copyButton)

    expect(writeText).toHaveBeenCalled()
    const clipboardContent = writeText.mock.calls[0][0]
    expect(clipboardContent).toContain('DECISION GRAPH STRUCTURE')
    expect(clipboardContent).toContain('GOALS (1)')
    expect(clipboardContent).toContain('Maximize Revenue')
    expect(clipboardContent).toContain('CONNECTIONS: 5 edges')
  })

  it('handles nodes with missing type gracefully', () => {
    const onNodeClick = vi.fn()
    const nodeWithNoType: Node = {
      id: 'unknown-1',
      position: { x: 0, y: 0 },
      data: { label: 'Unknown Node' },
    }

    render(
      <GraphTextView
        nodes={[nodeWithNoType]}
        edges={[]}
        onNodeClick={onNodeClick}
      />
    )

    // Should default to 'decision' type and render without error
    expect(screen.getByTestId('graph-text-view')).toBeInTheDocument()
    expect(screen.getByText('Decisions')).toBeInTheDocument()
    expect(screen.getByText('Unknown Node')).toBeInTheDocument()
  })

  it('renders with accessible search input', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    const searchInput = screen.getByTestId('graph-text-view-search')
    expect(searchInput).toHaveAttribute('aria-label', 'Search nodes')
    expect(searchInput).toHaveAttribute('placeholder', 'Search nodes...')
  })

  it('section headers have proper aria attributes', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    const goalsSection = screen.getByTestId('graph-text-view-section-goal')
    const toggleButton = goalsSection.querySelector('button[aria-expanded]')
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    expect(toggleButton).toHaveAttribute('aria-controls', 'graph-section-goal')
  })
})
