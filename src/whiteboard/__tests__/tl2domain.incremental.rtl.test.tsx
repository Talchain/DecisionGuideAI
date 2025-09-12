// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FlagsProvider } from '@/lib/flags'
import { GraphProvider } from '@/sandbox/state/graphStore'
import { render } from '@testing-library/react'
import { Canvas } from '@/whiteboard/Canvas'

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

function makeTLEditor() {
  const shapes: any[] = []
  let cb: (() => void) | null = null
  const editor = {
    getCurrentPageShapes: () => shapes,
    getSelectedShapes: () => [],
    store: {
      getSnapshot: () => ({}),
      listen: (fn: () => void) => { cb = fn; return () => { cb = null } },
    },
  }
  return { editor, shapes, emit: () => cb?.() }
}

vi.mock('@/whiteboard/tldraw', () => {
  return {
    Tldraw: ({ onMount }: any) => {
      const { editor, shapes, emit } = makeTLEditor()
      ;(window as any).__tlShapes = shapes
      ;(window as any).__tlEmit = emit
      React.useEffect(() => { onMount?.(editor) }, [])
      return null
    }
  }
})

describe('TL→Domain incremental sync', () => {
  it('creates, renames, and deletes node; creates edge and cascades on delete', async () => {
    localStorage.setItem('dgai:canvas:decision/demo', JSON.stringify({ meta: { decision_id: 'demo', kind: 'sandbox' }, shapes: [], bindings: [], tldraw: {} }))
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {}, edges: {} }))

    render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: true, scenarioSnapshots: false, optionHandles: false, projections: false, decisionCTA: false, realtime: false, deltaReapplyV2: false, strategyBridge: false, voting: false }}>
        <MemoryRouter>
          <GraphProvider decisionId={'demo'}>
            <Canvas decisionId={'demo'} embedded={true} />
          </GraphProvider>
        </MemoryRouter>
      </FlagsProvider>
    )

    const shapes = (window as any).__tlShapes as any[]
    const emit = (window as any).__tlEmit as () => void

    // Create node A via TL
    shapes.push({ id: 'shapeA', type: 'geo', x: 100, y: 120, props: { w: 140, h: 80, text: 'A title' }, meta: { nodeId: 'A' } })
    emit(); await vi.advanceTimersByTimeAsync(1000)
    let parsed = JSON.parse(localStorage.getItem('dgai:graph:decision:demo')!)
    expect(parsed.nodes.A).toBeTruthy()
    expect(parsed.nodes.A.title).toBe('A title')

    // Rename A
    shapes[0].props.text = 'A new'
    emit(); await vi.advanceTimersByTimeAsync(1000)
    parsed = JSON.parse(localStorage.getItem('dgai:graph:decision:demo')!)
    expect(parsed.nodes.A.title).toBe('A new')

    // Create node B
    shapes.push({ id: 'shapeB', type: 'geo', x: 360, y: 120, props: { w: 160, h: 80, text: 'B' }, meta: { nodeId: 'B' } })
    emit(); await vi.advanceTimersByTimeAsync(1000)
    parsed = JSON.parse(localStorage.getItem('dgai:graph:decision:demo')!)
    expect(parsed.nodes.B).toBeTruthy()

    // Create edge E1 between A and B
    shapes.push({ id: 'edgeE1', type: 'arrow', props: { start: { boundShapeId: 'shapeA' }, end: { boundShapeId: 'shapeB' } }, meta: { edgeId: 'E1', kind: 'supports' } })
    emit(); await vi.advanceTimersByTimeAsync(1000)
    parsed = JSON.parse(localStorage.getItem('dgai:graph:decision:demo')!)
    expect(parsed.edges.E1).toBeTruthy()
    expect(parsed.edges.E1.from).toBe('A')
    expect(parsed.edges.E1.to).toBe('B')

    // Delete A in TL: should cascade delete E1
    shapes.splice(0, 1) // remove shapeA
    emit(); await vi.advanceTimersByTimeAsync(1000)
    parsed = JSON.parse(localStorage.getItem('dgai:graph:decision:demo')!)
    expect(parsed.nodes.A).toBeUndefined()
    expect(parsed.edges.E1).toBeUndefined()
  })
})
