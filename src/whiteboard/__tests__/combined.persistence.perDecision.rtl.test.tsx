// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { FlagsProvider } from '@/lib/flags'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

// Hoisted lightweight mocks
vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = {
      updateInstanceState: vi.fn(),
      setCurrentTool: vi.fn(),
      undo: vi.fn(), redo: vi.fn(),
      zoomIn: vi.fn(), zoomOut: vi.fn(), zoomToFit: vi.fn(),
      store: {
        loadSnapshot: vi.fn(),
        getSnapshot: vi.fn(() => ({})),
        listen: vi.fn(() => () => {}),
      },
    }
    onMount?.(editor)
    return <div data-testid="tldraw-mock" />
  },
}))
vi.mock('@/sandbox/panels/IntelligencePanel', () => ({ IntelligencePanel: () => <div aria-label="Intelligence Panel" /> }))
vi.mock('@/sandbox/panels/GoalsOkrsPanel', () => ({ GoalsOkrsPanel: () => <div aria-label="Goals Panel" /> }))

const renderCombined = (decisionId: string) => {
  return render(
    <ThemeProvider>
      <FlagsProvider value={{ sandbox: true, scenarioSnapshots: true } as any}>
        <MemoryRouter initialEntries={[`/decisions/${decisionId}/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    </ThemeProvider>
  )
}

describe('Combined route — per-decision persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('persists width/collapse per decision and clamps width on restore', async () => {
    // Seed two decisions with different states
    const A = 'A', B = 'B'
    localStorage.setItem(`dgai:combined:${A}:panel_collapsed`, 'true')
    localStorage.setItem(`dgai:combined:${A}:panel_w`, '420')
    localStorage.setItem(`dgai:combined:${B}:panel_collapsed`, 'false')
    localStorage.setItem(`dgai:combined:${B}:panel_w`, '800') // will clamp to viewport - minCanvas

    // Decision A
    const { unmount } = renderCombined(A)
    // Collapsed → button shows "Show panels"; pick the header toggle (has aria-controls)
    const showBtns = screen.getAllByRole('button', { name: /show panels/i })
    const headerToggle = showBtns.find(el => el.getAttribute('aria-controls') === 'panels-region') as HTMLButtonElement
    expect(headerToggle).toBeTruthy()
    fireEvent.click(headerToggle)
    // Wait until the toggle reflects expanded state deterministically
    await waitFor(() => expect(screen.getByRole('button', { name: /hide panels/i })).toBeInTheDocument())
    const gridA = document.querySelector('div[style*="--panel-w:"]') as HTMLDivElement
    expect(gridA).toBeTruthy()
    const styleA = gridA.getAttribute('style') || ''
    const matchA = /--panel-w:\s*(\d+)px/.exec(styleA)
    const nowA = matchA ? Number(matchA[1]) : NaN
    expect(nowA).toBeGreaterThanOrEqual(240)

    unmount()

    // Decision B
    renderCombined(B)
    // Not collapsed initially (saved false)
    expect(screen.getByRole('button', { name: /hide panels/i })).toBeInTheDocument()
    const gridB = document.querySelector('div[style*="--panel-w:"]') as HTMLDivElement
    const styleB = gridB.getAttribute('style') || ''
    const matchB = /--panel-w:\s*(\d+)px/.exec(styleB)
    const nowB = matchB ? Number(matchB[1]) : NaN
    // Default JSDOM width ~1024 → maxAllowed = min(560, 1024-480)=544
    expect(nowB).toBeLessThanOrEqual(560)
    expect(nowB).toBeLessThanOrEqual(544)
    expect(nowB).toBeGreaterThanOrEqual(240)
  })
})
