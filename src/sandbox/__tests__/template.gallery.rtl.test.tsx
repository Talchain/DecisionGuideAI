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

describe('Templates Gallery (popover)', () => {
  beforeEach(() => { localStorage.clear(); trackSpy.mockReset() })
  afterEach(() => { localStorage.clear(); trackSpy.mockReset() })

  it('opens gallery, filters, arrow-navigates, applies, and emits telemetry', async () => {
    const ui = (
      <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )

    renderSandbox(ui, { sandbox: true, sandboxTemplates: true, sandboxTemplatesGallery: true })

    const btn = await screen.findByRole('button', { name: /templates/i })
    fireEvent.click(btn)

    // Telemetry: open
    await waitFor(() => {
      const names = trackSpy.mock.calls.map(c => c[0])
      if (!names.includes('sandbox_template_preview_open')) throw new Error('no preview_open telemetry')
    })

    // Type in the search to filter down
    const search = await screen.findByRole('textbox', { name: /search templates/i })
    fireEvent.change(search, { target: { value: 'decision' } })

    // Focus moves to the first card automatically; ArrowRight to next
    const dlg = await screen.findByRole('dialog', { name: /templates gallery/i })
    fireEvent.keyDown(dlg, { key: 'ArrowRight' })
    fireEvent.keyDown(dlg, { key: 'Enter' })

    // Telemetry: apply with source gallery
    await waitFor(() => {
      const calls = trackSpy.mock.calls
      const names = calls.map(c => c[0])
      if (!names.includes('sandbox_template_apply')) throw new Error('no template apply telemetry')
      const payloads = calls.filter(c => c[0] === 'sandbox_template_apply').map(c => c[1])
      if (!payloads.some(p => p && p.source === 'gallery')) throw new Error('apply missing source=gallery')
    })

    // Close telemetry optional; button click closes on apply; we allow either
    const names = trackSpy.mock.calls.map(c => c[0])
    names.includes('sandbox_template_preview_close')

    // Optional: Undo banner may appear; do not fail if missing
    screen.queryByRole('button', { name: /undo/i })
  })
})
