/**
 * ⭐ A PROGRAM BOARD OFFERS NO HAND-DRAWN LINK (lease U-W3, 25 Oct). CEE's core route refuses every canvas edit on a
 * program except a card's figure or a goal's target (`core-turn.ts` program branch, CEE staging 9749f03a: 409
 * CANVAS_EDIT_REFUSED, nothing saved), and the UI's link sender has no revert, so a drawn link was a link on the canvas
 * the model does not hold. The gesture now refuses it with the sentence it already uses for a link it cannot save.
 *
 * Real path: the real `useConnectGesture` and `InspectorConnectPicker` against the real store; the program flag is the
 * real saved-graph read (only `fetch` stubbed) of a served program read (`pass-funding-72300716-read.json`, its `_source`
 * names the run and served commits). The contrast is the same read with no program flag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../conversation/drawnLinkProposal', () => ({ proposeForDrawnLink: vi.fn(() => 'sent'), proposeWhenLeftUnsized: vi.fn(() => () => {}) }))

import { useConnectGesture } from '../useConnectGesture'
import { InspectorConnectPicker } from '../../ui/inspector-v2/shared/InspectorConnectPicker'
import { useCanvasStore } from '../../store'
import { SHARED_MODEL_AUTHORITY_COPY } from '../../mutations/mutationAuthority'
import funding from '../../runView/__tests__/fixtures/pass-funding-72300716-read.json'

type Json = Record<string, any>

// Two unlinked factors of the served read: no self-loop, duplicate, limit, cycle or Question rule refuses the pair.
const FROM = 'firm_deal_size'
const TO = 'cash_available'

let read: Json = funding as Json
/** How the graph route answers: with the read, not yet (held until `answer()`), or with a server error. */
let route: 'serve' | 'hold' | 'fail' = 'serve'
let answer: () => void = () => {}
let n = 0
/** The served read on screen: as served (a program board) or, `false`, with its program flag removed. */
function board(program: boolean) {
  n += 1
  const graph = funding.graph as Json
  const { model_program: _program, ...legacyModel } = graph.living_model as Json
  read = { ...funding, graph_hash: `${funding.graph_hash.slice(0, 11)}${String(n).padStart(5, '0')}`,
    graph: program ? graph : { ...graph, living_model: legacyModel } }
  useCanvasStore.setState({
    currentScenarioId: funding.scenario_id,
    lastServerGraphHash: read.graph_hash,
    lastAuthoritativeGraph: null,
    _externalMutationActive: 0,
    pendingStructuralAddEdges: [],
    nodes: (graph.nodes as Json[]).map((x) => ({ id: x.id, type: x.kind, position: { x: 0, y: 0 }, data: { label: x.label, kind: x.kind } })),
    edges: (graph.edges as Json[]).map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to, type: 'styled', data: {} })),
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
  } as never)
}

/** A card as React Flow renders it, to release the pointer over. */
function cardBody(id: string): HTMLElement {
  const card = document.createElement('div')
  card.className = 'react-flow__node react-flow__node-factor'
  card.setAttribute('data-id', id)
  document.body.appendChild(card)
  return card
}
const release = (target: HTMLElement) => ({ target } as unknown as MouseEvent)
const drawn = () => useCanvasStore.getState().edges.filter((e) => e.source === FROM && e.target === TO)
const queued = () => useCanvasStore.getState().pendingStructuralAddEdges

let toasts: Array<[string, string]>
const showToast = vi.fn((m: string, t: string) => { toasts.push([m, t]) })
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })

/** The gesture as the canvas mounts it (`enabled` is the build's edge-add authority, true on staging), after the read lands. */
async function gesture() {
  const hook = renderHook(() => useConnectGesture({ enabled: true, showToast }))
  await settle()
  return hook.result.current
}

beforeEach(() => {
  toasts = []
  showToast.mockClear()
  window.history.replaceState(null, '', '/?ai=core-route')
  route = 'serve'
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!/\/scenarios\/[^/]+\/graph$/.test(String(url))) return new Response('{}', { status: 404 })
    if (route === 'fail') return new Response('{}', { status: 500 })
    if (route === 'hold') await new Promise<void>((resolve) => { answer = resolve })
    return new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.innerHTML = ''; window.history.replaceState(null, '', '/') })

describe('a program board: a drawn link is refused with the existing sentence, and nothing is made or sent', () => {
  it('a drop on the card body makes no link, queues nothing, and says how to change the model', async () => {
    board(true)
    const g = await gesture()
    g.onConnectStart(null, { nodeId: FROM, handleType: 'source' })
    g.onConnectEnd(release(cardBody(TO)))
    expect(drawn()).toEqual([])
    expect(queued()).toEqual([])
    expect(toasts).toEqual([[SHARED_MODEL_AUTHORITY_COPY, 'info']])
  })

  it('the drag offers no valid target, and a handle drop makes no link', async () => {
    board(true)
    const g = await gesture()
    expect(g.isValidConnection({ source: FROM, target: TO })).toBe(false)
    g.onConnect({ source: FROM, target: TO, sourceHandle: null, targetHandle: null })
    expect(drawn()).toEqual([])
    expect(queued()).toEqual([])
    expect(toasts).toEqual([[SHARED_MODEL_AUTHORITY_COPY, 'info']])
  })

  it('the inspector’s connect picker offers no target', async () => {
    board(true)
    render(<InspectorConnectPicker nodeId={FROM} />)
    await settle()
    expect(screen.getByTestId('inspector-connect-picker').querySelector('select')).toBeNull()
  })
})

describe('CONTRAST: the same read with no program flag keeps today’s gesture', () => {
  it('a drop on the card body makes the link, with no refusal', async () => {
    board(false)
    const g = await gesture()
    expect(g.isValidConnection({ source: FROM, target: TO })).toBe(true)
    g.onConnectStart(null, { nodeId: FROM, handleType: 'source' })
    g.onConnectEnd(release(cardBody(TO)))
    expect(drawn()).toHaveLength(1)
    expect(toasts).toEqual([])
  })

  it('the inspector’s connect picker offers the target', async () => {
    board(false)
    render(<InspectorConnectPicker nodeId={FROM} />)
    await settle()
    const options = [...(screen.getByTestId('inspector-connect-picker').querySelectorAll('option'))].map((o) => o.value)
    expect(options).toContain(TO)
  })
})

describe('NOT KNOWN YET: no link is drawn until the read says the board is not a program (Codex r1 on #2998)', () => {
  it('while the read is pending, a drop and the picker are refused; once it answers "not a program", the link draws', async () => {
    board(false)
    route = 'hold'
    const hook = renderHook(() => useConnectGesture({ enabled: true, showToast }))
    render(<InspectorConnectPicker nodeId={FROM} />)
    await settle()
    const pending = hook.result.current
    expect(pending.isValidConnection({ source: FROM, target: TO })).toBe(false)
    pending.onConnectStart(null, { nodeId: FROM, handleType: 'source' })
    pending.onConnectEnd(release(cardBody(TO)))
    expect(drawn()).toEqual([])
    expect(queued()).toEqual([])
    expect(toasts).toEqual([[SHARED_MODEL_AUTHORITY_COPY, 'info']])
    expect(screen.getByTestId('inspector-connect-picker').querySelector('select')).toBeNull()

    answer()
    await settle()
    expect(hook.result.current.isValidConnection({ source: FROM, target: TO })).toBe(true)
    expect(screen.getByTestId('inspector-connect-picker').querySelector('select')).not.toBeNull()
  })

  it('after a failed read, a drop is refused and nothing is made', async () => {
    board(false)
    route = 'fail'
    const g = await gesture()
    g.onConnectStart(null, { nodeId: FROM, handleType: 'source' })
    g.onConnectEnd(release(cardBody(TO)))
    expect(drawn()).toEqual([])
    expect(toasts).toEqual([[SHARED_MODEL_AUTHORITY_COPY, 'info']])
  })
})

describe('NO SAVED HASH YET: a saved scenario restored before its hash arrives is not known (Codex r2 on #2998)', () => {
  it('a restored program board with no saved hash refuses a drop and offers no picker target', async () => {
    board(true)
    // Autosave restored the cards; hydration has not stamped the saved hash (or the boot read failed).
    useCanvasStore.setState({ lastServerGraphHash: null } as never)
    render(<InspectorConnectPicker nodeId={FROM} />)
    const g = await gesture()
    g.onConnectStart(null, { nodeId: FROM, handleType: 'source' })
    g.onConnectEnd(release(cardBody(TO)))
    expect(drawn()).toEqual([])
    expect(queued()).toEqual([])
    expect(toasts).toEqual([[SHARED_MODEL_AUTHORITY_COPY, 'info']])
    expect(screen.getByTestId('inspector-connect-picker').querySelector('select')).toBeNull()
  })

  it('CONTRAST: a board never saved (no scenario id) draws as today', async () => {
    board(false)
    useCanvasStore.setState({ currentScenarioId: null, lastServerGraphHash: null } as never)
    const g = await gesture()
    g.onConnectStart(null, { nodeId: FROM, handleType: 'source' })
    g.onConnectEnd(release(cardBody(TO)))
    expect(drawn()).toHaveLength(1)
    expect(toasts).toEqual([])
  })
})
