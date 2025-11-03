import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeInspector } from '../../../src/canvas/ui/NodeInspector'
import { useCanvasStore } from '../../../src/canvas/store'

// Mock renderIcon
vi.mock('../../../src/canvas/helpers/renderIcon', () => ({
  renderIcon: () => null
}))

describe('Inline Probability Editing', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision' } },
        { id: 'n2', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option A' } },
        { id: 'n3', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option B' } }
      ],
      edges: [
        { id: 'e1', type: 'styled', source: 'n1', target: 'n2', data: { confidence: 0.6, label: '60%', weight: 1.0, style: 'solid' as const } },
        { id: 'e2', type: 'styled', source: 'n1', target: 'n3', data: { confidence: 0.4, label: '40%', weight: 1.0, style: 'solid' as const } }
      ],
      touchedNodeIds: new Set()
    })
  })

  it('shows inline probabilities editor for selected node', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    expect(screen.getByText(/Probabilities/i)).toBeInTheDocument()
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('displays current probability percentages in sliders and inputs', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(2)
    expect(sliders[0]).toHaveValue('60')
    expect(sliders[1]).toHaveValue('40')

    const numericInputs = screen.getAllByRole('spinbutton')
    expect(numericInputs[0]).toHaveValue(60)
    expect(numericInputs[1]).toHaveValue(40)
  })

  it('shows total validation indicator', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    expect(screen.getByText('Total: 100%')).toBeInTheDocument()
  })

  it('updates draft when slider changes (does not auto-apply)', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    const sliders = screen.getAllByRole('slider')

    // Change first slider to 70%
    fireEvent.change(sliders[0], { target: { value: '70' } })

    // Store should NOT be updated yet (draft mode)
    const edges = useCanvasStore.getState().edges
    const edge1 = edges.find(e => e.id === 'e1')

    // Edge in store should still have old value
    expect(edge1?.data?.confidence).toBe(0.6)

    // But UI should show new draft value
    expect(sliders[0]).toHaveValue('70')
  })

  it('applies changes when Apply button is clicked', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    const sliders = screen.getAllByRole('slider')

    // Change first slider to 70%
    fireEvent.change(sliders[0], { target: { value: '70' } })
    // Change second slider to 30%
    fireEvent.change(sliders[1], { target: { value: '30' } })

    // Click Apply button
    const applyButton = screen.getByRole('button', { name: /Apply/i })
    fireEvent.click(applyButton)

    // Now store should be updated
    const edges = useCanvasStore.getState().edges
    const edge1 = edges.find(e => e.id === 'e1')
    const edge2 = edges.find(e => e.id === 'e2')

    expect(edge1?.data?.confidence).toBe(0.7)
    expect(edge1?.data?.label).toBe('70%')
    expect(edge2?.data?.confidence).toBe(0.3)
    expect(edge2?.data?.label).toBe('30%')
  })

  it('shows validation warning when probabilities do not sum to 100%', () => {
    // Set invalid probabilities (sum = 80%)
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision' } },
        { id: 'n2', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option A' } },
        { id: 'n3', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option B' } }
      ],
      edges: [
        { id: 'e1', type: 'styled', source: 'n1', target: 'n2', data: { confidence: 0.5, label: '50%', weight: 1.0, style: 'solid' as const } },
        { id: 'e2', type: 'styled', source: 'n1', target: 'n3', data: { confidence: 0.3, label: '30%', weight: 1.0, style: 'solid' as const } }
      ],
      touchedNodeIds: new Set()
    })

    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    expect(screen.getByText('Total: 80%')).toBeInTheDocument()
    expect(screen.getByText(/must be 100% ±1%/i)).toBeInTheDocument()
  })

  it('disables Apply button when probabilities are invalid', () => {
    // Set invalid probabilities (sum = 80%)
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision' } },
        { id: 'n2', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option A' } },
        { id: 'n3', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option B' } }
      ],
      edges: [
        { id: 'e1', type: 'styled', source: 'n1', target: 'n2', data: { confidence: 0.5, label: '50%', weight: 1.0, style: 'solid' as const } },
        { id: 'e2', type: 'styled', source: 'n1', target: 'n3', data: { confidence: 0.3, label: '30%', weight: 1.0, style: 'solid' as const } }
      ],
      touchedNodeIds: new Set()
    })

    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    const applyButton = screen.getByRole('button', { name: /Apply/i })
    expect(applyButton).toBeDisabled()
  })

  it('shows Auto-balance and Equal split buttons', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    expect(screen.getByRole('button', { name: /Auto-balance/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Equal split/i })).toBeInTheDocument()
  })

  it('shows lock/unlock buttons for each row', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    const lockButtons = screen.getAllByRole('button', { pressed: false })
    // Filter to only lock buttons (exclude Auto-balance, Equal split, Reset, Apply)
    const lockOnlyButtons = lockButtons.filter(btn =>
      btn.getAttribute('aria-label')?.includes('Lock') ||
      btn.getAttribute('aria-label')?.includes('Unlock')
    )
    expect(lockOnlyButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('resets to original values when Reset button is clicked', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    const sliders = screen.getAllByRole('slider')

    // Change values
    fireEvent.change(sliders[0], { target: { value: '70' } })
    fireEvent.change(sliders[1], { target: { value: '30' } })

    // Click Reset
    const resetButton = screen.getByRole('button', { name: /Reset/i })
    fireEvent.click(resetButton)

    // Values should be back to original
    expect(sliders[0]).toHaveValue('60')
    expect(sliders[1]).toHaveValue('40')
  })

  it('shows empty state when node has no outgoing edges', () => {
    render(<NodeInspector nodeId="n2" onClose={() => {}} />)

    // Should show empty state message
    expect(screen.getByText(/Add connectors from this decision/i)).toBeInTheDocument()
  })

  it('applies Auto-balance algorithm correctly', () => {
    // Set rough estimates
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision' } },
        { id: 'n2', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option A' } },
        { id: 'n3', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option B' } }
      ],
      edges: [
        { id: 'e1', type: 'styled', source: 'n1', target: 'n2', data: { confidence: 0.67, label: '67%', weight: 1.0, style: 'solid' as const } },
        { id: 'e2', type: 'styled', source: 'n1', target: 'n3', data: { confidence: 0.08, label: '8%', weight: 1.0, style: 'solid' as const } }
      ],
      touchedNodeIds: new Set()
    })

    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    // Click Auto-balance
    const autoBalanceButton = screen.getByRole('button', { name: /Auto-balance/i })
    fireEvent.click(autoBalanceButton)

    // Should preserve ratio and round to 5% steps
    const sliders = screen.getAllByRole('slider')
    // 67:8 ratio normalized to 100% ≈ 89:11, rounded to 90:10
    expect(sliders[0].value).toBe('90')
    expect(sliders[1].value).toBe('10')
  })

  it('applies Equal split algorithm correctly', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    // Click Equal split
    const equalSplitButton = screen.getByRole('button', { name: /Equal split/i })
    fireEvent.click(equalSplitButton)

    // Should split equally
    const sliders = screen.getAllByRole('slider')
    expect(sliders[0].value).toBe('50')
    expect(sliders[1].value).toBe('50')
  })
})
