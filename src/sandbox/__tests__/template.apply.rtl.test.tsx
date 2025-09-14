// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { screen, fireEvent, act } from '@testing-library/react'
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

    // Click first template item
    const firstItem = await screen.findAllByRole('button', { name: /template/i }).then(list => list[0]).catch(async () => {
      // Fallback: pick any item inside the templates menu
      const items = await screen.findAllByRole('button')
      return items.find(b => (b.parentElement?.parentElement?.id === 'templates-menu')) as HTMLButtonElement
    })
    expect(firstItem).toBeTruthy()
    fireEvent.click(firstItem as HTMLButtonElement)

    // Polite announce should render text containing "Template applied" or "Applied template"
    await screen.findByText(/applied template/i)

    // Telemetry should include sandbox_template_apply
    const names = trackSpy.mock.calls.map(c => c[0])
    expect(names).toContain('sandbox_template_apply')

    // Undo banner should appear with an Undo button
    const undoBtn = await screen.findByRole('button', { name: /undo/i })
    fireEvent.click(undoBtn)

    // After undo, the banner should dismiss
    await act(async () => {})
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()

    // No console noise
    expect(errSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
