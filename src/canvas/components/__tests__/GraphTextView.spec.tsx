import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GraphTextView, SectionErrorBoundary } from '../GraphTextView'
import type { Node, Edge } from '@xyflow/react'

const createMockNode = (id: string, type: string, label: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label },
})

const createMockEdge = (
  id: string,
  source: string,
  target: string,
  edgeData?: { beliefExists?: number; beliefStrength?: number; direction?: string }
): Edge => ({
  id,
  source,
  target,
  data: edgeData,
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
    createMockEdge('e3', 'option-1', 'outcome-1', { beliefExists: 0.8, beliefStrength: 0.7, direction: 'positive' }),
    createMockEdge('e4', 'factor-1', 'outcome-1', { beliefExists: 0.9, beliefStrength: 0.5 }),
    createMockEdge('e5', 'risk-1', 'outcome-1', { beliefExists: 0.7, beliefStrength: 0.3, direction: 'negative' }),
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

  it('displays enhanced summary with node breakdown', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    // Enhanced summary shows node breakdown
    expect(screen.getByText('Node breakdown')).toBeInTheDocument()
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

  it('displays outgoing connections with edge belief and effect', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    // Option-1 has an edge to outcome-1 with beliefStrength 0.7 and beliefExists 0.8
    const optionSection = screen.getByTestId('graph-text-view-section-option')
    expect(optionSection).toHaveTextContent('Expected Profit')
    expect(optionSection).toHaveTextContent('effect: +0.7')
    expect(optionSection).toHaveTextContent('belief: 80%')
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

  it('calls onEdgeClick when edge target is clicked', () => {
    const onNodeClick = vi.fn()
    const onEdgeClick = vi.fn()
    render(
      <GraphTextView
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
      />
    )

    // Find the option section which has an edge to outcome
    const optionSection = screen.getByTestId('graph-text-view-section-option')
    const edgeButton = optionSection.querySelector('button[title*="Focus edge"]')
    expect(edgeButton).toBeInTheDocument()

    fireEvent.click(edgeButton!)
    expect(onEdgeClick).toHaveBeenCalledWith('e3')
  })

  it('displays fragile badge for fragile edges', () => {
    const onNodeClick = vi.fn()
    const fragileEdgeIds = new Set(['e3'])

    render(
      <GraphTextView
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={onNodeClick}
        fragileEdgeIds={fragileEdgeIds}
      />
    )

    // Fragile badge should be visible
    expect(screen.getByText('Fragile')).toBeInTheDocument()
  })

  it('displays robust badge for robust edges', () => {
    const onNodeClick = vi.fn()
    const robustEdgeIds = new Set(['e4'])

    render(
      <GraphTextView
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={onNodeClick}
        robustEdgeIds={robustEdgeIds}
      />
    )

    // Robust badge should be visible
    expect(screen.getByText('✓ Robust')).toBeInTheDocument()
  })

  it('displays factor observed state with value, unit, and source', () => {
    const onNodeClick = vi.fn()
    const factorWithObservedState: Node = {
      id: 'factor-observed',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Market Share',
        observedState: {
          value: 42,
          unit: '%',
          source: 'Market research',
        },
      },
    }

    render(
      <GraphTextView
        nodes={[factorWithObservedState]}
        edges={[]}
        onNodeClick={onNodeClick}
      />
    )

    expect(screen.getByText('Market Share')).toBeInTheDocument()
    // Wave 1: values are now human-formatted (no "Value:" prefix)
    expect(screen.getByText('42%')).toBeInTheDocument()
    // Source mapped through getProvenanceLabel; unknown sources keep "Source: X" default
    expect(screen.getByText(/Source: Market research/)).toBeInTheDocument()
  })

  it('displays ± for effect when direction is unknown', () => {
    const onNodeClick = vi.fn()
    // e4 has no direction specified
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    // Factor section has edge e4 with no direction - should show ±
    const factorSection = screen.getByTestId('graph-text-view-section-factor')
    expect(factorSection).toHaveTextContent('effect: ±0.5')
  })

  it('displays negative effect for edges with negative direction', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    // Risk section has edge e5 with negative direction
    const riskSection = screen.getByTestId('graph-text-view-section-risk')
    expect(riskSection).toHaveTextContent('effect: -0.3')
  })

  it('handles edges with missing or null data gracefully', () => {
    const onNodeClick = vi.fn()
    const edgesWithBadData: Edge[] = [
      { id: 'bad-1', source: 'decision-1', target: 'option-1', data: null as any },
      { id: 'bad-2', source: 'decision-1', target: 'option-2', data: undefined },
    ]

    render(
      <GraphTextView
        nodes={mockNodes}
        edges={edgesWithBadData}
        onNodeClick={onNodeClick}
      />
    )

    // Should render without crashing
    expect(screen.getByTestId('graph-text-view')).toBeInTheDocument()
  })

  it('does not display redundant Connected or Edges with evidence stats', () => {
    const onNodeClick = vi.fn()
    render(<GraphTextView nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />)

    expect(screen.queryByText('Connected')).not.toBeInTheDocument()
    expect(screen.queryByText('Edges with evidence')).not.toBeInTheDocument()
  })

  it('renders nodes with non-string labels without crashing', () => {
    const onNodeClick = vi.fn()
    const nodesWithBadLabels: Node[] = [
      { id: 'num-label', type: 'factor', position: { x: 0, y: 0 }, data: { label: 42 } },
      { id: 'null-label', type: 'factor', position: { x: 0, y: 0 }, data: { label: null } },
      { id: 'obj-label', type: 'factor', position: { x: 0, y: 0 }, data: { label: { text: 'hi' } } },
    ]

    render(<GraphTextView nodes={nodesWithBadLabels} edges={[]} onNodeClick={onNodeClick} />)

    expect(screen.getByTestId('graph-text-view')).toBeInTheDocument()
    // Number label should be coerced to string "42"
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})

describe('SectionErrorBoundary', () => {
  it('renders fallback UI when child throws', () => {
    // Suppress React error boundary console noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Boom(): JSX.Element {
      throw new Error('test boom')
    }

    render(
      <SectionErrorBoundary section="test section">
        <Boom />
      </SectionErrorBoundary>
    )

    expect(screen.getByText('Unable to display test section.')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()

    spy.mockRestore()
  })

  it('renders children when no error', () => {
    render(
      <SectionErrorBoundary section="healthy section">
        <div data-testid="child">OK</div>
      </SectionErrorBoundary>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByText('Unable to display')).not.toBeInTheDocument()
  })
})
