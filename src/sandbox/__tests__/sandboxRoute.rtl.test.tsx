import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'

// Helper to render route with desired flags via module mock
const renderWithFlags = async (
  flags: { featureScenarioSandbox: boolean; featureWhiteboard: boolean },
  opts: { mockCanvas?: boolean } = {}
) => {
  vi.doMock('@/lib/config', () => ({
    cfg: {
      supabaseUrl: '',
      supabaseAnon: '',
      openaiKey: '',
      featureWhiteboard: flags.featureWhiteboard,
      featureScenarioSandbox: flags.featureScenarioSandbox,
    },
    hasSupabase: false,
    isSandboxEnabled: () => flags.featureScenarioSandbox,
    isWhiteboardEnabled: () => flags.featureWhiteboard,
  }))

  // Mock RightPanel to keep test lightweight
  vi.doMock('@/whiteboard/RightPanel', () => ({
    RightPanel: () => <aside>RightPanel</aside>
  }))

  if (opts.mockCanvas) {
    vi.doMock('@/whiteboard/Canvas', () => ({
      Canvas: ({ decisionId }: { decisionId: string }) => <div>Canvas Loaded {decisionId}</div>
    }))
  }

  // Cache-bust import so per-call mocks apply without module resets
  const mod = await import(`@/whiteboard/SandboxRoute?ts=${Date.now()}&r=${Math.random()}`)
  const SandboxRoute: any = (mod as any).SandboxRoute
  const ui = (
    <MemoryRouter initialEntries={['/decisions/abc/sandbox']}>
      <Routes>
        <Route path="/decisions/:decisionId/sandbox" element={<SandboxRoute />} />
      </Routes>
    </MemoryRouter>
  )
  return render(ui)
}

describe('SandboxRoute feature gating and lazy behavior', () => {
  it('renders gated screen when feature flag disabled', async () => {
    await renderWithFlags({ featureScenarioSandbox: false, featureWhiteboard: false })
    expect(screen.getByText(/Scenario Sandbox is not enabled/i)).toBeInTheDocument()
  })

  it('renders mock when sandbox enabled and whiteboard disabled', async () => {
    await renderWithFlags({ featureScenarioSandbox: true, featureWhiteboard: false })
    expect(await screen.findByLabelText('Scenario Tile')).toBeInTheDocument()
  })

  it('shows spinner then lazy canvas when both flags enabled', async () => {
    await renderWithFlags({ featureScenarioSandbox: true, featureWhiteboard: true }, { mockCanvas: true })

    // Suspense fallback initially
    expect(screen.getByText(/Loading…/i)).toBeInTheDocument()

    // Then the mocked canvas appears
    await waitFor(() => expect(screen.getByText(/Canvas Loaded/i)).toBeInTheDocument())
  })
})
