// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))

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

describe('KR Cards', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('drop-late: ignores out-of-order older versions and does not re-emit telemetry', async () => {
    await enableFlags()
    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    const { __emitTest } = await import('@/sandbox/state/recompute')
    const analytics = await import('@/lib/analytics')
    const track = analytics.track as unknown as ReturnType<typeof vi.fn>

    renderSandbox(<SandboxRoute boardId="debug-test-board" />, { sandbox: true, strategyBridge: true })
    await vi.runOnlyPendingTimersAsync()

    // Emit newer version first
    __emitTest('debug-test-board', { version: 5, lastTs: Date.now(), lastReason: 'prob_edit', bands: { p10: 0.7, p50: 0.8, p90: 0.9 } })
    await vi.runOnlyPendingTimersAsync()
    const card = screen.getByTestId('kr-resolved-kr1')
    expect(within(card).getByText(/80%/)).toBeInTheDocument()
    const countAfterNew = (track as any).mock.calls.filter((c: any[]) => c[0] === 'sandbox_projection').length

    // Emit older version afterwards → should be ignored
    __emitTest('debug-test-board', { version: 3, lastTs: Date.now() - 1, lastReason: 'prob_edit', bands: { p10: 0.2, p50: 0.3, p90: 0.4 } })
    await vi.runOnlyPendingTimersAsync()
    // UI should still show 80% and not re-emit telemetry
    expect(within(card).getByText(/80%/)).toBeInTheDocument()
    const countAfterOld = (track as any).mock.calls.filter((c: any[]) => c[0] === 'sandbox_projection').length
    expect(countAfterOld).toBe(countAfterNew)
  })

  it('skeleton -> resolved after recompute; subsequent recomputes emit once per version without duplicates', async () => {
    await enableFlags()
    const { SandboxRoute } = await import('@/sandbox/routes/SandboxRoute')
    const { notifyRecompute } = await import('@/sandbox/state/recompute')
    const analytics = await import('@/lib/analytics')
    const track = analytics.track as unknown as ReturnType<typeof vi.fn>

    renderSandbox(<SandboxRoute boardId="debug-test-board" />, { sandbox: true, strategyBridge: true })

    // Initially skeleton, then after seed tick it resolves
    expect(screen.getByTestId('kr-skel-kr1')).toBeInTheDocument()
    await vi.runOnlyPendingTimersAsync()
    expect(screen.getByTestId('kr-resolved-kr1')).toBeInTheDocument()
    expect(track).toHaveBeenCalledWith('sandbox_projection', expect.objectContaining({ op: 'recompute', krId: 'kr1' }))
    const afterSeedCount = (track as any).mock.calls.filter((c: any[]) => c[0] === 'sandbox_projection').length

    // Trigger two rapid recomputes -> should emit once per new version
    notifyRecompute('debug-test-board', 'prob_edit', [
      { id: 'a', p: 0.1, c: 1 },
      { id: 'b', p: 0.9, c: 1 },
    ], Date.now())
    notifyRecompute('debug-test-board', 'prob_edit', [
      { id: 'a', p: 0.2, c: 1 },
      { id: 'b', p: 0.8, c: 1 },
    ], Date.now())
    await vi.runOnlyPendingTimersAsync()
    expect(screen.getByTestId('kr-resolved-kr1')).toBeInTheDocument()
    const finalCount = (track as any).mock.calls.filter((c: any[]) => c[0] === 'sandbox_projection').length
    // After seed, two more versions should increase by 2
    expect(finalCount - afterSeedCount).toBe(2)
  })
})
