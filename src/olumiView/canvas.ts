/**
 * The canvas on the olumi-core lane is the View's model (decision A): one `viewCard` node per card and one link per View link, placed as
 * DGAI's causal graph (`causalPlaces`: the question at the top, then the options, the factors, the goal; Paul 4 Nov, replacing core's
 * columns). Drawn whenever a View lands (`useViewCanvas`), including the first approved model and every approval after it (00052 #1).
 * A card already on the canvas keeps where the person put it. Nothing else writes the core lane's canvas.
 */
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useStore, useStoreApi, type Node } from '@xyflow/react'
import { create } from 'zustand'
import { useCanvasStore } from '../canvas/store'
import { ROW_BUDGET_W } from '../canvas/utils/nodeLayoutConstants'
import type { View, ViewModel } from './client'
import { allOptionCards, addedSince, appliedSince, cardsOfRecords, CARD_WIDTH, GAP_Y, causalPlaces, drawKindOf, stageRow, simpleStageRow, questionBarWidth, TREE_RAIL_Y, drawnModelOf, barsOf, cardLinks, drawnHeights, holdsViewNodes, ideasOnlyPlaces, QUESTION, QUESTION_LAYOUT_HEIGHT } from './layout'
import { useViewStore } from './store'
import { levelOf, useSimpleLevel } from './v12/simpleStore'
import { useLayoutStore } from '../canvas/layoutStore'
import {
  DOCK_SELECTOR, KEY_PILL_SELECTOR, LENS_BAR_SELECTOR, OVERLAY_BAND_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR, computeFitPadding,
} from '../canvas/utils/computeFitPadding'
import { reducedFaceSize } from './camera'
import { frameTop } from './regions'
import { FOOT_GUTTER } from './footClear'
import { selectLodBodyHidden } from '../canvas/utils/zoomLegibility'
import { paddingToInsets } from '../canvas/utils/cameraComfort'
import { revealOf } from './reveal'
import { pulseWhenOnCanvas } from '../olumiCore/pulseArrivals'
import { foldHeadingOf, VIEW_FOLD, VIEW_IDEA, type FoldCardData } from './v12/bands/BandNodes'
import { groupLinkTitle } from './v12/bands/GroupLinkEdge'
import { extrasOf, type BandExtra } from './v12/bands/extras'
import { groupOpen, inputsFolded, useInputsOpen } from './v12/bands/foldStore'
import { bandOf, FOLD_ID, inputIdsOf } from './v12/bands/bands'
import { cardGroupsOf, groupLinksOf, withoutGrouped, type GroupLink } from './v12/bands/groups'

export const VIEW_CARD = 'viewCard', VIEW_QUESTION = 'viewQuestion', VIEW_LINK = 'viewLink'
/** The previous graph's line from the question to each of its options (RULING 1): core states the card is an option of this question; the
 *  line draws that statement and carries no strength, sign or word. */
export const ROOT_LINK = 'rootLink'
/** V12 Simple: a group connector (v12/bands/groups.ts GroupLink), its own edge type so no single link's readers or controls reach it. */
export const GROUP_LINK = 'groupLink'
/** A card or the question drawn from core's View: it has no store node, so a click selects it (its words show) and opens no inspector,
 *  which could only say it has no editor (4 Nov drive). Its own controls (✎, the Olumi icon) are on the card. */
export const isViewNode = (node: { type?: string } | null | undefined): boolean => node?.type === VIEW_CARD || node?.type === VIEW_QUESTION || node?.type === VIEW_IDEA || node?.type === VIEW_FOLD

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The View card (or the question) under the pointer, if any: the path from it is lit (focusPath.ts) and its links say their words (ViewLinkEdge). */
export const useViewHover = create<{ id: string | null }>(() => ({ id: null }))
/** The link (its React Flow edge id) with keyboard focus, if any: it is drawn and says its words while it is (ViewLinkEdge). */
export const useViewFocusLink = create<{ id: string | null }>(() => ({ id: null }))
/** The card (its node id) with keyboard focus on it or inside it, if any: it opens its other words as a selected card does (plan v3: full text
    on selection or keyboard focus, not hover only). */
export const useViewFocusCard = create<{ id: string | null }>(() => ({ id: null }))
/** The first drawing of a model on an empty canvas (021, 19 Nov: a cold reopen showed the lens bar over an empty canvas for 1-4 s while the
 *  causal layout ran). `laying` until its cards are drawn, `failed` if the layout threw; `retry` lays it out again (Codex ruling 10:04Z). */
export const useFirstDraw = create<{ state: 'idle' | 'laying' | 'failed'; retry: number }>(() => ({ state: 'idle', retry: 0 }))
const firstDraw = (state: 'idle' | 'laying' | 'failed') => { if (useFirstDraw.getState().state !== state) useFirstDraw.setState({ state }) }
export const retryFirstDraw = (): void => useFirstDraw.setState((s) => ({ state: 'laying', retry: s.retry + 1 }))
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
/** A place with the width its band gives the card and the type scale the Simple board is drawn at (layout.ts SimplePlace). */
type Placed = At & { w?: number; s?: number }
/** Where this module last put each View card and the question. One still there is the canvas's to re-place; one elsewhere is where the
 *  person put it. */
const placed = new Map<string, At>()
const at = (a: At | undefined, b: At) => a !== undefined && a.x === b.x && a.y === b.y
type Box = At & { w: number; h: number }
const sits = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

type Size = { width: number; height: number }
type Stage = ReturnType<typeof stageRow> & { simple?: true; budget?: number; roomW?: number }
type LayoutResult = { places: ReadonlyMap<string, Placed>; sizes: ReadonlyMap<string, Size>; row: Stage }

let causal: { key: string; result: LayoutResult } | null = null
// Set lazily because layout.ts and this module import each other.
let row: Stage = { cardW: 0, gapX: 0 }
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

// React Flow retains a node's last measurement even when its face changes off screen.
const measuredFaces = new WeakMap<NonNullable<Node['measured']>, string>()
let canvasZoom = () => 1

function layoutFace(reduced: boolean, simple: boolean, far: boolean): string {
  return simple ? (far ? 'simple-line' : 'simple') : far ? 'detailed-line' : reduced ? 'detailed-body' : 'detailed'
}

function currentFace() {
  return layoutFace(reducedFaceSize(canvasZoom()) > 0, levelOf(useViewStore.getState().sid) === 'simple', selectLodBodyHidden(useCanvasStore.getState()))
}

function measuredOnFace(node: Node, face: string) {
  const measured = node.measured
  return measured && (measuredFaces.get(measured) ?? face) === face ? measured : undefined
}

function heightsKey(nodes: readonly Node[], face: string) {
  return nodes.map((n) => `${n.id}:${measuredOnFace(n, face)?.height ?? ''}`).join('|')
}

function sizesOf(entries: readonly (readonly [string, number])[], stage: Stage, face: string, questionWidth = stage.cardW) {
  const nodes = new Map(useCanvasStore.getState().nodes.map((n) => [n.id, n]))
  return new Map(entries.map(([id, estimate]) => {
    const node = nodes.get(id)
    const measured = node && measuredOnFace(node, face)
    if (measured && !measuredFaces.has(measured)) measuredFaces.set(measured, face)
    return [id, { width: id === QUESTION ? questionWidth : stage.cardW, height: measured?.height || estimate }]
  }))
}

/** The exact dimensions and options the canvas hands to the causal layout. */
export function causalInputs(model: ViewModel, extras: readonly BandExtra[] = [], face = currentFace()) {
  const nodes = useCanvasStore.getState().nodes, railed = railedCards()
  const stage: Stage = levelOf(useViewStore.getState().sid) === 'simple' ? simpleStageRow(roomOf().w) : stageRow(model, roomOf().w)
  const { direction, nodeSpacing } = useLayoutStore.getState()
  const boxes = sizesOf([
    [QUESTION, QUESTION_LAYOUT_HEIGHT], ...model.cards.map((c) => [c.id, c.h] as const), ...extras.map((e) => [e.id, e.h] as const),
  ], stage, face, questionBarWidth(model, stage))
  // The rail adds a layout gap below its card. It is outside the card's own box.
  const size = new Map(boxes)
  for (const id of railed) {
    const box = boxes.get(id)
    const node = nodes.find((n) => n.id === id)
    if (box && node && measuredOnFace(node, face)?.height) size.set(id, { ...box, height: box.height + TREE_RAIL_Y })
  }
  return { nodes, railed, boxes, size, opts: { direction, spacing: nodeSpacing, row: stage, extras } }
}

function withPlacedWidths(sizes: Map<string, Size>, places: ReadonlyMap<string, Placed>): ReadonlyMap<string, Size> {
  return new Map([...sizes].map(([id, size]) => [id, { ...size, width: places.get(id)?.w ?? size.width }]))
}

async function causalFor(model: ViewModel, extras: readonly BandExtra[], face: string) {
  const { boxes, size, opts } = causalInputs(model, extras, face)
  const key = JSON.stringify([face, model.cards.map((c) => [c.id, c.family, opts.row.simple === true ? bandOf(c, model) : drawKindOf(c, model)]),
    model.links.map((l) => [l.from, l.to, l.kind]), [...boxes], [...size], opts.direction, opts.spacing, opts.row, extras.map((e) => [e.id, e.band])])
  if (causal?.key === key) return causal
  const places = await causalPlaces(model, size, opts)
  return { key, result: { places, sizes: withPlacedWidths(boxes, places), row: opts.row } }
}

/**
 * Put the View's model on the canvas at `places` (the question's and every card's). True when the canvas changed. A card (or the
 * question) the person moved stays where they put it; the canvas's measurements are kept, so a re-draw never forgets a card's height.
 */
export function drawViewCanvas(model: ViewModel, places: ReadonlyMap<string, Placed>, extras: readonly BandExtra[] = [], groupLinks: readonly GroupLink[] = [], sizes?: ReadonlyMap<string, Size>, arrange = false): boolean {
  const store = useCanvasStore.getState()
  const held = new Map(store.nodes.map((n) => [n.id, n]))
  if (row.cardW === 0) row = levelOf(useViewStore.getState().sid) === 'simple' ? simpleStageRow(roomOf().w) : stageRow(model, roomOf().w)
  const heights = drawnHeights(store.nodes), q = { width: questionBarWidth(model, row) }
  const widthOf = (id: string): number => (id === QUESTION ? places.get(id)?.w ?? q.width : places.get(id)?.w ?? row.cardW)
  const scale = [...places.values()].find((p) => p.s !== undefined)?.s
  const box = (id: string, p: At) => ({ x: p.x, y: p.y, w: widthOf(id), h: sizes?.get(id)?.height ?? heights.get(id) ?? extras.find((e) => e.id === id)?.h ?? model.cards.find((c) => c.id === id)?.h ?? 0 })
  const ids = [QUESTION, ...model.cards.map((c) => c.id), ...extras.map((e) => e.id)], type = (id: string) => (id === QUESTION ? VIEW_QUESTION : extras.find((e) => e.id === id)?.type ?? VIEW_CARD)
  const movedTo = (id: string) => { const n = held.get(id); return !arrange && n?.type === type(id) && !at(placed.get(id), n.position) ? n.position : null }
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
    // `label` names the question for the canvas's readers that name a node (the selection chip, the Olumi controls' asks): the person's own
    // question, in its words. Without it those readers fell back to the node's id ("About: page:question").
    { id: QUESTION, type: VIEW_QUESTION, data: { question: model.question, ...(model.question.text.trim() === '' ? {} : { label: model.question.text }), width: widthOf(QUESTION), ...(scale === undefined ? {} : { scale }) }, position: placeOf(QUESTION), ...kept(QUESTION) },
    // `label` is the card's heading, for the canvas's readers that name a node (the Olumi controls' asks among them, 00063 #3).
    ...model.cards.map((card) => ({ id: card.id, type: VIEW_CARD, data: { card, label: card.heading, width: widthOf(card.id), ...(scale === undefined ? {} : { scale }) }, position: placeOf(card.id), ...kept(card.id) })),
    // V12 Simple: the kept ideas and the folded inputs' group (v12/bands), each in its band.
    ...extras.map((e) => ({ id: e.id, type: e.type, data: { ...e.data, width: widthOf(e.id), ...(scale === undefined ? {} : { scale }) }, position: placeOf(e.id), ...kept(e.id) })),
  ]
  // Each link keeps its meaning (00057 #3): its kind, sign, doubt, challenge and proposal, drawn by the View link edge.
  const edges = cardLinks(model).map(({ link, i }) => ({ id: `${link.from}->${link.to}:${link.kind}`, source: link.from, target: link.to, type: VIEW_LINK, data: { link, i }, ariaLabel: link.title,
    // Its words describe it (React Flow's own description speaks of deleting a link, which this canvas never does).
    domAttributes: { 'aria-describedby': linkWordsIdOf(i) } }))
  // V12 Simple (D1): the links of a row's grouped cards run to its group card, one neutral connector per pair of ends (never a link's own edge).
  const headings = new Map<string, string>([[QUESTION, model.question.text], ...model.cards.map((c) => [c.id, c.heading] as const)])
  for (const extra of extras) {
    if (extra.type === VIEW_FOLD) headings.set(extra.id, foldHeadingOf(extra.data as FoldCardData).join(' '))
  }
  const grouped = groupLinks.map((g) => {
    const from = headings.get(g.from), to = headings.get(g.to), count = groupLinkTitle(g.count)
    const ariaLabel = g.mixedDirection ? `${from} and ${to}: links both ways (${count})` : `${from} to ${to} (${count})`
    return { id: `group:${g.from}->${g.to}`, source: g.from, target: g.to, type: GROUP_LINK, data: g, focusable: false, selectable: false, ariaLabel }
  })
  // V12 Simple: the question draws no wires to the options.
  const roots = levelOf(useViewStore.getState().sid) === 'simple' ? [] : allOptionCards(model).map((c) => ({ id: `root:${c.id}`, source: QUESTION, target: c.id, type: ROOT_LINK, data: {}, focusable: false, selectable: false }))
  if (same(store.nodes.map((n) => [n.id, n.type, n.data, n.position]), nodes.map((n) => [n.id, n.type, n.data, n.position])) && same(store.edges.map((e) => [e.id, e.data]), [...roots, ...edges, ...grouped].map((e) => [e.id, e.data]))) return false
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    // Every card is placed already: a layout begun on the canvas this replaces is stale, and none is asked for.
    useCanvasStore.setState({ nodes: nodes as never, edges: [...roots, ...edges, ...grouped] as never, pendingLayout: false, layoutRequestId: store.layoutRequestId + 1 })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }
  return true
}

/** Lay the model out as DGAI's causal graph and draw it. True when the canvas changed. */
export function layViewCanvas(core: ViewModel): Promise<boolean> {
  const job = makeJob(currentInputs(), () => {})
  latestJob = job
  return runCausalJob(job, boardOf(core), false)
}

/** What the board draws for core's model: its drawn model, less (on Simple) each row's grouped cards (D1, v12/bands/groups.ts: Olumi's unreviewed
 *  proposals and the approved notes, until the person opens that row's group) and the inputs while 15 or more of core's are folded (rule 7), with the nodes Simple adds (kept ideas, the folded group, the group cards) and the grouped cards' links run to their group card. Detailed
 *  draws core's model as it is. */
export function boardOf(core: ViewModel, open: Readonly<Record<string, boolean>> = useInputsOpen.getState().open): { model: ViewModel; extras: BandExtra[]; links: GroupLink[] } {
  const { sid, view } = useViewStore.getState(), whole = drawnModelOf(core)
  if (levelOf(sid) !== 'simple') return { model: whole, extras: [], links: [] }
  // An aim's bar is its bound, said on the aim card (layout.ts barsOf): no card of its own. Its links stay in the list (every drawn link keeps its place);
  // those into it run to its aim (groupLinksOf).
  const bars = barsOf(whole), drawn = bars.size === 0 ? whole : { ...whole, cards: whole.cards.filter((c) => !bars.has(c.id)) }
  // Rule 7 counts core's inputs as before D1 (a row it folds holds its group cards' cards too), so D1 never unfolds a board rule 7 folded.
  const folded = inputsFolded(sid, drawn, open)
  const groups = cardGroupsOf(drawn, view).filter((g) => !groupOpen(sid, g.id, open) && !(folded && g.band === 'inputs'))
  const folds = folded ? [...groups, { id: FOLD_ID, cards: inputIdsOf(drawn) }] : groups
  const model = withoutGrouped(drawn, folds), extras = extrasOf(view, sid, folded ? drawn : null, groups)
  return { model, extras, links: groupLinksOf(drawn, folds, new Set([QUESTION, ...model.cards.map((c) => c.id), ...extras.map((e) => e.id)]), bars) }
}

/**
 * The kept ideas to draw when core holds NO model (its first proposal set aside, or none yet; Codex 008e #1): the "Kept ideas" band and
 * nothing else, on any level. Empty when core holds a model (the model's own board draws its bands) or the scenario holds no kept idea.
 */
export const ideasOnlyOf = (view: View | null, sid: string | null): BandExtra[] => (view === null || view.model != null ? [] : extrasOf(view, sid, null))

/** Draw the ideas-only board at `places`. A card the person moved stays where they put it. True when the canvas changed. */
export function drawIdeasOnly(extras: readonly BandExtra[], places: ReadonlyMap<string, Placed>): boolean {
  const store = useCanvasStore.getState(), held = new Map(store.nodes.map((n) => [n.id, n]))
  const nodes = extras.map((e) => {
    const n = held.get(e.id), put = places.get(e.id) ?? { x: 0, y: 0 }
    const moved = n?.type === e.type && !at(placed.get(e.id), n.position)
    if (!moved) placed.set(e.id, put)
    return { id: e.id, type: e.type, data: { ...e.data, width: places.get(e.id)?.w ?? row.cardW, ...(places.get(e.id)?.s === undefined ? {} : { scale: places.get(e.id)!.s }) }, position: moved ? n!.position : put, ...(n?.measured ? { measured: n.measured } : {}), ...(n?.selected === true ? { selected: true } : {}) }
  })
  if (same(store.nodes.map((n) => [n.id, n.type, n.data, n.position]), nodes.map((n) => [n.id, n.type, n.data, n.position])) && store.edges.length === 0) return false
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    useCanvasStore.setState({ nodes: nodes as never, edges: [], pendingLayout: false, layoutRequestId: store.layoutRequestId + 1 })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }
  return true
}

function ideasLayout(extras: readonly BandExtra[], face: string): LayoutResult {
  const stage = simpleStageRow(roomOf().w)
  const sizes = sizesOf(extras.map((e) => [e.id, e.h]), stage, face)
  const places = ideasOnlyPlaces(extras, sizes, stage)
  return { places, sizes: withPlacedWidths(sizes, places), row: stage }
}

/** Lay out and draw the ideas-only board for the room the canvas has now. */
export function layIdeasOnly(extras: readonly BandExtra[]): boolean {
  const result = ideasLayout(extras, currentFace())
  row = result.row
  return drawIdeasOnly(extras, result.places)
}

/** Core holds no model (its first draft set aside): the View's cards, question and links leave the canvas (gap D4). True when they did. */
export function withdrawViewCanvas(): boolean {
  const store = useCanvasStore.getState()
  if (!holdsViewNodes(store.nodes, [VIEW_CARD, VIEW_QUESTION, VIEW_IDEA, VIEW_FOLD])) return false
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
  const job = makeJob(currentInputs(), latestJob?.updateBudget ?? (() => {}))
  restoring = null
  latestJob = job
  job.arranging = runCausalJob(job, boardOf(model), true)
  return job.arranging
}

/**
 * On the core lane, the canvas follows the View: each View that lands for the scenario on screen is drawn; no View, or one with no
 * model, withdraws it.
 * A card that arrives on a canvas already holding the model (an approval, here or by another member) is acknowledged with the applied-edit
 * pulse; the first drawing of a scenario pulses nothing.
 */
/** The scenario, version and model the canvas last drew: a newer version of the same scenario pulses what it applied (`appliedSince`). */
let drew: { sid: string | null; n: number | null; model: ViewModel } | null = null

/**
 * V12 Simple: the row budget its bands share across the room the canvas has now (layout.ts simpleStageRow), '' on Detailed. It follows the
 * pane's width (a window resized, the dock opened or closed), so a Simple board laid out for a wider room is laid out again for this one
 * (Codex 006: after a resize from about 2000 to 1280 wide, Fit left "2 more cards to the right", since the bands were still the wide room's
 * and Simple never zooms below its readable floor). Only a change in the row budget (layout.ts simpleStageRow, in steps of 48) lays the board out again; a few pixels move nothing.
 */
function simpleBudgetKey(simple: boolean): string {
  if (!simple) return ''
  const stage = simpleStageRow(roomOf().w)
  // At the width cap, the room still sets the type scale in steps of 96 px.
  return stage.budget >= ROW_BUDGET_W ? `${stage.budget}:${Math.floor(stage.roomW / 96)}` : String(stage.budget)
}

function useSimpleBudgetKey(on: boolean, simple: boolean) {
  const [n, setN] = useState(() => simpleBudgetKey(simple))
  useEffect(() => {
    if (!on) return undefined
    const again = () => setN(simpleBudgetKey(simple))
    again()
    const pane = typeof document === 'undefined' ? null : document.querySelector('.react-flow')
    const watch = pane !== null && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(again) : null
    if (watch !== null && pane !== null) watch.observe(pane)
    const dock = document.querySelector(DOCK_SELECTOR)
    if (dock !== null) watch?.observe(dock)
    window.addEventListener('resize', again)
    return () => { watch?.disconnect(); window.removeEventListener('resize', again) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, simple])
  return [n, setN] as const
}

type LayoutInputs = readonly [
  view: View | null, sid: string | null, open: Readonly<Record<string, boolean>>,
  heights: string, settings: string, columns: string, retry: number, face: string,
]

function currentInputs(): LayoutInputs {
  const { view, sid } = useViewStore.getState()
  const { direction, nodeSpacing } = useLayoutStore.getState()
  const level = levelOf(sid), face = currentFace()
  return [view, sid, useInputsOpen.getState().open, heightsKey(useCanvasStore.getState().nodes, face),
    `${direction}:${nodeSpacing}:${level}`, simpleBudgetKey(level === 'simple' || ideasOnlyOf(view, sid).length > 0),
    useFirstDraw.getState().retry, face]
}

function inputsMatch(a: LayoutInputs, b: LayoutInputs, { ignoreHeights = false, ignoreFace = false } = {}) {
  return a.every((input, i) => (ignoreHeights && i === 3) || (ignoreFace && i === 7) || input === b[i])
}

type LayoutJob = {
  inputs: LayoutInputs
  updateBudget: (key: string) => void
  state: 'pending' | 'failed' | 'cancelled' | ReadonlyMap<string, Size>
  arranging?: Promise<boolean>
}

// The job object is the token shared by Auto-arrange, the reactive layout and the snapshot reader.
let latestJob: LayoutJob | null = null
let restoring: { zoom: number; job: LayoutJob } | null = null
function makeJob(inputs: LayoutInputs, updateBudget: LayoutJob['updateBudget']): LayoutJob {
  return { inputs, updateBudget, state: 'pending' }
}

function isCurrent(job: LayoutJob, ignoreHeights = false) {
  if (job !== latestJob || job.state === 'cancelled') return false
  const inputs = currentInputs()
  if (job.inputs[5] !== inputs[5]) job.updateBudget(inputs[5])
  return inputsMatch(job.inputs, inputs, { ignoreHeights })
}

/** Only the current job can replace the drawing or publish its sizes. */
async function runCausalJob(job: LayoutJob, board: ReturnType<typeof boardOf>, arrange: boolean, onDraw?: (changed: boolean) => void) {
  const hadBoard = holdsViewNodes(useCanvasStore.getState().nodes, [VIEW_CARD, VIEW_QUESTION])
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!isCurrent(job, arrange)) return false
    let result: NonNullable<typeof causal>
    try {
      result = await causalFor(board.model, board.extras, job.inputs[7])
    } catch (error) {
      if (!isCurrent(job, arrange)) return false
      if (attempt === 0 && hadBoard) continue
      job.state = 'failed'
      console.error('[olumiView] causal layout failed', error)
      if (!hadBoard) firstDraw('failed')
      return false
    }
    if (!isCurrent(job, arrange)) return false
    causal = result
    row = result.result.row
    if (arrange) placed.clear()
    const { places, sizes } = result.result
    const changed = drawViewCanvas(board.model, places, board.extras, board.links, sizes, arrange)
    job.state = sizes
    firstDraw('idle')
    onDraw?.(changed)
    return changed
  }
  return false
}

export const viewLaying = (): boolean => latestJob?.state === 'pending' && isCurrent(latestJob, latestJob.arranging !== undefined)

export function useViewCanvas(on: boolean, reduced = false, restoreRetry = 0): void {
  const view = useViewStore((s) => s.view)
  // The board draws core's model less the relation cards that are their link (layout.ts drawnModelOf).
  const level = useSimpleLevel((s) => levelOf(useViewStore.getState().sid, s))
  const open = useInputsOpen((s) => s.open)
  const board = useMemo(() => (view?.model == null ? null : boardOf(view.model, open)), [view, open, level])
  // Kept ideas outlive the model they were kept beside: with no model they are drawn alone (ideasOnlyOf), never with a fabricated card.
  const sidNow = useViewStore((s) => s.sid)
  const ideasOnly = useMemo(() => ideasOnlyOf(view, sidNow), [view, sidNow])
  // Folds start closed (DL ruling 9 Nov (ii): 77cdc6f6's first-look fold opening is retired for this serve; the route is one click away on
  // the badge's count), so a reopened board draws what the first one did.
  // A card the canvas measures taller (or shorter) lays the graph out again at the drawn heights (review 00063 #4).
  const face = useCanvasStore((s) => layoutFace(reduced, level === 'simple', selectLodBodyHidden(s)))
  const heights = useCanvasStore((s) => heightsKey(s.nodes, face))
  // The layout's direction and spacing are the layout store's, as in the previous product: a change lays the board out again.
  // V12: the level is part of the layout too (Simple's bands are wider), so a switch lays the board out again.
  const laidAs = useLayoutStore((s) => `${s.direction}:${s.nodeSpacing}:${level}`)
  const [cols, updateBudget] = useSimpleBudgetKey(on, level === 'simple' || ideasOnly.length > 0)
  const retry = useFirstDraw((s) => s.retry)
  useLayoutEffect(() => {
    if (!on) return
    const inputs: LayoutInputs = [view, sidNow, open, heights, laidAs, cols, retry, face]
    if (restoring !== null) {
      const { zoom, job } = restoring
      if (canvasZoom() === zoom && inputsMatch(job.inputs, inputs, { ignoreHeights: true, ignoreFace: true })) {
        // The failed probe left the drawing in place. Reuse its job once the original face is measured again.
        if (inputsMatch(job.inputs, inputs)) {
          latestJob = job
          restoring = null
        }
        return
      }
      restoring = null
    }
    // No View for the scenario on screen (a new scenario, or one core holds no model for): the last one's cards leave (review 00003 #1).
    const job = makeJob(inputs, updateBudget)
    const cancel = () => { job.state = 'cancelled' }
    const arranging = latestJob
    const draw = () => {
      latestJob = job
      if (!isCurrent(job)) return
      if (view === null || board === null) {
        firstDraw('idle')
        if (ideasOnly.length > 0) {
          const result = ideasLayout(ideasOnly, face)
          row = result.row
          drawIdeasOnly(ideasOnly, result.places)
          job.state = result.sizes
        } else {
          withdrawViewCanvas()
          job.state = new Map()
        }
        return
      }
      const before = useCanvasStore.getState().nodes
      const had = holdsViewNodes(before, [VIEW_CARD, VIEW_QUESTION]) ? new Set(before.map((n) => n.id)) : null
      // An empty canvas waiting for its first layout says so (DraftingBoard.tsx LayingBoard); a board already drawn keeps its cards meanwhile.
      if (had === null) firstDraw('laying')
      void runCausalJob(job, board, false, (changed) => {
        const last = drew, sid = sidNow, n = view.version?.n ?? null
        drew = { sid, n, model: board.model }
        if (!changed || had === null) return
        const arrived: string[] = []
        for (const c of board.model.cards) if (!had.has(c.id)) arrived.push(c.id)
        const advanced = last !== null && last.sid === sid && last.n !== null && n !== null && n > last.n
        const named = view.version?.changed
        pulseWhenOnCanvas(advanced ? [...arrived, ...(named === undefined ? appliedSince(last.model, board.model) : [...cardsOfRecords(board.model, named), ...addedSince(last.model, board.model)])] : arrived)
      })
    }
    if (arranging?.arranging && arranging.state === 'pending' && inputsMatch(arranging.inputs, inputs, { ignoreHeights: true })) {
      // A resize can supersede another resize while it waits for Auto-arrange to place the cards.
      void arranging.arranging.then(() => {
        if (job.state !== 'cancelled' && latestJob === arranging) draw()
      })
    } else draw()
    return cancel
  }, [on, view, sidNow, open, board, ideasOnly, heights, laidAs, cols, retry, face, restoreRetry])
}

export type LayoutSettled = Readonly<{
  version: number
  far: boolean
  nodes: readonly Node[]
  pane: Readonly<{ width: number; height: number }>
  insets: Readonly<ReturnType<typeof paddingToInsets>>
}>

function frameInsetsOf(pane: HTMLElement | null) {
  const raw = paddingToInsets(computeFitPadding(pane))
  return { ...raw, top: frameTop(raw.top), bottom: Math.max(raw.bottom, FOOT_GUTTER) }
}

/** The mounted flow certifies geometry from the current job once its drawing has caught up. */
export function useLayoutSettled(on: boolean) {
  const flow = useStoreApi()
  const reduced = useStore((s) => reducedFaceSize(s.transform[2]) > 0)
  const [, refresh] = useState(0)
  const [restoreRetry, retryRestore] = useState(0)
  useLayoutEffect(() => {
    if (!on) return
    canvasZoom = () => flow.getState().transform[2]
    const unsubscribe = useCanvasStore.subscribe((next, previous) => {
      if (next.nodes === previous.nodes) return
      const face = currentFace()
      for (const { measured } of next.nodes) {
        if (measured && !measuredFaces.has(measured)) measuredFaces.set(measured, face)
      }
    })
    return () => {
      unsubscribe()
      canvasZoom = () => 1
      restoring = null
      if (latestJob !== null) latestJob.state = 'cancelled'
    }
  }, [on, flow])
  const layout = useMemo(() => {
    let version = 0, geometry = '', settled: LayoutSettled | null = null
    let certified: LayoutJob | null = null
    const read = (): LayoutSettled | null => {
      const { domNode, nodeLookup, panZoom, width, height, transform, updateNodeInternals } = flow.getState()
      const job = latestJob
      if (job === null || !isCurrent(job) || typeof job.state === 'string' ||
          !domNode || !panZoom || width <= 0 || height <= 0) return null
      const state = useCanvasStore.getState()
      const far = selectLodBodyHidden(state)
      const nodes = state.nodes.filter(isViewNode)
      if (nodes.length === 0 || nodes.some((n) => n.dragging)) return null
      const insets = frameInsetsOf(domNode)
      const elements = new Map(Array.from(domNode.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'), (el) => [el.dataset.id, el]))
      if (elements.size > nodes.length) return null
      const boxes: Node[] = []
      const [x, y, zoom] = transform
      for (const node of nodes) {
        const drawn = nodeLookup.get(node.id), el = elements.get(node.id)
        const position = drawn?.internals.positionAbsolute
        if (!position || !at(position, node.position)) return null
        const size = job.state.get(node.id)
        if (size === undefined) return null
        const measured = drawn?.measured
        const visible = sits({ x: x + position.x * zoom, y: y + position.y * zoom, w: size.width * zoom, h: size.height * zoom },
          { x: 0, y: 0, w: width, h: height })
        const domWidth = el?.offsetWidth, domHeight = el?.offsetHeight
        if (el && domWidth && domHeight) {
          if (measured?.width !== domWidth || measured.height !== domHeight) {
            if (!visible && (!measured?.width || !measured.height)) {
              updateNodeInternals(new Map([[node.id, { id: node.id, nodeElement: el, force: true }]]), { triggerFitView: false })
            }
            return null
          }
          if (node.measured?.width !== domWidth || node.measured.height !== domHeight) return null
          // Equal dimensions can survive a face change without a new resize event.
          if (measuredFaces.get(node.measured) !== job.inputs[7]) {
            const previous = measuredOnFace(node, job.inputs[7])
            measuredFaces.set(node.measured, job.inputs[7])
            if (!previous) {
              refresh((n) => n + 1)
              return null
            }
          }
          if (size.height !== domHeight) return null
        } else if (visible) return null
        const measuredWidth = measuredOnFace(node, job.inputs[7])?.width
        const boxWidth = job.inputs[7].startsWith('detailed') && measuredWidth ? Math.min(measuredWidth, size.width) : size.width
        boxes.push({ id: node.id, type: node.type, data: node.data, position: { ...position }, measured: { width: boxWidth, height: size.height } })
      }
      const key = JSON.stringify([far, width, height, insets, boxes.map((n) => [n.id, n.position, n.measured])])
      if (job !== certified || key !== geometry) {
        certified = job
        geometry = key
        version += 1
        settled = null
      }
      return settled ??= { version, far, nodes: boxes, pane: { width, height }, insets }
    }

    const wait = (signal: AbortSignal): Promise<LayoutSettled | null> => new Promise((resolve) => {
      if (signal.aborted) { resolve(null); return }
      let frame = 0
      const stop = () => finish(null)
      const finish = (snapshot: LayoutSettled | null) => {
        cancelAnimationFrame(frame)
        signal.removeEventListener('abort', stop)
        resolve(snapshot)
      }
      const tick = () => {
        const snapshot = read()
        if (snapshot !== null || (latestJob?.state === 'failed' && isCurrent(latestJob))) finish(snapshot)
        else frame = requestAnimationFrame(tick)
      }
      signal.addEventListener('abort', stop, { once: true })
      frame = requestAnimationFrame(tick)
    })

    const prepareRestore = (zoom: number) => {
      const job = certified === null ? null : { ...certified }
      return () => { if (job !== null) restoring = { zoom, job } }
    }
    const resume = () => {
      if (restoring === null) return
      restoring = null
      retryRestore((n) => n + 1)
    }
    return { read, wait, prepareRestore, resume }
  }, [flow])
  // Select only face changes. A pan and same-face zoom leave the job in force.
  useViewCanvas(on, reduced, restoreRetry)


  // A floating dock can resize without changing React Flow's width.
  const hasBoard = useViewStore((s) => s.view !== null)
  const [insetKey, setInsetKey] = useState('')
  useEffect(() => {
    if (!on) return
    const changed = () => setInsetKey(JSON.stringify(frameInsetsOf(flow.getState().domNode)))
    changed()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(changed)
    const selectors = [DOCK_SELECTOR, KEY_PILL_SELECTOR, LENS_BAR_SELECTOR, OVERLAY_BAND_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR]
    for (const el of document.querySelectorAll(selectors.join(','))) observer.observe(el)
    return () => observer.disconnect()
  }, [flow, hasBoard, on])
  return { layout, insetKey }
}
