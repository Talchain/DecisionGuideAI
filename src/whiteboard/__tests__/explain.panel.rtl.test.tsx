// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderSandbox } from '@/test/renderSandbox'
import { screen, fireEvent, act } from '@testing-library/react'

// Mock Canvas to surface explainHighlightNodeId and a ring element
vi.mock('@/whiteboard/Canvas', () => {
  const React = require('react')
  return {
    Canvas: (props: any) => React.createElement(
      'div',
      { 'data-testid': 'canvas-root', 'data-dg-explain-highlight': props.explainHighlightNodeId || '' },
      props.explainHighlightNodeId ? React.createElement('div', { 'data-testid': 'explain-highlight-ring' }) : null
    )
  }
})

// Mock CompareView to avoid tldraw side-effects
vi.mock('@/whiteboard/CompareView', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement('div', { 'data-testid': 'compare-view' }) }
})

// Mock Panels and trigger a Δ via overrides to surface the Explain link
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

function mount(route = '/decisions/demo/sandbox/combined', flags?: any) {
  const ui = (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
      </Routes>
    </MemoryRouter>
  )
  return renderSandbox(ui, flags)
}

describe('explain.panel (open, list, highlight)', () => {
  let errSpy: any, warnSpy: any
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear()
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); localStorage.clear(); errSpy.mockRestore(); warnSpy.mockRestore() })

  it('opens via ScorePill link when Δ ≠ 0, lists rows, and highlights on click', async () => {
    // Base graph with a single Outcome scoring 15%
    const graph = { schemaVersion: 1, nodes: { o1: { id: 'o1', type: 'Outcome', title: 'Out', krImpacts: [{ krId: 'kr', deltaP50: 0.3, confidence: 0.5 }] } }, edges: {} }
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify(graph))

    mount('/decisions/demo/sandbox/combined', { sandbox: true, sandboxScore: true, sandboxWhatIf: true, sandboxExplain: true })

    // Wait for base score compute
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })

    // The mocked ScenarioPanels toggles disable on o1, producing a Δ so the link appears
    const link = await screen.findByTestId('explain-delta-link')
    fireEvent.click(link)

    // Panel visible and at least one row present
    expect(await screen.findByTestId('explain-panel')).toBeTruthy()
    const anyRow = screen.getAllByTestId(/explain-row-/)[0]
    fireEvent.click(anyRow)
    const canvas = await screen.findByTestId('canvas-root')
    expect(canvas.getAttribute('data-dg-explain-highlight')).toBeTruthy()
    // Ring element visible
    expect(await screen.findByTestId('explain-highlight-ring')).toBeTruthy()

    // After ~1200ms highlight is cleared
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); await vi.advanceTimersByTimeAsync(0) })
    // No console noise
    expect(errSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
