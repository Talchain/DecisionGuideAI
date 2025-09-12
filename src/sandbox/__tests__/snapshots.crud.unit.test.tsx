// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RenderResult, render, act } from '@testing-library/react'
import { GraphProvider, useGraph } from '@/sandbox/state/graphStore'
import { FlagsProvider } from '@/lib/flags'

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useGraph>) => void }) {
  const api = useGraph()
  React.useEffect(() => { onReady(api) }, [])
  return null
}

describe('graph snapshots CRUD (storage only)', () => {
  let cleanupFns: Array<() => void> = []
  beforeEach(() => { vi.useFakeTimers(); cleanupFns = []; localStorage.clear() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); cleanupFns.forEach(fn => fn()) })

  function renderWithGraph(decisionId = 'demo', seed?: any): Promise<ReturnType<typeof useGraph>> {
    if (seed) localStorage.setItem(`dgai:graph:decision:${decisionId}`, JSON.stringify(seed))
    return new Promise((resolve) => {
      const r = render(
        <FlagsProvider value={{ sandbox: true, sandboxMapping: false, sandboxCompare: true, scenarioSnapshots: true, optionHandles: false, projections: false, decisionCTA: false, realtime: false, deltaReapplyV2: false, strategyBridge: false, voting: false }}>
          <GraphProvider decisionId={decisionId}>
            <Harness onReady={resolve as any} />
          </GraphProvider>
        </FlagsProvider>
      )
      cleanupFns.push(() => r.unmount())
    })
  }

  it('save/list/rename/delete/duplicate', async () => {
    const api = await renderWithGraph('demo', { schemaVersion: 1, nodes: {}, edges: {} })

    // save
    await act(async () => { api.saveSnapshot('S1') })
    const list1 = api.listSnapshots()
    expect(list1.length).toBe(1)
    const s1 = list1[0]
    expect(s1.name).toBe('S1')

    // rename
    const rn = api.renameSnapshot(s1.id, 'Renamed')
    expect(rn.ok).toBe(true)
    const list2 = api.listSnapshots()
    expect(list2[0].name).toBe('Renamed')

    // duplicate
    const dup = api.duplicateSnapshot(s1.id) as any
    expect(dup.snapId).toBeTruthy()
    const list3 = api.listSnapshots()
    expect(list3.length).toBe(2)

    // delete
    const del = api.deleteSnapshot(s1.id)
    expect(del.ok).toBe(true)
    const list4 = api.listSnapshots()
    expect(list4.length).toBe(1)
  })
})
