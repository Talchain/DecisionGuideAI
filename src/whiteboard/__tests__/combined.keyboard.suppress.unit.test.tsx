// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderSandbox } from '@/test/renderSandbox'
import { fireEvent, screen } from '@testing-library/react'

vi.doMock('@/whiteboard/Canvas', () => ({
  Canvas: () => <div data-testid="canvas-root" />
}))

vi.doMock('@/sandbox/panels/ScenarioPanels', () => ({
  ScenarioPanels: () => (
    <div data-testid="panels-root">
      <input data-testid="panel-input" placeholder="Type here" />
    </div>
  )
}))

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

describe('CombinedSandboxRoute keyboard focus suppression', () => {
  const originalWidth = globalThis.innerWidth
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
  })
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth })
  })

  it('does not bubble canvas hotkeys when typing in panel inputs', async () => {
    const onOuterKey = vi.fn()

    const ui = (
      <div data-testid="outer" onKeyDown={onOuterKey}>
        <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </div>
    )

    renderSandbox(ui, { sandbox: true })

    const input = await screen.findByTestId('panel-input')
    input.focus()

    fireEvent.keyDown(input, { key: 'r' })
    fireEvent.keyDown(input, { key: 't' })
    fireEvent.keyDown(input, { key: 'v' })
    fireEvent.keyDown(input, { key: ' ' })

    // Aside's onKeyDownCapture stops propagation; outer handler should not run
    expect(onOuterKey).not.toHaveBeenCalled()
  })
})
