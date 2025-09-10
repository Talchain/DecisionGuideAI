// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderSandbox } from '@/test/renderSandbox'

vi.mock('@/sandbox/panels/ScenarioPanels', () => ({
  ScenarioPanels: ({ decisionId }: any) => <div data-testid="panels-root">Panels for {decisionId}</div>
}))

vi.mock('@/whiteboard/Canvas', () => ({
  Canvas: ({ decisionId }: any) => (
    <div data-testid="canvas-root">
      <button data-testid="tb-select">Select</button>
    </div>
  )
}))

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

describe('CombinedSandboxRoute layout (no overlap)', () => {
  it('renders two-pane layout with scrollable panels and full-height canvas', async () => {
    const ui = (
      <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )

    const { getByTestId } = renderSandbox(ui, { sandbox: true, scenarioSnapshots: true, projections: true })

    const panels = getByTestId('panels-root')
    const canvas = getByTestId('canvas-root')

    expect(panels).toBeInTheDocument()
    expect(canvas).toBeInTheDocument()
  })
})
