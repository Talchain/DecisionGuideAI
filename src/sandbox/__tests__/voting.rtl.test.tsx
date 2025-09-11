// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

// Theme + Flags via renderSandbox

const enableFlags = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return {
      ...actual,
      isSandboxEnabled: () => true,
      isStrategyBridgeEnabled: () => true,
      isProjectionsEnabled: () => true,
      isSandboxRealtimeEnabled: () => true,
      isSandboxVotingEnabled: () => true,
      isSandboxTriggersBasicEnabled: () => true,
    }
  })
}

describe('Voting + alignment + LOW_ALIGNMENT trigger', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('submits votes, computes alignment, and fires LOW_ALIGNMENT once after two cycles; realtime shares state', async () => {
    await enableFlags()
    // Shorten debounce/cooldown for deterministic runtime in tests (mock-before-import)
    vi.doMock('@/sandbox/bridge/triggers', async (orig) => {
      const mod = await orig<typeof import('@/sandbox/bridge/triggers')>()
      return { ...mod, DEBOUNCE_MS: 100, COOLDOWN_MS: 200 }
    })
    // Use analytics buffer helpers (name-only)
    const analytics = await import('@/lib/analytics')
    analytics.__clearTestBuffer?.()

    // Prepare shared doc and populate probRows with two options far apart
    const { connect } = await import('@/realtime/provider')
    const conn = await connect('debug-test-board')
    const Y = await import('yjs')
    const mock = conn.doc.getMap('sandboxMock') as unknown as InstanceType<typeof Y.Map>
    const arr = new (Y as any).Array()
    const mk = (id: string, label: string, value: number) => { const m = new (Y as any).Map(); m.set('id', id); m.set('label', label); m.set('value', value); m.set('conf', 1); m.set('updatedAt', Date.now()); return m }
    arr.push([mk('a', 'A', 0.0)])
    arr.push([mk('b', 'B', 1.0)])
    mock.set('probRows', arr)

    // Render bridge shell (goals panel inside) under realtime provider
    const { StrategyBridgeShell } = await import('@/sandbox/layout/StrategyBridgeShell')
    const { RealtimeProvider } = await import('@/realtime/provider')
    // Open Intelligence tab to arm triggers via effects
    window.location.hash = '#/decisions/debug-test-board/sandbox?panel=intelligence'
    await act(async () => {
      renderSandbox(
        <RealtimeProvider decisionId="debug-test-board"><StrategyBridgeShell decisionId="debug-test-board" /></RealtimeProvider>,
        { sandbox: true, strategyBridge: true, projections: true, realtime: true, voting: true, decisionCTA: true }
      )
      // Flush initial effects
      await vi.advanceTimersByTimeAsync(0)
      await vi.runOnlyPendingTimersAsync()
    })

    // Programmatically submit votes for both voters to avoid UI flake
    const { submitVotes } = await import('@/sandbox/state/voting')
    submitVotes('debug-test-board', 'voter-a', [{ id: 'a', p: 0.0, c: 1 }, { id: 'b', p: 1.0, c: 1 }])
    submitVotes('debug-test-board', 'voter-b', [{ id: 'a', p: 0.0, c: 1 }, { id: 'b', p: 1.0, c: 1 }])
    await vi.advanceTimersByTimeAsync(0)

    // Two consecutive recomputes to trip LOW_ALIGNMENT (debounced cycles)
    const { notifyRecompute } = await import('@/sandbox/state/recompute')
    await act(async () => {
      notifyRecompute('debug-test-board', 'prob_edit', [{ id: 'a', p: 0.0, c: 1 }, { id: 'b', p: 1.0, c: 1 }], Date.now())
      await vi.advanceTimersByTimeAsync(100)
      await vi.runOnlyPendingTimersAsync()
      notifyRecompute('debug-test-board', 'prob_edit', [{ id: 'a', p: 0.0, c: 1 }, { id: 'b', p: 1.0, c: 1 }], Date.now())
      await vi.advanceTimersByTimeAsync(100)
      await vi.runOnlyPendingTimersAsync()
    })

    const buf = (analytics.__getTestBuffer?.() || []) as any[]
    const alignEvt = buf.find(c => c.event === 'sandbox_alignment')
    expect(alignEvt).toBeTruthy()
    expect(Number((alignEvt as any).props?.score)).toBeLessThan(60)

    const trig = buf.filter(c => c.event === 'sandbox_trigger' && c.props?.rule === 'LOW_ALIGNMENT')
    expect(trig).toHaveLength(1)
  })
})
