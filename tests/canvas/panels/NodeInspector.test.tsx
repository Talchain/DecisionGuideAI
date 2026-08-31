import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeInspector } from '../../../src/canvas/ui/NodeInspector'
import { useCanvasStore } from '../../../src/canvas/store'
import { DECISION_NODE_LABEL } from '../../../src/canvas/domain/vocabulary'

describe('NodeInspector (panel)', () => {
  beforeEach(() => {
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

  it('renders node label input', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    // Title input shows node label
    expect(screen.getByDisplayValue('Decision Node')).toBeTruthy()
  })

  it('renders type as read-only text in Advanced section', () => {
    render(<NodeInspector nodeId="n1" onClose={() => {}} />)

    const typeDisplay = screen.getByTestId('read-only-node-type')
    // The node-type word comes from the vocabulary constant, never a literal —
    // a hardcoded word here is the hand-maintained mirror `DECISION_NODE_LABEL`
    // exists to abolish, and it goes stale silently at the next rename.
    expect(typeDisplay.textContent).toBe(DECISION_NODE_LABEL)
  })

  // B.I.1: Probabilities section removed — tests for probability editor no longer applicable

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn()
    render(<NodeInspector nodeId="n1" onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
