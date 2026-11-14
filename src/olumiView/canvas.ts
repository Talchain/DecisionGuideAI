/**
 * The canvas on the olumi-core lane is the View's model (decision A): one `viewCard` node per card and one link per View link, placed as
 * DGAI's causal graph (`causalPlaces`: the question at the top, then the options, the factors, the goal; Paul 4 Nov, replacing core's
 * columns). Drawn whenever a View lands (`useViewCanvas`), including the first approved model and every approval after it (00052 #1).
 * A card already on the canvas keeps where the person put it. Nothing else writes the core lane's canvas.
 */
import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useCanvasStore } from '../canvas/store'
import type { View, ViewModel } from './client'
import { allOptionCards, addedSince, appliedSince, cardsOfRecords, CARD_WIDTH, GAP_Y, causalPlaces, stageRow, questionBarWidth, TREE_RAIL_Y, drawnModelOf, cardLinks, drawnHeights, drawnHeightsKey, holdsViewNodes, QUESTION } from './layout'
import { useViewStore } from './store'
import { useLayoutStore } from '../canvas/layoutStore'
import { computeFitPadding } from '../canvas/utils/computeFitPadding'
import { paddingToInsets } from '../canvas/utils/cameraComfort'
import { revealOf } from './reveal'
import { pulseWhenOnCanvas } from '../olumiCore/pulseArrivals'

export const VIEW_CARD = 'viewCard', VIEW_QUESTION = 'viewQuestion', VIEW_LINK = 'viewLink'
/** The previous graph's line from the question to each of its options (RULING 1): core states the card is an option of this question; the
 *  line draws that statement and carries no strength, sign or word. */
export const ROOT_LINK = 'rootLink'
/** A card or the question drawn from core's View: it has no store node, so a click selects it (its words show) and opens no inspector,
 *  which could only say it has no editor (4 Nov drive). Its own controls (✎, the Olumi icon) are on the card. */
export const isViewNode = (node: { type?: string } | null | undefined): boolean => node?.type === VIEW_CARD || node?.type === VIEW_QUESTION

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The View card (or the question) under the pointer, if any: its reason links are drawn while it is (`linkDrawn`). */
export const useViewHover = create<{ id: string | null }>(() => ({ id: null }))
/** The link (its React Flow edge id) with keyboard focus, if any: it is drawn and says its words while it is (ViewLinkEdge). */
export const useViewFocusLink = create<{ id: string | null }>(() => ({ id: null }))
/** The card (its node id) with keyboard focus on it or inside it, if any: it opens its other words as a selected card does (plan v3: full text
    on selection or keyboard focus, not hover only). */
export const useViewFocusCard = create<{ id: string | null }>(() => ({ id: null }))
/** The node id of the card a focus event landed on or inside, or null. */
export const focusedCardOf = (target: EventTarget | null): string | null =>
  target instanceof Element ? target.closest('.react-flow__node')?.getAttribute('data-id') ?? null : null
/** The id of a link's words, which describe its focusable edge to a screen reader (PL 7 Nov: the words focus shows are tied to the link). */
export const linkWordsIdOf = (i: number): string => `view-link-words-${i}`
/** The edge id of the link a focus event landed on, or null: React Flow's focusable edge wrapper carries it as `data-id`. */
export const focusedLinkOf = (target: EventTarget | null): string | null =>
  target instanceof Element
    // A link's own control in the label layer (its Remove link) keeps the link named while focus is on it.
    ? target.closest('.react-flow__edge')?.getAttribute('data-id') ?? target.closest('[data-link-for]')?.getAttribute('data-link-for') ?? null
    : null

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
const causalKey = (model: ViewModel, nodes: readonly { id: string; measured?: { height?: number } }[], railed: ReadonlySet<string>, opts: { direction: string; spacing: number; row: { cardW: number; gapX: number; perRow?: number } }) =>
  JSON.stringify([model.cards.map((c) => [c.id, c.family, c.h]), model.links.map((l) => [l.from, l.to, l.kind]), drawnHeightsKey(nodes), [...railed], opts.direction, opts.spacing, opts.row])
/** DL-538: the card width and row gap the stage gives this model (layout.ts stageRow), set when the board is laid out and drawn with it. */
// Set lazily: layout.ts and this module import each other, so CARD_WIDTH is not initialised when this module is first evaluated.
let row: { cardW: number; gapX: number; perRow?: number } = { cardW: 0, gapX: 0 }
export const drawnCardWidth = (): number => row.cardW || CARD_WIDTH
/** J1 gate: the free canvas's height at full size (the pane less the header, the Model row and the foot), which the board's rows share. */
export const roomOf = (): { h: number; w: number } => {
  if (typeof window === 'undefined') return { h: 0, w: 0 }
  // The same insets the board's framing uses (ViewCanvas frameFor), so the rows fill exactly the room the camera frames.
  // The Model / Explore / Team row may not be placed yet when the board is first laid out: its foot is the top-left column's
  // (`--chrome-top-left`, TopBar.tsx), and the framing keeps 8 px more under it.
  const pane = document.querySelector('.react-flow'), inset = paddingToInsets(computeFitPadding())
  const column = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-top-left')) || 0
  const r = pane?.getBoundingClientRect()
  return { h: Math.max(0, Math.floor((r?.height ?? window.innerHeight) - Math.max(inset.top, column + 8) - inset.bottom)), w: Math.max(0, Math.floor((r?.width ?? window.innerWidth) - inset.left - inset.right)) }
}
/** Where a link enters and leaves a card for the layout's direction (the layout store's, top to bottom by default): it enters on the side
 *  the causes are on and leaves on the side the effects are on, so every link runs the way the board reads. */
export const linkSidesOf = (direction: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'): { into: 'top' | 'left' | 'bottom' | 'right'; out: 'top' | 'left' | 'bottom' | 'right' } =>
  direction === 'RIGHT' ? { into: 'left', out: 'right' } : direction === 'LEFT' ? { into: 'right', out: 'left' } : direction === 'UP' ? { into: 'bottom', out: 'top' } : { into: 'top', out: 'bottom' }
/** The sides for the layout in force. */
export const useLinkSides = () => linkSidesOf(useLayoutStore((s) => s.direction))
/** The cards that carry a chip rail below them (the team's revealed marks): the layout leaves them room. */
// A card carries a chip rail under it for core's marks on it, and for a link mark core keeps off its line on it (LinkMarkChip).
export const railedOf = (view: View | null): ReadonlySet<string> =>
  new Set([...(revealOf(view)?.cardChips.keys() ?? []), ...(view?.collab.link_marks ?? []).flatMap((m) => (!m.line && m.card !== null ? [m.card] : []))])
const railedCards = (): ReadonlySet<string> => railedOf(useViewStore.getState().view)

/** The previous product's places for the model (layout.ts causalPlaces), at the cards' drawn heights (else core's), worked out once per
 *  model, set of heights and layout setting. The layout has no viewport input (the previous product's rule): the same model is the same board. */
async function causalFor(model: ViewModel): Promise<Map<string, At>> {
  const nodes = useCanvasStore.getState().nodes, railed = railedCards()
  row = stageRow(model, roomOf().w)
  const { direction, nodeSpacing } = useLayoutStore.getState(), key = causalKey(model, nodes, railed, { direction, spacing: nodeSpacing, row })
  if (causal?.key === key) return causal.places
  // A card with a chip rail under it (the team's revealed marks) is laid out with the rail's room.
  const size = new Map([...drawnHeights(nodes)].map(([id, height]) => [id, { width: id === QUESTION ? questionBarWidth(model, row) : row.cardW, height: height + (railed.has(id) ? TREE_RAIL_Y : 0) }]))
  laying += 1
  try {
    const places = await causalPlaces(model, size, { direction, spacing: nodeSpacing, row })
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
  if (row.cardW === 0) row = stageRow(model, roomOf().w)
  const heights = drawnHeights(store.nodes), q = { width: questionBarWidth(model, row) }
  const box = (id: string, p: At) => ({ ...p, w: id === QUESTION ? q.width : row.cardW, h: heights.get(id) ?? model.cards.find((c) => c.id === id)?.h ?? 0 })
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
  // A card selected on the canvas, or put in front from the Model tab, stays selected across a re-layout (R5: an editor opening made the
  // card taller, the re-laid node lost its selection, and the at-rest wrapper hid the open form's Set button).
  const kept = (id: string) => ({ ...measured(id), ...(held.get(id)?.selected === true ? { selected: true } : {}) })
  // The question first, as core's page draws it (00057 #1): its text, its date, its badge, and the links to the question as a whole.
  const nodes = [
    { id: QUESTION, type: VIEW_QUESTION, data: { question: model.question, width: q.width }, position: placeOf(QUESTION), ...kept(QUESTION) },
    // `label` is the card's heading, for the canvas's readers that name a node (the Olumi controls' asks among them, 00063 #3).
    ...model.cards.map((card) => ({ id: card.id, type: VIEW_CARD, data: { card, label: card.heading, width: row.cardW }, position: placeOf(card.id), ...kept(card.id) })),
  ]
  // Each link keeps its meaning (00057 #3): its kind, sign, doubt, challenge and proposal, drawn by the View link edge.
  const edges = cardLinks(model).map(({ link, i }) => ({ id: `${link.from}->${link.to}:${link.kind}`, source: link.from, target: link.to, type: VIEW_LINK, data: { link, i }, ariaLabel: link.title,
    // Its words describe it (React Flow's own description speaks of deleting a link, which this canvas never does).
    domAttributes: { 'aria-describedby': linkWordsIdOf(i) } }))
  const roots = allOptionCards(model).map((c) => ({ id: `root:${c.id}`, source: QUESTION, target: c.id, type: ROOT_LINK, data: {}, focusable: false, selectable: false }))
  if (same(store.nodes.map((n) => [n.id, n.type, n.data, n.position]), nodes.map((n) => [n.id, n.type, n.data, n.position])) && same(store.edges.map((e) => [e.id, e.data]), [...roots, ...edges].map((e) => [e.id, e.data]))) return false
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    // Every card is placed already: a layout begun on the canvas this replaces is stale, and none is asked for.
    useCanvasStore.setState({ nodes: nodes as never, edges: [...roots, ...edges] as never, pendingLayout: false, layoutRequestId: store.layoutRequestId + 1 })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }
  return true
}

/** Lay the model out as DGAI's causal graph and draw it. True when the canvas changed. */
export async function layViewCanvas(core: ViewModel): Promise<boolean> {
  const model = drawnModelOf(core)
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
/** The scenario, version and model the canvas last drew: a newer version of the same scenario pulses what it applied (`appliedSince`). */
let drew: { sid: string | null; n: number | null; model: ViewModel } | null = null

export function useViewCanvas(on: boolean): void {
  const view = useViewStore((s) => s.view)
  // The board draws core's model less the relation cards that are their link (layout.ts drawnModelOf).
  const model = useMemo(() => (view?.model == null ? null : drawnModelOf(view.model)), [view])
  // Folds start closed (DL ruling 9 Nov (ii): 77cdc6f6's first-look fold opening is retired for this serve; the route is one click away on
  // the badge's count), so a reopened board draws what the first one did.
  // A card the canvas measures taller (or shorter) lays the graph out again at the drawn heights (review 00063 #4).
  const heights = useCanvasStore((s) => drawnHeightsKey(s.nodes))
  // The layout's direction and spacing are the layout store's, as in the previous product: a change lays the board out again.
  const laidAs = useLayoutStore((s) => `${s.direction}:${s.nodeSpacing}`)
  useEffect(() => {
    if (!on) return
    // No View for the scenario on screen (a new scenario, or one core holds no model for): the last one's cards leave (review 00003 #1).
    if (view === null || model === null) { withdrawViewCanvas(); return }
    const before = useCanvasStore.getState().nodes
    const had = holdsViewNodes(before, [VIEW_CARD, VIEW_QUESTION]) ? new Set(before.map((n) => n.id)) : null
    let live = true
    // A newer View, or a new height, starts its own layout: this one draws nothing once it is stale.
    void causalFor(model).then((places) => {
      if (!live) return
      const last = drew, sid = useViewStore.getState().sid, n = view.version?.n ?? null
      drew = { sid, n, model }
      if (!drawViewCanvas(model, places) || had === null) return
      const arrived: string[] = []
      for (const c of model.cards) if (!had.has(c.id)) arrived.push(c.id)
      // A newer version of the same scenario (an approval, or an edit, here or by another member): the cards it applied pulse too.
      const advanced = last !== null && last.sid === sid && last.n !== null && n !== null && n > last.n
      // Core names the records the version changed (`version.changed`); a core before R2a does not, and the cards are compared instead.
      const changed = view.version?.changed
      pulseWhenOnCanvas(advanced ? [...arrived, ...(changed === undefined ? appliedSince(last.model, model) : [...cardsOfRecords(model, changed), ...addedSince(last.model, model)])] : arrived)
    })
    return () => { live = false }
  }, [on, view, model, heights, laidAs])
}
