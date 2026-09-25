/**
 * SETTLING A CONTESTED CONNECTION — the act, end to end, on the real panel mount.
 *
 * WHAT WAS BROKEN. CEE tells the user, unprompted, that two drafting passes disagreed about a
 * link and that "it hasn't been settled". Measured at UI staging `3b7e5d4c` with a contrast
 * control: `buildEdgeAdjudicationEvent` had ZERO product callers (its only non-test references
 * were the adapter that RECEIVES the event and a sibling's docblock), while the same-family
 * `edgeStrengthEdit` had TEN non-test consumer files. The wire was open the whole time —
 * `edge_adjudication` is in `WIRE_SYSTEM_EVENT_TYPES` and CEE dispatches it `'fact_and_commit'`
 * — and the one surface that ever adjudicated is folded away by
 * `LEGACY_DETAILED_EDITOR_MOUNTED = false`. So the user could be told a disagreement mattered
 * and had no way to answer, and because `judgement-signals.ts` derives `contestedUnadjudicated`
 * by joining against exactly these facts, the product could never stop asking.
 *
 * ⛔⛔ AND THEN WHAT THE SURFACE SAID AFTER THE USER ACTED WAS NOT TRUE. The first version of
 * this suite mocked `sendSystemEvent` as `async () => 'sent'` — ALWAYS RESOLVING, ALWAYS
 * SUCCEEDING — so no assertion in it was structurally capable of observing a send that failed,
 * was refused, or never left. The carrier did `void sendSystemEvent(...)`, discarded the
 * outcome, and retired the row with a success sentence on all five settlements. **The
 * instrument could not reach the defect**, which is the invariant written against the failure
 * mode in hand rather than against the seam's spec (CLAUDE.md trap 13d).
 *
 * ⭐ SO THE MOCK IS NOW A DISPATCHER, NOT A CONSTANT: every test names the settlement it is
 * about, and the four that mean "did not land" / "cannot be shown to have landed" each have a
 * case. `settleSystemEventSend` IS NOT MOCKED — the five-way derivation runs for real, against
 * real `SystemEventSendError` / `SEND_BLOCKED` / `SEND_DEFERRED` inputs, so this suite exercises
 * the estate's one authority for the split rather than a local restatement of it.
 *
 * ⚠⚠ WHAT THIS INSTRUMENT STILL CANNOT SEE, STATED SO IT IS NOT LATER ASSUMED AWAY:
 *  · **It cannot witness the wire.** `sendSystemEvent` is a mock. This proves how the SURFACE
 *    reacts to each settlement; it proves nothing about which settlement a real turn produces
 *    under which server condition. That `isOrchestratorV2Enabled() === false` really yields
 *    `SEND_BLOCKED`, or that a 409 really carries `conflict_category`, is `useConversation`'s
 *    and CEE's to prove, not this suite's.
 *  · **`'sent'` is not a receipt and no case here pretends otherwise.** It means a POST left and
 *    the server has not answered. Nothing in this file observes CEE persisting the fact, and no
 *    assertion claims it did.
 *  · **It cannot discriminate WHICH mechanism enforces one-turn-per-press.** While a send is in
 *    flight the buttons are `disabled` AND the handler holds a re-entry latch; React does not
 *    dispatch `onClick` for a disabled button, so the double-press case cannot tell the two
 *    apart. The `disabled` half is pinned directly; the latch's RELEASE is pinned by the retry
 *    in the `refused` case. A mutant deleting the latch alone would survive this file.
 *  · **The durability case simulates the producer, it does not run it.** Re-asserting
 *    `user_action: 'pending'` is what a full draft or a patch does to this field
 *    (`applyDraftResult.ts:139`, `applyPatch.ts`'s `buildEdge`); this suite writes that state
 *    directly rather than drafting.
 *  · jsdom proves PRESENCE, never visibility (trap 3).
 *
 * WHY THE FULL PANEL AND NOT THE COMPONENT (trap 3b). A green suite says nothing about a
 * component the deployment does not render. These tests drive `PreAnalysisPanelV3`, the surface
 * deployed staging actually mounts, so the affordance is asserted where a user meets it.
 *
 * EVERY ASSERTION IS A MUTANT'S TOMBSTONE:
 *  · WIRE      — the verdict leaves the browser as a typed `edge_adjudication` event bound to
 *                the edge by from+to NODE ids, and carries the endorsed pass's mean.
 *  · IDENTITY  — pins name the SPECIFIC edge, the SPECIFIC verdict and the SPECIFIC settlement
 *                (`data-settlement`, trap 19). Never a length or text predicate another row
 *                could satisfy.
 *  · SETTLEMENT — the row retires and the acknowledgement appears ONLY on `sent`/`queued`; on
 *                `blocked`/`refused`/`unverified` the row stays, un-retired, and says so; and
 *                the window BEFORE any settlement is its own state, not a success default.
 *  · TWO HARMS — `refused`/`blocked` may say nothing was recorded; `unverified` may NOT, and a
 *                discriminating pair pins that they do not share a sentence (trap 22b).
 *  · NO VALUE  — no effect-strength value is written and no number reaches the screen. This is
 *                a judgement, not a value edit, and the copy may claim only what the fact does.
 *  · FAIL-CLOSED — no send ⇒ no button and a stated reason, never a dead control.
 *  · NO DURABILITY PROMISE — the retirement is session-scoped, demonstrated by the row coming
 *                back, and the acknowledgement does not claim otherwise.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

/** Typed so `.mock.calls[0][0]` is the EVENT, not an untyped tuple index. */
type SentEvent = { type: string; payload: Record<string, unknown> }

/**
 * ⭐ WHAT THE NEXT SEND DOES — swapped per test, never a constant.
 *
 * The default is the ordinary success path: `sendSystemEvent` resolves with an outcome that is
 * neither `SEND_DEFERRED` nor `SEND_BLOCKED`, which `settleSystemEventSend` settles as `'sent'`.
 * Every failure arm below replaces this with a REAL rejection or a REAL blocked outcome, so the
 * settlement under test is derived rather than asserted.
 */
let nextSend: () => Promise<unknown> = async () => undefined
const sendSystemEvent = vi.fn((_event: SentEvent, _opts?: Record<string, unknown>) => nextSend())

/**
 * The context the panel sees. A MUTABLE hoisted handle rather than a second `vi.mock` in the
 * offline test: re-mocking mid-file needs `vi.resetModules()`, which re-instantiates the whole
 * panel tree's module graph and lands it in its own error boundary — the test then "passes or
 * fails" on a crashed canvas rather than on the affordance. One mock, one switch.
 */
let conversationContext: { sendSystemEvent: typeof sendSystemEvent } | null = null

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  // ⚠ SPREAD THE ORIGINAL (trap 12). A bare factory REPLACES the module, so every other export
  // this panel's tree imports would silently vanish at collection.
  const actual = await importOriginal<typeof import('../../../conversation/ConversationContext')>()
  return {
    ...actual,
    useOptionalConversationContext: () => conversationContext,
  }
})

import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { useUIStore } from '../../../../stores/uiStore'
import { makeContestedEdge, makeContestedValidation } from '../../../../__fixtures__/contestedEdge'
import { CONTESTED_COPY } from '../constants'
import { contestedVerdictOptions } from '../contested/contestedVerdict'
import {
  SEND_BLOCKED,
  SEND_DEFERRED,
  SystemEventSendError,
} from '../../../conversation/useConversation'
import type { EdgeData } from '../../../domain/edges'
import type { ValidationMetadata } from '../../../domain/validation'

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

const BASE_NODES: Node[] = [
  node('d1', 'decision', 'Hire a tech lead or two developers?'),
  node('g1', 'goal', 'Increase delivery output', { goal_threshold: 0.8 }),
  node('o1', 'option', 'Hire a tech lead'),
  node('f_lead', 'factor', 'Tech lead impact'),
  node('f_speed', 'factor', 'Delivery speed'),
  node('f_cost', 'factor', 'Salary cost'),
  node('f_morale', 'factor', 'Team morale'),
]

function setGraph(edges: Edge[]) {
  useCanvasStore.setState({
    nodes: BASE_NODES,
    edges: edges as Edge<EdgeData>[],
    preAnalysisSensitivity: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: 0.8,
  })
}

beforeEach(() => {
  sendSystemEvent.mockClear()
  nextSend = async () => undefined
  conversationContext = { sendSystemEvent }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
  useReadinessStore.setState({
    readiness: {
      readiness_score: 72,
      readiness_level: 'ready',
      can_run_analysis: true,
      confidence_explanation: 'Looks consistent.',
      improvements: [],
    },
    loading: false,
    error: null,
  })
  useUIStore.setState({ activeOutputTab: 'results', pendingModelTabSection: null })
  setGraph([])
})

function renderPanel() {
  return render(
    <ToastProvider>
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun blockedReason={undefined} />
    </ToastProvider>,
  )
}

/**
 * Drain the microtask chain `settleSystemEventSend` settles on, inside `act` so React commits
 * the resulting state.
 *
 * ⚠ NO FAKE TIMERS AND NO `waitFor`: the settlement is a promise chain, not a timeout, and a
 * poller would pass just as happily against a surface that never settles at all. Draining
 * explicitly means the PENDING cases below can assert the window rather than race it.
 */
async function flushSettlement() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

const EDGE = 'e_lead_speed'
const settleBtn = (verdict: string, edgeId = EDGE) =>
  `pre-analysis-v3-contested-settle-${verdict}-${edgeId}`
const stateLine = (edgeId = EDGE) => `pre-analysis-v3-contested-settle-state-${edgeId}`
const ACK = 'pre-analysis-v3-contested-settled-ack'

/** The graph under test: ONE contested connection between two named factors. */
function oneContested(validation?: Partial<ValidationMetadata>) {
  setGraph([
    makeContestedEdge(EDGE, 'f_lead', 'f_speed', makeContestedValidation(validation)),
  ])
}

/** The edge as the store holds it now — the retire assertions read through this. */
function storedValidation(edgeId = EDGE): ValidationMetadata | undefined {
  const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
  return (edge?.data as { validation?: ValidationMetadata } | undefined)?.validation
}

describe('settling a contested connection — the verdict reaches the wire', () => {
  it('sends a typed edge_adjudication event bound to the edge by from+to node ids', async () => {
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [event] = sendSystemEvent.mock.calls[0]!
    // IDENTITY: the contract's rule is from+to NODE ids, not the client edge id.
    expect(event.type).toBe('edge_adjudication')
    expect(event.payload.from).toBe('f_lead')
    expect(event.payload.to).toBe('f_speed')
    expect(event.payload.edge_id).toBe(EDGE)
    expect(event.payload.verdict).toBe('accepted_pass2')
    await flushSettlement()
  })

  it('carries the endorsed pass mean — pass2 for the review, pass1 for the original', async () => {
    // The two verdicts must not collapse onto one number. The fixture's passes differ
    // (0.35 vs 0.6), so a builder that always sent one of them goes RED on the other arm.
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    const pass2Event = sendSystemEvent.mock.calls[0]![0]
    expect(pass2Event.payload.resolved_strength_mean).toBe(0.35)
    await flushSettlement()

    // ⚠ UNMOUNT FIRST. A second `render` into the same container leaves BOTH panels in the
    // document and `getByTestId` then throws on the duplicate — which reads exactly like the
    // affordance being missing.
    cleanup()
    sendSystemEvent.mockClear()
    oneContested()
    renderPanel()
    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass1')))
    const pass1Event = sendSystemEvent.mock.calls[0]![0]
    expect(pass1Event.payload.resolved_strength_mean).toBe(0.6)
    await flushSettlement()
  })

  it('records "can\'t say yet" as a real verdict that asserts no value', async () => {
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('dismissed')))
    await flushSettlement()

    const event = sendSystemEvent.mock.calls[0]![0]
    expect(event.payload.verdict).toBe('dismissed')
    // A dismissal asserts NO value — the contract's own rule, applied by the builder.
    expect(event.payload).not.toHaveProperty('resolved_strength_mean')
    expect(storedValidation()?.resolved_value).toBeNull()
  })
})

describe('settling a contested connection — the row retires and says so', () => {
  it('stamps the verdict as the USER\'s judgement on the edge', async () => {
    oneContested()
    renderPanel()
    expect(storedValidation()?.user_action).toBe('pending')

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    await flushSettlement()

    const after = storedValidation()
    expect(after?.user_action).toBe('accepted_pass2')
    // The USER made the choice, so `resolved_by` is theirs...
    expect(after?.resolved_by).toBe('user')
    // ...and the VALUE remains the producer's. `resolved_value` records which number the
    // endorsed pass stated; nothing here claims the human authored it.
    expect(after?.resolved_value).toEqual({ strength_mean: 0.35 })
  })

  it('retires the settled row and keeps the acknowledgement after the last one goes', async () => {
    oneContested()
    renderPanel()
    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
    expect(screen.queryByTestId(ACK)).toBeNull()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass1')))
    await flushSettlement()

    // The row leaves through `selectSurfacedContestedEdges`'s own `user_action` gate.
    expect(screen.queryByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeNull()
    // EMPTY MEANS ABSENT must not eat the confirmation the click just earned.
    const ack = screen.getByTestId(ACK)
    // IDENTITY: the settlement it speaks for is on the element, not inferred from its words.
    expect(ack).toHaveAttribute('data-settlement', 'sent')
    expect(ack).toHaveTextContent(CONTESTED_COPY.settleState.sent)
    // The count, the lead and the navigation CTA describe a list that is now empty.
    expect(screen.queryByTestId('pre-analysis-v3-contested-review')).toBeNull()
    expect(screen.queryByText(CONTESTED_COPY.lead)).toBeNull()
  })

  it('sends ONE turn per connection even if the control is clicked twice', async () => {
    // `sendSystemEvent` is a network TURN, so two for one intent is a real cost.
    //
    // ⚠ SCOPE, STATED (see the header): while the send is in flight the buttons are `disabled`
    // AND `handleSettle` holds a re-entry latch, and React will not dispatch `onClick` for a
    // disabled button — so this case pins the INVARIANT and cannot say which half enforced it.
    // The `disabled` half is asserted directly below; the latch's release is pinned by the
    // retry in the `refused` case.
    //
    // Two rows, so the sibling click below proves the suite is not merely observing an
    // unmounted or inert button — without it this test would pass against a component that had
    // stopped sending altogether.
    setGraph([
      makeContestedEdge(EDGE, 'f_lead', 'f_speed', makeContestedValidation()),
      makeContestedEdge('e_cost_morale', 'f_cost', 'f_morale', makeContestedValidation()),
    ])
    renderPanel()
    const button = screen.getByTestId(settleBtn('accepted_pass2'))

    fireEvent.click(button)
    fireEvent.click(button)

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId(settleBtn('accepted_pass2'))).toBeDisabled()
    // POSITIVE CONTROL: the latch is per connection, not a global one — the sibling still sends,
    // and its own buttons were never disabled.
    expect(screen.getByTestId(settleBtn('dismissed', 'e_cost_morale'))).not.toBeDisabled()
    fireEvent.click(screen.getByTestId(settleBtn('dismissed', 'e_cost_morale')))
    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    await flushSettlement()
  })

  it('leaves a DIFFERENT contested connection untouched', async () => {
    // Trap 19 at the section level: settling one row must not retire its neighbour.
    setGraph([
      makeContestedEdge(EDGE, 'f_lead', 'f_speed', makeContestedValidation()),
      makeContestedEdge('e_cost_morale', 'f_cost', 'f_morale', makeContestedValidation()),
    ])
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass1')))
    await flushSettlement()

    expect(screen.queryByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeNull()
    expect(
      screen.getByTestId('pre-analysis-v3-contested-row-e_cost_morale'),
    ).toBeInTheDocument()
    expect(storedValidation('e_cost_morale')?.user_action).toBe('pending')
  })
})

/**
 * ⛔⛔ THE SECTION THE ORIGINAL SUITE COULD NOT CONTAIN. Its mock always resolved `'sent'`, so
 * none of these states was reachable by any assertion it could have written.
 */
describe('settling a contested connection — what it says depends on how the send settled', () => {
  it('claims NOTHING in the window before a settlement arrives, and does not retire the row', async () => {
    // ⭐ THE PENDING WINDOW IS A THIRD STATE, NOT THE ABSENCE OF THE OTHER TWO. A settlement is
    // always at least a microtask late, so EVERY press passes through this. Falling through to
    // a success default here is precisely how the unconditional claim survived.
    let release!: (outcome: unknown) => void
    nextSend = () => new Promise(resolve => { release = resolve })
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    // Deliberately NOT flushed: this is the state at the instant of the press.

    // The row has NOT retired, locally or in the store.
    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
    expect(storedValidation()?.user_action).toBe('pending')
    // No acknowledgement. Nothing has been shown to have left.
    expect(screen.queryByTestId(ACK)).toBeNull()
    // And the row says what IS true: the send is in flight.
    const line = screen.getByTestId(stateLine())
    expect(line).toHaveAttribute('data-settlement', 'pending')
    expect(line).toHaveTextContent(CONTESTED_COPY.settleState.pending)
    expect(screen.getByTestId(settleBtn('accepted_pass2'))).toBeDisabled()

    // POSITIVE CONTROL: the window ends. Releasing the send retires the row and acknowledges it,
    // so the three absences above are the PENDING state and not a component that never worked.
    release(undefined)
    await flushSettlement()
    expect(screen.queryByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeNull()
    expect(screen.getByTestId(ACK)).toHaveAttribute('data-settlement', 'sent')
  })

  it('REFUSED: keeps the row, records nothing, and says the judgement is not with Olumi', async () => {
    // The server answered and its own line certifies it wrote nothing:
    // `settleSystemEventSend` asks `isProvenNoWriteConflict`, and `BASE_HASH_DIVERGED` is a
    // member of that closed set. The derivation is NOT mocked.
    nextSend = async () => {
      throw new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED' })
    }
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    await flushSettlement()

    // ⛔ THE HARM THIS CLOSES: the row must not retire and the product must not claim success.
    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
    expect(storedValidation()?.user_action).toBe('pending')
    expect(storedValidation()?.resolved_by).toBe('default')
    expect(screen.queryByTestId(ACK)).toBeNull()

    const line = screen.getByTestId(stateLine())
    expect(line).toHaveAttribute('data-settlement', 'refused')
    expect(line).toHaveTextContent(CONTESTED_COPY.settleState.refused)

    // The latch RELEASED, so the user can answer again — which is the point of telling them.
    expect(screen.getByTestId(settleBtn('accepted_pass2'))).not.toBeDisabled()
    nextSend = async () => undefined
    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    await flushSettlement()
  })

  it('REFUSED, FENCE: a STOPPED turn (CEE #1868 `turn_fence_stopped`) keeps the row and says the fence\'s own sentence', async () => {
    nextSend = async () => {
      throw new SystemEventSendError('server', { conflictCategory: 'turn_fence_stopped' })
    }
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    await flushSettlement()

    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
    expect(storedValidation()?.user_action).toBe('pending')
    const line = screen.getByTestId(stateLine())
    expect(line).toHaveAttribute('data-settlement', 'refused')
    expect(line).toHaveTextContent("That change wasn't saved because this turn was stopped. Nothing in your decision changed. Send the change again if you still want it.")
    expect(line.textContent ?? '').not.toContain(CONTESTED_COPY.settleState.refused)
  })

  it('NOT SENT: a send that never reached the server keeps the row and says so', async () => {
    // `SEND_BLOCKED` is returned with NO NETWORK CALL AT ALL when the orchestrator flag is off
    // or serialisation drops the event. Nothing left the browser.
    nextSend = async () => SEND_BLOCKED
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('dismissed')))
    await flushSettlement()

    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
    expect(storedValidation()?.user_action).toBe('pending')
    expect(screen.queryByTestId(ACK)).toBeNull()
    const line = screen.getByTestId(stateLine())
    expect(line).toHaveAttribute('data-settlement', 'blocked')
    expect(line).toHaveTextContent(CONTESTED_COPY.settleState.blocked)
  })

  it('UNVERIFIED: does not claim nothing was recorded, and does not share the refusal sentence', async () => {
    // ⛔ TWO HARMS, TWO PREDICATES (trap 22b). A transport failure cannot prove non-delivery —
    // `v5Adapter` catches a fetch rejection without observing whether the server accepted — so
    // answering "not recorded" here would invite the user to answer again about a judgement
    // Olumi may already hold. That is the OPPOSITE harm, and it must not share a sentence.
    nextSend = async () => {
      throw new SystemEventSendError('transport')
    }
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass1')))
    await flushSettlement()

    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
    expect(screen.queryByTestId(ACK)).toBeNull()

    const line = screen.getByTestId(stateLine())
    expect(line).toHaveAttribute('data-settlement', 'unverified')
    expect(line).toHaveTextContent(CONTESTED_COPY.settleState.unverified)
    // DISCRIMINATING PAIR: the two harms do not collapse onto one line. A single shared
    // "nothing was recorded" sentence would satisfy the assertion above and fail these.
    expect(line.textContent).not.toBe(CONTESTED_COPY.settleState.refused)
    expect(line.textContent).not.toBe(CONTESTED_COPY.settleState.blocked)
    expect(line.textContent).not.toBe(CONTESTED_COPY.settleState.sent)
  })

  it('QUEUED: retires the row, and the acknowledgement does not claim the turn has gone', async () => {
    // Buffered behind an in-flight turn: it will go, so the row retires — but the turn does not
    // exist yet, so "sent" would be false. The pair with the `sent` case above is what pins that
    // the acknowledgement reads its settlement rather than printing one string for both.
    nextSend = async () => SEND_DEFERRED
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    await flushSettlement()

    expect(screen.queryByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeNull()
    const ack = screen.getByTestId(ACK)
    expect(ack).toHaveAttribute('data-settlement', 'queued')
    expect(ack).toHaveTextContent(CONTESTED_COPY.settleState.queued)
    expect(ack.textContent).not.toBe(CONTESTED_COPY.settleState.sent)
  })
})

describe('settling a contested connection — what it must NOT do', () => {
  it('writes no effect-strength value and puts no number on the screen', async () => {
    oneContested()
    const before = useCanvasStore.getState().edges.find(e => e.id === EDGE)!.data
    renderPanel()

    // The section's own text, BEFORE the click — this is where a number would leak.
    const section = screen.getByTestId('pre-analysis-v3-contested')
    const text = section.textContent ?? ''
    expect(text).not.toContain('0.35')
    expect(text).not.toContain('0.6')

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    await flushSettlement()
    // POSITIVE CONTROL: the settle actually happened, so the three equalities below are read
    // AFTER the local write rather than before it. Without this they would hold trivially.
    expect(storedValidation()?.user_action).toBe('accepted_pass2')

    const after = useCanvasStore.getState().edges.find(e => e.id === EDGE)!.data as Record<
      string,
      unknown
    >
    // `edge_adjudication` is `fact_and_commit`: it writes NO graph. The local write is
    // validation METADATA only, so no value the analysis reads may move.
    expect(after.weight).toEqual((before as Record<string, unknown>).weight)
    expect(after.weightSource).toEqual((before as Record<string, unknown>).weightSource)
    expect(after.direction).toEqual((before as Record<string, unknown>).direction)
  })

  it('does not promise that this panel will stop raising the connection', async () => {
    // ⛔ THE SECOND FALSE CLAIM. The old acknowledgement read "Olumi will stop raising this
    // one." That is true of Olumi's COACHING (`judgement-signals.ts` joins against exactly
    // these facts) and FALSE of this panel: the row's suppression reads `validation.user_action`,
    // an opaque passthrough of the producer's payload that a full draft or any patch touching
    // the connection re-asserts as `'pending'`, and `edge_adjudication` writes no graph — so
    // the persisted connection never changes and the row comes back.
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    await flushSettlement()
    expect(screen.queryByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeNull()

    // What the producer does on the next draft or patch: re-assert its own validation payload.
    await act(async () => { oneContested() })

    // THE ROW IS BACK, asking the question again. The retirement was session-scoped all along.
    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
    // And it is ANSWERABLE: the re-entry latch guards the in-flight window only, so a re-raised
    // question is not a dead control. A latch held shut after a landed settlement would fail
    // here, which is why it is not.
    expect(screen.getByTestId(settleBtn('accepted_pass2'))).not.toBeDisabled()
    // No stale settlement line rides back with it either: a landed settlement's sentence belongs
    // to the acknowledgement, not to a row that is asking again.
    expect(screen.queryByTestId(stateLine())).toBeNull()
    // And the sentence the user read never promised otherwise: it states what this app did with
    // their judgement and stops there. Asserted on the RENDERED text, not on the constant, so a
    // second sentence appended at the render site cannot slip past this.
    const ack = screen.getByTestId(ACK)
    expect(ack).toHaveTextContent(CONTESTED_COPY.settleState.sent)
    expect(ack.textContent ?? '').not.toMatch(/stop (raising|asking)/i)
    expect(ack.textContent ?? '').toBe(CONTESTED_COPY.settleState.sent)
  })

  it('offers no button and states the reason when no send is available', () => {
    // FAIL-CLOSED. A verdict that cannot leave the browser must not be offered as if it could.
    conversationContext = null
    oneContested()
    renderPanel()

    expect(screen.queryByTestId(settleBtn('accepted_pass1'))).toBeNull()
    expect(screen.queryByTestId(settleBtn('accepted_pass2'))).toBeNull()
    expect(screen.queryByTestId(settleBtn('dismissed'))).toBeNull()
    expect(
      screen.getByTestId(`pre-analysis-v3-contested-settle-unavailable-${EDGE}`),
    ).toHaveTextContent(CONTESTED_COPY.settleUnavailable)
    // POSITIVE CONTROL: the row itself is still on screen, so the three absences above are the
    // affordance being withheld — not the section having failed to render at all.
    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
  })
})

describe('contestedVerdictOptions — fail-closed on a pass that states nothing', () => {
  it('drops the verdict for a non-finite pass mean and keeps the escape hatch', () => {
    expect(contestedVerdictOptions({ pass1Mean: 0.6, pass2Mean: 0.35 }).map(o => o.verdict)).toEqual(
      ['accepted_pass1', 'accepted_pass2', 'dismissed'],
    )
    // A pass with nothing finite to endorse cannot be endorsed self-containedly.
    expect(contestedVerdictOptions({ pass1Mean: null, pass2Mean: 0.35 }).map(o => o.verdict)).toEqual(
      ['accepted_pass2', 'dismissed'],
    )
    expect(
      contestedVerdictOptions({ pass1Mean: Number.NaN, pass2Mean: Number.POSITIVE_INFINITY }).map(
        o => o.verdict,
      ),
    ).toEqual(['dismissed'])
    // `dismissed` never carries a value, by contract.
    expect(
      contestedVerdictOptions({ pass1Mean: 0.6, pass2Mean: 0.35 }).find(
        o => o.verdict === 'dismissed',
      )?.resolvedMean,
    ).toBeNull()
  })
})
