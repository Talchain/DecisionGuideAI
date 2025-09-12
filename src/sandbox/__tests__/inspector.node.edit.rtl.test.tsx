// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FlagsProvider } from '@/lib/flags'
import { GraphProvider, useGraph } from '@/sandbox/state/graphStore'
import InspectorPanel from '@/sandbox/panels/InspectorPanel'

function SelectOnMount({ id }: { id: string }) {
  const { setSelectedNode } = useGraph()
  React.useEffect(() => { setSelectedNode(id) }, [id])
  return null
}

describe('InspectorPanel node edit', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('edits node title and KR impact, updating domain store (debounced)', async () => {
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {
      A: { id: 'A', type: 'Problem', title: 'Old', krImpacts: [{ krId: 'kr1', deltaP50: 0, confidence: 0 }] },
    }, edges: {} }))

    render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: true, scenarioSnapshots: false, optionHandles: false, projections: false, decisionCTA: false, realtime: false, deltaReapplyV2: false, strategyBridge: false, voting: false }}>
        <GraphProvider decisionId={'demo'}>
          <SelectOnMount id={'A'} />
          <InspectorPanel />
        </GraphProvider>
      </FlagsProvider>
    )

    // Flush initial effects (selection)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    // Title input appears
    const input = screen.getByDisplayValue('Old')
    fireEvent.change(input, { target: { value: 'New Title' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })

    // KR slider: move delta to 0.5
    const deltaSlider = screen.getByLabelText('KR 1 delta') as HTMLInputElement
    fireEvent.change(deltaSlider, { target: { value: '0.5' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })
    // Flush store save debounce (800ms)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    // Validate domain updated by reloading provider state
    // (GraphProvider persists on change)
    const raw = localStorage.getItem('dgai:graph:decision:demo')!
    const parsed = JSON.parse(raw)
    expect(parsed.nodes.A.title).toBe('New Title')
    expect(parsed.nodes.A.krImpacts[0].deltaP50).toBe(0.5)
  })
})
