/**
 * Canvas A1, review 00063 (the third A1 review's correction): the View's cards never sit on one another, and each card keeps the
 * Olumi controls a canvas card has. A card added to a board a person has already rearranged finds free space (#1); the causal graph
 * is laid out at each card's drawn height, never shorter than core's `h`, so a long card sits on nothing, while a card the person moved
 * stays (#4); the card is core's width; and every card carries Ask Olumi and Challenge, which reach core (a challenge on core's own
 * challenge route for that card), and its coaching marker (#3). #2 (a View with no model) is S6's withdraw, laneSwitchOffs.spec D4.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

import type { View, ViewModel } from '../client'
import { useCanvasStore } from '../../canvas/store'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { setTeamFetch } from '../../olumiCore/team/api'
import { layViewCanvas, useViewCanvas, VIEW_CARD } from '../canvas'
import { useViewStore } from '../store'
import { CARD_WIDTH } from '../layout'
import { ViewChat, useViewChat } from '../ViewChat'
import { ViewCard, ViewCardNode } from '../../canvas/nodes/ViewCardNode'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
const W = CARD_WIDTH
const UUID = '00000000-0000-4000-8000-000000000001', SID = 's_000000000001'

type Box = { id: string; x: number; y: number; w: number; h: number }
/** Every View card on the canvas as the box it fills: its measured height, else core's h. */
const boxes = (model: ViewModel): Box[] => useCanvasStore.getState().nodes.filter((n) => n.type === VIEW_CARD).map((n) => {
  const card = model.cards.find((c) => c.id === n.id)!
  return { id: n.id, x: n.position.x, y: n.position.y, w: W, h: Math.max(card.h, (n as { measured?: { height?: number } }).measured?.height ?? 0) }
})
const overlapping = (bs: Box[]) => bs.flatMap((a, i) => bs.slice(i + 1).filter((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).map((b) => `${a.id}/${b.id}`))
/** As React Flow reports a drawn card's size. */
const measure = (id: string, height: number) => useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => (n.id === id ? { ...n, measured: { width: W, height } } : n)) as never })

beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [], pendingLayout: false }) })
afterEach(() => { cleanup(); setTeamFetch(null) })

describe('#1 a card added to a rearranged board finds free space', () => {
  it('a card core inserts beside the first, with every card moved by the person onto the places it could take, lands on no other card', async () => {
    const model = view.model!
    const first = model.cards[0]!, inserted = { ...first, id: 'inserted_quantity', heading: 'Inserted' }
    const next = { ...model, cards: [first, inserted, ...model.cards.slice(1)] }
    // Where the causal layout would put each card of the next model: the person moves the existing cards one unit off those places.
    await layViewCanvas(next)
    const slots = new Map(useCanvasStore.getState().nodes.map((n) => [n.id, n.position]))
    useCanvasStore.setState({ nodes: [] })
    await layViewCanvas(model)
    const target = slots.get(inserted.id)!
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => (n.id === first.id ? { ...n, position: { x: target.x, y: target.y + 1 } } : n)) as never })
    await layViewCanvas(next)
    expect(useCanvasStore.getState().nodes.find((n) => n.id === first.id)!.position).toEqual({ x: target.x, y: target.y + 1 })
    expect(overlapping(boxes(next))).toEqual([])
  })
})

describe('#4 the causal graph is laid out at each card\'s drawn height', () => {
  it('a card drawn taller than core\'s h sits on no other card; a card the person moved stays', async () => {
    const model = view.model!
    await layViewCanvas(model)
    const [a, b] = [model.cards[0]!, model.cards[1]!]
    measure(a.id, a.h + 400)
    await layViewCanvas(model)
    const at = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id)!.position
    // A re-draw keeps what the canvas measured, so it never forgets a card's height.
    expect((useCanvasStore.getState().nodes.find((n) => n.id === a.id) as { measured?: { height?: number } }).measured?.height).toBe(a.h + 400)
    expect(overlapping(boxes(model))).toEqual([])
    const moved = { x: 999, y: 999 }
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => (n.id === b.id ? { ...n, position: moved } : n)) as never })
    measure(a.id, a.h + 500)
    await layViewCanvas(model)
    expect(at(b.id)).toEqual(moved)
  })

  it('on the lane the canvas lays the graph out again when a card is measured taller, with no new View', async () => {
    const model = view.model!
    useViewStore.setState({ view })
    renderHook(() => useViewCanvas(true))
    await waitFor(() => expect(useCanvasStore.getState().nodes.length).toBe(model.cards.length + 1))
    expect(overlapping(boxes(model))).toEqual([])
    const before = JSON.stringify(useCanvasStore.getState().nodes.map((n) => n.position))
    act(() => measure(model.cards[0]!.id, model.cards[0]!.h + 400))
    await waitFor(() => expect(JSON.stringify(useCanvasStore.getState().nodes.map((n) => n.position))).not.toBe(before))
    expect(overlapping(boxes(model))).toEqual([])
    useViewStore.setState({ view: null })
  })

  it('the card is the canvas card width (220, the original look)', () => {
    const c = render(<ViewCard card={view.model!.cards[0]!} />).container.querySelector<HTMLElement>('[data-view-card]')!
    expect(c.style.width).toBe(`${W}px`)
  })
})

describe('#3 every View card keeps the Olumi controls, and they reach core', () => {
  let posts: { url: string; body: Record<string, unknown> }[] = []
  beforeEach(() => {
    posts = []
    setTeamFetch((async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ proposal: null }), { status: 201 }) }
      return new Response(JSON.stringify(view), { status: 200 })
    }) as unknown as typeof fetch)
    useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready', stale: false })
    return layViewCanvas(view.model!).then(() => undefined)
  })
  afterEach(() => {
    useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
    useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null })
    useGuidanceStore.setState({ guidanceItems: [] } as never)
  })
  const node = (card: ViewModel['cards'][number]) => render(
    <ReactFlowProvider><ViewChat /><ViewCardNode {...({ id: card.id, data: useCanvasStore.getState().nodes.find((n) => n.id === card.id)!.data, selected: true, type: VIEW_CARD } as unknown as NodeProps)} /></ReactFlowProvider>,
  )

  it('every card has Challenge, and a challenge goes to core\'s challenge route for that card', async () => {
    for (const card of view.model!.cards) {
      node(card)
      expect(screen.getByTestId(`node-action-challenge-${card.id}`)).toBeTruthy()
      cleanup()
    }
    const card = view.model!.cards[1]!
    node(card)
    await act(async () => { fireEvent.click(screen.getByTestId(`node-action-challenge-${card.id}`)) })
    await waitFor(() => expect(posts).toEqual([{ url: `/api/scenarios/${SID}/challenge`, body: { kind: 'assumption', record: card.id, op: expect.any(String) } }]))
  })

  it('Ask Olumi asks core about that card, by its heading', async () => {
    const card = view.model!.cards[1]!
    node(card)
    // The card's one Ask Olumi door: the generic ask, or, where the card has a coaching question, that question (vision spec §3).
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    const door = screen.getByTestId(`node-olumi-door-${card.id}`).querySelector<HTMLElement>('button, [role="button"]')!
    expect(door.getAttribute('aria-label')).toBe(`Ask Olumi about ${card.heading}`)
    await act(async () => { fireEvent.click(door) })
    await waitFor(() => expect(posts.length).toBe(1))
    expect(posts[0]!.url).toBe(`/api/scenarios/${SID}/messages`)
    expect(String(posts[0]!.body['text'])).toContain(card.heading)
  })

  it('a coaching item about the card shows its marker on the card', () => {
    const card = view.model!.cards[1]!
    useGuidanceStore.setState({ guidanceItems: [{ id: 'g1', target_object: { id: card.id, type: 'node' }, title: 'Check this', severity: 'medium' }] } as never)
    node(card)
    expect(screen.queryByTestId(`node-coaching-marker-${card.id}`)).not.toBeNull()
  })
})
