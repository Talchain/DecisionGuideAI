// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

// Hoisted flags so we can vary them per test via resetModules()
const flags = vi.hoisted(() => ({ sandbox: true, whiteboard: false }))

// Mock cfg and helpers using dynamic flags
vi.mock('@/lib/config', () => ({
  cfg: {
    get featureWhiteboard() { return flags.whiteboard },
    get featureScenarioSandbox() { return flags.sandbox },
    supabaseUrl: '', supabaseAnon: '', openaiKey: ''
  },
  isSandboxEnabled: () => flags.sandbox,
}))

// Mock ScenarioSandboxMock with a tiny component
vi.mock('@/sandbox/ui/ScenarioSandboxMock', () => ({
  ScenarioSandboxMock: () => <div>Mock OK</div>
}))

// Router helper
async function renderAt(path: string) {
  const { SandboxRoute } = await import('../SandboxRoute')
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/decisions/:decisionId/sandbox" element={<SandboxRoute />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.resetModules()
})

describe('SandboxRoute flag + error resilience', () => {
  it('sandbox=false -> shows Not Enabled; no lazy import attempted', async () => {
    flags.sandbox = false
    flags.whiteboard = false

    const { container } = await renderAt('/decisions/abc/sandbox')

    expect(container.textContent).toMatch(/not enabled/i)
    expect(screen.queryByTestId('sandbox-loading')).toBeNull()
    expect(screen.queryByTestId('sandbox-mock')).toBeNull()
    expect(screen.queryByTestId('sandbox-real')).toBeNull()
  })

  it('sandbox=true, whiteboard=false -> loads mock; spinner shows then disappears', async () => {
    flags.sandbox = true
    flags.whiteboard = false

    // Delay the mock import to force Suspense fallback
    vi.doMock('@/sandbox/ui/ScenarioSandboxMock', async () => {
      await new Promise(r => setTimeout(r, 5))
      return { ScenarioSandboxMock: () => <div>Mock OK</div> }
    })

    const { rerender } = await renderAt('/decisions/abc/sandbox')

    expect(await screen.findByTestId('sandbox-loading')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('sandbox-mock')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('sandbox-loading')).toBeNull()
  })

  it('sandbox=true, whiteboard=true, real import OK -> renders real canvas root', async () => {
    flags.sandbox = true
    flags.whiteboard = true

    // Slow-load the real canvas to show spinner briefly
    vi.doMock('../Canvas', async () => {
      await new Promise(r => setTimeout(r, 5))
      return { Canvas: () => <div>Real OK</div> }
    })

    await renderAt('/decisions/abc/sandbox')

    expect(await screen.findByTestId('sandbox-loading')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('sandbox-real')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('sandbox-loading')).toBeNull()
  })

  it('sandbox=true, whiteboard=true, real import throws -> fallback; Use mock instead swaps to mock', async () => {
    flags.sandbox = true
    flags.whiteboard = true

    // Make the lazy import reject
    vi.doMock('../Canvas', () => {
      throw new Error('boom')
    })

    await renderAt('/decisions/abc/sandbox')

    // Fallback visible
    const fb = await screen.findByTestId('sandbox-fallback')
    expect(fb).toBeInTheDocument()

    // Click Use mock instead
    await screen.findByText('Use mock instead').then(btn => (btn as HTMLButtonElement).click())

    await waitFor(() => {
      expect(screen.getByTestId('sandbox-mock')).toBeInTheDocument()
    })
  })
})
