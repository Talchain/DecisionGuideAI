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
 * ── WHY THIS PATH IS SILENT — AND THE CLAIM THAT IT WAS THE *ONLY* ONE,
 *    WITHDRAWN ────────────────────────────────────────────────────────────────
 *
 * The two POST-REPLY discard paths both leave the user something to read:
 *   · a typed refusal resolves through `resolveFailedOptimisticFactorEdit` and
 *     ships one of the `OPTIMISTIC_FACTOR_EDIT_NOTICE` sentences;
 *   · a 200 with no receipt reverts, and CEE's own prose ("Value 25 months
 *     exceeds the factor's cap of 6 months. I haven't changed anything.")
 *     renders in the transcript beside it.
 * An abort produces no reply, therefore no prose, therefore silence.
 *
 * ⚠ THIS HEADER USED TO SAY THE ABORT WAS THE ONLY GENUINELY SILENT PATH. FALSE
 * — refuted by execution in the #962 review, with a contrast control firing in
 * the same run. A signed-in session with `currentScenarioId` null refuses to
 * mint at `useConversation.ts:3636`, and that refusal's notice is gated
 * `mode === 'user' && !hidden`, so a SYSTEM `factor_value_edit` returns before
 * dispatch and before the try: `dispatched = 0`, `messages = 0`, canvas still
 * `{"value":0.8,…,"source":"user"}`, guest contrast control `dispatched = 1`.
 * It is silent for a DIFFERENT reason — it never reaches a reply, so a scan
 * that begins at the reply cannot see it — which is exactly why the original
 * enumeration missed it. Left unfixed and rowed, not closed blind: the honest
 * sentence there is about a decision that is not open, not about an interrupted
 * turn, and that copy is a separate change. Named rather than quietly dropped.
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
/**
 * ⚠ THE HELD TURN'S TWO ENDINGS, AND THE SECOND ONE IS WHY THIS FLAG EXISTS.
 *
 * `callV5Turn` awaits `fetch()` (headers) and `parseV5Response(res)` (body) as
 * two SEPARATE awaits (`v5Adapter.ts:119`, `:198`). An abort between them, on a
 * small already-buffered receipt, leaves `res.json()` resolving normally — so
 * the promise RESOLVES while the signal reads aborted, and `sendTurn` leaves
 * through `if (controller.signal.aborted) return` INSIDE the try, never
 * reaching the catch. Every case above this flag drives the rejecting ending;
 * none of them can see that exit, which is exactly how the #962 review found
 * PR head emitting ZERO notices where the merge base emitted one.
 */
let heldTurnResolvesOnAbort = false

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
          await new Promise((res, rej) => {
            const signal = opts?.signal
            const settle = () => (heldTurnResolvesOnAbort ? res(undefined) : rej(abortError()))
            if (!signal) return
            if (signal.aborted) return settle()
            signal.addEventListener('abort', settle)
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

/** What the server answers a Stop with. Set per case; all three are driven. */
let stopKind: 'not_saved' | 'already_saved' | 'unconfirmed' = 'not_saved'
vi.mock('../../../v5/stopTurn', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, stopV5Turn: vi.fn(async () => ({ kind: stopKind })) }
})

import { useConversation } from '../useConversation'
import {
  EARLY_STOP_NOT_SAVED_NOTICE,
  EARLY_STOP_ALREADY_SAVED_NOTICE,
  EARLY_STOP_UNCONFIRMED_NOTICE,
} from '../../components/DraftLoadingAnimation'

const STOP_NOTICE_BY_KIND = {
  not_saved: EARLY_STOP_NOT_SAVED_NOTICE,
  already_saved: EARLY_STOP_ALREADY_SAVED_NOTICE,
  unconfirmed: EARLY_STOP_UNCONFIRMED_NOTICE,
} as const

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
  heldTurnResolvesOnAbort = false
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
  /**
   * ⚠ TITLE CORRECTED AFTER REVIEW — it used to read "the user's number
   * stands", which OVERSOLD what this pins. It passes because the harness's
   * preempting reply carries no graph (`replies` is empty, so the stub answers
   * `{assistant_text:'ok', blocks:[]}`). It therefore demonstrates that THIS ARM
   * does not revert; it demonstrates nothing about survival in production,
   * where the same lane's own staging reading shows the row flipping to
   * "Olumi: Moderate (0.5) · AI estimate" once the preempting turn's graph
   * apply lands.
   *
   * ⭐ SO THE SCOPE OF THE WHOLE FIX, PLAINLY: THIS ADDS AN APOLOGY, NOT A
   * RESCUE. The user is told their number could not be confirmed. The number
   * itself is still liable to be overwritten by the turn that interrupted it.
   * Saying that here rather than letting a green test title imply otherwise.
   */
  it('OPPOSITE TWIN: the arm itself does not revert — there are no committed bytes either way', async () => {
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

// ---------------------------------------------------------------------------
// DIRECTION 3 — THE STOP SEAM. Found by the independent review of #962, BY
// EXECUTION, and it is the arm's real cost rather than a hypothetical.
//
// All three stop notices open "You stopped this draft". None of them is about a
// value edit, and on a stopped `factor_value_edit` turn there IS no draft in
// flight — `isThinking` is set by the edit turn itself, and the Stop button
// renders on `isThinking` alone. So the product answered a question nobody
// asked, and answered it falsely: EARLY_STOP_NOT_SAVED_NOTICE promises "Your
// canvas is unchanged" while the user's optimistic 0.8 is sitting on it, and
// EARLY_STOP_UNCONFIRMED_NOTICE tells the user to RELOAD — which would discard
// the very unpersisted value the edit notice has just told them to go and check.
//
// The reviewer's probe, at the arm as first shipped:
//
//   PROBE_NOTICE_COUNT=2
//   [0] "You stopped this draft, and it was cancelled before it was saved.
//        Your canvas is unchanged — start a new draft when you are ready."
//   [1] "I couldn't confirm your change to Migration investment (one-off capex)
//        … set the value again if you need it counted."
//   PROBE_CANVAS_VALUE=0.8      <- so [0] is FALSE
//
// ── WHICH NOTICE FIRES, AND WHY THAT AND NOT A COPY TWEAK ─────────────────
//
// The two sentences answer DIFFERENT QUESTIONS: the stop notice answers "what
// happened to the DRAFT you stopped?", the edit notice answers "what happened
// to the VALUE you set?". On this turn the first question has no subject. So
// the fix is not to caveat the draft copy into truthfulness, nor to concatenate
// two sentences — it is that `cancelTurn` emits the notice matching the KIND of
// turn it stopped. Exactly one notice per stop, as `cancelTurn`'s own invariant
// requires, and it is the one with a subject.
//
// ⚠ AND THE TWIN THAT MAKES THAT SAFE, which is the whole risk of this change:
// suppressing the draft notice must NEVER produce silence. `cancelTurn`'s own
// comment states the rule — "a Stop the user pressed is never silent". So the
// suppression is conditional on the edit notice ACTUALLY speaking, decided by
// the same single predicate both sites read, captured synchronously before the
// abort. When the edit stands down (node gone, value moved on) the draft stop
// notice fires exactly as it does today.
// ---------------------------------------------------------------------------

async function driveStoppedEdit(
  kind: 'not_saved' | 'already_saved' | 'unconfirmed',
  opts?: { movedOnTo?: number; deleteNode?: boolean; resolveOnAbort?: boolean },
) {
  stopKind = kind
  holdFirstTurn = true
  heldTurnResolvesOnAbort = opts?.resolveOnAbort === true
  const { result } = renderHook(() => useConversation())

  const pre = useCanvasStore.getState().nodes.find((n) => n.id === TARGET_ID)!.data
  const undo = captureOptimisticFactorEdit(TARGET_ID, SENT_MODEL, pre)!
  writeOptimistically(TARGET_ID, SENT_MODEL, SENT_RAW)

  act(() => {
    void result.current.sendSystemEvent(editEvent(), { optimisticFactorEdit: undo }).catch(() => undefined)
  })
  await flush()
  expect(dispatched.length, 'the edit turn is in flight, not queued').toBe(1)

  if (opts?.movedOnTo !== undefined) writeOptimistically(TARGET_ID, opts.movedOnTo, opts.movedOnTo * CAP)
  if (opts?.deleteNode) {
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.filter((n) => n.id !== TARGET_ID),
    } as never)
  }

  act(() => {
    result.current.cancelTurn()
  })
  await flush()
  return result
}

describe('Stop during an in-flight factor edit — exactly ONE notice, and it has a subject', () => {
  it.each(['not_saved', 'already_saved', 'unconfirmed'] as const)(
    'stop outcome %s: the value-edit notice speaks and the draft notice stands down',
    async (kind) => {
      const result = await driveStoppedEdit(kind)
      const notices = noticesOf(result as never)

      // RED before the fix: TWO notices, the draft one first and false.
      expect(notices).toHaveLength(1)
      expect(notices[0]).toBe(buildInterruptedFactorEditNotice(TARGET_LABEL))
      expect(notices).not.toContain(STOP_NOTICE_BY_KIND[kind])
    },
  )

  it('never claims the canvas is unchanged while the user’s value is sitting on it', async () => {
    const result = await driveStoppedEdit('not_saved')

    // PRECONDITION, PINNED IN-TEST: the value really IS on the canvas, so the
    // claim under test really would be false. Without this the assertion passes
    // on a canvas that happens to be empty.
    expect(observedOn(TARGET_ID).value).toBe(SENT_MODEL)
    expect(noticesOf(result as never).join(' ')).not.toMatch(/canvas is unchanged/i)
  })

  it('never tells the user to reload, which would discard the unpersisted value', async () => {
    const result = await driveStoppedEdit('unconfirmed')

    expect(observedOn(TARGET_ID).value).toBe(SENT_MODEL)
    // EARLY_STOP_UNCONFIRMED_NOTICE says "reload to see what your canvas holds".
    // The optimistic write is in the autosave slot only when something flushed
    // it, and this arm deliberately flushes nothing — so a reload is the one
    // instruction that can destroy what the other notice just asked them to check.
    expect(noticesOf(result as never).join(' ')).not.toMatch(/reload/i)
  })
})

describe('the stop suppression is conditional — a Stop the user pressed is NEVER silent', () => {
  it('OPPOSITE TWIN: when the value has MOVED ON, the draft stop notice fires as it does today', async () => {
    const result = await driveStoppedEdit('not_saved', { movedOnTo: 0.95 })
    const notices = noticesOf(result as never)

    // The edit notice stands down (a newer edit owns the surface), so the
    // suppression must stand down with it. Silence here would be the defect
    // this whole PR exists to remove, reintroduced by its own fix.
    expect(notices).toHaveLength(1)
    expect(notices[0]).toBe(EARLY_STOP_NOT_SAVED_NOTICE)
  })

  it('OPPOSITE TWIN: when the value has MOVED ON *and* the response resolves after the abort, the draft stop notice still fires', async () => {
    // The same twin as above, on the OTHER exit. Both directions must hold on
    // both arms or the suppression has a hole on one of them and the suite
    // cannot tell — which is precisely how the non-`catch` exit shipped silent.
    const result = await driveStoppedEdit('not_saved', { movedOnTo: 0.95, resolveOnAbort: true })
    const notices = noticesOf(result as never)

    expect(notices).toHaveLength(1)
    expect(notices[0]).toBe(EARLY_STOP_NOT_SAVED_NOTICE)
  })

  it('OPPOSITE TWIN: when the NODE IS GONE, the draft stop notice fires as it does today', async () => {
    // ⚠ THIS CASE EXISTS BECAUSE THE REVIEW FOUND `if (!node) return` WAS A
    // SURVIVING MUTANT — the comment claimed TWO preconditions binding by
    // identity and only one of them was pinned by anything. A comment asserting
    // a guard no test holds is how the next reader is misled.
    const result = await driveStoppedEdit('already_saved', { deleteNode: true })
    const notices = noticesOf(result as never)

    expect(notices).toHaveLength(1)
    expect(notices[0]).toBe(EARLY_STOP_ALREADY_SAVED_NOTICE)
  })
})

// ---------------------------------------------------------------------------
// DIRECTION 4 — THE EXIT NOTHING ABOVE DRIVES.
//
// Found by the independent review of #962, by execution, with a base-commit
// control. `cancelTurn` stands its stop notice down on a PREDICTION that the
// catch's abort arm will speak. The two sites read ONE predicate, so they
// cannot DISAGREE — but a reader that is never REACHED cannot agree either,
// and there are exactly two returns inside `sendTurn`'s try that bypass the
// catch. On the first of them the promise RESOLVES (the Stop landed between
// the header await and the body await), so nothing threw, nothing was caught,
// and the suppression stood alone.
//
// MEASURED, both arms, same driver, preconditions pinned in-probe (edit
// dispatched = 1; the optimistic 0.8 asserted on the canvas; isThinking true):
//
//   PR HEAD c62e1bfe   notice count = 0   canvas value = 0.8 (source 'user')
//   BASE    e38b8e96   notice count = 1   "You stopped this draft … Your canvas
//                                          is unchanged — start a new draft…"
//
// The base sentence is FALSE while 0.8 sits on the canvas — that is the defect
// this PR set out to remove. The PR turned one wrong sentence into NO sentence,
// which is the worse direction by this file's own rule, and the twelve cases
// above were all green throughout because every one of them drives the
// REJECTING ending.
// ---------------------------------------------------------------------------

describe('the response that RESOLVES after the abort — the exit that bypasses the catch', () => {
  it('still speaks, and the sentence names the factor', async () => {
    const result = await driveStoppedEdit('not_saved', { resolveOnAbort: true })

    // PRECONDITION, PINNED IN-TEST: the optimistic value really is on the
    // canvas, so silence here really would leave a number nothing reconciles.
    expect(observedOn(TARGET_ID).value, 'the optimistic write stands').toBe(SENT_MODEL)

    const notices = noticesOf(result as never)
    // RED at PR head c62e1bfe: `notices` is EMPTY — 0, against a base of 1.
    expect(notices).toHaveLength(1)
    expect(notices[0]).toBe(buildInterruptedFactorEditNotice(TARGET_LABEL))
    // Bound by IDENTITY, not by shape: the sentence names the factor the event
    // named and not the other factor sitting beside it on the same canvas.
    expect(notices[0]).toContain(TARGET_LABEL)
    expect(notices[0]).not.toContain(BYSTANDER_LABEL)
    // The copy itself, pinned by a LITERAL rather than by the production
    // builder — the review's note that an equality against the builder cannot
    // see a copy change. The phrase chosen is the one that distinguishes this
    // sentence from `unconfirmed_server`, which also opens "I couldn't confirm".
    expect(notices[0]).toContain('the turn carrying it was interrupted')
  })

  it('does not emit the false draft notice on this exit either', async () => {
    const result = await driveStoppedEdit('not_saved', { resolveOnAbort: true })

    expect(observedOn(TARGET_ID).value).toBe(SENT_MODEL)
    expect(noticesOf(result as never).join(' ')).not.toMatch(/canvas is unchanged/i)
  })
})
