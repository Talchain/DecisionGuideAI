import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('KR history rotation', () => {
  const decisionId = 'hist-x'
  const base = 1730000000000

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    try { performance.clearMarks(); performance.clearMeasures() } catch {}
    vi.useRealTimers()
  })

  it('caps history to 12 and emits history_archived count', async () => {
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({ track: (event: string, props: Record<string, any> = {}) => { calls.push({ event, props }) }, model_segment_changed: () => {} }))
    const { notifyRecompute, getHistory } = await import('@/sandbox/state/recompute')

    const optsA = (i: number) => [{ id: 'a', p: 0.5 + (i % 2 ? 0.01 : -0.01), c: 1 }]

    for (let i = 0; i < 14; i++) {
      const ts = base + i * 1000
      notifyRecompute(decisionId, 'prob_edit', optsA(i), ts)
      await vi.advanceTimersByTimeAsync(1)
    }

    // Emit one more recompute to ensure recompute counter increments
    notifyRecompute(decisionId, 'prob_edit', optsA(14), base + 14 * 1000)

    const hist = getHistory(decisionId)
    expect(hist.length).toBe(12)

    const arcs = calls.filter(c => c.event === 'history_archived')
    expect(arcs.length).toBeGreaterThanOrEqual(1)
    const total = arcs.reduce((sum, a) => sum + Number((a.props as any).archived_count || 0), 0)
    expect(total).toBe(2)

    const fallback = (globalThis as any).__dmRecomputeEntries ?? 0
    expect(fallback).toBeGreaterThan(0)
  })
})
