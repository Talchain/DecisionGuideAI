// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Perf harness (wrapper-based)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('recompute increments the fallback counter (__dmRecomputeEntries)', async () => {
    const { notifyRecompute } = await import('@/sandbox/state/recompute')
    ;(globalThis as any).__dmRecomputeEntries = 0
    notifyRecompute('perf-x', 'prob_edit', [ { id: 'a', p: 0.2, c: 1 }, { id: 'b', p: 0.8, c: 1 } ], Date.now())
    const fallback = (globalThis as any).__dmRecomputeEntries ?? 0
    expect(fallback).toBeGreaterThan(0)
  })

  it('KRCard transitions from skeleton to resolved on accepted recompute', async () => {
    const React = await import('react')
    const { render, screen } = await import('@testing-library/react')
    const { KRCard } = await import('@/sandbox/components/KRCard')
    const { __emitTest } = await import('@/sandbox/state/recompute')

    render(React.createElement(KRCard as any, { decisionId: 'perf-y', krId: 'k1', krTitle: 'K', objectiveTitle: 'O' }))

    // Initially skeleton visible
    expect(screen.getByTestId('kr-skel-k1')).toBeInTheDocument()

    // Emit accepted recompute → should render resolved state
    __emitTest('perf-y', { version: 1, lastTs: Date.now(), lastReason: 'prob_edit', bands: { p10: 0.3, p50: 0.5, p90: 0.7 }})
    expect(screen.getByTestId('kr-resolved-k1')).toBeInTheDocument()
  })
})
