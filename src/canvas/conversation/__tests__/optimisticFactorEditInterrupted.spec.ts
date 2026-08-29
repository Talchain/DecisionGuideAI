/**
 * A factor edit whose turn is ABORTED resolves NOTHING, and the user is told
 * NOTHING. Measured on the deployed build, not derived.
 *
 * ── THE MEASUREMENT (staging deploy `9308a30c`, guest, one scenario id, run
 *    `confirm2`; the pinned immutable permalink's `/version.json` commit was
 *    asserted before a single reading was taken) ─────────────────────────────
 *
 *   POST-EDIT      "▾ Factors 5 · 2 with no value yet · 2 estimated by Olumi
 *                   · you set 1"
 *                  "● Migration investment (one-off capex)  Not set  User edited"
 *   ANALYSIS ~15s
 *   POST-ANALYSIS  "▾ Factors 5 · 2 with no value yet · 3 estimated by Olumi"
 *                  "● Migration investment (one-off capex)  Not set
 *                    Olumi: Moderate (0.5)  AI estimate"
 *   TRANSCRIPT NOTICE PRESENT = false
 *     (positive control 'Olumi' hits = 2, fabricated 'zzq_notice' hits = 0,
 *      transcript = 7,982 chars — so the probe could see, and could still say no)
 *
 * The analysis then named that same factor as the decision's biggest lever,
 * over the AI's number, with no mention anywhere that the user's had gone.
 *
 * ── WHAT THE WIRE SAYS, AND WHY IT REFUTES THE ORIGINAL DIAGNOSIS ───────────
 *
 * The defect was reported as the stale-turn gate on the optimistic-edit
 * resolution (`useConversation.ts` — `activeV5TurnIdRef.current === turnClientId`):
 * a newer turn takes the active slot, the edit's reply resolves neither arm.
 * That gate is real, but it CANNOT be what fired here, because it can only be
 * reached by a reply — and in the measured run the edit's reply never existed:
 *
 *   8  analyse REQ  POST /proxy/v5/turn  len=231
 *   9  analyse REQ  POST /proxy/v5/turn  len=244
 *  16  analyse RESP 200  /proxy/v5/turn  len=41739
 *
 * TWO turns dispatched back to back; ONE response. The analysis completed
 * ("ANALYSIS SETTLED ~15s"), so the turn that got no reply was the EDIT — its
 * request was cancelled in flight.
 *
 * The cancel is unconditional: every V5 dispatch runs `abortRef.current?.abort()`
 * before installing its own controller, so the next turn kills the one in
 * flight whatever kind it is. And the catch block gates the whole optimistic
 * resolution on `!isAbort`, so an aborted system turn carrying a
 * `factor_value_edit` runs NEITHER arm — no revert, no confirm, no notice, and
 * no freshness dirt. The value simply stands until the preempting turn's own
 * graph apply writes CEE's copy over it.
 *
 * ── WHY THIS IS THE ONLY GENUINELY SILENT PATH ─────────────────────────────
 *
 * The other two discard paths both leave the user something to read:
 *   · a typed refusal resolves through `resolveFailedOptimisticFactorEdit` and
 *     ships one of the `OPTIMISTIC_FACTOR_EDIT_NOTICE` sentences;
 *   · a 200 with no receipt reverts, and CEE's own prose ("Value 25 months
 *     exceeds the factor's cap of 6 months. I haven't changed anything.")
 *     renders in the transcript beside it.
 * An abort produces no reply, therefore no prose, therefore silence.
 *
 * ── WHAT THE FIX MAY NOT DO ────────────────────────────────────────────────
 *
 * It may not REVERT. We hold no committed bytes: the request was cancelled
 * client-side and CEE may well have taken it. Discarding the user's number on
 * that guess is the data-loss direction of the same harm, so every case below
 * carries its opposite-direction twin.
 *
 * It may not promise a way back, either. For a guest there is none: server
 * versions refuse outright, and local version history is only ever written by
 * a manual save button. A user who never pressed it has nothing to restore, so
 * the copy stops at "check it and set it again".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import type { WireSystemEvent } from '../types'
import {
  captureOptimisticFactorEdit,
  buildInterruptedFactorEditNotice,
} from '../optimisticFactorEdit'

/** Reply bodies the transport answers with, in order. */
const replies: Array<Record<string, unknown>> = []
const dispatched: Array<Record<string, unknown>> = []
let holdFirstTurn = false

/** An abort shaped exactly as `sendTurn` classifies it (`err.name === 'AbortError'`). */
function abortError(): Error {
  const e = new Error('The operation was aborted.')
  e.name = 'AbortError'
  return e
}

// Mock the TRANSPORT, not the context — `importOriginal` spread, never a
// hand-listed factory (trap 12). The held turn honours its AbortSignal, which
// is the whole point: this harness must be able to produce a REAL abort.
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(
      async (payload: Record<string, unknown>, opts?: { signal?: AbortSignal }) => {
        dispatched.push(payload)
        if (holdFirstTurn && dispatched.length === 1) {
          await new Promise((_res, rej) => {
            const signal = opts?.signal
            if (!signal) return
            if (signal.aborted) return rej(abortError())
            signal.addEventListener('abort', () => rej(abortError()))
          })
        }
        const response = replies.shift() ?? { assistant_text: 'ok', blocks: [] }
        return { ok: true, response }
      },
    ),
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isOrchestratorV2Enabled: () => true,
    isOrchestratorStreamingEnabled: () => false,
  }
})

import { useConversation } from '../useConversation'

const SCENARIO = 'c3c3c3c3-d4d4-4e5e-8f6f-a7a7a7a7a7a7'

/** The factor under edit. Bound by IDENTITY everywhere below, never by value. */
const TARGET_ID = 'fac_migration_investment'
const TARGET_LABEL = 'Migration investment (one-off capex)'
/** A SECOND factor, present throughout, so no assertion can pass on the wrong object. */
const BYSTANDER_ID = 'fac_headcount'
const BYSTANDER_LABEL = 'Team headcount'

const CAP = 10
/** What Olumi estimated, and what the model still holds. */
const PRIOR_MODEL = 0.5
const PRIOR_RAW = 5
/** What the user typed — the number the deployed build threw away. */
const SENT_MODEL = 0.8
const SENT_RAW = 8
const BYSTANDER_MODEL = 0.55

function factorNode(id: string, label: string, model: number, raw: number): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      category: 'controllable',
      display_value: `${raw} units`,
      observedState: { value: model, raw_value: raw, unit: 'units', cap: CAP, source: 'cee_inference' },
    },
  } as unknown as Node
}

const editEvent = (): WireSystemEvent =>
  ({
    type: 'factor_value_edit',
    payload: { target_id: TARGET_ID, value: SENT_MODEL, raw_value: SENT_RAW, unit: 'units', field: 'value' },
  }) as WireSystemEvent

/** CEE's ACCEPTANCE — the control that must never take the interrupted arm. */
const acceptance = () => ({
  assistant_text: `Updated ${TARGET_LABEL} from ${PRIOR_RAW} to ${SENT_RAW} units.`,
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
  graph_hash: 'ab12cd34ef56ab78',
})

/** The panel's optimistic write, through the same sanctioned setter it uses. */
function writeOptimistically(nodeId: string, model: number, raw: number) {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === nodeId)!
  const existing = (node.data as Record<string, unknown>).observedState as Record<string, unknown>
  store.updateNode(nodeId, {
    data: {
      ...(node.data as Record<string, unknown>),
      display_value: undefined,
      observedState: { ...existing, value: model, raw_value: raw, source: 'user' },
    },
  } as never)
}

function observedOn(nodeId: string) {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
  return ((node?.data as Record<string, unknown>)?.observedState ?? {}) as Record<string, unknown>
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

function noticesOf(result: { current: { messages: Array<Record<string, unknown>> } }) {
  return result.current.messages
    .filter((m) => m.role === 'assistant' && m.synthetic === true)
    .map((m) => String(m.content))
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  dispatched.length = 0
  replies.length = 0
  holdFirstTurn = false
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [
      factorNode(TARGET_ID, TARGET_LABEL, PRIOR_MODEL, PRIOR_RAW),
      factorNode(BYSTANDER_ID, BYSTANDER_LABEL, BYSTANDER_MODEL, 5.5),
    ],
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

/**
 * Drive the MEASURED sequence: the edit turn is genuinely in flight when the
 * user's next send preempts it, exactly as the two back-to-back `/proxy/v5/turn`
 * POSTs on the capture show.
 */
async function driveInterruptedEdit(opts?: { movedOnTo?: number }) {
  holdFirstTurn = true
  const { result } = renderHook(() => useConversation())

  const pre = useCanvasStore.getState().nodes.find((n) => n.id === TARGET_ID)!.data
  const undo = captureOptimisticFactorEdit(TARGET_ID, SENT_MODEL, pre)!
  writeOptimistically(TARGET_ID, SENT_MODEL, SENT_RAW)

  act(() => {
    void result.current.sendSystemEvent(editEvent(), { optimisticFactorEdit: undo }).catch(() => undefined)
  })
  await flush()

  // PRECONDITION, PINNED IN-TEST: the edit really was DISPATCHED and is in
  // flight. Without this the whole case could pass for the wrong reason — a
  // deferred edit never reaches the abort seam at all.
  expect(dispatched.length, 'the edit turn is in flight, not queued').toBe(1)
  expect(observedOn(TARGET_ID).value, 'the optimistic write stands before the preempt').toBe(SENT_MODEL)

  if (opts?.movedOnTo !== undefined) {
    writeOptimistically(TARGET_ID, opts.movedOnTo, opts.movedOnTo * CAP)
  }

  // The user clicks Analyse. `mode: 'user'` preempts: it aborts the in-flight
  // edit turn and dispatches its own.
  act(() => {
    void result.current.sendMessage('Run analysis').catch(() => undefined)
  })
  await flush()

  // The abort actually happened — a second turn went out and the first never
  // returned, which is the capture's 2-REQ/1-RESP signature.
  expect(dispatched.length, 'the preempting turn dispatched').toBe(2)

  return result
}

// ---------------------------------------------------------------------------
// DIRECTION 1 — the silence. This is the defect.
// ---------------------------------------------------------------------------

describe('a factor edit whose turn is ABORTED must not vanish in silence', () => {
  it('tells the user, NAMING the factor it could not confirm', async () => {
    const result = await driveInterruptedEdit()

    const notices = noticesOf(result as never)
    // RED before the fix: `notices` is EMPTY. The deployed transcript carried
    // 7,982 characters and not one of them mentioned the discarded edit.
    expect(notices).toContain(buildInterruptedFactorEditNotice(TARGET_LABEL))
    // Bound by IDENTITY: the sentence names the factor the event named, and
    // not the other factor sitting beside it on the same canvas.
    expect(notices.join(' ')).toContain(TARGET_LABEL)
    expect(notices.join(' ')).not.toContain(BYSTANDER_LABEL)
  })

  /**
   * ⚠ THE FRESHNESS LEVER WAS TRIED HERE AND REFUTED BY MEASUREMENT — recorded
   * rather than quietly dropped, because the refutation is the finding.
   *
   * This case was first written as `analysisFreshnessDirty === true`, on the
   * reasoning that `resolveFailedOptimisticFactorEdit` dirties freshness on its
   * cannot-confirm arm and this arm should too. It PASSED AT PRISTINE — and so
   * did its twin's `toBe(false)`, in the other direction, which is what exposed
   * it. The optimistic write is itself an analytical `updateNode`, so the flag
   * is ALREADY dirty before any turn is dispatched, on every path through this
   * file. It discriminates nothing here, and an assertion on it would have been
   * a guard agreeing with itself.
   *
   * It is also, on the deployed evidence, not the lever: staging `9308a30c`
   * dirtied freshness at the edit exactly as designed and STILL rendered
   * "Came out ahead in 92% of simulated scenarios — Leads via Migration
   * investment, its biggest lever". So the fix adds no `markAnalysisFreshnessDirty`
   * call: it would be a no-op dressed as a remedy. The sentence is the remedy.
   */
  it('does NOT promise a way back that a guest does not have', async () => {
    const result = await driveInterruptedEdit()
    const copy = noticesOf(result as never).join(' ')

    // PRECONDITION, PINNED IN-TEST: there IS copy to constrain. Without this
    // the case passes on an empty string — a guard agreeing with itself.
    expect(copy).toContain(TARGET_LABEL)
    // Server versions refuse for a guest, and local version history is only
    // ever written by a manual save button — so any of these would be a lie.
    expect(copy).not.toMatch(/previous version|earlier version|restore|version history|undo/i)
  })
})

// ---------------------------------------------------------------------------
// DIRECTION 2 — the OPPOSITE-DIRECTION TWINS. Each is the harm the fix would
// cause if it were written one notch wider. They must hold at pristine AND
// after the fix.
// ---------------------------------------------------------------------------

describe('the interrupted edit is not REVERTED — we hold no committed bytes', () => {
  it("OPPOSITE TWIN: the user's number stands, because CEE may well have taken it", async () => {
    await driveInterruptedEdit()

    // The request was cancelled CLIENT-side. Nothing was read back, so
    // discarding the user's value here would be data loss on a guess — the
    // exact mirror of the defect above.
    expect(observedOn(TARGET_ID).value).toBe(SENT_MODEL)
    expect(observedOn(TARGET_ID).raw_value).toBe(SENT_RAW)
    // DISCRIMINATOR: nothing touched the factor the event did not name.
    expect(observedOn(BYSTANDER_ID).value).toBe(BYSTANDER_MODEL)
  })

  it('OPPOSITE TWIN: an ACCEPTED edit takes the receipt arm and never the interrupted one', async () => {
    replies.push(acceptance())
    const { result } = renderHook(() => useConversation())

    const pre = useCanvasStore.getState().nodes.find((n) => n.id === TARGET_ID)!.data
    const undo = captureOptimisticFactorEdit(TARGET_ID, SENT_MODEL, pre)!
    writeOptimistically(TARGET_ID, SENT_MODEL, SENT_RAW)

    await act(async () => {
      await result.current.sendSystemEvent(editEvent(), { optimisticFactorEdit: undo })
    })
    await flush()

    expect(observedOn(TARGET_ID).value).toBe(SENT_MODEL)
    expect(noticesOf(result as never)).not.toContain(buildInterruptedFactorEditNotice(TARGET_LABEL))
    // The receipt arm ran, so the edit is resolved rather than abandoned.
    expect(dispatched.length).toBe(1)
  })

  it('OPPOSITE TWIN: an edit whose value has MOVED ON since dispatch says nothing', async () => {
    // A newer edit owns the surface and will resolve itself. Warning about the
    // superseded one is noise about a number no longer on screen — the same
    // stand-down `revertOptimisticFactorEdit` makes for the same reason.
    const result = await driveInterruptedEdit({ movedOnTo: 0.95 })

    expect(observedOn(TARGET_ID).value).toBe(0.95)
    expect(noticesOf(result as never)).not.toContain(buildInterruptedFactorEditNotice(TARGET_LABEL))
  })
})
