// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, waitFor } from '@testing-library/react'
import { FlagsProvider } from '@/lib/flags'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

// Hoisted TL mock capturing createShape calls
const calls: any[] = []
vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = {
      createShape: (args: any) => { calls.push({ op: 'create', args }) },
      updateShape: (args: any) => { calls.push({ op: 'update', args }) },
      deleteShape: (args: any) => { calls.push({ op: 'delete', args }) },
      store: {
        loadSnapshot: (_: any) => {},
        getSnapshot: () => ({ shapes: [], bindings: [] }),
        listen: (_cb: () => void) => () => {},
      },
    }
    React.useEffect(() => { onMount?.(editor) }, [])
    return null
  },
}))

describe('graph persistence reload (nodes)', () => {
  it('rebuilds node shapes from dgai:graph:decision storage', async () => {
    const key = 'dgai:graph:decision:demo'
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, nodes: {
      A: { id: 'A', type: 'Problem', title: 'Problem A', view: { x: 100, y: 120, w: 140, h: 80 } },
      B: { id: 'B', type: 'Option', title: 'Option B', view: { x: 360, y: 120, w: 160, h: 80 } },
    }, edges: {} }))
    // Prime Canvas local snapshot so Tldraw mounts immediately
    localStorage.setItem('dgai:canvas:decision/demo', JSON.stringify({ meta: { decision_id: 'demo', kind: 'sandbox' }, shapes: [], bindings: [], tldraw: {} }))

    render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: true, scenarioSnapshots: false, optionHandles: false, projections: false, decisionCTA: false, realtime: false, deltaReapplyV2: false, strategyBridge: false, voting: false }}>
        <MemoryRouter initialEntries={['/decisions/demo/sandbox/combined']}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    )

    // Expect createShape calls for 2 nodes (mapping rebuild runs after TL mounts)
    await waitFor(() => {
      expect(calls.some(c => c.op === 'create' && c.args.meta?.nodeId === 'A')).toBe(true)
      expect(calls.some(c => c.op === 'create' && c.args.meta?.nodeId === 'B')).toBe(true)
    })
  })
})
