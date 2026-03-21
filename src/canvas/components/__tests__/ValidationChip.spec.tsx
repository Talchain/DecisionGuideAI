/**
 * ValidationChip tests
 * Tests visibility, click behavior, and ARIA labels
 *
 * The validation logic (getInvalidNodes) only checks decision→option edges:
 * - Source node must have data.kind === 'decision'
 * - Target node must have data.kind === 'option'
 * - At least 2 outgoing edges with non-zero confidence
 * - The sum of non-zero confidences must equal 1.0 ± tolerance
 * - Source node must be in touchedNodeIds (or requireTouched=false)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ValidationChip } from '../ValidationChip'
import { useCanvasStore } from '../../store'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../domain/nodes'
import type { EdgeData } from '../../domain/edges'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'

/** Helper: create a node with the required kind field */
function makeNode(id: string, kind: 'decision' | 'option' | 'factor', label?: string): Node<NodeData> {
  return {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    data: { label: label ?? `Node ${id}`, kind } as NodeData,
  }
}

/** Helper: create an edge with confidence for probability validation */
function makeEdge(id: string, source: string, target: string, confidence: number): Edge<EdgeData> {
  return {
    id,
    source,
    target,
    data: { ...DEFAULT_EDGE_DATA, confidence, label: `${Math.round(confidence * 100)}%` },
  }
}

/**
 * Set up the canvas store with nodes, edges, and touched tracking.
 * Marks all decision nodes that have edges with non-zero confidence as touched.
 */
function setupStore(nodes: Node<NodeData>[], edges: Edge<EdgeData>[]) {
  const touchedNodeIds = new Set<string>()
  for (const edge of edges) {
    if ((edge.data?.confidence ?? 0) > 0) {
      touchedNodeIds.add(edge.source)
    }
  }
  useCanvasStore.setState({ nodes, edges, touchedNodeIds })
}

describe('ValidationChip', () => {
  beforeEach(() => {
    // Reset to empty canvas state
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      touchedNodeIds: new Set(),
    })
  })

  it('does not render when no validation errors', () => {
    render(<ValidationChip />)

    expect(screen.queryByTestId('validation-chip')).not.toBeInTheDocument()
  })

  it('renders when validation errors exist', () => {
    // Decision node with 2 outgoing edges to options summing to 0.9 (not 1.0)
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.5),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip />)

    expect(screen.getByTestId('validation-chip')).toBeInTheDocument()
  })

  it('displays correct count for single invalid node', () => {
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.5),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip />)

    expect(screen.getByText('Fix probabilities (1 issue)')).toBeInTheDocument()
  })

  it('displays correct count for multiple invalid nodes', () => {
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('d2', 'decision'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
      makeNode('o3', 'option'),
    ]
    const edges = [
      // d1 → o1, o2: 0.4 + 0.5 = 0.9 (invalid)
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.5),
      // d2 → o1, o3: 0.4 + 0.5 = 0.9 (invalid)
      makeEdge('e3', 'd2', 'o1', 0.4),
      makeEdge('e4', 'd2', 'o3', 0.5),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip />)

    expect(screen.getByText('Fix probabilities (2 issues)')).toBeInTheDocument()
  })

  it('calls onFocusNode with first invalid node ID when clicked', () => {
    const onFocusNode = vi.fn()

    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.5),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip onFocusNode={onFocusNode} />)

    fireEvent.click(screen.getByTestId('validation-chip'))

    expect(onFocusNode).toHaveBeenCalledWith('d1')
  })

  it('has correct ARIA attributes', () => {
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.5),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip />)

    const chip = screen.getByTestId('validation-chip')

    // Should be a button (not role="status" which is for passive live regions)
    expect(chip.tagName).toBe('BUTTON')
    expect(chip).toHaveAttribute('type', 'button')
    expect(chip).toHaveAttribute('aria-label', '1 node has invalid probabilities. Click to fix.')

    // Should have hidden live region for SR announcements
    const liveRegion = chip.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
  })

  it('has correct ARIA label for multiple nodes', () => {
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('d2', 'decision'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
      makeNode('o3', 'option'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.5),
      makeEdge('e3', 'd2', 'o1', 0.4),
      makeEdge('e4', 'd2', 'o3', 0.5),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip />)

    const chip = screen.getByTestId('validation-chip')

    expect(chip).toHaveAttribute('aria-label', '2 nodes have invalid probabilities. Click to fix.')
  })

  it('disappears when validation errors are fixed', () => {
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.5),
    ]
    setupStore(nodes, edges)

    const { rerender } = render(<ValidationChip />)

    expect(screen.getByTestId('validation-chip')).toBeInTheDocument()

    // Fix the validation error: update edge e2 so 0.4 + 0.6 = 1.0
    const fixedEdges = [
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.6),
    ]
    useCanvasStore.setState({ edges: fixedEdges })

    rerender(<ValidationChip />)

    expect(screen.queryByTestId('validation-chip')).not.toBeInTheDocument()
  })

  it('does not render for non-decision nodes', () => {
    // Factor nodes should not trigger validation even with mismatched probabilities
    const nodes = [
      makeNode('f1', 'factor'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
    ]
    const edges = [
      makeEdge('e1', 'f1', 'o1', 0.4),
      makeEdge('e2', 'f1', 'o2', 0.3),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip />)

    expect(screen.queryByTestId('validation-chip')).not.toBeInTheDocument()
  })

  it('does not render when edges target non-option nodes', () => {
    // Decision → factor edges should not be validated
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('f1', 'factor'),
      makeNode('f2', 'factor'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'f1', 0.4),
      makeEdge('e2', 'd1', 'f2', 0.3),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip />)

    expect(screen.queryByTestId('validation-chip')).not.toBeInTheDocument()
  })

  it('uses Olumi brand colors via CSS module', () => {
    const nodes = [
      makeNode('d1', 'decision'),
      makeNode('o1', 'option'),
      makeNode('o2', 'option'),
    ]
    const edges = [
      makeEdge('e1', 'd1', 'o1', 0.4),
      makeEdge('e2', 'd1', 'o2', 0.5),
    ]
    setupStore(nodes, edges)

    render(<ValidationChip />)

    const chip = screen.getByTestId('validation-chip')

    // Chip should have the CSS module class (styles use Olumi tokens in ValidationChip.module.css)
    expect(chip.className).toContain('validationChip')
    // Should have icon and label elements
    expect(chip.querySelector('svg')).toBeInTheDocument()
    expect(chip.querySelector('span:not([aria-live])')).toBeInTheDocument()
  })
})
