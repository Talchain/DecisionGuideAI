// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, fireEvent } from '@testing-library/react'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'
import { FlagsProvider } from '@/lib/flags'

// Hoisted TL mock
vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = {
      updateInstanceState: () => {},
      setCurrentTool: () => {},
      store: { getSnapshot: () => ({}), listen: () => () => {} },
    }
    React.useEffect(() => { onMount?.(editor) }, [])
    return null
  },
}))

describe('compare.render', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('opens compare and shows diff chips for added/removed/changed', async () => {
    // Current graph: A (Problem) -> B (Option)
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {
      A: { id: 'A', type: 'Problem', title: 'A', view: { x: 100, y: 120, w: 140, h: 80 } },
      B: { id: 'B', type: 'Option', title: 'B', view: { x: 360, y: 120, w: 160, h: 80 } },
    }, edges: { E1: { id: 'E1', from: 'A', to: 'B', kind: 'supports' } } }))

    // Snapshot S1: A changed title; C added
    const snapId = 'S1'
    localStorage.setItem(`dgai:graph:snap:list:demo`, JSON.stringify([{ id: 'S1', name: 'Snap1', createdAt: Date.now() }]))
    localStorage.setItem(`dgai:graph:snap:demo:${snapId}`, JSON.stringify({ schemaVersion: 1, nodes: {
      A: { id: 'A', type: 'Problem', title: 'A changed', view: { x: 100, y: 120, w: 140, h: 80 } },
      C: { id: 'C', type: 'Outcome', title: 'C', view: { x: 560, y: 120, w: 160, h: 80 } },
    }, edges: {} }))

    const r = render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: true, sandboxCompare: true }}>
        <MemoryRouter initialEntries={[`/decisions/demo/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    )

    // Open compare
    const btnCompare = await r.findByText('Compare')
    fireEvent.click(btnCompare)

    // Pick left=current, right=S1
    const selects = r.getAllByRole('combobox')
    // first select is Left
    fireEvent.change(selects[0], { target: { value: 'current' } })
    // second is Right
    fireEvent.change(selects[1], { target: { value: snapId } })

    // Click Open
    const btnOpen = r.getByText('Open')
    fireEvent.click(btnOpen)

    // Expect diff chips to exist
    // Left pane should show removed node B as removed, changed A as changed
    const chips = r.container.querySelectorAll('[data-dg-diff-chip]')
    const chipVals = Array.from(chips).map(el => el.getAttribute('data-dg-diff-chip'))
    expect(chipVals.includes('changed')).toBe(true)
    expect(chipVals.includes('removed')).toBe(true)
  })
})
