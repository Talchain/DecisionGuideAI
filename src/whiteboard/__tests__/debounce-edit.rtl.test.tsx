// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import React from 'react'

// Hoisted shared refs to avoid hoist errors
const { storeListenerRef, currentSnapshotRef } = vi.hoisted(() => ({
  storeListenerRef: { current: null as null | (() => void) },
  currentSnapshotRef: { current: { shapes: [{ id: 'init' }], bindings: [] } as any },
}))

// Mock Tldraw to immediately call onMount with a controllable editor
vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: { onMount?: (editor: any) => void }) => {
    const store = {
      loadSnapshot: vi.fn(),
      getSnapshot: () => currentSnapshotRef.current,
      listen: (cb: () => void, _opts?: any) => {
        storeListenerRef.current = cb
        return () => { storeListenerRef.current = null }
      },
    }
    const editor = { store }
    onMount?.(editor)
    return null as any
  },
}))

// Mock persistence & projection (hoisted fns)
const mocks = vi.hoisted(() => {
  return {
    ensureCanvasForDecision: vi.fn().mockResolvedValue({ canvasId: 'cv_1' }),
    loadCanvasDoc: vi.fn().mockResolvedValue({ meta: { decision_id: 'dec_1', kind: 'sandbox' }, shapes: [], bindings: [] }),
    saveCanvasDoc: vi.fn().mockResolvedValue(undefined),
    writeProjection: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../persistence', () => ({
  ensureCanvasForDecision: mocks.ensureCanvasForDecision,
  loadCanvasDoc: mocks.loadCanvasDoc,
  saveCanvasDoc: mocks.saveCanvasDoc,
}))
vi.mock('../projection', () => ({
  writeProjection: mocks.writeProjection,
}))

// Mock seed to avoid DB calls and return a minimal doc immediately
const seedMocks = vi.hoisted(() => ({
  loadSeed: vi.fn().mockResolvedValue({ doc: { meta: { decision_id: 'dec_1', kind: 'sandbox' }, shapes: [], bindings: [] } })
}))
vi.mock('../seed', () => ({
  loadSeed: seedMocks.loadSeed,
}))

import { Canvas } from '../Canvas'

describe('Canvas editor change debounce', () => {
  beforeEach(() => {
    mocks.ensureCanvasForDecision.mockClear()
    mocks.loadCanvasDoc.mockClear()
    mocks.saveCanvasDoc.mockClear()
    mocks.writeProjection.mockClear()
    currentSnapshotRef.current = { shapes: [{ id: 'init' }], bindings: [] }
    storeListenerRef.current = null
  })

  it('debounces multiple editor store change events and saves once with last snapshot', async () => {
    render(<Canvas decisionId="dec_1" persistDelayMs={0} persistOnlyWithTldraw />)

    // Wait until Canvas doc is ready (overlay appears)
    await screen.findByText(/Scenario Sandbox \(MVP\)/i)
    // Ignore initial persist triggered by first doc set
    mocks.saveCanvasDoc.mockClear()
    mocks.writeProjection.mockClear()
    // Ensure onMount ran and listener is attached
    await waitFor(() => {
      expect(typeof storeListenerRef.current).toBe('function')
    })

    // Two rapid store events with different snapshots
    await act(async () => {
      currentSnapshotRef.current = { shapes: [{ id: 'a' }], bindings: [] }
      storeListenerRef.current?.()
      currentSnapshotRef.current = { shapes: [{ id: 'b' }], bindings: [] }
      storeListenerRef.current?.()
    })

    // Wait for debounced persistence (persistDelayMs=0 in this test)
    await waitFor(() => expect(mocks.saveCanvasDoc).toHaveBeenCalledTimes(1))
    const [calledCanvasId, calledDoc] = mocks.saveCanvasDoc.mock.calls[0]
    expect(calledCanvasId).toBe('cv_1')
    expect(calledDoc.tldraw).toEqual({ shapes: [{ id: 'b' }], bindings: [] })

    // Projection is also written once with last doc
    expect(mocks.writeProjection).toHaveBeenCalledTimes(1)
  })
})
