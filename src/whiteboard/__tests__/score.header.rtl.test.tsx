// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, fireEvent, screen, act } from '@testing-library/react'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'
import { FlagsProvider } from '@/lib/flags'

vi.mock('@/whiteboard/tldraw', () => ({ Tldraw: () => null }))

// Mock Canvas to avoid TL internals but keep GraphProvider context
vi.mock('@/whiteboard/Canvas', () => ({
  Canvas: () => {
    return React.createElement('div', { 'data-testid': 'mock-canvas' })
  }
}))

describe('score.header', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); localStorage.clear() })

  it('shows Scenario Score pill and aria-live updates on change', async () => {
    // Seed graph with one Outcome KR (15%)
    const graph = { schemaVersion: 1, nodes: { o1: { id: 'o1', type: 'Outcome', title: 'Out', krImpacts: [{ krId: 'kr', deltaP50: 0.3, confidence: 0.5 }] } }, edges: {} }
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify(graph))

    const r = render(
      <FlagsProvider value={{ sandbox: true, sandboxScore: true }}>
        <MemoryRouter initialEntries={[`/decisions/demo/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    )

    // Wait for debounced compute
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(screen.getByText(/Scenario Score:/)).toBeTruthy()
    expect(screen.getByText(/Scenario Score: 15%/)).toBeTruthy()

    // Change KR to 0.6 * 0.5 = 30%
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ ...graph, nodes: { o1: { ...graph.nodes.o1, krImpacts: [{ krId: 'kr', deltaP50: 0.6, confidence: 0.5 }] } } }))
    // Dispatch storage event to notify provider
    window.dispatchEvent(new StorageEvent('storage', { key: 'dgai:graph:decision:demo', newValue: localStorage.getItem('dgai:graph:decision:demo')! }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(screen.getByText(/Scenario Score: 30%/)).toBeTruthy()
  })
})
