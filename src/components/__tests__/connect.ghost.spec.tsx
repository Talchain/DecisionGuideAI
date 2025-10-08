import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import GraphCanvas from '../GraphCanvas'

function setup() {
  const onOp = vi.fn()
  const utils = render(
    <GraphCanvas
      nodes={[{ id: 'a', label: 'A', x: 100, y: 100 }, { id: 'b', label: 'B', x: 300, y: 100 }] as any}
      edges={[] as any}
      localEdits={{ addedNodes: [], renamedNodes: {}, addedEdges: [] }}
      onEditsChange={() => {}}
      onOp={onOp as any}
    />
  )
  return { ...utils, onOp }
}

describe('GraphCanvas connect ghost', () => {
  it('shows ghost on connect and clears on Esc', () => {
    const { getByTestId, queryByTestId } = setup()
    const toggle = getByTestId('connect-toggle-btn')
    fireEvent.click(toggle)

    const rects = Array.from(document.querySelectorAll('[data-testid="graph-node"] rect'))
    expect(rects.length).toBeGreaterThanOrEqual(2)

    // click source node (rect has the onClick handler)
    fireEvent.click(rects[0])

    // move mouse over svg to create ghost
    const svg = getByTestId('whiteboard-canvas')
    fireEvent.mouseMove(svg, { clientX: 250, clientY: 150 })

    expect(getByTestId('ghost-edge')).toBeTruthy()

    // press Esc on canvas container to cancel
    const container = getByTestId('graph-canvas')
    fireEvent.keyDown(container, { key: 'Escape' })

    expect(queryByTestId('ghost-edge')).toBeNull()

    console.log('GATES: PASS — connect ghost unit')
  })
})
