// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FlagsProvider } from '@/lib/flags'
import { render, act, fireEvent } from '@testing-library/react'
import { GraphProvider, useGraph } from '@/sandbox/state/graphStore'

function DriveDeleteAndUndo() {
  const api = useGraph()
  React.useEffect(() => {
    const { snapId } = api.saveSnapshot('X')
    api.deleteSnapshot(snapId)
    setTimeout(() => { api.undoDeleteSnapshot() }, 500)
  }, [])
  return null
}

describe('snapshots.undoDelete', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); localStorage.clear() })

  it('undo restores snapshot entry and payload', async () => {
    // seed current graph for completeness
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {}, edges: {} }))

    render(
      <FlagsProvider value={{ sandbox: true, sandboxCompare: true }}>
        <GraphProvider decisionId={'demo'}>
          <DriveDeleteAndUndo />
        </GraphProvider>
      </FlagsProvider>
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    const listRaw = localStorage.getItem('dgai:graph:snap:list:demo')
    expect(listRaw).toBeTruthy()
    const list = JSON.parse(listRaw!)
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBe(1)
    const restoredId = list[0].id
    const payload = localStorage.getItem(`dgai:graph:snap:demo:${restoredId}`)
    expect(payload).toBeTruthy()
  })
})
