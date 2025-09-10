// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'

// Ensure sandbox/bridge/projections are enabled
const enableFlags = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return {
      ...actual,
      isSandboxEnabled: () => true,
      isStrategyBridgeEnabled: () => true,
      isProjectionsEnabled: () => true,
    }
  })
}

describe('KR seed recompute cancellation on unmount', () => {
  beforeEach(() => { vi.useFakeTimers() })

  it('mount → immediate unmount cancels seed recompute (no telemetry, no compute)', async () => {
    await enableFlags()

    // Mock recompute module to observe calls without side-effects
    const notifyRecompute = vi.fn()
    vi.doMock('@/sandbox/state/recompute', async () => {
      const actual = await vi.importActual<any>('@/sandbox/state/recompute')
      return {
        ...actual,
        notifyRecompute,
        subscribeRecompute: () => () => {},
        trackProjectionResolved: vi.fn(),
      }
    })

    // Mock analytics to capture any sandbox_* events
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({
      track: (event: string, props: Record<string, any> = {}) => { calls.push({ event, props }) },
      model_segment_changed: () => {},
    }))

    const { StrategyBridgeShell } = await import('@/sandbox/layout/StrategyBridgeShell')

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = renderSandbox(<StrategyBridgeShell decisionId="seed-unmount" />, { sandbox: true, strategyBridge: true, projections: true })
    // Immediately unmount before rAF seed fires
    r.unmount()

    // Drive timers (if any) just in case
    await vi.runOnlyPendingTimersAsync()

    expect(notifyRecompute).not.toHaveBeenCalled()
    // No projection telemetry should have fired
    expect(calls.filter(c => c.event === 'sandbox_projection')).toHaveLength(0)
    // No React unmounted warnings
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
