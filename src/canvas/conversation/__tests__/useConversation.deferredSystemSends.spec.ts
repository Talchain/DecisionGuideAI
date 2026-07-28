/**
 * The CONCURRENT path for inspector value edits (ROADMAP 1.346, review HIGH).
 *
 * THE DEFECT THIS PINS. `sendTurn`'s in-flight lock used to answer a blocked
 * system-mode send with a bare `return`: a DEV-only `console.warn`, a promise
 * that RESOLVES, no `SystemEventSendError`, and nothing whatsoever in
 * production. Because the lock is held for an entire analysis round trip, an
 * inspector edit made while an analysis was running was ALWAYS dropped — and
 * then the completing run's own `analysis_ready` verdict cleared the dirty
 * overlay, so the strip affirmed "reflects the current model" over a value the
 * server had never seen. Alarm → futile action → false reassurance: the exact
 * sequence this whole roadmap item exists to kill, reintroduced one path over.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE PANEL SPEC. The panel spec mocks
 * `ConversationContext`, which sits ABOVE the dispatcher — so it cannot see the
 * lock at all, and was structurally blind to this. These tests drive the REAL
 * `useConversation` dispatcher and assert on the payload that reaches the
 * transport (`callV5Turn`), which is the only place the truth is visible.
 *
 * The typo-correction case is the one that matters most: commit 20000, correct
 * to 25000 before the in-flight turn returns. Under the defect BOTH were
 * dropped; a naive queue that appends would persist 20000 LAST and leave the
 * server on the wrong number. The user's FINAL value must be the one that
 * lands.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import type { WireSystemEvent } from '../types'

// Mock the TRANSPORT, not the context — `importOriginal` spread so the module's
// other exports (getV5Endpoint et al.) stay real (CLAUDE.md trap 12: a hand
// listed vi.mock factory REPLACES the module and silently drops what it omits).
const dispatched: Array<Record<string, unknown>> = []
let resolveInFlight: ((v: unknown) => void) | null = null
/** When set, every dispatch AFTER the first (the lock-holder) rejects. */
let failFlushDispatch = false

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      // The FIRST turn is held open so later sends genuinely collide with the
      // in-flight lock — this is the concurrency the defect lived in.
      if (dispatched.length === 1) {
        await new Promise((res) => { resolveInFlight = res })
      } else if (failFlushDispatch) {
        throw new TypeError('Failed to fetch')
      }
      return { ok: true, response: { assistant_text: 'ok', blocks: [] } }
    }),
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

import { useConversation, SEND_DEFERRED } from '../useConversation'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

const edit = (target: string, value: number, raw: number): WireSystemEvent => ({
  type: 'factor_value_edit',
  payload: { target_id: target, value, raw_value: raw, unit: '£', field: 'value' },
})

/** Every factor_value_edit that actually reached the transport, in order. */
function dispatchedEdits() {
  return dispatched
    .filter((p) => (p as { event?: { kind?: string } }).event?.kind === 'factor_value_edit')
    .map((p) => (p as { event: Record<string, unknown> }).event)
}

const flush = async () => {
  // Drain microtasks AND macrotasks. The buffer flushes on a microtask from the
  // releasing turn's finally, each dispatch re-enters the drain, and the
  // response-processing path in between contains real awaits — so a fixed
  // microtask count is not enough. Loop on timers until it settles.
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  dispatched.length = 0
  resolveInFlight = null
  failFlushDispatch = false
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('system-mode sends blocked by the in-flight lock', () => {
  it('a blocked send is DETECTABLE — it returns a sentinel, never a silent resolve', async () => {
    const { result } = renderHook(() => useConversation())

    // Occupy the lock with a turn that does not resolve.
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    expect(dispatched.length, 'first turn dispatched and is holding the lock').toBe(1)

    let outcome: unknown = 'not-set'
    await act(async () => { outcome = await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })

    // THE assertion that was RED: the old code resolved with `undefined`,
    // indistinguishable from a dispatched turn.
    expect(outcome).toBe(SEND_DEFERRED)
    expect(dispatchedEdits(), 'not on the wire yet — the lock is still held').toHaveLength(0)
  })

  it('a deferred edit is NOT LOST — it reaches the wire once the lock clears', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })
    expect(dispatchedEdits()).toHaveLength(0)

    // Let the in-flight analysis finish — this is what releases the lock.
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    const edits = dispatchedEdits()
    expect(edits, 'the deferred edit was flushed').toHaveLength(1)
    expect(edits[0].target_id).toBe('fac_a')
    expect(edits[0].raw_value).toBe(20000)
  })

  it('TYPO CORRECTION: commit A then B during one in-flight turn → B is what persists', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    // The user commits 20000, then notices the typo and commits 25000 — both
    // while the analysis is still running.
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    await act(async () => { resolveInFlight?.(undefined); await flush() })

    const edits = dispatchedEdits()
    // Exactly one turn for the factor — and it carries the FINAL value. An
    // append-only queue would send 20000 after 25000 and leave the server on
    // the superseded number.
    expect(edits, 'superseded value collapsed, not replayed').toHaveLength(1)
    expect(edits[0].raw_value).toBe(25000)
    expect(edits[0].value).toBe(0.5)
  })

  it('preserves ORDER across DISTINCT targets (last-write-wins is per factor only)', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })
    await act(async () => { await result.current.sendSystemEvent(edit('fac_b', 0.2, 200)) })
    // Supersede A — it must keep A's ORIGINAL position, not jump to the tail.
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    await act(async () => { resolveInFlight?.(undefined); await flush() })

    const edits = dispatchedEdits()
    expect(edits).toHaveLength(2)
    expect(edits.map((e) => e.target_id)).toEqual(['fac_a', 'fac_b'])
    expect(edits[0].raw_value).toBe(25000)
  })

  it('the freshness strip may NOT affirm freshness while an edit is undispatched', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    // A local edit dirties the overlay (the store's own edit chokepoint does
    // this; set it directly here so the test is about the CLEAR, not the set).
    act(() => { useCanvasStore.setState({ analysisFreshnessDirty: true } as never) })
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })

    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // The in-flight run's verdict lands. It was computed WITHOUT the queued
    // edit, so it must not un-dirty the overlay.
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness?.({
        freshness: 'fresh', freshness_reason: 'graph_hash_match', computed_at: new Date().toISOString(),
      })
    })
    expect(
      useCanvasStore.getState().analysisFreshnessDirty,
      'overlay must stay dirty — the server has not seen this edit',
    ).toBe(true)

    // Once it flushes, the count clears and the overlay is free to resolve.
    await act(async () => { resolveInFlight?.(undefined); await flush() })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
  })

  it('clearAnalysisFreshnessDirty is also held while an edit is undispatched', async () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true, pendingEmittedEdits: 1 } as never)
    act(() => { useCanvasStore.getState().clearAnalysisFreshnessDirty?.() })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)

    useCanvasStore.setState({ pendingEmittedEdits: 0 } as never)
    act(() => { useCanvasStore.getState().clearAnalysisFreshnessDirty?.() })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
})

describe('F1 — a GENUINE failure at flush time must not silently lose the edit', () => {
  it('re-dirties, re-holds the count, and keeps the edit queued', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // The network dies exactly when the queue drains. Under the old code the
    // entry was already removed and the count already published 0, and the
    // rejection had NO listener — the panel's promise resolved SEND_DEFERRED
    // long ago and a system turn renders no bubble. The edit vanished and the
    // next verdict blessed the stale numbers.
    failFlushDispatch = true
    act(() => { useCanvasStore.setState({ analysisFreshnessDirty: false } as never) })
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    expect(
      useCanvasStore.getState().pendingEmittedEdits,
      'the hold must survive a failed flush — the server still has not seen this edit',
    ).toBeGreaterThan(0)
    expect(
      useCanvasStore.getState().analysisFreshnessDirty,
      're-dirtied: the strip may not affirm freshness over an edit that failed to send',
    ).toBe(true)
  })

  it('a verdict arriving after the failed flush still cannot clear the overlay', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    failFlushDispatch = true
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    act(() => {
      useCanvasStore.getState().setAnalysisFreshness?.({
        freshness: 'fresh', freshness_reason: 'graph_hash_match', computed_at: new Date().toISOString(),
      })
    })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('stops retrying after the cap but KEEPS the hold (the edit is genuinely unsent)', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    failFlushDispatch = true
    await act(async () => { resolveInFlight?.(undefined); await flush() })
    for (let i = 0; i < 4; i++) await act(async () => { await flush() })

    // Bounded: a failing flush takes and releases the lock, re-entering the
    // drain, so an uncapped retry would spin forever.
    const attempts = dispatched.length - 1
    expect(attempts).toBeLessThanOrEqual(4)
    // ...but the hold stays: the edit really has not reached the server.
    expect(useCanvasStore.getState().pendingEmittedEdits).toBeGreaterThan(0)
  })
})

describe('F2 — the buffer and the hold are SCENARIO-SCOPED', () => {
  const OTHER = 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5'

  it('never dispatches an edit from one scenario into another', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // The user switches decision while the edit is still queued.
    act(() => { useCanvasStore.setState({ currentScenarioId: OTHER } as never) })
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    // Dispatch resolves the scenario FRESH, so without scoping this edit would
    // have mutated the newly-opened decision's graph.
    expect(dispatchedEdits(), 'no cross-scenario dispatch').toHaveLength(0)
  })

  it('does not leak the hold into the new scenario (it would fabricate "model changed")', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    act(() => { useCanvasStore.setState({ currentScenarioId: OTHER } as never) })
    await act(async () => { await flush() })

    // noteRunCompletedWithoutVerdict assigns dirty straight from this count, so
    // a leaked value is a FABRICATED verdict in a decision the user never edited.
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
  })

  it('SURFACES the discard rather than dropping it silently', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    act(() => { useCanvasStore.setState({ currentScenarioId: OTHER } as never) })
    await act(async () => { await flush() })

    // Assert on the WHOLE transcript, not on a slice from a remembered index:
    // switching scenario clears `messages` first (that effect is declared
    // earlier in the hook and React runs effects in declaration order), so an
    // index captured beforehand points past the end afterwards. What matters is
    // that the user can see it, not where it sits.
    const shown = result.current.messages.map((m) => String(m.content)).join(' ')
    expect(shown, 'the user is told the edit was discarded').toMatch(/discarded/i)
    expect(shown, 'and which edit it was').toMatch(/fac_a|25000/)
  })

  it('unmount clears the hold — a stranded count is a permanent false "model changed"', async () => {
    const { result, unmount } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // The buffer dies with the hook but the count lives in the STORE — leaving
    // it set strands a hold nothing can ever clear. That is the INVERSE defect:
    // no edit is pending at all, yet the strip insists the model changed.
    act(() => { unmount() })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
  })
})
