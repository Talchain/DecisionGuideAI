/**
 * Canvas A1, review 00063 (the third A1 review's correction): the View's cards never sit on one another, and each card keeps the
 * Olumi controls a canvas card has. A card added to a column a person has already rearranged finds free space (#1); a column stacks by
 * each card's drawn height, never shorter than core's `h`, so a long card pushes the next down, while a card the person moved stays
 * (#4); the card is core's width; and every card carries Ask Olumi and Challenge, which reach core (a challenge on core's own
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
import { drawViewCanvas, useViewCanvas, VIEW_CARD } from '../canvas'
import { useViewStore } from '../store'
import { ViewChat, useViewChat } from '../ViewChat'
import { ViewCard, ViewCardNode } from '../../canvas/nodes/ViewCardNode'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
const W = 232, GAP_Y = 14
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

describe('#1 a card added to a rearranged column finds free space', () => {
  it('a card core inserts after margin_raised, with cups_now moved by the person, lands on no other card', () => {
    const model = view.model!
    drawViewCanvas(model)
    const first = model.cards[0]!, col = model.cards.filter((c) => c.col === first.col)
    expect(col.length).toBeGreaterThan(1)
    // The person moves the column's second card into the slot a new second card would take.
    const second = useCanvasStore.getState().nodes.find((n) => n.id === col[1]!.id)!
    const slot = { ...second.position }
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => (n.id === second.id ? { ...n, position: { x: slot.x, y: slot.y + 1 } } : n)) as never })
    const inserted = { ...first, id: 'inserted_quantity', heading: 'Inserted' }
    const next = { ...model, cards: [first, inserted, ...model.cards.slice(1)] }
    drawViewCanvas(next)
    expect(overlapping(boxes(next))).toEqual([])
  })
})

describe('#4 a column stacks by each card\'s drawn height', () => {
  it('a card drawn taller than core\'s h pushes the next card in its column below it; a card the person moved stays', () => {
    const model = view.model!
    drawViewCanvas(model)
    const col = model.cards.filter((c) => c.col === model.cards[0]!.col)
    const [a, b] = [col[0]!, col[1]!]
    measure(a.id, a.h + 200)
    drawViewCanvas(model)
    const at = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id)!.position
    // A re-draw keeps what the canvas measured, so it never forgets a card's height.
    expect((useCanvasStore.getState().nodes.find((n) => n.id === a.id) as { measured?: { height?: number } }).measured?.height).toBe(a.h + 200)
    expect(at(b.id).y).toBeGreaterThanOrEqual(at(a.id).y + a.h + 200 + GAP_Y)
    expect(overlapping(boxes(model))).toEqual([])
    const moved = { x: 999, y: 999 }
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => (n.id === b.id ? { ...n, position: moved } : n)) as never })
    measure(a.id, a.h + 300)
    drawViewCanvas(model)
    expect(at(b.id)).toEqual(moved)
  })

  it('on the lane the canvas re-places its cards when a card is measured taller, with no new View', () => {
    const model = view.model!
    useViewStore.setState({ view })
    renderHook(() => useViewCanvas(true))
    const col = model.cards.filter((c) => c.col === model.cards[0]!.col)
    const before = useCanvasStore.getState().nodes.find((n) => n.id === col[1]!.id)!.position.y
    act(() => measure(col[0]!.id, col[0]!.h + 150))
    expect(useCanvasStore.getState().nodes.find((n) => n.id === col[1]!.id)!.position.y).toBe(before + 150)
    useViewStore.setState({ view: null })
  })

  it('the card is core\'s width', () => {
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
    drawViewCanvas(view.model!)
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
