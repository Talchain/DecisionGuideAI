// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, fireEvent } from '@testing-library/react'
import { FlagsProvider } from '@/lib/flags'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

// Mock analytics to capture telemetry
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))

// TL mock
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

describe('compare.telemetry', () => {
  beforeEach(() => { trackSpy.mockReset(); localStorage.clear() })
  afterEach(() => { trackSpy.mockReset(); localStorage.clear() })

  it('emits sandbox_compare_open and sandbox_compare_close', async () => {
    // Seed an empty current graph
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {}, edges: {} }))

    const r = render(
      <FlagsProvider value={{ sandbox: true, sandboxCompare: true, sandboxMapping: true }}>
        <MemoryRouter initialEntries={[`/decisions/demo/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    )

    // Open compare and then open view
    const btnCompare = await r.findByText('Compare')
    fireEvent.click(btnCompare)
    const btnOpen = await r.findByText('Open')
    fireEvent.click(btnOpen)

    // Close compare
    const btnClose = await r.findByText('Close')
    fireEvent.click(btnClose)

    const events = trackSpy.mock.calls.map(c => c[0])
    expect(events.includes('sandbox_compare_open')).toBe(true)
    expect(events.includes('sandbox_compare_close')).toBe(true)
  })
})
