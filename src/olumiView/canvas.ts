/**
 * The canvas on the olumi-core lane is the View's model (decision A): one `viewCard` node per card, placed as core's page places it
 * (`cardPlaces`), and one link per View link. Drawn whenever a View lands (`useViewCanvas`), including the first approved model and every
 * approval after it (00052 #1). A card already on the canvas keeps where the person put it. Nothing else writes the core lane's canvas.
 */
import { useEffect } from 'react'
import { useCanvasStore } from '../canvas/store'
import type { ViewModel } from './client'
import { cardPlaces } from './layout'
import { useViewStore } from './store'

export const VIEW_CARD = 'viewCard'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Put the View's model on the canvas. True when the canvas changed. */
export function drawViewCanvas(model: ViewModel): boolean {
  const store = useCanvasStore.getState()
  const held = new Map(store.nodes.map((n) => [n.id, n]))
  const places = cardPlaces(model)
  const nodes = model.cards.map((card) => ({
    id: card.id, type: VIEW_CARD, data: { card },
    position: held.get(card.id)?.type === VIEW_CARD ? held.get(card.id)!.position : places.get(card.id)!,
  }))
  const ids = new Set(nodes.map((n) => n.id))
  const edges = model.links.filter((l) => ids.has(l.from) && ids.has(l.to))
    .map((l) => ({ id: `${l.from}->${l.to}`, source: l.from, target: l.to, type: 'default', data: { link: l } }))
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
