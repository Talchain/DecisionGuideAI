import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeInspector } from '../../../src/canvas/ui/NodeInspector'
import { useCanvasStore } from '../../../src/canvas/store'

// Mock renderIcon
vi.mock('../../../src/canvas/helpers/renderIcon', () => ({
  renderIcon: () => null
}))

describe('Probability Editing', () => {
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
      ]
    })
  })

  it('shows outgoing edges for selected node', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)
    
    expect(screen.getByText(/Outgoing Edges \(2\)/i)).toBeInTheDocument()
    expect(screen.getByText('→ Option A')).toBeInTheDocument()
    expect(screen.getByText('→ Option B')).toBeInTheDocument()
  })

  it('displays current probability percentages', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)
    
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('updates probability when slider changes', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)
    
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(2)
    
    // Change first slider to 70%
    fireEvent.change(sliders[0], { target: { value: '70' } })
    
    const edges = useCanvasStore.getState().edges
    const edge1 = edges.find(e => e.id === 'e1')
    
    expect(edge1?.data?.confidence).toBe(0.7)
    expect(edge1?.data?.label).toBe('70%')
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
      ]
    })
    
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)
    
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/must sum to 100%/i)).toBeInTheDocument()
  })

  it('clears validation warning when probabilities sum to 100%', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)
    
    // Valid probabilities (60% + 40% = 100%)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not show outgoing edges section when node has no outgoing edges', () => {
    render(<NodeInspector nodeId="n2" onClose={() => {}} />)
    
    expect(screen.queryByText(/Outgoing Edges/i)).not.toBeInTheDocument()
  })
})
