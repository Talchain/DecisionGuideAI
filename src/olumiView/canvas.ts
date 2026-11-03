/**
 * The canvas on the olumi-core lane is the View's model (decision A): one `viewCard` node per card, placed as core's page places it
 * (`cardPlaces`), and one link per View link. Drawn whenever a View lands (`useViewCanvas`), including the first approved model and every
 * approval after it (00052 #1). A card already on the canvas keeps where the person put it. Nothing else writes the core lane's canvas.
 */
import { useEffect } from 'react'
import { useCanvasStore } from '../canvas/store'
import type { ViewModel } from './client'
import { cardLinks, cardPlaces, drawnHeights, drawnHeightsKey, holdsViewNodes, QUESTION, questionPlace, withoutViewNodes } from './layout'
import { useViewStore } from './store'
import { pulseWhenOnCanvas } from '../olumiCore/pulseArrivals'

export const VIEW_CARD = 'viewCard', VIEW_QUESTION = 'viewQuestion', VIEW_LINK = 'viewLink'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

type At = { x: number; y: number }
/** Where this module last put each View card. A card still there is the canvas's to re-place; one elsewhere is where the person put it. */
const placed = new Map<string, At>()
const at = (a: At | undefined, b: At) => a !== undefined && a.x === b.x && a.y === b.y

/**
 * Put the View's model on the canvas. True when the canvas changed. Each card the person has not moved is placed as core's page places
 * it, by its drawn height (review 00063 #4); a card the person moved stays, and no card is put on it (00063 #1). The canvas's
 * measurements are kept, so a re-draw never forgets a card's height.
 */
export function drawViewCanvas(model: ViewModel): boolean {
  const store = useCanvasStore.getState()
  const held = new Map(store.nodes.map((n) => [n.id, n]))
  const moved = new Map<string, At>()
  for (const c of model.cards) {
    const n = held.get(c.id)
    if (n?.type === VIEW_CARD && !at(placed.get(c.id), n.position)) moved.set(c.id, n.position)
  }
  const places = cardPlaces(model, drawnHeights(store.nodes), moved), q = questionPlace(model)
  for (const c of model.cards) if (!moved.has(c.id)) placed.set(c.id, places.get(c.id)!)
  const kept = (id: string, type: string, place: At) => (held.get(id)?.type === type ? held.get(id)!.position : place)
  const measured = (id: string) => (held.get(id)?.measured ? { measured: held.get(id)!.measured } : {})
  // The question first, as core's page draws it (00057 #1): its text, its date, its badge, and the links to the question as a whole.
  const nodes = [
    { id: QUESTION, type: VIEW_QUESTION, data: { question: model.question, width: q.width }, position: kept(QUESTION, VIEW_QUESTION, { x: q.x, y: q.y }), ...measured(QUESTION) },
    // `label` is the card's heading, for the canvas's readers that name a node (the Olumi controls' asks among them, 00063 #3).
    ...model.cards.map((card) => ({ id: card.id, type: VIEW_CARD, data: { card, label: card.heading }, position: places.get(card.id)!, ...measured(card.id) })),
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

/** Auto-arrange on the core lane (gap B5): every View card back where core's page places it; the person's moves are let go. */
export function placeViewCards(model: ViewModel): boolean {
  const store = useCanvasStore.getState()
  useCanvasStore.setState({ nodes: withoutViewNodes(store.nodes, [VIEW_CARD, VIEW_QUESTION]) })
  return drawViewCanvas(model)
}

/**
 * On the core lane, the canvas follows the View: each View that lands for the scenario on screen is drawn, and one with no model withdraws it.
 * A card that arrives on a canvas already holding the model (an approval, here or by another member) is acknowledged with the applied-edit
 * pulse; the first drawing of a scenario pulses nothing.
 */
export function useViewCanvas(on: boolean): void {
  const view = useViewStore((s) => s.view)
  const model = view?.model ?? null
  // A card the canvas measures taller (or shorter) re-places the cards below it (review 00063 #4).
  const heights = useCanvasStore((s) => drawnHeightsKey(s.nodes))
  useEffect(() => {
    if (!on || view === null) return
    if (model === null) { withdrawViewCanvas(); return }
    const before = useCanvasStore.getState().nodes
    const had = holdsViewNodes(before, [VIEW_CARD, VIEW_QUESTION]) ? new Set(before.map((n) => n.id)) : null
    if (!drawViewCanvas(model) || had === null) return
    const arrived: string[] = []
    for (const c of model.cards) if (!had.has(c.id)) arrived.push(c.id)
    pulseWhenOnCanvas(arrived)
  }, [on, view, model, heights])
}
