// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { renderSandbox } from '@/test/renderSandbox'
import { screen, fireEvent, waitFor } from '@testing-library/react'

// Spy analytics
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))
vi.mock('@/lib/useTelemetry', () => ({ useTelemetry: () => ({ track: (...args: any[]) => trackSpy(...args) }) }))

// Mock heavy components
vi.mock('@/whiteboard/Canvas', () => {
  const React = require('react')
  return { Canvas: () => React.createElement('div', { 'data-testid': 'canvas-root' }) }
})
vi.mock('@/sandbox/panels/ScenarioPanels', () => {
  const React = require('react')
  return { ScenarioPanels: () => React.createElement('div', { 'data-testid': 'panels-root' }, 'Panels') }
})
// Minimal overrides store stub
vi.mock('@/sandbox/state/overridesStore', () => {
  const React = require('react')
  return {
    OverridesProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useOverrides: () => ({ focusOnNodeId: null, setFocusOn: () => {} }),
  }
})

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

describe('Export Report (Markdown)', () => {
  let warnSpy: any, errSpy: any
  beforeEach(() => {
    localStorage.clear(); trackSpy.mockReset()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    localStorage.clear(); trackSpy.mockReset()
    warnSpy?.mockRestore?.(); errSpy?.mockRestore?.()
  })

  it('exports markdown and emits telemetry', async () => {
    const ui = (
      <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )

    renderSandbox(ui, { sandbox: true, exportReport: true })

    const btn = await screen.findByRole('button', { name: /export report \(markdown\)/i })
    fireEvent.click(btn)

    await waitFor(() => {
      const names = trackSpy.mock.calls.map(c => c[0])
      if (!names.includes('sandbox_export_report')) throw new Error('no export telemetry')
    })

    // Optional: live region text
    screen.queryByTestId('data-dg-report-status')
  })
})
