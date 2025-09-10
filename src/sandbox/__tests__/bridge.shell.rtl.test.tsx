// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

// Utilities: flags injected via renderSandbox

// Analytics mock
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
// ThemeProvider is provided by renderSandbox

describe('Strategy Bridge shell', () => {
  beforeEach(() => {
    // no module resets
  })
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('Flag off → legacy view (no Strategy context region)', async () => {
    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    renderSandbox(<SandboxRoute />, { sandbox: true, strategyBridge: false })
    expect(screen.queryByRole('region', { name: /Strategy context/i })).toBeNull()
  })

  it('Flag on → three regions render, tab telemetry fires once, focus management works', async () => {
    // Bridge on
    const analytics = await import('@/lib/analytics')
    const track = analytics.track as unknown as ReturnType<typeof vi.fn>

    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    renderSandbox(<SandboxRoute />, { sandbox: true, strategyBridge: true })

    // Regions are present
    expect(screen.getByRole('region', { name: /Strategy context/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Scenario canvas/i })).toBeInTheDocument()
    const right = screen.getByRole('region', { name: /Right panel/i })
    expect(right).toBeInTheDocument()

    // Initial focus lands on active tab (Goals)
    const goalsTab = screen.getByRole('tab', { name: /Goals & OKRs/i }) as HTMLButtonElement
    expect(document.activeElement).toBe(goalsTab)

    // Switch tab to Intelligence → one sandbox_panel event
    const intelTab = screen.getByRole('tab', { name: /Intelligence/i }) as HTMLButtonElement
    fireEvent.click(intelTab)
    expect(track).toHaveBeenCalledWith('sandbox_panel', expect.objectContaining({ op: 'tab_select', tab: 'intelligence' }))

    // Focus management: focus the right panel content and press Esc → returns to active tab
    ;(right as HTMLElement).focus()
    fireEvent.keyDown(right, { key: 'Escape' })
    expect(document.activeElement).toBe(intelTab)
  })

  it('Left panel shows non-blocking error if loadSeed throws; center canvas still renders', async () => {
    // Bridge on
    // Throw from loadSeed
    vi.doMock('@/sandbox/bridge/contracts', () => ({
      loadSeed: () => { throw new Error('boom') },
    }))
    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    renderSandbox(<SandboxRoute />, { sandbox: true, strategyBridge: true })
    expect(screen.getByText(/Failed to load strategy seed/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Scenario canvas/i })).toBeInTheDocument()
  })
})
