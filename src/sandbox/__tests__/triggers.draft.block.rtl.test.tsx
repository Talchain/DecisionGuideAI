// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'

const enable = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return { ...actual, isSandboxTriggersBasicEnabled: () => true, isStrategyBridgeEnabled: () => true }
  })
}

describe('Draft mode → triggers blocked', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('does not fire trigger telemetry when in Draft (board meta)', async () => {
    await enable()
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({ track: (event: string, props: Record<string, any> = {}) => { calls.push({ event, props }) }, model_segment_changed: () => {} }))

    const { __setDraft } = await import('@/sandbox/state/boardMeta')
    __setDraft('draft-x', true)

    const { IntelligencePanel } = await import('@/sandbox/panels/IntelligencePanel')
    const { notifyRecompute } = await import('@/sandbox/state/recompute')

    renderSandbox(<IntelligencePanel decisionId="draft-x" /> , { sandbox: true, strategyBridge: true })
    notifyRecompute('draft-x', 'prob_edit', [ { id: 'a', p: 0.1, c: 1 }, { id: 'b', p: 0.9, c: 1 } ], Date.now())
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.runOnlyPendingTimersAsync()

    expect(calls.filter(c => c.event === 'sandbox_trigger').length).toBe(0)
  })
})
