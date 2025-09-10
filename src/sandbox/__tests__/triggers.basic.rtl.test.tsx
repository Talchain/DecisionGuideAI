// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, act } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

// Analytics mock
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))
// ThemeProvider is supplied by renderSandbox

// Bridge + triggers flags
const enableBridgeAndTriggers = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return {
      ...actual,
      isSandboxEnabled: () => true,
      isStrategyBridgeEnabled: () => true,
      isSandboxTriggersBasicEnabled: () => true,
      isDecisionCTAEnabled: () => true,
    }
  })
}
const disableTriggers = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return {
      ...actual,
      isSandboxEnabled: () => true,
      isStrategyBridgeEnabled: () => true,
      isSandboxTriggersBasicEnabled: () => false,
    }
  })
}

describe('Basic triggers (KR_MISS_PROJECTION)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    try { vi.runOnlyPendingTimers() } catch {}
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('CTA routing gated by flag', async () => {
    await enableBridgeAndTriggers()
    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    const { notifyRecompute } = await import('@/sandbox/state/recompute')

    window.location.hash = '#/decisions/test/sandbox?panel=intelligence'
    renderSandbox(<SandboxRoute />, { sandbox: true, strategyBridge: true, voting: false, projections: true, realtime: false, decisionCTA: true })

    // Fire engine recompute to arm trigger path to high severity
    notifyRecompute('debug-test-board', 'prob_edit', [ { id: 'a', p: 0.1, c: 1 }, { id: 'b', p: 0.2, c: 1 } ], Date.now())
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.runOnlyPendingTimersAsync()
    const card = await screen.findByLabelText(/Decision needed/i)
    expect(card).toBeInTheDocument()

    // Click CTA → hash updates when flag on
    const btn = card.querySelector('button') as HTMLButtonElement
    btn.click()
    expect(window.location.hash).toMatch(/#\/decisions\/debug-test-board\/frame/)

    // Flag off: no navigation
    // Re-render with CTA disabled via FlagsProvider
    const { SandboxRoute: SR2 } = await import('@/sandbox/routes/SandboxRoute')
    window.location.hash = '#/decisions/test/sandbox?panel=intelligence'
    renderSandbox(<SR2 />, { sandbox: true, strategyBridge: true, decisionCTA: false })
    notifyRecompute('debug-test-board', 'prob_edit', [ { id: 'a', p: 0.1, c: 1 }, { id: 'b', p: 0.2, c: 1 } ], Date.now())
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.runOnlyPendingTimersAsync()
    const card2 = await screen.findByLabelText(/Decision needed/i)
    const btn2 = card2.querySelector('button') as HTMLButtonElement
    const before = window.location.hash
    btn2.click()
    expect(window.location.hash).toBe(before)
  })
  it('fires once with debounce and cooldown; shows Decision needed when flag on', async () => {
    await enableBridgeAndTriggers()
    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    const { updateKRFromP50 } = await import('@/sandbox/bridge/triggers')
    const analytics = await import('@/lib/analytics')
    const track = analytics.track as unknown as ReturnType<typeof vi.fn>

    // Deep-link to intelligence tab via query param
    window.location.hash = '#/decisions/test/sandbox?panel=intelligence'

    renderSandbox(<SandboxRoute />, { sandbox: true, strategyBridge: true })

    // Trigger with low probability → high severity; debounce 30s
    await act(async () => {
      updateKRFromP50('debug-test-board', 0.1)
      await vi.advanceTimersByTimeAsync(30_000)
      await vi.runOnlyPendingTimersAsync()
    })

    // Card should appear (sync getBy after timers flushed)
    expect(screen.getByLabelText(/Decision needed/i)).toBeInTheDocument()
    expect(track).toHaveBeenCalledWith('sandbox_trigger', expect.objectContaining({ rule: 'KR_MISS_PROJECTION', severity: 'high' }))

    // Try to fire again immediately → cooldown prevents telemetry increment
    await act(async () => {
      updateKRFromP50('debug-test-board', 0.05)
      await vi.advanceTimersByTimeAsync(30_000)
      await vi.runOnlyPendingTimersAsync()
    })
    expect(track.mock.calls.filter(c => c[0] === 'sandbox_trigger').length).toBe(1)
  })

  it('flag off → no card, no telemetry', async () => {
    await disableTriggers()
    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    const { updateKRProbabilities } = await import('@/sandbox/bridge/triggers')
    const analytics = await import('@/lib/analytics')
    const track = analytics.track as unknown as ReturnType<typeof vi.fn>

    window.location.hash = '#/decisions/test/sandbox?panel=intelligence'
    renderSandbox(<SandboxRoute />, { sandbox: true, strategyBridge: true })

    updateKRProbabilities('debug-test-board', [0.1])
    await vi.advanceTimersByTimeAsync(30_000)

    expect(screen.queryByLabelText(/Decision needed/i)).toBeNull()
    expect(track).not.toHaveBeenCalledWith('sandbox_trigger', expect.anything())
  })
})
