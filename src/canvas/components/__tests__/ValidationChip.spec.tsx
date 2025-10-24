/**
 * ValidationChip tests
 * Tests visibility, click behavior, and ARIA labels
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ValidationChip } from '../ValidationChip'
import { useCanvasStore } from '../../store'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'

function createEdgeWithConfidence(source: string, target: string, confidence: number) {
  return {
    source,
    target,
    data: { ...DEFAULT_EDGE_DATA, confidence, label: `${Math.round(confidence * 100)}%` }
  }
}

describe('ValidationChip', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it('does not render when no validation errors', () => {
    render(<ValidationChip />)

    expect(screen.queryByTestId('validation-chip')).not.toBeInTheDocument()
  })

  it('renders when validation errors exist', () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 100, y: 100 })

    // Add invalid edges (90% total)
    addEdge(createEdgeWithConfidence('1', '2', 0.4))
    addEdge(createEdgeWithConfidence('1', '3', 0.5))

    render(<ValidationChip />)

    expect(screen.getByTestId('validation-chip')).toBeInTheDocument()
  })

  it('displays correct count for single invalid node', () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.4))
    addEdge(createEdgeWithConfidence('1', '3', 0.5))

    render(<ValidationChip />)

    expect(screen.getByText('Fix probabilities (1 issue)')).toBeInTheDocument()
  })

  it('displays correct count for multiple invalid nodes', () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

    resetCanvas()

    // Add two invalid nodes
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 200, y: 0 })
    addNode({ x: 0, y: 100 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.4))
    addEdge(createEdgeWithConfidence('1', '3', 0.5))
    addEdge(createEdgeWithConfidence('4', '2', 0.4))
    addEdge(createEdgeWithConfidence('4', '5', 0.5))

    render(<ValidationChip />)

    expect(screen.getByText('Fix probabilities (2 issues)')).toBeInTheDocument()
  })

  it('calls onFocusNode with first invalid node ID when clicked', () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()
    const onFocusNode = vi.fn()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.4))
    addEdge(createEdgeWithConfidence('1', '3', 0.5))

    render(<ValidationChip onFocusNode={onFocusNode} />)

    fireEvent.click(screen.getByTestId('validation-chip'))

    expect(onFocusNode).toHaveBeenCalledWith('1')
  })

  it('has correct ARIA attributes', () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.4))
    addEdge(createEdgeWithConfidence('1', '3', 0.5))

    render(<ValidationChip />)

    const chip = screen.getByTestId('validation-chip')

    expect(chip).toHaveAttribute('role', 'status')
    expect(chip).toHaveAttribute('aria-label', '1 node has invalid probabilities. Click to fix.')
  })

  it('has correct ARIA label for multiple nodes', () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 200, y: 0 })
    addNode({ x: 0, y: 100 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.4))
    addEdge(createEdgeWithConfidence('1', '3', 0.5))
    addEdge(createEdgeWithConfidence('4', '2', 0.4))
    addEdge(createEdgeWithConfidence('4', '5', 0.5))

    render(<ValidationChip />)

    const chip = screen.getByTestId('validation-chip')

    expect(chip).toHaveAttribute('aria-label', '2 nodes have invalid probabilities. Click to fix.')
  })

  it('disappears when validation errors are fixed', () => {
    const { resetCanvas, addNode, addEdge, updateEdge } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.4))
    addEdge(createEdgeWithConfidence('1', '3', 0.5))

    const { rerender } = render(<ValidationChip />)

    expect(screen.getByTestId('validation-chip')).toBeInTheDocument()

    // Fix the validation error (40% + 60% = 100%)
    // Note: edge IDs are 'e1', 'e2', etc. (not '1', '2')
    updateEdge('e2', { data: { ...DEFAULT_EDGE_DATA, confidence: 0.6, label: '60%' } })

    rerender(<ValidationChip />)

    expect(screen.queryByTestId('validation-chip')).not.toBeInTheDocument()
  })

  it('uses Olumi warning color', () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.4))
    addEdge(createEdgeWithConfidence('1', '3', 0.5))

    render(<ValidationChip />)

    const chip = screen.getByTestId('validation-chip')

    expect(chip).toHaveStyle({ backgroundColor: 'var(--olumi-warning)' })
  })
})
