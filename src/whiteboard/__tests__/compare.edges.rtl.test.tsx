// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, fireEvent } from '@testing-library/react'
import { FlagsProvider } from '@/lib/flags'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

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

describe('compare.edges', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('renders edge chips per side', async () => {
    // Current graph has E1 A->B supports
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {
      A: { id: 'A', type: 'Problem', title: 'A', view: { x: 0, y: 0, w: 100, h: 60 } },
      B: { id: 'B', type: 'Option', title: 'B', view: { x: 300, y: 0, w: 100, h: 60 } },
    }, edges: { E1: { id: 'E1', from: 'A', to: 'B', kind: 'supports' } } }))

    // Snapshot has E1 changed kind; E2 added
    const snapId = 'S2'
    localStorage.setItem(`dgai:graph:snap:list:demo`, JSON.stringify([{ id: 'S2', name: 'Snap2', createdAt: Date.now() }]))
    localStorage.setItem(`dgai:graph:snap:demo:${snapId}`, JSON.stringify({ schemaVersion: 1, nodes: {
      A: { id: 'A', type: 'Problem', title: 'A', view: { x: 0, y: 0, w: 100, h: 60 } },
      B: { id: 'B', type: 'Option', title: 'B', view: { x: 300, y: 0, w: 100, h: 60 } },
    }, edges: { E1: { id: 'E1', from: 'A', to: 'B', kind: 'causes' }, E2: { id: 'E2', from: 'B', to: 'A', kind: 'supports' } } }))

    const r = render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: true, sandboxCompare: true }}>
        <MemoryRouter initialEntries={[`/decisions/demo/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    )

    // Open compare and pick right = S2
    fireEvent.click(await r.findByText('Compare'))
    const selects = r.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'current' } })
    fireEvent.change(selects[1], { target: { value: snapId } })
    fireEvent.click(r.getByText('Open'))

    const chips = Array.from(r.container.querySelectorAll('[data-dg-diff-chip]'))
    const hasChanged = chips.some(el => el.getAttribute('data-dg-diff-chip') === 'changed')
    const hasAdded = chips.some(el => el.getAttribute('data-dg-diff-chip') === 'added')
    expect(hasChanged).toBe(true)
    expect(hasAdded).toBe(true)
  })
})
