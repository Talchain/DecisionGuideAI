// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderSandbox } from '@/test/renderSandbox'
import { screen, act, fireEvent } from '@testing-library/react'

// Polyfill FontFace for tldraw in jsdom
vi.stubGlobal('FontFace', class {} as any)

// Spy analytics
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))

// Mock Canvas to reduce noise
vi.mock('@/whiteboard/Canvas', () => {
  const React = require('react')
  return {
    Canvas: () => React.createElement('div', { 'data-testid': 'canvas-root' })
  }
})

// Mock CompareView to avoid tldraw side-effects
vi.mock('@/whiteboard/CompareView', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement('div', { 'data-testid': 'compare-view' }) }
})

// Mock ScorePill to expose a deterministic Explain Δ link
vi.mock('@/whiteboard/ScorePill', () => {
  const React = require('react')
  return {
    ScorePill: (props: any) => React.createElement('button', { 'data-testid': 'explain-delta-link', onClick: () => props.onExplain?.() }, 'Explain Δ')
  }
})

// Mock Panels to trigger a Δ via overrides
vi.mock('@/sandbox/panels/ScenarioPanels', async () => {
  const React = await import('react')
  const { useOverrides } = await import('@/sandbox/state/overridesStore')
  function Driver() {
    const o = useOverrides()
    React.useEffect(() => { o.toggleNodeDisabled('o1') }, [o])
    return React.createElement('div', { 'data-testid': 'panels-root' }, 'Panels')
  }
  return { ScenarioPanels: Driver }
})

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

describe('explain.telemetry', () => {
  let errSpy: any, warnSpy: any
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear(); trackSpy.mockReset()
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    try { vi.runOnlyPendingTimers() } catch {}
    vi.useRealTimers(); localStorage.clear(); trackSpy.mockReset()
    errSpy.mockRestore(); warnSpy.mockRestore()
  })

  it('emits sandbox_score_explain_open and close with meta', async () => {
    const graph = { schemaVersion: 1, nodes: { o1: { id: 'o1', type: 'Outcome', title: 'Out', krImpacts: [{ krId: 'kr', deltaP50: 0.3, confidence: 0.5 }] } }, edges: {} }
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify(graph))

    const ui = React.createElement(MemoryRouter, { initialEntries: ["/decisions/demo/sandbox/combined"] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/decisions/:decisionId/sandbox/combined", element: React.createElement(CombinedSandboxRoute, null) })
      )
    )

    renderSandbox(ui, { sandbox: true, sandboxScore: true, sandboxWhatIf: true, sandboxExplain: true })

    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    const link = await screen.findByTestId('explain-delta-link')
    fireEvent.click(link)

    // open emitted
    const names = trackSpy.mock.calls.map(c => c[0])
    expect(names).toContain('sandbox_score_explain_open')

    const openEvt = trackSpy.mock.calls.find(c => c[0] === 'sandbox_score_explain_open')
    expect(openEvt?.[1]?.route).toBe('combined')
    expect(openEvt?.[1]?.decisionId).toBe('demo')
    expect(openEvt?.[1]?.sessionId).toBeDefined()

    // close
    const closeBtn = await screen.findByRole('button', { name: /close/i })
    fireEvent.click(closeBtn)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    const names2 = trackSpy.mock.calls.map(c => c[0])
    expect(names2).toContain('sandbox_score_explain_close')
  })
})
