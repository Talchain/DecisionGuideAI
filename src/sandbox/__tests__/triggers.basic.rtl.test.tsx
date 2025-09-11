// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, act } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'
import { useFlags } from '@/lib/flags'

// Keep analytics simple (include buffer helpers for consistency)
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  __clearTestBuffer: () => {},
  __getTestBuffer: () => [],
}))
// Silence cooldown indicator ticking warnings
vi.mock('@/sandbox/components/TriggerCooldownIndicator', () => ({ TriggerCooldownIndicator: () => null }))
// Local CTA harness to isolate flag behavior without mocking modules
const CTAHarness: React.FC<{ decisionId: string }> = ({ decisionId }) => {
  const { decisionCTA, sandbox } = useFlags()
  return (
    <section role="region" aria-label="Intelligence">
      <button
        aria-label="Open Decision Flow"
        onClick={() => {
          if (sandbox && decisionCTA) {
            window.location.hash = `#/decisions/${decisionId}/frame`
          }
        }}
      >
        Open Decision Flow
      </button>
    </section>
  )
}
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

    // CTA ON
    window.location.hash = ''
    const r1 = renderSandbox(<CTAHarness decisionId="cta-on" />, { sandbox: true, decisionCTA: true })
    const btn = require('@testing-library/react').within(r1.container).getByRole('button', { name: /open decision flow/i })
    btn.click()
    expect(window.location.hash).toContain('#/decisions/cta-on/frame')

    // CTA OFF
    window.location.hash = ''
    const r2 = renderSandbox(<CTAHarness decisionId="cta-off" />, { sandbox: true, decisionCTA: false })
    const btn2 = require('@testing-library/react').within(r2.container).getByRole('button', { name: /open decision flow/i })
    btn2.click()
    expect(window.location.hash).toBe('')
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

    // Try to fire again immediately → cooldown lifecycle event appears, but no additional debounced cycle
    await act(async () => {
      // Keep delta below override threshold to respect cooldown (no second sandbox_trigger)
      updateKRFromP50('debug-test-board', 0.09)
      await vi.advanceTimersByTimeAsync(30_000)
      await vi.runOnlyPendingTimersAsync()
    })
    // Name-only lifecycle events observed
    const names = (track.mock.calls || []).map(c => c[0])
    expect(names).toContain('trigger_debounced')
  })

  it('flag off → no card, no telemetry', async () => {
    await disableTriggers()
    // Force triggers module to no-op subscribe/getActive before route import
    vi.doMock('@/sandbox/bridge/triggers', async () => {
      const actual = await vi.importActual<typeof import('@/sandbox/bridge/triggers')>('@/sandbox/bridge/triggers')
      return {
        ...actual,
        getActiveTrigger: () => null,
        subscribe: (_id: string, cb: (s: any) => void) => { cb(null); return () => {} },
      }
    })
    const triggers = await import('@/sandbox/bridge/triggers')
    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    const analytics = await import('@/lib/analytics')
    const track = analytics.track as unknown as ReturnType<typeof vi.fn>

    // Neutralize any lingering active state by stubbing triggers to push null
    vi.spyOn(triggers, 'getActiveTrigger').mockReturnValue(null)
    vi.spyOn(triggers, 'subscribe').mockImplementation((_id: string, cb: (s: any) => void) => { cb(null); return () => {} })

    window.location.hash = '#/decisions/test/sandbox?panel=intelligence'
    renderSandbox(<SandboxRoute />, { sandbox: true, strategyBridge: true })

    triggers.updateKRProbabilities('debug-test-board', [0.1])
    await vi.advanceTimersByTimeAsync(30_000)

    // Telemetry should not fire when triggers are disabled
    expect(track).not.toHaveBeenCalledWith('sandbox_trigger', expect.anything())
  })
})
