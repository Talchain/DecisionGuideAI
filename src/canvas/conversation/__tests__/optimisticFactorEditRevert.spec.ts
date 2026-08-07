/**
 * ROADMAP 2.129 (b) — a value CEE REFUSED must not survive on the canvas.
 *
 * THE DEFECT THIS PINS, live-proven on staging `98aae72e`
 * (`PHASE0-EVIDENCE-2026-07-28/fix-2121-slice1-liveproof.md` §3 sub-finding,
 * run 1). Typing `25` into a `months` factor capped at 6 produced a correct wire
 * event and an honest refusal from CEE:
 *
 *   "Value 25 months exceeds the factor's cap of 6 months. I haven't changed
 *    anything." — blocks: [], no analysis_ready, no graph_hash
 *
 * ...and the client kept the number anyway. The canvas node read `25 months`,
 * the Model tab pill flipped to **"User edited"**, and the following re-run
 * returned win probabilities BYTE-IDENTICAL to baseline because the engine still
 * held 3. The user is shown a number, and a provenance claim about that number,
 * that the engine explicitly declined.
 *
 * WHY THIS FILE DRIVES THE REAL DISPATCHER, not the panel.
 * A refusal is not a FAILURE — the promise resolves, so no `catch` at any call
 * site can see it, and a panel spec that mocks `ConversationContext` sits ABOVE
 * the only place the reply is visible. The dispatcher is also the only layer
 * that can serve the DEFERRED case: an edit committed while an analysis runs is
 * queued, and the caller's promise resolved with SEND_DEFERRED long before the
 * reply existed. Both are asserted here, against the transport.
 *
 * WHY THESE ASSERTIONS AND NOT OTHERS. Each `it` is either an assertion that was
 * RED before the fix (reject → revert, on both the immediate and the deferred
 * path; the pill reverting with the number) or a CONTROL that stops the fix being
 * satisfied by something cheaper and wrong: the ACCEPTED reply must NOT revert
 * (a fix that reverted unconditionally would pass every RED assertion and destroy
 * every accepted edit), an unattributable patch receipt must NOT revert, and a
 * value that has MOVED ON since the send must not be clobbered by a late revert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import type { WireSystemEvent } from '../types'
import { captureOptimisticFactorEdit } from '../optimisticFactorEdit'

/** Reply bodies the transport should answer with, in order. */
const replies: Array<Record<string, unknown>> = []
const dispatched: Array<Record<string, unknown>> = []
let holdFirstTurn = false
let resolveInFlight: ((v: unknown) => void) | null = null

// Mock the TRANSPORT, not the context (CLAUDE.md trap 12: `importOriginal`
// spread, never a hand-listed factory).
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      if (holdFirstTurn && dispatched.length === 1) {
        await new Promise((res) => { resolveInFlight = res })
      }
      const response = replies.shift() ?? { assistant_text: 'ok', blocks: [] }
      return { ok: true, response }
    }),
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

import { useConversation, SEND_DEFERRED } from '../useConversation'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const FACTOR_ID = 'fac_delivery_time'
const CAP = 6

/** Pre-edit state: CEE's own estimate of 3 months (model scale 3/6 = 0.5). */
const PRIOR_OBSERVED = {
  value: 0.5,
  raw_value: 3,
  unit: 'months',
  cap: CAP,
  source: 'cee_inference',
}

/** The refused value: 25 months → 25/6 model scale. */
const SENT_RAW = 25
const SENT_MODEL = SENT_RAW / CAP

function factorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Estimated Delivery Time',
      category: 'controllable',
      display_value: '3 months',
      observedState: { ...PRIOR_OBSERVED },
    },
  } as Node
}

const edit = (value: number, raw: number): WireSystemEvent => ({
  type: 'factor_value_edit',
  payload: { target_id: FACTOR_ID, value, raw_value: raw, unit: 'months', field: 'value' },
})

/**
 * CEE's REFUSAL, verbatim in shape from turn-responses.json[2]: prose, empty
 * blocks, no analysis_ready, no graph_hash. There is no `status: 'rejected'`
 * anywhere on the wire — the absence of an applied receipt IS the signal.
 */
const REFUSAL = {
  assistant_text:
    "Value 25 months exceeds the factor's cap of 6 months. I haven't changed anything.",
  blocks: [],
}

/** CEE's ACCEPTANCE, verbatim in shape from turn-responses-run2.json[2]. */
const acceptance = (model: number, raw: number) => ({
  assistant_text: `Updated Delivery Timeline from 3 months to ${raw} months.`,
  blocks: [
    {
      type: 'graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: FACTOR_ID,
      before: { value: 0.5, raw_value: 3, unit: 'months', cap: CAP },
      after: { value: model, raw_value: raw, unit: 'months', cap: CAP },
    },
  ],
  graph_hash: 'f0719cb3b8905ef4',
})

/** The panel's optimistic write, through the same sanctioned setter it uses. */
function writeOptimistically(model: number, raw: number) {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === FACTOR_ID)!
  const existing = (node.data as Record<string, unknown>).observedState as Record<string, unknown>
  store.updateNode(FACTOR_ID, {
    data: {
      ...(node.data as Record<string, unknown>),
      display_value: undefined,
      observedState: { ...existing, value: model, raw_value: raw, source: 'user', display_value: undefined },
    },
  } as never)
}

function observedNow() {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)
  return ((node?.data as Record<string, unknown>)?.observedState ?? {}) as Record<string, unknown>
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  dispatched.length = 0
  replies.length = 0
  holdFirstTurn = false
  resolveInFlight = null
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [factorNode()],
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('a REFUSED value edit reverts the optimistic write', () => {
  it('restores the value, the raw magnitude AND the provenance stamp', async () => {
    const { result } = renderHook(() => useConversation())
    const pre = useCanvasStore.getState().nodes[0].data

    const undo = captureOptimisticFactorEdit(FACTOR_ID, SENT_MODEL, pre)!
    writeOptimistically(SENT_MODEL, SENT_RAW)
    // Sanity: the split-brain exists before the reply lands.
    expect(observedNow().raw_value).toBe(SENT_RAW)
    expect(observedNow().source).toBe('user')

    replies.push(REFUSAL)
    await act(async () => {
      await result.current.sendSystemEvent(edit(SENT_MODEL, SENT_RAW), { optimisticFactorEdit: undo })
    })
    await flush()

    // RED before the fix: 25 / 4.1666… / 'user' all stood, and the "User edited"
    // pill with them, over a value CEE said it had not changed.
    expect(observedNow().raw_value).toBe(3)
    expect(observedNow().value).toBe(0.5)
    expect(observedNow().source).toBe('cee_inference')
    // The server's own display prose comes back too — clearing it was part of
    // the same optimistic update.
    expect((useCanvasStore.getState().nodes[0].data as Record<string, unknown>).display_value)
      .toBe('3 months')
  })

  it('reverts a DEFERRED edit refused after the in-flight lock cleared', async () => {
    holdFirstTurn = true
    const { result } = renderHook(() => useConversation())

    // Occupy the lock with a turn that does not resolve — an analysis running.
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    expect(dispatched.length).toBe(1)

    const pre = useCanvasStore.getState().nodes[0].data
    const undo = captureOptimisticFactorEdit(FACTOR_ID, SENT_MODEL, pre)!
    writeOptimistically(SENT_MODEL, SENT_RAW)

    let outcome: unknown = 'not-set'
    await act(async () => {
      outcome = await result.current.sendSystemEvent(edit(SENT_MODEL, SENT_RAW), {
        optimisticFactorEdit: undo,
      })
    })
    expect(outcome, 'the edit is queued, not dispatched').toBe(SEND_DEFERRED)
    // Its promise has ALREADY resolved — no caller-side await can ever see the
    // refusal that is about to arrive. This is why the revert is central.
    expect(observedNow().raw_value).toBe(SENT_RAW)

    replies.push(REFUSAL)
    await act(async () => { resolveInFlight?.({}); await flush() })

    expect(observedNow().raw_value).toBe(3)
    expect(observedNow().source).toBe('cee_inference')
  })
})

describe('the deferral queue collapses two edits to one factor — the snapshot must not', () => {
  it('restores the value the SERVER still holds, not the intermediate one it never saw', async () => {
    holdFirstTurn = true
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    // 3 → 25 (queued), then a correction 25 → 30 (replaces it, same target).
    // The buffer keeps ONE entry, so exactly one turn will be dispatched — and
    // the server has seen NEITHER value, so it still holds 3.
    const pre = useCanvasStore.getState().nodes[0].data
    const undo1 = captureOptimisticFactorEdit(FACTOR_ID, SENT_MODEL, pre)!
    writeOptimistically(SENT_MODEL, SENT_RAW)
    await act(async () => {
      await result.current.sendSystemEvent(edit(SENT_MODEL, SENT_RAW), { optimisticFactorEdit: undo1 })
    })

    const mid = useCanvasStore.getState().nodes[0].data
    const undo2 = captureOptimisticFactorEdit(FACTOR_ID, 30 / CAP, mid)!
    writeOptimistically(30 / CAP, 30)
    await act(async () => {
      await result.current.sendSystemEvent(edit(30 / CAP, 30), { optimisticFactorEdit: undo2 })
    })

    replies.push(REFUSAL)
    await act(async () => { resolveInFlight?.({}); await flush() })

    // With a naive last-write-wins snapshot this reads 25 — a number CEE never
    // held and never will, left on screen by the fix that was meant to remove
    // exactly that class of lie.
    expect(observedNow().raw_value).toBe(3)
    expect(observedNow().source).toBe('cee_inference')
  })
})

describe('controls — the revert must not fire when the server DID apply', () => {
  it('an APPLIED patch receipt for the target leaves the new value standing', async () => {
    const { result } = renderHook(() => useConversation())
    const pre = useCanvasStore.getState().nodes[0].data
    const NEW_RAW = 2
    const NEW_MODEL = NEW_RAW / CAP

    const undo = captureOptimisticFactorEdit(FACTOR_ID, NEW_MODEL, pre)!
    writeOptimistically(NEW_MODEL, NEW_RAW)

    replies.push(acceptance(NEW_MODEL, NEW_RAW))
    await act(async () => {
      await result.current.sendSystemEvent(edit(NEW_MODEL, NEW_RAW), { optimisticFactorEdit: undo })
    })
    await flush()

    expect(observedNow().raw_value).toBe(NEW_RAW)
    expect(observedNow().source).toBe('user')
  })

  it('does not clobber a value the user has already changed again', async () => {
    const { result } = renderHook(() => useConversation())
    const pre = useCanvasStore.getState().nodes[0].data
    const undo = captureOptimisticFactorEdit(FACTOR_ID, SENT_MODEL, pre)!
    writeOptimistically(SENT_MODEL, SENT_RAW)
    // The user re-types 4 before the refusal of 25 comes back.
    writeOptimistically(4 / CAP, 4)

    replies.push(REFUSAL)
    await act(async () => {
      await result.current.sendSystemEvent(edit(SENT_MODEL, SENT_RAW), { optimisticFactorEdit: undo })
    })
    await flush()

    // A late revert must lose to newer truth.
    expect(observedNow().raw_value).toBe(4)
  })
})
