// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { screen, fireEvent } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

// Mock Canvas and Panels to keep test tiny and deterministic
vi.doMock('@/whiteboard/Canvas', () => ({
  Canvas: () => <div data-testid="canvas-root" />
}))
vi.doMock('@/sandbox/panels/ScenarioPanels', () => ({
  ScenarioPanels: () => <div data-testid="panels-root">Panels</div>
}))

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

const DECISION = 'kbd-resize-A'

describe('CombinedSandboxRoute — divider keyboard resize', () => {
  const origW = globalThis.innerWidth
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
    localStorage.removeItem(`dgai:combined:${DECISION}:panel_w`)
  })
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: origW })
  })

  it('ArrowLeft/ArrowRight adjust width, clamped and persisted', async () => {
    const ui = (
      <MemoryRouter initialEntries={[`/decisions/${DECISION}/sandbox/combined`] }>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )

    renderSandbox(ui, { sandbox: true })

    // Start expanded; focus separator and press ArrowRight (grow)
    const sep = await screen.findByRole('separator', { name: /resize panels/i })
    sep.focus()
    const before = Number(sep.getAttribute('aria-valuenow'))
    fireEvent.keyDown(sep, { key: 'ArrowRight' })
    fireEvent.keyUp(sep, { key: 'ArrowRight' })

    const after = Number(sep.getAttribute('aria-valuenow'))
    expect(after).toBe(before + 16)

    // Persisted per decision
    const saved = Number(localStorage.getItem(`dgai:combined:${DECISION}:panel_w`) || '0')
    expect(saved).toBe(after)

    // Clamp at max
    for (let i = 0; i < 100; i++) fireEvent.keyDown(sep, { key: 'ArrowRight' })
    for (let i = 0; i < 100; i++) fireEvent.keyUp(sep, { key: 'ArrowRight' })
    const maxNow = Number(sep.getAttribute('aria-valuenow'))
    expect(maxNow).toBeLessThanOrEqual(560)
  })
})
