// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, act } from '@testing-library/react'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'
import { FlagsProvider } from '@/lib/flags'

// Mock analytics to capture telemetry
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))

// Mock Canvas to avoid TL internals but keep GraphProvider context
vi.mock('@/whiteboard/Canvas', () => ({
  Canvas: () => React.createElement('div', { 'data-testid': 'mock-canvas' })
}))

vi.mock('@/whiteboard/tldraw', () => ({ Tldraw: () => null }))

describe('score.telemetry', () => {
  beforeEach(() => { vi.useFakeTimers(); trackSpy.mockReset(); localStorage.clear() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); localStorage.clear(); trackSpy.mockReset() })

  it('emits sandbox_graph_score_update after debounced compute', async () => {
    // Seed graph with one Outcome KR (15%)
    const graph = { schemaVersion: 1, nodes: { o1: { id: 'o1', type: 'Outcome', title: 'Out', krImpacts: [{ krId: 'kr', deltaP50: 0.3, confidence: 0.5 }] } }, edges: {} }
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify(graph))

    render(
      React.createElement(FlagsProvider, {
        value: { sandbox: true, sandboxScore: true },
        children: React.createElement(MemoryRouter, {
          initialEntries: [`/decisions/demo/sandbox/combined`]
        }, React.createElement(Routes, null,
          React.createElement(Route, { path: '/decisions/:decisionId/sandbox/combined', element: React.createElement(CombinedSandboxRoute, {}) })
        ))
      })
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    const events = trackSpy.mock.calls.map(c => c[0])
    expect(events.includes('sandbox_graph_score_update')).toBe(true)
  })
})
