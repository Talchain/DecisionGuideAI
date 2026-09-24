/**
 * A direction change the model REFUSED must not stay on screen as if it saved.
 *
 * THE DEFECT (independent review of #1950 at `ae0c8935`, 5820041073): the new
 * "increases / decreases" buttons call `setDirection`, which wrote the flip
 * locally and fire-and-forgot the send — no in-flight mark, no settlement, no
 * `optimisticEdgeEdit`. So on a proven no-write refusal the revert never ran:
 * the store (which feeds the canvas and autosave) kept `negative`, "decreases"
 * stayed pressed, and nothing said "not recorded" — while the model and every
 * analysis still used `positive`. `setStrength` on the same hook already did
 * all of this; direction had simply not been routed through it.
 *
 * WHAT IS PINNED, through the mounted `InspectorRouter` and the REAL settlement
 * machinery (`settleSystemEventSend` → `resolveEdgeEditSettlement` → revert):
 *   1. REFUSED → the local direction returns to the model's, the model's
 *      button is pressed again, and the panel says it was not recorded.
 *   2. LOST RESPONSE → the flip is KEPT (it may have landed) and the panel says
 *      Olumi may not have recorded it — never "Sent", never reverted.
 *   3. THE SAME-MAGNITUDE TRAP — a direction flip keeps |mean|, so a check keyed
 *      on magnitude alone passes before the server has said anything about the
 *      SIGN. A 200 whose model still reads `positive` must not say "Sent".
 *   4. CONTRAST — a 200 whose model now reads `negative` says "Sent to Olumi"
 *      and keeps the flip. Without it, 1–3 pass for a panel that distrusts
 *      every send.
 *   5. The window between the press and the answer says "Sending…".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'
import { SystemEventSendError } from '../../../conversation/useConversation'
import {
  __resetPendingEdgeEditsForTest,
  markEdgeEditInFlight,
  resolveEdgeEditSettlement,
  unconfirmedEdgeEditOnGraph,
} from '../../../conversation/pendingEdgeEdit'

const sendSystemEvent = vi.fn<[WireSystemEvent, unknown?], Promise<unknown>>()

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})
vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const NODES = [
  { id: 'n_price', type: 'factor', data: { label: 'Price' }, position: { x: 0, y: 0 } },
  { id: 'n_revenue', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
]

const EDGE = {
  id: 'e1', source: 'n_price', target: 'n_revenue',
  data: {
    weight: 0.4, direction: 'positive', weightSource: 'cee',
    serverStrength: { mean: 0.4, effect_direction: 'positive' },
  },
}

const SENT = 'Sent to Olumi'
const NOT_RECORDED = 'Not recorded — Olumi did not take this change'
const UNVERIFIED = 'Olumi may not have recorded this'
const SENDING = 'Sending to Olumi…'

function seed() {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: [EDGE] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const readEdgeData = () =>
  useCanvasStore.getState().edges.find(e => e.id === 'e1')?.data as Record<string, unknown>

/** What the dispatcher's acknowledgement writes when CEE applied the flip. */
function serverNowStates(direction: 'positive' | 'negative') {
  const mean = direction === 'negative' ? -0.4 : 0.4
  useCanvasStore.setState((s: any) => ({
    edges: s.edges.map((e: any) => e.id !== 'e1' ? e : {
      ...e,
      data: { ...e.data, weight: 0.4, direction, serverStrength: { mean, effect_direction: direction } },
    }),
  }))
}

const feedback = () => screen.getByTestId('edge-direction-feedback')

async function flipToDecreases() {
  render(<InspectorRouter nodeId={null} edgeId="e1" onClose={() => {}} />)
  fireEvent.click(await screen.findByTestId('edge-direction-decreases'))
  await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(1))
}

beforeEach(() => {
  cleanup()
  sendSystemEvent.mockReset()
  __resetPendingEdgeEditsForTest()
  seed()
})

describe('a direction change is settled, never assumed', () => {
  it('REFUSED — the model\'s direction comes back, and the panel says it was not recorded', async () => {
    sendSystemEvent.mockImplementation(() =>
      Promise.reject(new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED' })))
    await flipToDecreases()

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(readEdgeData().direction).toBe('positive')
    expect(screen.getByTestId('edge-direction-increases')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('edge-direction-decreases')).toHaveAttribute('aria-pressed', 'false')
    expect(feedback().textContent).toContain(NOT_RECORDED)
    expect(feedback().textContent).not.toContain(SENT)
  })

  it('LOST RESPONSE — the flip is kept, and the panel says Olumi may not have recorded it', async () => {
    sendSystemEvent.mockImplementation(() => Promise.reject(new SystemEventSendError('transport')))
    await flipToDecreases()

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'unverified'))
    expect(readEdgeData().direction).toBe('negative')
    expect(feedback().textContent).toContain(UNVERIFIED)
    expect(feedback().textContent).not.toContain(SENT)
  })

  it('THE SAME-MAGNITUDE TRAP — a 200 whose model still reads positive is not "Sent"', async () => {
    sendSystemEvent.mockImplementation(async () => undefined)
    await flipToDecreases()

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'unverified'))
    expect(feedback().textContent).not.toContain(SENT)
  })

  it('CONTRAST — a 200 whose model now reads negative says "Sent to Olumi" and keeps the flip', async () => {
    sendSystemEvent.mockImplementation(async () => {
      serverNowStates('negative')
      return undefined
    })
    await flipToDecreases()

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'sent'))
    expect(feedback().textContent).toContain(SENT)
    expect(readEdgeData().direction).toBe('negative')
    expect(screen.getByTestId('edge-direction-decreases')).toHaveAttribute('aria-pressed', 'true')
  })

  it('between the press and the answer the panel says "Sending…"', async () => {
    let answer: (v: unknown) => void = () => {}
    sendSystemEvent.mockImplementation(() => new Promise(r => { answer = r }))
    await flipToDecreases()

    expect(feedback()).toHaveAttribute('data-settlement', 'pending')
    expect(feedback().textContent).toContain(SENDING)
    await act(async () => { serverNowStates('negative'); answer(undefined) })
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'sent'))
  })
})

/** Past `EditConfirmation`'s 1.5 s fade — real time: its timer is armed before any fake clock could be. */
const pastTheFade = () => act(() => new Promise<void>(r => setTimeout(r, 1700)))

describe('what outlasts the moment', () => {

  it('a refusal notice does not vanish on a timer — only "Sent" fades', async () => {
    sendSystemEvent.mockImplementation(() =>
      Promise.reject(new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED' })))
    await flipToDecreases()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))

    await pastTheFade()
    expect(feedback().textContent).toContain(NOT_RECORDED)
    expect(feedback()).toHaveAttribute('role', 'alert')
  })

  it('CONTRAST — "Sent to Olumi" does fade', async () => {
    sendSystemEvent.mockImplementation(async () => { serverNowStates('negative'); return undefined })
    await flipToDecreases()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'sent'))

    await pastTheFade()
    expect(feedback().textContent).not.toContain(SENT)
  })
})

describe('the hold asks the sign as well as the magnitude', () => {
  const before = { weight: 0.4, direction: 'positive' }

  it('a pending flip is unconfirmed only while the canvas SHOWS the flipped sign', () => {
    markEdgeEditInFlight('e1', 0.4, before, 'negative')
    // Same magnitude, old sign on screen: this is not the pending write.
    expect(unconfirmedEdgeEditOnGraph([{ id: 'e1', data: { weight: 0.4, direction: 'positive' } }])).toBeNull()
    // CONTRAST — the flipped sign on screen is the pending write.
    expect(unconfirmedEdgeEditOnGraph([{ id: 'e1', data: { weight: 0.4, direction: 'negative' } }])).toBe('e1')
  })
})

/**
 * ⛔ THE CANVAS WEIGHT IS NOT THE SERVER'S MAGNITUDE (independent review of
 * #1950 at `b16c4177`, 5820664860). The flip is sent at the SERVER's `|mean|`;
 * the canvas can show another weight — an unconfirmed strength drag is the
 * natural case. A guard that compared the two left the refused flip on screen,
 * beside its own "Not recorded". The refusal must restore the DIRECTION, and
 * only the direction: the drag beside it is not this edit's to undo.
 */
describe('a refused flip beside a canvas weight the server has not confirmed', () => {
  const refuse = () => sendSystemEvent.mockImplementation(() =>
    Promise.reject(new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED' })))

  function canvasWeight(w: number) {
    useCanvasStore.setState((st: any) => ({
      edges: st.edges.map((e: any) => e.id !== 'e1' ? e : { ...e, data: { ...e.data, weight: w, weightSource: 'user' } }),
    }))
  }

  it('A — canvas weight 0.6, server mean 0.4: the direction comes back and the weight stays', async () => {
    canvasWeight(0.6)
    refuse()
    await flipToDecreases()

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(readEdgeData().direction).toBe('positive')
    expect(readEdgeData().weight).toBe(0.6)
    expect(screen.getByTestId('edge-direction-decreases')).toHaveAttribute('aria-pressed', 'false')
  })

  it('B — a strength drag to 0.6 still in flight: the refused flip is undone, the drag is not', async () => {
    markEdgeEditInFlight('e1', 0.6, EDGE.data)
    canvasWeight(0.6)
    refuse()
    await flipToDecreases()

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(readEdgeData().direction).toBe('positive')
    expect(readEdgeData().weight).toBe(0.6)
    expect(readEdgeData().weightSource).toBe('user')
  })

  it('C — a pending drag took the sign negative; a refused "increases" restores NEGATIVE, what was on screen', async () => {
    markEdgeEditInFlight('e1', 0.6, EDGE.data)
    useCanvasStore.setState((st: any) => ({
      edges: st.edges.map((e: any) => e.id !== 'e1' ? e : {
        ...e, data: { ...e.data, weight: 0.6, weightSource: 'user', direction: 'negative', directionSource: 'user' },
      }),
    }))
    refuse()
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={() => {}} />)
    fireEvent.click(await screen.findByTestId('edge-direction-increases'))
    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(1))

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(readEdgeData().direction).toBe('negative')
    expect(readEdgeData().weight).toBe(0.6)
  })

  it('the hold follows the flipped SIGN whatever the canvas weight', () => {
    markEdgeEditInFlight('e1', 0.4, { weight: 0.4, direction: 'positive' }, 'negative')
    expect(unconfirmedEdgeEditOnGraph([{ id: 'e1', data: { weight: 0.6, direction: 'negative' } }])).toBe('e1')
    expect(unconfirmedEdgeEditOnGraph([{ id: 'e1', data: { weight: 0.6, direction: 'positive' } }])).toBeNull()
  })
})

/**
 * ⛔ A FLIP AND A STRENGTH DRAG ON ONE LINK MUST NOT OVERWRITE EACH OTHER'S
 * SETTLEMENT (independent review of #1950 at `858d9159`, 5820986154). With one
 * in-flight entry per edge, whichever came second replaced the first: the
 * first's refusal then reverted nothing, its hold ended early, and its sign
 * check was skipped. Each edit now keeps its own entry, settles against it,
 * and restores only what it owns.
 *
 * The strength edit is driven exactly as `setStrength` drives it: the
 * in-flight mark plus the canvas write, and its settlement through
 * `resolveEdgeEditSettlement`.
 */
describe('a flip and a strength drag on the same link, interleaved', () => {
  let answerFlip: (v: unknown) => void = () => {}
  const flipStaysPending = () =>
    sendSystemEvent.mockImplementation(() => new Promise(r => { answerFlip = r }))

  function dragStrengthTo(w: number) {
    markEdgeEditInFlight('e1', w, readEdgeData())
    useCanvasStore.setState((st: any) => ({
      edges: st.edges.map((e: any) => e.id !== 'e1' ? e : { ...e, data: { ...e.data, weight: w, weightSource: 'user' } }),
    }))
  }
  const strengthSettles = (w: number, settlement: 'refused' | 'sent') =>
    act(() => { resolveEdgeEditSettlement('e1', w, settlement) })

  /** CEE applied the flip: the acknowledgement states the new sign (magnitude untouched on the canvas). */
  function serverAppliedFlip() {
    useCanvasStore.setState((st: any) => ({
      edges: st.edges.map((e: any) => e.id !== 'e1' ? e : {
        ...e, data: { ...e.data, direction: 'negative', serverStrength: { mean: -0.4, effect_direction: 'negative' } },
      }),
    }))
  }

  async function clickDecreases() {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={() => {}} />)
    fireEvent.click(await screen.findByTestId('edge-direction-decreases'))
    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(1))
  }

  it('D — drag, then flip, then the DRAG is refused: the weight comes back, the pending flip is untouched', async () => {
    flipStaysPending()
    dragStrengthTo(0.6)
    await clickDecreases()

    await strengthSettles(0.6, 'refused')
    expect(readEdgeData().weight).toBe(0.4)
    expect(readEdgeData().direction).toBe('negative')
  })

  it('E — drag, then flip, the flip lands: the drag is STILL held off registration', async () => {
    flipStaysPending()
    dragStrengthTo(0.6)
    await clickDecreases()

    await act(async () => { serverAppliedFlip(); answerFlip(undefined) })
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'sent'))
    expect(unconfirmedEdgeEditOnGraph(useCanvasStore.getState().edges as never)).toBe('e1')
  })

  it('F1 — flip, then drag, the flip is answered WITHOUT the model stating the sign: not "Sent"', async () => {
    flipStaysPending()
    await clickDecreases()
    dragStrengthTo(0.6)

    await act(async () => { answerFlip(undefined) })
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'unverified'))
    expect(feedback().textContent).not.toContain(SENT)
  })

  it('F2 — flip, then drag, the flip lands and the DRAG is refused: the canvas keeps the model\'s sign', async () => {
    flipStaysPending()
    await clickDecreases()
    dragStrengthTo(0.6)
    await act(async () => { serverAppliedFlip(); answerFlip(undefined) })
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'sent'))

    await strengthSettles(0.6, 'refused')
    expect(readEdgeData().weight).toBe(0.4)
    expect(readEdgeData().direction).toBe('negative')
    expect(screen.getByTestId('edge-direction-decreases')).toHaveAttribute('aria-pressed', 'true')
  })
})

/**
 * ⛔ A FLIP THAT REPLACES A FLIP INHERITS THE ORIGINAL `before` (independent
 * review of #1950 at `437a5718`, 5821294085). With per-kind entries a flip's
 * predecessor can only be another flip, whose value is OPTIMISTIC — the server
 * still holds what was there before the first. Keeping the second flip's own
 * `before` made "decreases, then increases, both refused" end on `negative`
 * beside "Not recorded", while the model held `positive`.
 */
describe('changing your mind: two flips on one link', () => {
  const answers: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []
  const eachSendStaysPending = () =>
    sendSystemEvent.mockImplementation(() => new Promise((resolve, reject) => { answers.push({ resolve, reject }) }))
  const refusal = () => new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED' })

  async function decreasesThenIncreases() {
    answers.length = 0
    eachSendStaysPending()
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={() => {}} />)
    fireEvent.click(await screen.findByTestId('edge-direction-decreases'))
    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByTestId('edge-direction-increases'))
    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(2))
  }

  it('both refused: the canvas ends on the MODEL\'s sign, and nothing is left unconfirmed', async () => {
    await decreasesThenIncreases()
    await act(async () => { answers[0].reject(refusal()) })
    await act(async () => { answers[1].reject(refusal()) })

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(readEdgeData().direction).toBe('positive')
    expect(screen.getByTestId('edge-direction-increases')).toHaveAttribute('aria-pressed', 'true')
    expect(unconfirmedEdgeEditOnGraph(useCanvasStore.getState().edges as never)).toBeNull()
  })

  it('CONTRAST — the first lands, the second is refused: the canvas agrees with the model (negative)', async () => {
    await decreasesThenIncreases()
    await act(async () => { serverNowStates('negative'); answers[0].resolve(undefined) })
    await act(async () => { answers[1].reject(refusal()) })

    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(readEdgeData().direction).toBe('negative')
    expect(readEdgeData().serverStrength).toEqual({ mean: -0.4, effect_direction: 'negative' })
  })
})
