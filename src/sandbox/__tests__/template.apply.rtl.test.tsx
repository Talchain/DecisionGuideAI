// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

// Quiet console
let errSpy: any, warnSpy: any

// Spy analytics
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))

// Mock Canvas to avoid tldraw side-effects
vi.mock('@/whiteboard/Canvas', () => {
  const React = require('react')
  return { Canvas: () => React.createElement('div', { 'data-testid': 'canvas-root' }) }
})

// Mock Panels to minimize noise
vi.mock('@/sandbox/panels/ScenarioPanels', () => {
  const React = require('react')
  return { ScenarioPanels: () => React.createElement('div', { 'data-testid': 'panels-root' }, 'Panels') }
})

// Mock overrides store to avoid dependency on its implementation in this Templates-focused test
vi.mock('@/sandbox/state/overridesStore', () => {
  const React = require('react')
  return {
    OverridesProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useOverrides: () => ({ focusOnNodeId: null, setFocusOn: () => {} }),
  }
})

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

describe('templates apply (RTL)', () => {
  beforeEach(() => {
    localStorage.clear(); trackSpy.mockReset()
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    localStorage.clear(); trackSpy.mockReset()
    errSpy.mockRestore(); warnSpy.mockRestore()
  })

  it('applies a template, announces politely, emits telemetry, and supports undo', async () => {
    const ui = (
      <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )

    renderSandbox(ui, { sandbox: true, sandboxTemplates: true })

    // Open templates menu
    const menuBtn = await screen.findByRole('button', { name: /templates/i })
    fireEvent.click(menuBtn)
    await waitFor(() => {
      const menuNow = document.getElementById('templates-menu')
      if (!menuNow) throw new Error('menu not open yet')
    })

    // Click first template item (query inside the templates menu)
    const menu = document.getElementById('templates-menu') as HTMLElement
    expect(menu).toBeTruthy()
    const firstItem = menu.querySelector('button') as HTMLButtonElement
    expect(firstItem).toBeTruthy()
    fireEvent.click(firstItem)

    // Polite announce should render text containing "Template applied" or "Applied template"
    await screen.findByText(/(template applied|applied template)/i)

    // Telemetry should include sandbox_template_apply
    const names = trackSpy.mock.calls.map(c => c[0])
    expect(names).toContain('sandbox_template_apply')

    // Undo banner should appear with an Undo button
    const undoBtn = await screen.findByRole('button', { name: /undo/i })
    fireEvent.click(undoBtn)

    // After undo, the banner should dismiss
    await act(async () => {})
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()

    // No console noise (ignore React Router future flag warnings)
    expect(errSpy).not.toHaveBeenCalled()
    const routerWarnings = (warnSpy.mock.calls as unknown[][]).filter((c: unknown[]) => String((c && (c as any)[0]) || '').includes('React Router Future Flag Warning'))
    const otherWarnings = (warnSpy.mock.calls as unknown[][]).filter((c: unknown[]) => !String((c && (c as any)[0]) || '').includes('React Router Future Flag Warning'))
    expect(otherWarnings.length).toBe(0)
  })
})
