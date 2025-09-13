// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { scoreGraph } from '@/domain/kr'
import type { Graph } from '@/domain/graph'
import { topContributors } from '@/domain/krExplain'

describe('kr.explain (domain helper)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers() })

  it('produces a stable, clamped, deterministically ordered list', async () => {
    const base: Graph = {
      schemaVersion: 1,
      nodes: {
        o1: { id: 'o1', type: 'Outcome', title: 'Alpha', krImpacts: [{ krId: 'kr1', deltaP50: 0.3, confidence: 0.5 }] }, // 15
        o2: { id: 'o2', type: 'Outcome', title: 'Beta', krImpacts: [{ krId: 'kr1', deltaP50: 0.2, confidence: 0.5 }] }, // 10
        a1: { id: 'a1', type: 'Action', title: 'Gamma' },
      },
      edges: {
        e1: { id: 'e1', from: 'o2', to: 'o1', kind: 'supports' }, // propagate Beta -> Alpha
      },
    }
    const before = scoreGraph(base)

    // After: increase Beta own; Alpha unchanged directly; should change via propagation.
    const afterGraph: Graph = {
      ...base,
      nodes: {
        ...base.nodes,
        o2: { ...base.nodes.o2!, krImpacts: [{ krId: 'kr1', deltaP50: 0.5, confidence: 0.6 }] }, // own ~30
      },
    }
    const after = scoreGraph(afterGraph)

    const list = topContributors(before, after, base)
    // Deterministic: highest |delta| first; ties by title, then id
    expect(list.length).toBeGreaterThan(0)
    // Find entries
    const alpha = list.find(x => x.id === 'o1')!
    const beta = list.find(x => x.id === 'o2')!
    expect(alpha).toBeTruthy()
    expect(beta).toBeTruthy()

    // total = own + fromChildren, clamped range
    expect(alpha.total).toBeCloseTo(alpha.own + alpha.fromChildren, 6)
    expect(beta.total).toBeCloseTo(beta.own + beta.fromChildren, 6)
    expect(Math.abs(alpha.total)).toBeLessThanOrEqual(100)
    expect(Math.abs(beta.total)).toBeLessThanOrEqual(100)

    // deltas should reflect the change (non-zero)
    expect(Math.abs(beta.delta)).toBeGreaterThan(0)
    expect(Math.abs(alpha.delta)).toBeGreaterThan(0)

    // Deterministic ordering: first item should have >= |delta| than the second
    if (list.length >= 2) {
      expect(Math.abs(list[0].delta)).toBeGreaterThanOrEqual(Math.abs(list[1].delta))
    }

    await vi.advanceTimersByTimeAsync(0)
  })
})
