/**
 * A PROGRAM'S FIRST MODEL ON AN EMPTY CANVAS IS CEE'S GRAPH, NOT A DEFAULTED DRAFT (UI thin layer, step 1).
 * Every program reply reaches the client as a legacy `draft_graph` (`coreTurnToClientBody`), and on an empty canvas that
 * went through the draft apply (`applyDraftResult`), whose link mapper gives a link with no strength the UI's 0.5 and a
 * "positive" direction. A program core turn (CEE puts its `model_program` record on every turn whose model is a program,
 * core-route/contract.ts) now takes the program apply on an empty canvas too: the store holds exactly CEE's cards and
 * links, under CEE's ids, and a link that states neither a strength nor a direction holds neither.
 *
 * Real path: fetch -> parser -> conversation, as `useConversation.coreRouteServedTurn.spec.ts` drives it, and, for the
 * streamed draft, the real SSE consumer as `streamedDraftTurn.spec.ts` drives it. The graph is the qualitative journey's
 * real saved read (staging, 29 Oct 2026), sent as a core turn's model. Contrast: the same turn with no `model_program`
 * record (a core turn not on a program, and no read that said so) keeps the draft apply.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

import { SEND_DEFERRED, useConversation } from '../useConversation'
import { useStructuralAddEdgeEvents } from '../useStructuralAddEdgeEvents'
import { __resetProgramScenariosForTest } from '../../nodes/shared/savedModelProgram'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../../utils/mergeServerGraph'
import { __resetPendingFactorEditsForTest, pendingFactorEditValue } from '../pendingFactorEdit'
import { editDeliveryHold } from '../../registration/editDeliveryHold'
import { ANALYSIS_HELD_ON_EDIT_COPY } from '../../utils/analysisHeldOnInjectedModel'
import SERVED from '../../utils/__tests__/fixtures/served-qualitative-parallel-links.a3c24d98.read.json'

const mockOpenStream = vi.fn()
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args),
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
}))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
/** The layout engine, held by a test that needs a layout still running when a reply lands; otherwise the real one. */
const layoutHold = vi.hoisted(() => ({ next: null as null | ((nodes: Array<Record<string, unknown>>) => Promise<unknown>) }))
vi.mock('../../utils/layout', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/layout')>()
  return {
    ...real,
    layoutGraph: (...args: Parameters<typeof real.layoutGraph>) => {
      const hold = layoutHold.next
      layoutHold.next = null
      return hold ? hold(args[0] as never) as never : real.layoutGraph(...args)
    },
  }
})

beforeEach(() => {
  mockOpenStream.mockReset()
  // Buffered by default: the stream does not open, so the turn goes through the buffered fetch.
  mockOpenStream.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
  useCanvasStore.getState().reset()
  __resetPendingFactorEditsForTest()
  __resetProgramScenariosForTest()
})
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); vi.unstubAllGlobals() })

const FIRST = 'ads_before_fix__marketing_disruption'
const SECOND = 'ads_before_fix__marketing_disruption__2'
const FIGURE_CARD = 'repair_time'
const BRIEF = 'Should we delay the app update until the sync bug is fixed?'
type CanvasEdge = { id: string; source: string; target: string; data: Record<string, unknown> }
const storeEdges = () => useCanvasStore.getState().edges as unknown as CanvasEdge[]
const storeEdge = (id: string) => storeEdges().find((e) => e.id === id)
const figureOn = (id: string) =>
  ((useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as Record<string, unknown> | undefined)?.observedState as { value?: unknown } | undefined)?.value

/** CEE's core turn (contract fields as `CoreTurnContract` builds them), its model the saved read. */
function coreTurn(opts: {
  programRecord: unknown; text?: string; figure?: number; empty?: boolean
  /** Fields CEE states on a card, by card id; extra links CEE's model holds; the model's revision. */
  cardFields?: Record<string, Record<string, unknown>>; extraEdges?: unknown[]; revision?: string
  /** Cards CEE's model no longer holds, with every link that touches them. */
  without?: string[]
}) {
  const gone = new Set(opts.without ?? [])
  const nodes = opts.empty ? [] : SERVED.graph.nodes.filter((n) => !gone.has(n.id)).map((n) => ({
    ...n,
    ...(n.id === FIGURE_CARD && opts.figure !== undefined ? { observed_state: { value: opts.figure } } : {}),
    ...opts.cardFields?.[n.id],
  }))
  const edges = opts.empty ? [] : [...SERVED.graph.edges, ...(opts.extraEdges ?? [])]
    .filter((e) => !gone.has((e as { from: string }).from) && !gone.has((e as { to: string }).to))
  return {
    turn_id: `turn-${Math.random().toString(36).slice(2)}`,
    durability: 'recorded',
    assistant_text: opts.text ?? 'Here is a first model of your situation.',
    model: { revision: opts.revision ?? SERVED.graph_hash, scenario_revision: null, graph: { nodes, edges } },
    cards: [], notes: [], run: null, analysis_state: null,
    ...(opts.programRecord !== undefined ? { model_program: opts.programRecord } : {}),
    receipts: [], paused: null, error: null, action_bar: null,
  }
}
const draftTurn = (withProgramRecord: boolean) =>
  coreTurn({ programRecord: withProgramRecord ? { turn: 'draft', saved: true, model_program: 'v1' } : undefined })

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

function openBoard() {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.setState({ currentScenarioId: SERVED.scenario_id, nodes: [], edges: [], results: { status: 'idle' } as never } as never)
}

async function sendBrief(body: unknown) {
  openBoard()
  vi.stubGlobal('fetch', vi.fn(async () => json(body)))
  const { result } = renderHook(() => useConversation())
  await act(async () => { await result.current.sendMessage(BRIEF) })
  const edges = storeEdges()
  return { edges, byId: (id: string) => edges.find((e) => e.id === id) }
}

const settle = () => act(async () => {
  for (let round = 0; round < 20; round++) {
    for (let i = 0; i < 10; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
})

describe('a program core turn arriving on an empty canvas', () => {
  it('stores exactly CEE\'s cards and links under CEE\'s ids, both parallel links, and no default on the bare one', async () => {
    const { edges, byId } = await sendBrief(draftTurn(true))
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(SERVED.graph.nodes.map((n) => n.id).sort())
    expect(edges.map((e) => e.id).sort()).toEqual(SERVED.graph.edges.map((e) => e.id).sort())
    expect(edges.filter((e) => e.source === 'ads_before_fix' && e.target === 'marketing_disruption').map((e) => e.id).sort())
      .toEqual([FIRST, SECOND])
    const bare = byId(SECOND)!.data
    for (const key of ['weight', 'direction', 'weightSource', 'directionSource', 'beliefStrength', 'functionType']) {
      expect(bare, key).not.toHaveProperty(key)
    }
    expect(byId(FIRST)!.data).toMatchObject({ direction: 'positive', directionSource: 'cee' })
  })

  it('contrast: a core turn with no program record still takes the draft apply and its defaults', async () => {
    const { byId } = await sendBrief(draftTurn(false))
    expect(byId(SECOND)!.data).toMatchObject({ weight: 0.5, direction: 'positive' })
  })
})

/** A `Response` whose SSE body the test drives (the twin of `streamedDraftTurn.spec.ts`'s). */
function controllableStream() {
  const encoder = new TextEncoder()
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(c) { ctrl = c } })
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    async push(text: string) { ctrl.enqueue(encoder.encode(text)); await settle() },
  }
}
const frame = (obj: Record<string, unknown>) => `event: stage\ndata: ${JSON.stringify(obj)}\n\n`

describe('review 3: a streamed program draft takes one history entry, before its preview', () => {
  it('Undo after the draft restores the empty canvas, never the GRAPH_READY preview\'s defaulted links', async () => {
    openBoard()
    vi.stubGlobal('fetch', vi.fn(async () => json(draftTurn(true))))
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<unknown>
    await act(async () => { sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<unknown> })

    await stream.push(frame({ stage: 'GRAPH_READY', seq: 2, status: 'in_progress', schema_version: 'v3',
      graph: { nodes: SERVED.graph.nodes, edges: SERVED.graph.edges } }))
    // The preview went through the draft apply: its bare link carries the UI's defaults while the turn is open.
    expect(storeEdge(SECOND)?.data).toMatchObject({ weight: 0.5, direction: 'positive' })
    await stream.push(frame({ stage: 'COMPLETE', seq: 4, status: 'complete', status_code: 200, payload: draftTurn(true) }))
    await act(async () => { await sent })
    expect(mockOpenStream).toHaveBeenCalledTimes(1)
    expect(storeEdge(SECOND)?.data).not.toHaveProperty('weight')

    act(() => { useCanvasStore.getState().undo() })
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(storeEdges()).toHaveLength(0)
  })
})

/** Turn requests held open until the test answers them; any other request is a plain 404. */
function heldTurns() {
  const calls: Array<{ body: Record<string, unknown>; respond: (body: unknown) => void }> = []
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => new Promise<Response>((resolve) => {
    if (!String(url).includes('/v5/turn')) { resolve(new Response('{}', { status: 404 })); return }
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {}
    calls.push({ body, respond: (b) => resolve(json(b)) })
  })))
  return calls
}

async function draftedBoard(opts: { drainDrawnLinks?: boolean } = {}) {
  openBoard()
  const turnCalls = heldTurns()
  // With the drawn-link drainer mounted beside the conversation, as the board mounts it.
  const { result } = renderHook(() => {
    const conversation = useConversation()
    if (opts.drainDrawnLinks === true) useStructuralAddEdgeEvents(conversation.sendSystemEvent as never)
    return conversation
  })
  const until = async (n: number) => { for (let i = 0; i < 50 && turnCalls.length < n; i++) await settle() }
  let draft!: Promise<unknown>
  await act(async () => { draft = result.current.sendMessage(BRIEF) as Promise<unknown> })
  await until(1)
  turnCalls[0].respond(draftTurn(true))
  await act(async () => { await draft })
  expect(useCanvasStore.getState().nodes).toHaveLength(SERVED.graph.nodes.length)
  return { result, turnCalls, until }
}

describe('round 3 (a): a program core turn whose saved model is empty empties the canvas', () => {
  it('the receipt clears every card and link', async () => {
    const { result, turnCalls, until } = await draftedBoard()
    let turn!: Promise<unknown>
    await act(async () => { turn = result.current.sendMessage('Start again from nothing.') as Promise<unknown> })
    await until(2)
    turnCalls[1].respond(coreTurn({ programRecord: { turn: 'agent' }, text: 'The model is empty now.', empty: true }))
    await act(async () => { await turn })
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(storeEdges()).toHaveLength(0)
  })
})

describe('round 3 (b): a figure edit queued behind a program turn is delivered, with the delivery notice meanwhile', () => {
  it('the store holds exactly CEE\'s graph throughout, the hold says the change is still being saved, and CEE\'s answer lands', async () => {
    const { result, turnCalls, until } = await draftedBoard()
    expect(figureOn(FIGURE_CARD)).toBeUndefined()

    // A question is on its way; the person gives the repair time a figure meanwhile, and the edit queues behind it.
    let question!: Promise<unknown>
    await act(async () => { question = result.current.sendMessage('What if the repair takes longer?') as Promise<unknown> })
    await until(2)
    act(() => {
      useCanvasStore.setState((s) => ({
        nodes: s.nodes.map((n) => n.id === FIGURE_CARD ? { ...n, data: { ...n.data, observedState: { value: 42 } } } : n),
      }) as never)
    })
    let queued: unknown
    await act(async () => {
      queued = await result.current.sendSystemEvent(
        { type: 'factor_value_edit', payload: { target_id: FIGURE_CARD, value: 42, raw_value: 42, unit: 'week', field: 'value' } } as never,
        { optimisticFactorEdit: { nodeId: FIGURE_CARD, sentValue: 42, prevObservedState: undefined, prevDisplayValue: undefined } as never },
      )
    })
    expect(queued).toBe(SEND_DEFERRED)

    // The question's receipt is CEE's whole model, which does not hold the figure yet: the store is exactly that model.
    turnCalls[1].respond(coreTurn({ programRecord: { turn: 'agent' }, text: 'A longer repair lowers sync readiness.' }))
    await act(async () => { await question })
    expect(figureOn(FIGURE_CARD)).toBeUndefined()
    // Meanwhile the edit is shown as on its way: the delivery hold (whose sentence is the one below) and the card's
    // pending figure (`usePendingFactorEditValue`).
    expect(['edit_queued', 'edit_on_the_wire']).toContain(editDeliveryHold(useCanvasStore.getState() as never))
    expect(ANALYSIS_HELD_ON_EDIT_COPY.editInDelivery).toBe('Your change is still being saved. Analysis waits until Olumi confirms it.')
    expect(pendingFactorEditValue(FIGURE_CARD)).toBe(42)

    // The queued edit is delivered, as queued, and lands when CEE's graph includes it.
    await until(3)
    expect(turnCalls).toHaveLength(3)
    expect(turnCalls[2].body.event).toMatchObject({ kind: 'factor_value_edit', target_id: FIGURE_CARD, value: 42 })
    turnCalls[2].respond(coreTurn({ programRecord: { turn: 'card_edit', saved: true }, text: 'Saved.', figure: 42 }))
    await settle()
    expect(figureOn(FIGURE_CARD)).toBe(42)
    expect(pendingFactorEditValue(FIGURE_CARD)).toBeNull()
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
  })
})

/** Exactly what the inspector writes when a person states a link's strength (`drawnLinkSavesOnceStrengthIsStated`). */
const STATED = { weight: 0.4, weightSource: 'user', direction: 'positive', directionSource: 'user' }
const LINK_1 = { from: 'repair_time', to: 'review_reputation' }
const LINK_2 = { from: 'planned_release_time', to: 'marketing_disruption' }
const draw = (link: { from: string; to: string }) =>
  act(() => { useCanvasStore.getState().addEdge({ source: link.from, target: link.to, data: STATED } as never) })

describe('round 4: a second link drawn while the first is being sent is delivered', () => {
  it('the first link\'s receipt, which does not hold the second yet, never costs the second its send', async () => {
    const { turnCalls, until } = await draftedBoard({ drainDrawnLinks: true })
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(SERVED.graph_hash)

    draw(LINK_1)
    await until(2)
    expect(turnCalls[1].body.event).toMatchObject({ kind: 'structural_add_edge', from: LINK_1.from, to: LINK_1.to })

    // While the first is on the wire the person draws a second link; it queues behind the first.
    draw(LINK_2)
    expect(useCanvasStore.getState().pendingStructuralAddEdges.map((i) => [i.from, i.to])).toEqual([[LINK_2.from, LINK_2.to]])

    // The first link's receipt is CEE's whole model: the first link saved, the second not sent yet.
    turnCalls[1].respond(coreTurn({
      programRecord: { turn: 'structural_add_edge', saved: true }, text: 'Linked.', revision: 'rev-after-link-1',
      extraEdges: [{ id: 'repair_time__review_reputation', from: LINK_1.from, to: LINK_1.to, effect_direction: 'positive' }],
    }))
    await until(3)
    expect(turnCalls).toHaveLength(3)
    expect(turnCalls[2].body.event).toMatchObject({ kind: 'structural_add_edge', from: LINK_2.from, to: LINK_2.to })
  })
})

describe('round 4: a stale analysis entry never changes the options CEE sends', () => {
  it('a program core turn\'s receipt keeps CEE\'s option settings, whatever the retained analysis_ready says', async () => {
    const { result, turnCalls, until } = await draftedBoard()
    // An analysis_ready an earlier turn left behind, saying other things about two of the options.
    useCanvasStore.setState({
      ceeAnalysisReady: {
        status: 'ready',
        options: [
          { id: 'delay_update', label: 'Delay the update', status: 'ready', interventions: { repair_time: 99 } },
          { id: 'launch_as_planned', label: 'Launch as planned', status: 'ready', interventions: {}, is_baseline: true },
        ],
      },
    } as never)

    let turn!: Promise<unknown>
    await act(async () => { turn = result.current.sendMessage('What if the repair takes three weeks?') as Promise<unknown> })
    await until(2)
    // CEE's model: the delay option sets the repair time to 3; no option is marked as the baseline.
    turnCalls[1].respond(coreTurn({
      programRecord: { turn: 'agent' }, text: 'Delaying gives the repair three weeks.', figure: 7,
      cardFields: { delay_update: { interventions: { repair_time: 3 } } },
    }))
    await act(async () => { await turn })

    const option = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id)!.data as Record<string, unknown>
    expect(figureOn(FIGURE_CARD)).toBe(7)
    expect(option('delay_update').interventions).toEqual({ repair_time: 3 })
    for (const id of ['delay_update', 'launch_as_planned', 'staged_release']) expect(option(id), id).not.toHaveProperty('is_baseline')
    expect(option('launch_as_planned')).not.toHaveProperty('interventions')
  })
})

/** A layout held mid-run: resolves with the cards it was handed, each placed where `place` says. */
function holdLayout() {
  let handed: Array<Record<string, unknown>> = []
  let release!: (place: (i: number) => { x: number; y: number }) => void
  layoutHold.next = (nodes) => {
    handed = nodes
    return new Promise((resolve) => {
      release = (place) => resolve({ nodes: handed.map((n, i) => ({ ...n, position: place(i) })), layoutNodeWidth: 276, layoutCardWidths: {} })
    })
  }
  return { handed: () => handed, release: (place: (i: number) => { x: number; y: number }) => release(place) }
}

describe('round 5: a layout still running when a program reply lands never writes its old cards back', () => {
  it('the board is exactly CEE\'s graph after the stale layout lands, and the next layout only moves its cards', async () => {
    const { result, turnCalls, until } = await draftedBoard()
    expect(useCanvasStore.getState().pendingLayout).toBe(true)

    // The first model's layout starts, as the board's measurement hook starts it, and is still running...
    const stale = holdLayout()
    let laying!: Promise<unknown>
    act(() => {
      laying = useCanvasStore.getState().applyLayout({ skipHistory: true, requestId: useCanvasStore.getState().layoutRequestId, initiatedBy: 'product' })
    })
    await settle()
    expect(stale.handed().map((n) => n.id)).toContain('boss_backlash')

    // ...when CEE's reply lands: one card gone, a figure set.
    let turn!: Promise<unknown>
    await act(async () => { turn = result.current.sendMessage('Drop the boss backlash; the repair takes 7 weeks.') as Promise<unknown> })
    await until(2)
    turnCalls[1].respond(coreTurn({ programRecord: { turn: 'agent' }, text: 'Done.', figure: 7, without: ['boss_backlash'] }))
    await act(async () => { await turn })
    const ceeIds = SERVED.graph.nodes.map((n) => n.id).filter((id) => id !== 'boss_backlash').sort()
    const exactlyCee = () => {
      expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(ceeIds)
      expect(storeEdges().some((e) => e.source === 'boss_backlash' || e.target === 'boss_backlash')).toBe(false)
      expect(figureOn(FIGURE_CARD)).toBe(7)
    }
    exactlyCee()

    // The stale layout lands with the cards it read before the reply.
    await act(async () => { stale.release((i) => ({ x: 1000 + i, y: 1 })); await laying })
    exactlyCee()

    // The layout the reply leaves pending places CEE's cards, and moves nothing else.
    expect(useCanvasStore.getState().pendingLayout).toBe(true)
    const next = holdLayout()
    act(() => {
      laying = useCanvasStore.getState().applyLayout({ skipHistory: true, requestId: useCanvasStore.getState().layoutRequestId, initiatedBy: 'product' })
    })
    await settle()
    // A figure the person types while this layout runs is theirs when it lands.
    act(() => {
      useCanvasStore.setState((s) => ({
        nodes: s.nodes.map((n) => n.id === 'planned_release_time' ? { ...n, data: { ...n.data, observedState: { value: 3 } } } : n),
      }) as never)
    })
    await act(async () => { next.release((i) => ({ x: 2000 + i, y: 2 })); await laying })
    exactlyCee()
    expect(figureOn('planned_release_time')).toBe(3)
    const laidAt = new Map(next.handed().map((n, i) => [n.id as string, { x: 2000 + i, y: 2 }]))
    for (const n of useCanvasStore.getState().nodes) expect(n.position, n.id).toEqual(laidAt.get(n.id))
  })
})

describe('round 5: a link drawn on one scenario is never sent or applied under another', () => {
  const OTHER = '00000000-0000-4000-8000-00000000000b'
  /** B is a program board too: its read put its own model on the canvas. */
  const OTHER_READ = { nodes: [{ id: 'other_goal', kind: 'goal', label: 'Other goal' }], edges: [], living_model: { model_program: 'v1' } }

  it('switching to B while A\'s first link is on the wire: A\'s second link goes out under A, and B\'s board is untouched', async () => {
    const { turnCalls, until } = await draftedBoard({ drainDrawnLinks: true })
    // Two links drawn on A in one gesture batch: the drainer takes both and sends the first.
    act(() => {
      for (const link of [LINK_1, LINK_2]) useCanvasStore.getState().addEdge({ source: link.from, target: link.to, data: STATED } as never)
    })
    await until(2)
    expect(turnCalls[1].body).toMatchObject({ scenario_id: SERVED.scenario_id, event: { kind: 'structural_add_edge', from: LINK_1.from } })

    // The person opens scenario B while the first link is still being saved.
    act(() => {
      useCanvasStore.getState().adoptScenario(OTHER)
      mergeServerGraphOnHydrate(structuredClone(OTHER_READ))
    })
    const boardB = structuredClone({ nodes: useCanvasStore.getState().nodes, edges: useCanvasStore.getState().edges })

    // A's first receipt lands on B's board: fenced. A's second link then goes out, under A.
    turnCalls[1].respond(coreTurn({ programRecord: { turn: 'structural_add_edge', saved: true }, text: 'Linked.', revision: 'rev-a-1',
      extraEdges: [{ id: 'repair_time__review_reputation', from: LINK_1.from, to: LINK_1.to, effect_direction: 'positive' }] }))
    await until(3)
    expect(turnCalls).toHaveLength(3)
    expect(turnCalls[2].body).toMatchObject({ scenario_id: SERVED.scenario_id, event: { kind: 'structural_add_edge', from: LINK_2.from, to: LINK_2.to } })
    turnCalls[2].respond(coreTurn({ programRecord: { turn: 'structural_add_edge', saved: true }, text: 'Linked.', revision: 'rev-a-2' }))
    await settle()

    // Nothing of A's reached B.
    expect(useCanvasStore.getState().currentScenarioId).toBe(OTHER)
    expect({ nodes: useCanvasStore.getState().nodes, edges: useCanvasStore.getState().edges }).toEqual(boardB)
    expect(turnCalls.every((c) => c.body.scenario_id === SERVED.scenario_id)).toBe(true)
  })
})
