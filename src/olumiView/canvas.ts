/**
 * The canvas on the olumi-core lane is the View's model (decision A): one `viewCard` node per card and one link per View link, placed as
 * DGAI's causal graph (`causalPlaces`: the question at the top, then the options, the factors, the goal; Paul 4 Nov, replacing core's
 * columns). Drawn whenever a View lands (`useViewCanvas`), including the first approved model and every approval after it (00052 #1).
 * A card already on the canvas keeps where the person put it. Nothing else writes the core lane's canvas.
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import { useCanvasStore } from '../canvas/store'
import type { ViewModel } from './client'
import { CARD_WIDTH, GAP_Y, causalPlaces, cardLinks, drawnHeights, drawnHeightsKey, holdsViewNodes, QUESTION, questionPlace } from './layout'
import { useViewStore } from './store'
import { pulseWhenOnCanvas } from '../olumiCore/pulseArrivals'

export const VIEW_CARD = 'viewCard', VIEW_QUESTION = 'viewQuestion', VIEW_LINK = 'viewLink'
/** A card or the question drawn from core's View: it has no store node, so a click selects it (its words show) and opens no inspector,
 *  which could only say it has no editor (4 Nov drive). Its own controls (✎, the Olumi icon) are on the card. */
export const isViewNode = (node: { type?: string } | null | undefined): boolean => node?.type === VIEW_CARD || node?.type === VIEW_QUESTION

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The View card (or the question) under the pointer, if any: its reason links are drawn while it is (`linkDrawn`). */
export const useViewHover = create<{ id: string | null }>(() => ({ id: null }))

type At = { x: number; y: number }
/** Where this module last put each View card and the question. One still there is the canvas's to re-place; one elsewhere is where the
 *  person put it. */
const placed = new Map<string, At>()
const at = (a: At | undefined, b: At) => a !== undefined && a.x === b.x && a.y === b.y
type Box = At & { w: number; h: number }
const sits = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The last causal layout, keyed by what it rests on (the cards, their links and their drawn heights), and how many are being laid out. */
let causal: { key: string; places: Map<string, At> } | null = null
let laying = 0
/** True while the causal layout is being worked out: the camera waits for it before it frames the board. */
export const viewLaying = (): boolean => laying > 0
const causalKey = (model: ViewModel, nodes: readonly { id: string; measured?: { height?: number } }[]) =>
  JSON.stringify([model.cards.map((c) => [c.id, c.family, c.h]), model.links.map((l) => [l.from, l.to]), drawnHeightsKey(nodes)])

/** DGAI's causal places for the model, at the cards' drawn heights (else core's), worked out once per model and set of heights. */
async function causalFor(model: ViewModel): Promise<Map<string, At>> {
  const nodes = useCanvasStore.getState().nodes, key = causalKey(model, nodes)
  if (causal?.key === key) return causal.places
  const size = new Map([...drawnHeights(nodes)].map(([id, height]) => [id, { width: id === QUESTION ? questionPlace(model).width : CARD_WIDTH, height }]))
  laying += 1
  try {
    const places = await causalPlaces(model, size, questionPlace(model).width)
    causal = { key, places }
    return places
  } finally {
    laying -= 1
  }
}

/**
 * Put the View's model on the canvas at `places` (the question's and every card's). True when the canvas changed. A card (or the
 * question) the person moved stays where they put it; the canvas's measurements are kept, so a re-draw never forgets a card's height.
 */
export function drawViewCanvas(model: ViewModel, places: ReadonlyMap<string, At>): boolean {
  const store = useCanvasStore.getState()
  const held = new Map(store.nodes.map((n) => [n.id, n]))
  const heights = drawnHeights(store.nodes), q = questionPlace(model)
  const box = (id: string, p: At) => ({ ...p, w: id === QUESTION ? q.width : CARD_WIDTH, h: heights.get(id) ?? model.cards.find((c) => c.id === id)?.h ?? 0 })
  const ids = [QUESTION, ...model.cards.map((c) => c.id)], type = (id: string) => (id === QUESTION ? VIEW_QUESTION : VIEW_CARD)
  const movedTo = (id: string) => { const n = held.get(id); return n?.type === type(id) && !at(placed.get(id), n.position) ? n.position : null }
  // What the person moved stays; every other card goes to its causal place, below any moved card it would sit on (review 00063 #1).
  const taken = ids.flatMap((id) => { const p = movedTo(id); return p ? [box(id, p)] : [] })
  const final = new Map<string, At>()
  for (const id of ids) {
    const kept = movedTo(id)
    if (kept) { final.set(id, kept); continue }
    let place = places.get(id) ?? { x: 0, y: 0 }
    for (let on = taken.find((t) => sits(box(id, place), t)); on; on = taken.find((t) => sits(box(id, place), t))) place = { x: place.x, y: on.y + on.h + GAP_Y }
    taken.push(box(id, place))
    placed.set(id, place)
    final.set(id, place)
  }
  const placeOf = (id: string): At => final.get(id)!
  const measured = (id: string) => (held.get(id)?.measured ? { measured: held.get(id)!.measured } : {})
  // The question first, as core's page draws it (00057 #1): its text, its date, its badge, and the links to the question as a whole.
  const nodes = [
    { id: QUESTION, type: VIEW_QUESTION, data: { question: model.question, width: q.width }, position: placeOf(QUESTION), ...measured(QUESTION) },
    // `label` is the card's heading, for the canvas's readers that name a node (the Olumi controls' asks among them, 00063 #3).
    ...model.cards.map((card) => ({ id: card.id, type: VIEW_CARD, data: { card, label: card.heading }, position: placeOf(card.id), ...measured(card.id) })),
  ]
  // Each link keeps its meaning (00057 #3): its kind, sign, doubt, challenge and proposal, drawn by the View link edge.
  const edges = cardLinks(model).map(({ link, i }) => ({ id: `${link.from}->${link.to}:${link.kind}`, source: link.from, target: link.to, type: VIEW_LINK, data: { link, i } }))
  if (same(store.nodes.map((n) => [n.id, n.type, n.data, n.position]), nodes.map((n) => [n.id, n.type, n.data, n.position])) && same(store.edges.map((e) => [e.id, e.data]), edges.map((e) => [e.id, e.data]))) return false
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    // Every card is placed already: a layout begun on the canvas this replaces is stale, and none is asked for.
    useCanvasStore.setState({ nodes: nodes as never, edges: edges as never, pendingLayout: false, layoutRequestId: store.layoutRequestId + 1 })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }
  return true
}

/** Lay the model out as DGAI's causal graph and draw it. True when the canvas changed. */
export async function layViewCanvas(model: ViewModel): Promise<boolean> {
  return drawViewCanvas(model, await causalFor(model))
}

/** Core holds no model (its first draft set aside): the View's cards, question and links leave the canvas (gap D4). True when they did. */
export function withdrawViewCanvas(): boolean {
  const store = useCanvasStore.getState()
  if (!holdsViewNodes(store.nodes, [VIEW_CARD, VIEW_QUESTION])) return false
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    useCanvasStore.setState({ nodes: [], edges: [] })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }
  return true
}

/** Auto-arrange on the core lane (gap B5): every View card back in its causal place; the person's moves are let go. */
export function placeViewCards(model: ViewModel): Promise<boolean> {
  placed.clear()
  for (const n of useCanvasStore.getState().nodes) if (isViewNode(n)) placed.set(n.id, n.position)
  return layViewCanvas(model)
}

/**
 * On the core lane, the canvas follows the View: each View that lands for the scenario on screen is drawn; no View, or one with no
 * model, withdraws it.
 * A card that arrives on a canvas already holding the model (an approval, here or by another member) is acknowledged with the applied-edit
 * pulse; the first drawing of a scenario pulses nothing.
 */
export function useViewCanvas(on: boolean): void {
  const view = useViewStore((s) => s.view)
  const model = view?.model ?? null
  // A card the canvas measures taller (or shorter) lays the graph out again at the drawn heights (review 00063 #4).
  const heights = useCanvasStore((s) => drawnHeightsKey(s.nodes))
  useEffect(() => {
    if (!on) return
    // No View for the scenario on screen (a new scenario, or one core holds no model for): the last one's cards leave (review 00003 #1).
    if (view === null || model === null) { withdrawViewCanvas(); return }
    const before = useCanvasStore.getState().nodes
    const had = holdsViewNodes(before, [VIEW_CARD, VIEW_QUESTION]) ? new Set(before.map((n) => n.id)) : null
    let live = true
    // A newer View, or a new height, starts its own layout: this one draws nothing once it is stale.
    void causalFor(model).then((places) => {
      if (!live || !drawViewCanvas(model, places) || had === null) return
      const arrived: string[] = []
      for (const c of model.cards) if (!had.has(c.id)) arrived.push(c.id)
      pulseWhenOnCanvas(arrived)
    })
    return () => { live = false }
  }, [on, view, model, heights])
}
