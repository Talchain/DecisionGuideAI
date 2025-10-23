import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeInspector } from '../../../src/canvas/panels/NodeInspector'
import type { GraphEdge } from '../../../src/templates/mapper/graphToRunRequest'

describe('NodeInspector', () => {
  const mockEdges: GraphEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2', data: { probability: 0.6 } },
    { id: 'e2', source: 'n1', target: 'n3', data: { probability: 0.4 } }
  ]

  it('renders node label and edges', () => {
    render(
      <NodeInspector
        nodeId="n1"
        nodeLabel="Decision Node"
        outgoingEdges={mockEdges}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />
    )
    
    expect(screen.getByText('Edit: Decision Node')).toBeInTheDocument()
    expect(screen.getByText('→ n2')).toBeInTheDocument()
    expect(screen.getByText('→ n3')).toBeInTheDocument()
  })

  it('shows valid sum indicator when probabilities sum to 1', () => {
    render(
      <NodeInspector
        nodeId="n1"
        nodeLabel="Decision Node"
        outgoingEdges={mockEdges}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />
    )
    
    expect(screen.getByText(/Sum: 1.000 ✓/)).toBeInTheDocument()
  })

  it('shows invalid sum indicator when probabilities do not sum to 1', () => {
    const invalidEdges: GraphEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2', data: { probability: 0.5 } },
      { id: 'e2', source: 'n1', target: 'n3', data: { probability: 0.3 } }
    ]
    
    render(
      <NodeInspector
        nodeId="n1"
        nodeLabel="Decision Node"
        outgoingEdges={invalidEdges}
        onUpdateEdge={() => {}}
        onClose={() => {}}
      />
    )
    
    expect(screen.getByText(/Sum: 0.800 \(must equal 1.0\)/)).toBeInTheDocument()
  })

  it('calls onUpdateEdge when probability changed', () => {
    const onUpdateEdge = vi.fn()
    render(
      <NodeInspector
        nodeId="n1"
        nodeLabel="Decision Node"
        outgoingEdges={mockEdges}
        onUpdateEdge={onUpdateEdge}
        onClose={() => {}}
      />
    )
    
    const input = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(input, { target: { value: '0.7' } })
    fireEvent.blur(input)
    
    expect(onUpdateEdge).toHaveBeenCalledWith('e1', 0.7)
  })

  it('calls onClose when Close button clicked', () => {
    const onClose = vi.fn()
    render(
      <NodeInspector
        nodeId="n1"
        nodeLabel="Decision Node"
        outgoingEdges={mockEdges}
        onUpdateEdge={() => {}}
        onClose={onClose}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    
    expect(onClose).toHaveBeenCalled()
  })
})
