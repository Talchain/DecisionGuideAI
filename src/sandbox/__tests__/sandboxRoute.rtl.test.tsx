import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'

// Hoisted mocks with mutable flags avoid resetModules; tests mutate this state before rendering
const __flags = { featureScenarioSandbox: false, featureWhiteboard: false }
vi.mock('@/lib/config', () => ({
  cfg: {
    supabaseUrl: '',
    supabaseAnon: '',
    openaiKey: '',
    featureWhiteboard: __flags.featureWhiteboard,
    featureScenarioSandbox: __flags.featureScenarioSandbox,
  },
  hasSupabase: false,
  isSandboxEnabled: () => __flags.featureScenarioSandbox,
  isWhiteboardEnabled: () => __flags.featureWhiteboard,
  isDecisionGraphEnabled: () => false,
}))
// Lightweight UI mocks
vi.mock('@/whiteboard/RightPanel', () => ({ RightPanel: () => <aside>RightPanel</aside> }))
vi.mock('@/whiteboard/Canvas', () => ({ Canvas: ({ decisionId }: { decisionId: string }) => <div>Canvas Loaded {decisionId}</div> }))

// Helper to render route with desired flags
const renderWithFlags = async (flags: { featureScenarioSandbox: boolean; featureWhiteboard: boolean }) => {
  __flags.featureScenarioSandbox = flags.featureScenarioSandbox
  __flags.featureWhiteboard = flags.featureWhiteboard
  const mod = await import('@/whiteboard/SandboxRoute')
  const SandboxRoute: any = (mod as any).SandboxRoute
  return render(
    <MemoryRouter initialEntries={['/decisions/abc/sandbox']}>
      <Routes>
        <Route path="/decisions/:decisionId/sandbox" element={<SandboxRoute />} />
      </Routes>
    </MemoryRouter>
  )
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
    await renderWithFlags({ featureScenarioSandbox: true, featureWhiteboard: true })

    // Suspense fallback initially
    expect(screen.getByText(/Loading…/i)).toBeInTheDocument()

    // Then the mocked canvas appears
    expect(await screen.findByText(/Canvas Loaded/i)).toBeInTheDocument()
  })
})
