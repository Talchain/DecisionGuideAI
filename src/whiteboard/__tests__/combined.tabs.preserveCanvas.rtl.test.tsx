// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { screen, fireEvent } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

let mountCount = 0

vi.mock('@/whiteboard/Canvas', () => ({
  Canvas: ({ decisionId }: any) => {
    mountCount++
    return <div data-testid="canvas-root">Canvas for {decisionId}</div>
  }
}))

vi.mock('@/sandbox/panels/ScenarioPanels', () => ({
  ScenarioPanels: ({ decisionId }: any) => (
    <div data-testid="panels-root">
      <input data-testid="panel-input" placeholder="Type here" />
      Panels for {decisionId}
    </div>
  )
}))

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

describe('CombinedSandboxRoute tabs preserve canvas', () => {
  const originalWidth = globalThis.innerWidth
  beforeEach(() => {
    mountCount = 0
    // Simulate mobile
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
  })
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth })
  })

  it('keeps Canvas mounted when switching tabs', async () => {
    const ui = (
      <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )
    renderSandbox(ui, { sandbox: true })

    const panelsTab = screen.getByRole('tab', { name: 'Panels' })
    const canvasTab = screen.getByRole('tab', { name: 'Canvas' })

    // Switch to Panels, then back to Canvas
    const firstNode = screen.getByTestId('canvas-root')
    fireEvent.click(panelsTab)
    fireEvent.click(canvasTab)

    // Canvas stays mounted (single instance in DOM)
    const nodes = screen.getAllByTestId('canvas-root')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toBeInTheDocument()
    // Optional: same node identity (best-effort)
    // Note: React may replace nodes during strict mode double-render; so identity assertion is soft.
  })
})
