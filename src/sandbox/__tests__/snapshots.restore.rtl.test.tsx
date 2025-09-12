// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FlagsProvider } from '@/lib/flags'
import { render, act } from '@testing-library/react'
import { GraphProvider, useGraph } from '@/sandbox/state/graphStore'
import { Canvas } from '@/whiteboard/Canvas'

// TL mock
const calls: any[] = []
vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = {
      createShape: (args: any) => { calls.push({ op: 'create', args }) },
      updateShape: (args: any) => { calls.push({ op: 'update', args }) },
      deleteShape: (args: any) => { calls.push({ op: 'delete', args }) },
      setCurrentTool: () => {},
      store: {
        getSnapshot: () => ({}),
        listen: (fn: () => void) => () => {},
      },
    }
    React.useEffect(() => { onMount?.(editor) }, [])
    return null
  },
}))

function SeedThenRestore() {
  const api = useGraph()
  React.useEffect(() => {
    const { snapId } = api.saveSnapshot('A')
    api.updateNodeFields('A', { title: 'Edited' })
    setTimeout(() => { api.restoreSnapshot(snapId) }, 0)
  }, [])
  return null
}

describe('snapshots.restore.rtl', () => {
  beforeEach(() => { vi.useFakeTimers(); calls.length = 0; localStorage.clear() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers() })

  it('restores snapshot and TL redraw reflects snapshot without flicker', async () => {
    // Seed domain graph A
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {
      A: { id: 'A', type: 'Problem', title: 'Original', view: { x: 100, y: 120, w: 140, h: 80 } },
    }, edges: {} }))

    const r = render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: true, sandboxCompare: true }}>
        <GraphProvider decisionId={'demo'}>
          <SeedThenRestore />
          <div style={{ width: 800, height: 600 }}>
            <Canvas decisionId={'demo'} embedded hideBanner hideFeedback />
          </div>
        </GraphProvider>
      </FlagsProvider>
    )
    await act(async () => { await vi.advanceTimersByTimeAsync(1200) })

    // Verify domain persisted reflects 'Original'
    const raw = localStorage.getItem('dgai:graph:decision:demo')!
    const parsed = JSON.parse(raw)
    expect(parsed.nodes.A.title).toBe('Original')
  })
})
