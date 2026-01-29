/**
 * FocusModeChip tests
 * Tests visibility, clear behavior, title display, and ARIA labels
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FocusModeChip } from '../FocusModeChip'
import { useCanvasStore } from '../../store'

// Helper to create a test node
function createTestNode(id: string, label: string) {
  return {
    id,
    type: 'factor' as const,
    position: { x: 0, y: 0 },
    data: { label }
  }
}

// Helper to set up store with node selected and highlighted edges
function setupFocusMode(nodeId: string, nodeLabel: string) {
  useCanvasStore.setState({
    nodes: [createTestNode(nodeId, nodeLabel)],
    selection: { nodeIds: new Set([nodeId]), edgeIds: new Set() },
    highlightedEdges: new Set(['e1', 'e2'])
  })
}

describe('FocusModeChip', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it('does not render when no node selected', () => {
    render(<FocusModeChip />)

    expect(screen.queryByTestId('focus-mode-chip')).not.toBeInTheDocument()
  })

  it('does not render when node selected but no highlighted edges', () => {
    useCanvasStore.setState({
      nodes: [createTestNode('1', 'Test Factor')],
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() },
      highlightedEdges: new Set() // No highlighted edges
    })

    render(<FocusModeChip />)

    expect(screen.queryByTestId('focus-mode-chip')).not.toBeInTheDocument()
  })

  it('does not render when multiple nodes selected', () => {
    useCanvasStore.setState({
      nodes: [
        createTestNode('1', 'Factor 1'),
        createTestNode('2', 'Factor 2')
      ],
      selection: { nodeIds: new Set(['1', '2']), edgeIds: new Set() },
      highlightedEdges: new Set(['e1'])
    })

    render(<FocusModeChip />)

    expect(screen.queryByTestId('focus-mode-chip')).not.toBeInTheDocument()
  })

  it('renders when single node selected and highlighted edges exist', () => {
    setupFocusMode('1', 'Market Demand')

    render(<FocusModeChip />)

    expect(screen.getByTestId('focus-mode-chip')).toBeInTheDocument()
  })

  it('displays correct node title', () => {
    setupFocusMode('1', 'Market Demand')

    render(<FocusModeChip />)

    expect(screen.getByText('Market Demand')).toBeInTheDocument()
    expect(screen.getByText(/Showing paths from/)).toBeInTheDocument()
    expect(screen.getByText(/to goal/)).toBeInTheDocument()
  })

  it('truncates long node titles', () => {
    const longTitle = 'This is a very long factor name that exceeds 25 characters'
    setupFocusMode('1', longTitle)

    render(<FocusModeChip />)

    // Should truncate to 24 chars + '...'
    expect(screen.getByText(/This is a very long fact\.\.\./)).toBeInTheDocument()
    expect(screen.queryByText(longTitle)).not.toBeInTheDocument()
  })

  it('clears selection when clear button clicked', () => {
    setupFocusMode('1', 'Test Factor')

    render(<FocusModeChip />)

    // Click clear button
    const clearButton = screen.getByRole('button', { name: /clear selection/i })
    fireEvent.click(clearButton)

    // Selection should be cleared
    const { selection } = useCanvasStore.getState()
    expect(selection.nodeIds.size).toBe(0)
  })

  it('has correct ARIA attributes for accessibility', () => {
    setupFocusMode('1', 'Test Factor')

    render(<FocusModeChip />)

    const chip = screen.getByTestId('focus-mode-chip')

    // Should have role="status" for screen reader announcements
    expect(chip).toHaveAttribute('role', 'status')
    expect(chip).toHaveAttribute('aria-live', 'polite')

    // Clear button should have descriptive label
    const clearButton = screen.getByRole('button', { name: /clear selection and exit focus mode/i })
    expect(clearButton).toBeInTheDocument()
  })

  it('disappears when selection is cleared', () => {
    setupFocusMode('1', 'Test Factor')
    const { clearSelection } = useCanvasStore.getState()

    const { rerender } = render(<FocusModeChip />)

    expect(screen.getByTestId('focus-mode-chip')).toBeInTheDocument()

    // Clear selection
    clearSelection()

    rerender(<FocusModeChip />)

    expect(screen.queryByTestId('focus-mode-chip')).not.toBeInTheDocument()
  })

  it('uses design system tokens for styling', () => {
    setupFocusMode('1', 'Test Factor')

    render(<FocusModeChip />)

    const chip = screen.getByTestId('focus-mode-chip')

    // Should have design system classes
    expect(chip.className).toContain('bg-paper-50')
    expect(chip.className).toContain('border-sand-200')
    expect(chip.className).toContain('rounded-full')
  })
})
