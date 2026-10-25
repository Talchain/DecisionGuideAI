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
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
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
