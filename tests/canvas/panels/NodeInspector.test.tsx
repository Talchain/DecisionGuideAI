import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeInspector } from '../../../src/canvas/ui/NodeInspector'
import { useCanvasStore } from '../../../src/canvas/store'

describe('NodeInspector (panel)', () => {
  beforeEach(() => {
    // Default valid graph: probabilities sum to 100%
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision Node' } },
        { id: 'n2', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option A' } },
        { id: 'n3', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option B' } }
      ],
      edges: [
        { id: 'e1', type: 'styled', source: 'n1', target: 'n2', data: { confidence: 0.6, label: '60%', weight: 1.0, style: 'solid' as const } as any },
        { id: 'e2', type: 'styled', source: 'n1', target: 'n3', data: { confidence: 0.4, label: '40%', weight: 1.0, style: 'solid' as const } as any }
      ],
      touchedNodeIds: new Set()
    })
  })

  it('renders node label and outgoing edge rows', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    // Title input shows node label
    expect(screen.getByDisplayValue('Decision Node')).toBeTruthy()
    // Outgoing edges render their target labels
    expect(screen.getByText('Option A')).toBeTruthy()
    expect(screen.getByText('Option B')).toBeTruthy()
  })

  it('shows valid total indicator when probabilities sum to 100%', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    expect(screen.getByText('Total: 100%')).toBeTruthy()
  })

  it('shows invalid total indicator when probabilities do not sum to 100%', () => {
    // Override with invalid probabilities (sum = 80%)
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision Node' } },
        { id: 'n2', type: 'option', position: { x: 100, y: 100 }, data: { label: 'Option A' } },
        { id: 'n3', type: 'option', position: { x: 200, y: 100 }, data: { label: 'Option B' } }
      ],
      edges: [
        { id: 'e1', type: 'styled', source: 'n1', target: 'n2', data: { confidence: 0.5, label: '50%', weight: 1.0, style: 'solid' as const } as any },
        { id: 'e2', type: 'styled', source: 'n1', target: 'n3', data: { confidence: 0.3, label: '30%', weight: 1.0, style: 'solid' as const } as any }
      ],
      touchedNodeIds: new Set()
    })

    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    expect(screen.getByText('Total: 80%')).toBeTruthy()
    expect(screen.getByText(/must be 100% ±1%/i)).toBeTruthy()
  })

  it('applies updated probabilities to the store when changed', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    const numericInputs = screen.getAllByRole('spinbutton')

    // Change first probability to 70% and second to 30% so total stays at 100%
    fireEvent.change(numericInputs[0], { target: { value: '70' } })
    fireEvent.change(numericInputs[1], { target: { value: '30' } })

    // Apply changes
    const applyButton = screen.getByRole('button', { name: /Apply/i })
    fireEvent.click(applyButton)

    const edges = useCanvasStore.getState().edges
    const edge1 = edges.find(e => e.id === 'e1')
    expect(edge1?.data?.confidence).toBe(0.7)
    expect(edge1?.data?.label).toBe('70%')
  })

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn()
    render(<NodeInspector nodeId="n1" onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
