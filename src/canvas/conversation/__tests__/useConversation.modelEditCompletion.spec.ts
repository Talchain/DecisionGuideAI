/**
 * THE DISPATCHER'S LEDGER WRITES — driven through `useConversation`, not called.
 *
 * ⚠⚠ WHY THIS FILE EXISTS, and it is the same lesson for the third time.
 * `modelEditCompletionWiring.spec.tsx` pins the two wires DOWNSTREAM of the
 * receipt: the cold read, and the adjudication. It calls
 * `recordModelEditReceipt` itself — so it proves the ledger and the confirm
 * hook, and NOTHING about whether the dispatcher ever calls it. Measured: with
 * `recordModelEditReceipt(optimisticEdit.attemptId)` replaced by
 * `void optimisticEdit.attemptId`, 12 files / 143 tests passed, exit 0 —
 * including both new specs. Without that one line every attempt is `pending`
 * for the life of the page, which is F1 re-opened one hop upstream.
 *
 * Every test here drives `sendSystemEvent` and asserts the LEDGER. The
 * transport is mocked; the dispatcher, the router, the fence and the
 * optimistic-edit machinery are all real.
 *
 * THE FOUR EXITS. A completion that never arrives is indistinguishable from one
 * that is still coming, so every path out of a `factor_value_edit` turn must
 * write the ledger: the receipt, the refusal, the abort-after-response, and the
 * scenario fence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

/** Replies the mocked transport hands back, in order. */
let replies: Array<Record<string, unknown>> = []
let holdFirstTurn = false
let heldTurnResolvesOnAbort = false
/**
 * Releases a held turn WITHOUT aborting it. Load-bearing: the scenario fence is
 * reached only by a COMPLETE response on a non-aborted signal — an aborted one
 * returns at the abort-after-response exit further up and never gets there.
 */
let releaseHeldTurn: (() => void) | null = null
const dispatched: Array<Record<string, unknown>> = []

function abortError(): Error {
  const e = new Error('The operation was aborted.')
  e.name = 'AbortError'
  return e
}

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(
      async (payload: Record<string, unknown>, opts?: { signal?: AbortSignal }) => {
        dispatched.push(payload)
        if (holdFirstTurn && dispatched.length === 1) {
          await new Promise((res, rej) => {
            releaseHeldTurn = () => res(undefined)
            const signal = opts?.signal
            const settle = () => (heldTurnResolvesOnAbort ? res(undefined) : rej(abortError()))
            if (!signal) return
            if (signal.aborted) return settle()
            signal.addEventListener('abort', settle)
          })
        }
        return { ok: true, response: replies.shift() ?? { assistant_text: 'ok', blocks: [] } }
      },
    ),
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

vi.mock('../../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getUserId: async () => null,
    getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  }
})

vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { captureOptimisticFactorEdit } from '../optimisticFactorEdit'
import {
  __resetModelEditCompletionLedger,
  beginModelEditAttempt,
  getModelEditAttempt,
} from '../../hooks/modelEditCompletion'

const SCENARIO = 'd4d4d4d4-e5e5-4f6f-8a7a-b8b8b8b8b8b8'
const OTHER_SCENARIO = 'e5e5e5e5-f6f6-4a7a-8b8b-c9c9c9c9c9c9'
const TARGET_ID = 'fac_delivery_time'
const BYSTANDER_ID = 'fac_headcount'

const CAP = 10
const PRIOR_MODEL = 0.5
const PRIOR_RAW = 5
const SENT_MODEL = 0.8
const SENT_RAW = 8

function factorNode(id: string, model: number, raw: number): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      category: 'controllable',
      display_value: `${raw} units`,
      observedState: { value: model, raw_value: raw, unit: 'units', cap: CAP, source: 'cee_inference' },
    },
  } as unknown as Node
}

const editEvent = () =>
  ({
    type: 'factor_value_edit',
    payload: { target_id: TARGET_ID, value: SENT_MODEL, raw_value: SENT_RAW, unit: 'units', field: 'value' },
  }) as never

/** CEE's ACCEPTANCE receipt. */
const acceptance = () => ({
  assistant_text: `Updated ${TARGET_ID}.`,
  blocks: [
    {
      type: 'graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: TARGET_ID,
      before: { value: PRIOR_MODEL, raw_value: PRIOR_RAW, unit: 'units', cap: CAP },
      after: { value: SENT_MODEL, raw_value: SENT_RAW, unit: 'units', cap: CAP },
    },
  ],
})

/** CEE's REFUSAL — prose, no patch. The measured shape. */
const refusal = () => ({
  assistant_text: "Value 25 exceeds the factor's cap. I haven't changed anything.",
  blocks: [],
})

function seed(scenarioId = SCENARIO) {
  useCanvasStore.setState(
    {
      currentScenarioId: scenarioId,
      nodes: [factorNode(TARGET_ID, SENT_MODEL, SENT_RAW), factorNode(BYSTANDER_ID, 0.55, 5.5)],
      edges: [],
      results: { status: 'idle' },
      analysisFreshnessDirty: false,
      currentScenarioLastResultHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never,
    false,
  )
}

/** Mint a real attempt and the snapshot that carries its id to the dispatcher. */
function armedEdit() {
  const attemptId = beginModelEditAttempt({
    nodeId: TARGET_ID,
    scenarioId: SCENARIO,
    attemptedValue: SENT_MODEL,
    attemptedRawValue: SENT_RAW,
  })
  const undo = captureOptimisticFactorEdit(
    TARGET_ID,
    SENT_MODEL,
    { observedState: { value: PRIOR_MODEL, raw_value: PRIOR_RAW, unit: 'units', cap: CAP } },
    undefined,
    attemptId,
  )
  return { attemptId, undo: undo! }
}

beforeEach(() => {
  __resetModelEditCompletionLedger()
  replies = []
  dispatched.length = 0
  holdFirstTurn = false
  heldTurnResolvesOnAbort = false
  releaseHeldTurn = null
  vi.clearAllMocks()
  seed()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ B1 — the dispatcher records the receipt', () => {
  it('an APPLIED receipt moves the attempt out of `pending`', async () => {
    const { attemptId, undo } = armedEdit()
    replies = [acceptance()]
    expect(getModelEditAttempt(attemptId)?.completion.phase).toBe('pending')

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current
        .sendSystemEvent(editEvent(), { optimisticFactorEdit: undo })
        .catch(() => undefined)
    })

    // ⭐ THE LINE UNDER TEST. Neutering `recordModelEditReceipt` in the
    // dispatcher leaves this `pending` and REDs here — which is the mutant that
    // previously survived 12 files / 143 tests.
    expect(getModelEditAttempt(attemptId)?.completion.phase).toBe('receipted')
  })

  it('a REFUSAL records a provisional refusal, not silence', async () => {
    const { attemptId, undo } = armedEdit()
    replies = [refusal()]

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current
        .sendSystemEvent(editEvent(), { optimisticFactorEdit: undo })
        .catch(() => undefined)
    })

    expect(getModelEditAttempt(attemptId)?.completion).toMatchObject({
      phase: 'refused',
      evidence: 'receipt',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ B2 — every other exit writes the ledger too', () => {
  it('the SCENARIO FENCE resolves the attempt instead of dropping it silently', async () => {
    const { attemptId, undo } = armedEdit()
    holdFirstTurn = true
    replies = [acceptance()]

    const { result } = renderHook(() => useConversation())
    let sent: Promise<unknown> | null = null
    await act(async () => {
      sent = result.current
        .sendSystemEvent(editEvent(), { optimisticFactorEdit: undo })
        .catch(() => undefined)
      await Promise.resolve()
    })

    // ⚠ THE TURN IS NEVER ABORTED. The user simply leaves for another scenario
    // while it is in flight, and a COMPLETE response then arrives for a
    // scenario they are no longer on. The fence correctly discards it — and the
    // ledger must still hear about it, or the row locks for the session.
    // (An aborted turn returns at the abort-after-response exit further up and
    // never reaches the fence at all — an earlier draft of this test aborted,
    // and was silently exercising that other arm instead.)
    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: OTHER_SCENARIO } as never, false)
      releaseHeldTurn?.()
      await sent
    })

    expect(getModelEditAttempt(attemptId)?.completion).toEqual({
      phase: 'unresolved',
      reason: 'The model moved on before this change settled.',
    })
  })

  it('an ABORTED turn resolves the attempt', async () => {
    const { attemptId, undo } = armedEdit()
    holdFirstTurn = true
    heldTurnResolvesOnAbort = false // rejects with AbortError
    replies = [acceptance()]

    const { result } = renderHook(() => useConversation())
    let sent: Promise<unknown> | null = null
    await act(async () => {
      sent = result.current
        .sendSystemEvent(editEvent(), { optimisticFactorEdit: undo })
        .catch(() => undefined)
    })
    await act(async () => {
      result.current.cancelTurn?.()
      await sent
    })

    expect(getModelEditAttempt(attemptId)?.completion.phase).toBe('unresolved')
  })

  it('a response that ARRIVES AFTER AN ABORT resolves the attempt', async () => {
    // The other abort exit, and it bypasses the `catch` entirely: `callV5Turn`
    // awaits headers and body separately, so a Stop landing between them leaves
    // the promise RESOLVING while the signal reads aborted.
    const { attemptId, undo } = armedEdit()
    holdFirstTurn = true
    heldTurnResolvesOnAbort = true
    replies = [acceptance()]

    const { result } = renderHook(() => useConversation())
    let sent: Promise<unknown> | null = null
    await act(async () => {
      sent = result.current
        .sendSystemEvent(editEvent(), { optimisticFactorEdit: undo })
        .catch(() => undefined)
      await Promise.resolve()
    })
    await act(async () => {
      result.current.cancelTurn?.()
      await sent
    })

    expect(getModelEditAttempt(attemptId)?.completion).toEqual({
      phase: 'unresolved',
      reason: 'The turn was interrupted before the change settled.',
    })
  })
})
