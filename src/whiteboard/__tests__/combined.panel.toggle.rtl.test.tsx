// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { screen, fireEvent } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

vi.doMock('@/whiteboard/Canvas', () => ({
  Canvas: () => <div data-testid="canvas-root" />
}))

vi.doMock('@/sandbox/panels/ScenarioPanels', () => ({
  ScenarioPanels: () => <div data-testid="panels-root">Panels</div>
}))

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

describe('CombinedSandboxRoute panel toggle', () => {
  const originalWidth = globalThis.innerWidth
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
    localStorage.removeItem('dgai:combined:demo:panel_collapsed')
  })
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth })
  })

  it('toggles hide/show and updates aria', async () => {
    const ui = (
      <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )

    renderSandbox(ui, { sandbox: true })

    const toggle = await screen.findByRole('button', { name: /hide panels|show panels/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Collapse
    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent(/show panels/i)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(localStorage.getItem('dgai:combined:demo:panel_collapsed')).toBe('true')

    // Expand
    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent(/hide panels/i)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(localStorage.getItem('dgai:combined:demo:panel_collapsed')).toBe('false')
  })
})
