/**
 * The base a durable delete asserts comes from CEE, and this is where it enters
 * the client.
 *
 * ⚠ WHY THE TOP-LEVEL KEY AND NOT `analysis_ready.current_graph_hash`: they are
 * the same value (measured byte-identical across the live turn fixtures in this
 * directory), but `analysis_ready` is absent on turns that carry no analysis —
 * and a user can delete on any of them. Reading the top-level key is what stops
 * the capability being dark outside analyse turns.
 */

import { describe, it, expect, vi } from 'vitest'

import { applyV5State } from '../applyV5State'

function store(over: Record<string, unknown> = {}) {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    nodes: [],
    edges: [],
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setLastServerGraphHash: vi.fn(),
    ...over,
  } as never
}

function apply(response: Record<string, unknown>, s: ReturnType<typeof store>) {
  return applyV5State({ blocks: [], suggested_actions: [], insights: [], ...response } as never, s, {
    turnClientId: 't1',
    currentClientTurnId: 't1',
  })
}

describe('applyV5State captures CEE\'s graph_hash for the next durable delete', () => {
  it('records the top-level graph_hash VERBATIM', () => {
    const s = store()
    const result = apply({ assistant_text: 'ok', graph_hash: 'f3d31f75957c5cb5' }, s)
    expect((s as unknown as { setLastServerGraphHash: ReturnType<typeof vi.fn> })
      .setLastServerGraphHash).toHaveBeenCalledWith('f3d31f75957c5cb5')
    expect(result.applied).toContain('graph_hash:captured')
  })

  it('records it on a turn with NO analysis_ready — the case the freshness slice cannot serve', () => {
    const s = store()
    apply({ assistant_text: 'a clarification', graph_hash: '27e97e8e072b8bec' }, s)
    expect((s as unknown as { setLastServerGraphHash: ReturnType<typeof vi.fn> })
      .setLastServerGraphHash).toHaveBeenCalledWith('27e97e8e072b8bec')
  })

  it.each([
    ['absent', {}],
    ['empty', { graph_hash: '' }],
    ['not a string', { graph_hash: 12345 }],
  ])('does NOT call the setter when the hash is %s — retain, never absence→clear', (_l, extra) => {
    const s = store()
    const result = apply({ assistant_text: 'ok', ...extra }, s)
    expect((s as unknown as { setLastServerGraphHash: ReturnType<typeof vi.fn> })
      .setLastServerGraphHash).not.toHaveBeenCalled()
    expect(result.applied).not.toContain('graph_hash:captured')
  })
})
