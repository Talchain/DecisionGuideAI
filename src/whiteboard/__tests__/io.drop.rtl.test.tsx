// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { renderSandbox } from '@/test/renderSandbox'
import { screen, fireEvent, waitFor } from '@testing-library/react'

// Spy analytics
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))

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

describe('IO V2 - Drag & Drop', () => {
  beforeEach(() => { localStorage.clear(); trackSpy.mockReset() })
  afterEach(() => { localStorage.clear(); trackSpy.mockReset() })

  it('shows dropzone and imports JSON via DnD with telemetry', async () => {
    const ui = (
      <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )

    renderSandbox(ui, { sandbox: true, sandboxIO: true, sandboxIODnD: true })

    // IO container
    const io = await screen.findByTestId('io-import-btn')
    const ioContainer = io.closest('[data-dg-io]') as HTMLElement

    // Create a small valid JSON file
    const payload = { version: 1, decisionId: 'demo', graph: { schemaVersion: 1, nodes: { a: { id: 'a', type: 'Action', title: 'A' } }, edges: {} } }
    const file = new File([JSON.stringify(payload)], 'import.json', { type: 'application/json' })

    // Drag over (header-only dropzone)
    fireEvent.dragOver(ioContainer, { dataTransfer: { types: ['Files'] } as any })
    // Legend overlay appears
    await waitFor(() => {
      const overlay = document.querySelector('[data-dg-io-dropzone]')
      if (!overlay) throw new Error('dropzone not visible yet')
    })

    // Drop
    fireEvent.drop(ioContainer, { dataTransfer: { files: [file], types: ['Files'] } as any })

    // Telemetry assertions (name-only)
    await waitFor(() => {
      const names = trackSpy.mock.calls.map(c => c[0])
      if (!names.includes('sandbox_io_drop_open')) throw new Error('no drop open telemetry')
      if (!names.includes('sandbox_io_import')) throw new Error('no import telemetry')
    })
  })
})
