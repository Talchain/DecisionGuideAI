/**
 * The canvas on the olumi-core lane is the View's model (decision A): one `viewCard` node per card, placed as core's page places it
 * (`cardPlaces`), and one link per View link. Drawn whenever a View lands (`useViewCanvas`), including the first approved model and every
 * approval after it (00052 #1). A card already on the canvas keeps where the person put it. Nothing else writes the core lane's canvas.
 */
import { useEffect } from 'react'
import { useCanvasStore } from '../canvas/store'
import type { ViewModel } from './client'
import { cardLinks, cardPlaces, QUESTION, questionPlace } from './layout'
import { useViewStore } from './store'

export const VIEW_CARD = 'viewCard', VIEW_QUESTION = 'viewQuestion', VIEW_LINK = 'viewLink'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Put the View's model on the canvas. True when the canvas changed. */
export function drawViewCanvas(model: ViewModel): boolean {
  const store = useCanvasStore.getState()
  const held = new Map(store.nodes.map((n) => [n.id, n]))
  const places = cardPlaces(model), q = questionPlace(model)
  const kept = (id: string, type: string, at: { x: number; y: number }) => (held.get(id)?.type === type ? held.get(id)!.position : at)
  // The question first, as core's page draws it (00057 #1): its text, its date, its badge, and the links to the question as a whole.
  const nodes = [
    { id: QUESTION, type: VIEW_QUESTION, data: { question: model.question, width: q.width }, position: kept(QUESTION, VIEW_QUESTION, { x: q.x, y: q.y }) },
    ...model.cards.map((card) => ({ id: card.id, type: VIEW_CARD, data: { card }, position: kept(card.id, VIEW_CARD, places.get(card.id)!) })),
  ]
  // Each link keeps its meaning (00057 #3): its kind, sign, doubt, challenge and proposal, drawn by the View link edge.
  const edges = cardLinks(model).map(({ link, i }) => ({ id: `${link.from}->${link.to}:${link.kind}`, source: link.from, target: link.to, type: VIEW_LINK, data: { link, i } }))
  if (same(store.nodes.map((n) => [n.id, n.type, n.data]), nodes.map((n) => [n.id, n.type, n.data])) && same(store.edges.map((e) => [e.id, e.data]), edges.map((e) => [e.id, e.data]))) return false
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    // Every card is placed already: a layout begun on the canvas this replaces is stale, and none is asked for.
    useCanvasStore.setState({ nodes: nodes as never, edges: edges as never, pendingLayout: false, layoutRequestId: store.layoutRequestId + 1 })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }
  return true
}

/** On the core lane, the canvas follows the View: each View that lands for the scenario on screen is drawn. */
export function useViewCanvas(on: boolean): void {
  const model = useViewStore((s) => s.view?.model ?? null)
  useEffect(() => { if (on && model !== null) drawViewCanvas(model) }, [on, model])
}
