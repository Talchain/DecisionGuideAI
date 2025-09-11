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
    // Silence periodic act() warnings from the cooldown indicator in this integration
    vi.doMock('@/sandbox/components/TriggerCooldownIndicator', () => ({ TriggerCooldownIndicator: () => null }))
    // Use engine's real debounce; we will deterministically advance timers by 30_000ms
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

    // Drive two recompute cycles with low alignment at each cycle
    const { notifyRecompute, getRecompute } = await import('@/sandbox/state/recompute')
    const { updateKRFromP50 } = await import('@/sandbox/bridge/triggers')
    const { submitVotes } = await import('@/sandbox/state/voting')

    // Cycle 1: recompute → submit votes tagged to this version → let debounce elapse (30s)
    await act(async () => {
      notifyRecompute('debug-test-board', 'prob_edit', [{ id: 'a', p: 0.0, c: 1 }, { id: 'b', p: 1.0, c: 1 }], Date.now())
      const s1 = getRecompute('debug-test-board')!
      submitVotes('debug-test-board', 'voter-a', [{ id: 'a', p: 0.0, c: 1 }, { id: 'b', p: 1.0, c: 1 }], s1.version)
      submitVotes('debug-test-board', 'voter-b', [{ id: 'a', p: 1.0, c: 1 }, { id: 'b', p: 0.0, c: 1 }], s1.version)
      // Trigger engine evaluation for this cycle (debounced)
      updateKRFromP50('debug-test-board', 0.35)
      await vi.advanceTimersByTimeAsync(30_000)
      await vi.runOnlyPendingTimersAsync()
    })

    // Cycle 2: recompute → submit votes for new version → let debounce elapse (consecutive low; 30s)
    await act(async () => {
      notifyRecompute('debug-test-board', 'prob_edit', [{ id: 'a', p: 0.0, c: 1 }, { id: 'b', p: 1.0, c: 1 }], Date.now())
      const s2 = getRecompute('debug-test-board')!
      submitVotes('debug-test-board', 'voter-a', [{ id: 'a', p: 0.0, c: 1 }, { id: 'b', p: 1.0, c: 1 }], s2.version)
      submitVotes('debug-test-board', 'voter-b', [{ id: 'a', p: 1.0, c: 1 }, { id: 'b', p: 0.0, c: 1 }], s2.version)
      await vi.advanceTimersByTimeAsync(30_000)
      await vi.runOnlyPendingTimersAsync()
    })

    const buf = (analytics.__getTestBuffer?.() || []) as any[]
    const aligns = buf.filter(c => c.event === 'sandbox_alignment' && c.props?.decisionId === 'debug-test-board') as any[]
    expect(aligns.length).toBeGreaterThan(0)

    const trig = buf.filter(c => c.event === 'sandbox_trigger' && c.props?.rule === 'LOW_ALIGNMENT')
    expect(trig).toHaveLength(1)
  })
})
