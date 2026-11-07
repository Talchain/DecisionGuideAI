/**
 * THE ONE LAYOUT MODULE (View API design §3). The only place in src/olumiView/ that may pick, place or measure View values: which cards a
 * surface draws, and coordinate arithmetic. It never writes a word, formats a figure, orders what the View ordered, or joins strings:
 * core did all of that. Everything else here draws View strings exactly as they arrive (src/olumiView/__tests__/contract.spec.tsx).
 */
import { MODEL_GROUP_TITLE, MODEL_TAB_GOAL_GROUP_TITLE } from '../canvas/domain/vocabulary'
import type { Edge, Node } from '@xyflow/react'
import type { View, ViewCard, ViewModel, ViewReading, ViewRow, ViewRun, ViewTurn } from './client'
import { nonEmpty, type TippingLine } from './tipping'
import { COMPARED_KINDS, comparedHeadingOf, groupOf, type ComparedGroup, type ComparedLine } from './compared'
import { layoutGraph } from '../canvas/utils/layout'
import { wrapTiers } from '../canvas/utils/wrapTiers'
import { basisIdsOf } from './standin'
import { orderUnderParents } from '../canvas/utils/orderUnderParents'

/** Every option card in the View's order, live or not (the Summary shows a withheld option's status and reason too). */
export const allOptionCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.family === 'option')
/**
 * The option cards core compares, in the View's own order: what the chances block draws. An option core does not compare carries its
 * status on its card ("removed", "ruled out"); it has no chance to show, and the block leaves it out as the base does (review 00051).
 */
/** The cards whose figure the person may set (core offers `figure.edit`): the ones a what-if can try a different value for. */
export const triableCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.figure?.edit != null)

export const optionCards = (model: ViewModel): ViewCard[] => allOptionCards(model).filter((c) => c.status === null)

/** The cards whose figure the person may set, in the View's own order: core offers `figure.edit` only there, and only while no proposal is held. */
export const settableFigures = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.figure?.edit)

type Band = NonNullable<ViewCard['values']>[number]
/**
 * Each outcome band core gives one option (olumi.view/3 `cards[].values`), in the View's card order: the card, the option's entry and
 * its place in the card's list. A card with no modelled figure carries null, and a core before the band no field: neither draws one.
 */
export const optionBands = (model: ViewModel, option: string): { card: ViewCard; band: Band; i: number }[] =>
  model.cards.flatMap((card) => (card.values ?? []).flatMap((band, i) => (band.option === option ? [{ card, band, i }] : [])))

/**
 * Where a band sits on its card's one axis, from the least p10 to the greatest p90 of the card's bands, as percentages (core's numbers
 * are for positions only; its words are the band's `text`). One value everywhere puts every band at the start.
 */
export const bandPlace = (bands: Band[], band: Band): Place => placeOn(bands.map((b) => [b.p10, b.p90]), band.p10, band.p50, band.p90)

export type Place = { left: number; width: number; mid: number | null }
/** One range on the axis that runs from the least low to the greatest high of `all`, as percentages; one value everywhere is the start. */
function placeOn(all: [number, number][], low: number, mid: number | null, high: number): Place {
  const lo = Math.min(...all.map(([l]) => l)), span = Math.max(...all.map(([, h]) => h)) - lo
  const at = (x: number) => (span === 0 ? 0 : ((x - lo) / span) * 100)
  return { left: at(low), width: at(high) - at(low), mid: mid === null ? null : at(mid) }
}

type Outcome = NonNullable<Extract<ViewRow, { kind: 'chance' }>['outcome']>
/** Since core c838f56 a chance row carries `outcome`, the aim's measured quantity under that option (null where it has none). */
export const rowsCarryOutcome = (model: ViewModel): boolean => model.cards.some((c) => c.rows.some((r) => r.kind === 'chance' && 'outcome' in r))

/** Where an option's outcome sits on its aim's one axis: from the least low to the greatest high of every option's outcome for that aim. */
export const outcomePlace = (model: ViewModel, aim: string, o: Outcome): Place => placeOn(
  optionCards(model).flatMap((c) => c.rows.flatMap((r) => (r.kind === 'chance' && r.aim_id === aim && r.outcome != null ? [[r.outcome.low, r.outcome.high] as [number, number]] : []))),
  o.low, o.median, o.high)

/**
 * ⛔ A PENDING PROPOSAL'S RUN IS NEVER READ AS THE CURRENT MODEL (DL ruling, 4 Nov, R4). While core's View shows a pending proposal, its
 * model and Run are the proposal's (core view.ts:370 `shownModel = pending ?? version`), and core says so exactly when `proposal` is set and
 * `model.edit_base` is null (view.ts:380: no edit base while a proposal is shown; a held proposal shows the approved version and keeps it).
 * Then every Run-derived line carries core's own ↻ (its key item `changed`, by id), hover "If approved" (the DL's words); otherwise null.
 */
export function ifApprovedMarkOf(view: View | null): { glyph: string; title: string; i: number } | null {
  if (view === null || view.proposal == null || view.model == null || view.model.edit_base !== null) return null
  const i = view.model.key.findIndex((k) => k.id === 'changed')
  return i < 0 ? null : { glyph: view.model.key[i]!.glyph, title: IF_APPROVED, i }
}
const IF_APPROVED = 'If approved'

/** Core's key item for Olumi's mark (`model.key`, by core's id `olumi`, never its words: DL 4 Nov, R4) and its place in the key, or null when the View carries none. */
export function olumiKey(model: ViewModel): { glyph: string; text: string; i: number } | null {
  const i = (model.key ?? []).findIndex((k) => k.id === 'olumi')
  return i < 0 ? null : { ...model.key[i]!, i }
}

/**
 * Core's key item for a range that rests on a figure Olumi proposed: olumi-core src/view/model.ts BLUE_RANGE_KEY (wip/k5 6e40b89), last in
 * `model.key` only when some card's `values[].olumi` is true. Matched by its stable id, never its glyph or words (core may reword them; the
 * ids stay), so the page draws Olumi's blue on a bar only while core's key explains it. A key with no ids (R1/R2 core) draws no blue.
 */
export const BLUE_RANGE_KEY_ID = 'blue_range'
export function keyNamesBlueRange(key: ViewModel['key'] | null | undefined): boolean {
  // `id` is read structurally until the View is next vendored with olumi.view/3's key ids.
  for (const k of key ?? []) if ((k as { id?: unknown }).id === BLUE_RANGE_KEY_ID) return true
  return false
}

/** Core's own page geometry (olumi-core src/page/graph.ts): card width and the gap between its columns (the question's width). */
const W = 220, GAP_X = 48
/** The gap under a card: the least room between two cards one above the other. */
export const GAP_Y = 14

/** A View card's width on the canvas: core's page card (review 00063 #4). */
export const CARD_WIDTH = W

/** The heights the canvas measured for the nodes it drew, by id (React Flow's `measured`). */
export const drawnHeights = (nodes: readonly { id: string; measured?: { height?: number } }[]): Map<string, number> =>
  new Map(nodes.flatMap((n) => (typeof n.measured?.height === 'number' ? [[n.id, n.measured.height] as const] : [])))

/** A key that changes when any measured height does: the canvas lays its cards out again then. */
export const drawnHeightsKey = (nodes: readonly { id: string; measured?: { height?: number } }[]): string =>
  nodes.map((n) => `${n.id}:${n.measured?.height ?? ''}`).join('|')

/** The canvas kind a View card's Olumi controls ask as (its family is core's id, never shown): every card can be challenged, as on core's page. */
export const askKindOf = (family: string): 'factor' | 'risk' | 'goal' | 'option' | 'constraint' =>
  family === 'risk' || family === 'goal' || family === 'option' ? family : family === 'limit' ? 'constraint' : 'factor'

/** The question's card on core's page (olumi-core src/view/model.ts QUESTION): what a link to the question as a whole ends at. */
export const QUESTION = 'page:question'

/** How wide the question's card is: two cards and the gap between them, as the original canvas draws its decision card (DL 4 Nov, the
 *  original look; core's page drew it as wide as its columns, up to 900px, which ran under the dock at a readable zoom). The causal
 *  layout places it, at the top. */
export function questionPlace(model: ViewModel): { width: number } {
  // R25 (Paul 7 Nov: the aims in view at 1232): with an aim beside it the question is narrower, so the head row (two aims: 2 × 220 +
  // 2 × 16 + 272 = 744; one aim: the options' 756) fits the visible canvas at 1232 at the 1.0 floor (about 770 px between the canvas
  // controls and the dock; DL 7 Nov, fresh-brief board: one aim beside a full-width question ran under the dock).
  return { width: aimsOf(model).length >= 1 ? QUESTION_FLANKED_W : 2 * W + GAP_X }
}
/** The question's width with an aim beside it (R25). */
export const QUESTION_FLANKED_W = 272
/** The room between the question and an aim beside it (R25). */
export const HEAD_GAP = 16
/** The aims and limits, in the View's order: drawn beside the question, the head of the board (R25). */
export const aimsOf = (model: ViewModel): string[] => model.cards.filter((c) => { const k = askKindOf(c.family); return k === 'goal' || k === 'constraint' }).map((c) => c.id)

/** The View's links whose both ends are drawn (a card or the question), each with its place in the View's list, in its order. */
export const cardLinks = (model: ViewModel): { link: ViewModel['links'][number]; i: number }[] => {
  const ids = new Set([QUESTION, ...model.cards.map((c) => c.id)])
  return model.links.map((link, i) => ({ link, i })).filter(({ link }) => ids.has(link.from) && ids.has(link.to))
}

/** Whether the canvas holds any node the View drew (of one of the View's node types). */
export const holdsViewNodes = (nodes: readonly { type?: string }[], types: readonly string[]): boolean => nodes.some((n) => types.includes(n.type ?? ''))

/** The canvas's nodes the View did not draw. */
export const withoutViewNodes = <N extends { type?: string }>(nodes: readonly N[], types: readonly string[]): N[] => nodes.filter((n) => !types.includes(n.type ?? ''))

/** The canvas nodes that draw the View (its cards and question), by their node types: what the lane's own canvas frames. */
export const viewDrawnNodes = <T extends { type?: string }>(nodes: readonly T[], types: readonly string[]): T[] => nodes.filter((n) => n.type !== undefined && types.includes(n.type))

/** The drawn nodes of the given ids that the canvas has measured (both sides), for the camera's settle signal. */
export const measuredOf = <T extends { id: string; measured?: { width?: number; height?: number } }>(nodes: readonly T[], ids: ReadonlySet<string>): T[] =>
  nodes.filter((n) => ids.has(n.id) && !!n.measured?.width && !!n.measured?.height)

type Size = { width: number; height: number }
/**
 * DGAI'S CAUSAL GRAPH FOR CORE'S MODEL (Paul, 4 Nov: "the causal graph, not … the horizontal temporary UI"). Each View card as its DGAI
 * kind (`askKindOf`; the question as the decision) and each View link as an edge, placed by DGAI's own pure layout (`layoutGraph`: ELK
 * and the semantic tiers, top to bottom: decision, options, factors and risks, goal; a tier wider than four cards wraps). `size` is each
 * card as the canvas measured it
 * (else core's width and height). Positions only: no word of core's is read or written here.
 */
export async function causalPlaces(model: ViewModel, size: ReadonlyMap<string, Size>, questionWidth: number): Promise<Map<string, { x: number; y: number }>> {
  const at = (id: string, w: number, h: number): Size => size.get(id) ?? { width: w, height: h }
  // R25 (Paul 7 Nov: "aims in view" at 1232): the aims and limits are the head of the board, beside the question (`flankHead`), so the
  // rows below are the options, their drivers, the factors, then the outcomes and risks; the links into an aim run round the board.
  const aims = new Set(aimsOf(model))
  const nodes: Node[] = [
    { id: QUESTION, type: 'decision', data: { kind: 'decision' }, position: { x: 0, y: 0 }, measured: at(QUESTION, questionWidth, 85) },
    ...model.cards.filter((c) => !aims.has(c.id)).map((c): Node => { const kind = askKindOf(c.family); return { id: c.id, type: kind, data: { kind }, position: { x: 0, y: 0 }, measured: at(c.id, W, c.h) } }),
  ]
  const edges: Edge[] = cardLinks(model).filter(({ link }) => !aims.has(link.from) && !aims.has(link.to)).map(({ link, i }) => ({ id: `l${i}`, source: link.from, target: link.to }))
  const elk = await layoutGraph(nodes, edges, { direction: 'DOWN' })
  const sized = new Map(nodes.map((n) => [n.id, n.measured as Size]))
  // The previous PoC's family rows (Paul's item 1, option a2, 6 Nov: his hiring board opened with 7 of 17 cards off screen at 0.9): each
  // card's row is its family's, not its dependency depth: question / options / factors and assumptions / outcomes and risks / aims and
  // limits. ELK keeps the x order.
  const tierOf = new Map<string, number>([[QUESTION, 0], ...model.cards.filter((c) => !aims.has(c.id)).map((c): [string, number] => [c.id, familyTierOf(c, model)])])
  const tierY: number[] = []
  for (let t = 0, y = 0; t <= 4; t++) {
    tierY.push(y)
    const hs = [...tierOf].filter(([, k]) => k === t).map(([id]) => sized.get(id)?.height ?? 0)
    if (hs.length) y += Math.max(...hs) + FAMILY_ROW_GAP
  }
  const laid = { ...elk, nodes: elk.nodes.map((n) => ({ ...n, position: { x: n.position.x, y: tierY[tierOf.get(n.id) ?? 2]! } })) }
  const options = model.cards.filter((c) => c.family === 'option').map((c) => c.id)
  // The options packed under the question first (wrapped when too wide for the visible rect at 0.9); then every row below ordered under
  // what it hangs from, so the links drop row to row (DL 4 Nov, R3: the subtrees stayed where the layout spread them); then a tier wider
  // than four cards wraps (DL 4 Nov), so the board reads at fit as the original canvas does.
  const head = packHead(new Map(laid.nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }])), options, sized)
  const boxes = [...head].map(([id, p]) => ({ id, ...p, ...sized.get(id)! }))
  const under = orderUnderParents(boxes, edges.map((e) => [e.source, e.target] as const), new Set([QUESTION, ...options]))
  const aimSizes = new Map([...aims].map((id) => [id, at(id, W, model.cards.find((c) => c.id === id)!.h)] as const))
  return flankHead(wrapTiers(under, WRAP_PER_ROW, WRAP_GAP_X, WRAP_GAP_Y, true), [...aims], new Map([...sized, ...aimSizes]))
}

/**
 * The head of the board (R25, Paul 7 Nov: the aims in view at 1232): the aims and limits beside the question, in the View's order, the
 * first on its left and the next on its right (one aim: on its right), more stacked under those. Every other card moves down by what the
 * head adds below the question, so nothing overlaps. Positions only.
 */
export function flankHead(places: ReadonlyMap<string, { x: number; y: number }>, aims: readonly string[], size: ReadonlyMap<string, Size>): Map<string, { x: number; y: number }> {
  const q = places.get(QUESTION), qs = size.get(QUESTION), out = new Map(places)
  if (q === undefined || qs === undefined || aims.length === 0) return out
  const sides = aims.length === 1 ? [[], [...aims]] : [aims.filter((_, i) => i % 2 === 0), aims.filter((_, i) => i % 2 === 1)]
  let tallest = qs.height
  sides.forEach((ids, side) => {
    let y = q.y
    for (const id of ids) {
      const w = size.get(id)?.width ?? W, h = size.get(id)?.height ?? 0
      out.set(id, { x: side === 0 ? q.x - HEAD_GAP - w : q.x + qs.width + HEAD_GAP, y })
      y += h + GAP_Y
    }
    if (ids.length) tallest = Math.max(tallest, y - GAP_Y - q.y)
  })
  const by = tallest - qs.height
  if (by > 0) for (const [id, p] of places) if (id !== QUESTION) out.set(id, { x: p.x, y: p.y + by })
  return out
}

/**
 * The options' row packed under the question (DL 4 Nov, "readable first wins"): the layout spreads the options over their children, so the
 * question and the options did not fit across a 1280 canvas at 0.9. Each option row (the options alone on it) is drawn side by side, in
 * the View's order, `GAP_X` apart, centred under the question; nothing else moves. A row shared with another card is left as laid out.
 */
/**
 * The widest options row the camera holds wholly inside the visible rect at the readable floor (camera.ts READABLE_WHOLE_ZOOM, 0.9) on
 * the smallest supported canvas: 1280 less the dock and the canvas padding leaves about 824px, so 915 units; 900 keeps a margin. A wider
 * row (four options: 4 × 220 + 3 × 48 = 1024) wraps into balanced rows (DL 4 Nov, Codex P1-3), so the question and every option are seen.
 */
export const HEAD_ROW_MAX = 760 // R25 (DL 7 Nov, 4-option hosting board at 1232): the visible canvas at the 1.0 floor, as the head row; was 900 at 0.9
/** The room between two family rows, and inside a wrapped row (option a2: tight enough that Paul's hiring board opens whole at 0.8). */
export const FAMILY_ROW_GAP = 32
const WRAP_PER_ROW = 4, WRAP_GAP_X = 32, WRAP_GAP_Y = 24
/** The family row a card is drawn in: 0 question, 1 options, 2 the options' drivers (R24), 3 factors and assumptions, 4 outcomes and risks,
 *  5 aims and limits (drawn beside the question instead, `flankHead`). */
export const familyTierOf = (c: ViewCard, model: ViewModel): number => {
  const k = drawKindOf(c, model)
  return k === 'option' ? 1 : isDriver(c, model) ? 2 : k === 'outcome' || k === 'risk' ? 4 : k === 'goal' || k === 'constraint' ? 5 : 3
}
/** On an option card, the row index of its first chance (drawn as the big line, the previous PoC's face); -1 when it has none. */
export const leadChanceIndex = (card: ViewCard): number => (card.family === 'option' ? card.rows.findIndex((r) => r.kind === 'chance') : -1)

export function packHead(places: Map<string, { x: number; y: number }>, options: readonly string[], size: ReadonlyMap<string, Size>): Map<string, { x: number; y: number }> {
  const q = places.get(QUESTION), qs = size.get(QUESTION)
  if (q === undefined || qs === undefined) return places
  const rows = new Map<number, string[]>()
  for (const [id, p] of places) if (id !== QUESTION) rows.set(p.y, [...(rows.get(p.y) ?? []), id])
  const out = new Map(places)
  // Each wrapped options row moves every card below it down by the rows it added (from the laid-out places, so the order rows are met in
  // does not matter).
  const drops: { y: number; by: number }[] = []
  for (const [y, ids] of rows) {
    if (!ids.every((id) => options.includes(id))) continue
    // In the View's order (core's), never re-sorted here.
    const row = options.filter((id) => ids.includes(id)).map((id) => ({ id, w: size.get(id)?.width ?? W, h: size.get(id)?.height ?? 0 }))
    let width = GAP_X * (row.length - 1)
    for (const r of row) width += r.w
    const lines = Math.max(1, Math.ceil(width / HEAD_ROW_MAX)), per = Math.ceil(row.length / lines)
    let top = y
    for (let i = 0; i < row.length; i += per) {
      const line = row.slice(i, i + per)
      let lw = GAP_X * (line.length - 1), lh = 0
      for (const r of line) { lw += r.w; lh = Math.max(lh, r.h) }
      let x = q.x + qs.width / 2 - lw / 2
      for (const r of line) { out.set(r.id, { x, y: top }); x += r.w + GAP_X }
      top += lh + GAP_Y
    }
    let first = 0
    for (const r of row.slice(0, per)) first = Math.max(first, r.h)
    if (top - GAP_Y > y + first) drops.push({ y, by: top - GAP_Y - (y + first) })
  }
  for (const [id, p] of places) {
    if (id === QUESTION) continue
    let by = 0
    for (const d of drops) if (p.y > d.y) by += d.by
    if (by > 0) out.set(id, { ...out.get(id)!, y: out.get(id)!.y + by })
  }
  return out
}

/**
 * Whether a link is drawn (DL 4 Nov, after the causal graph: "the dashed premise and assumption links cross the whole board"). The
 * causal links always are. A reason link (a premise ⊢ or an assumption ◇ on what it concerns) only while one of its two cards is
 * hovered or selected (`active`), or when core marks it challenged or proposed, so what a person would approve is never folded away.
 */
export const linkDrawn = (link: { from: string; to: string; kind: string; alert: boolean; proposed: boolean }, active: ReadonlySet<string>): boolean =>
  link.kind !== 'reason' || link.alert || link.proposed || active.has(link.from) || active.has(link.to)

/** One thing the model rests on that a person can check or set, numbered in the View's order; `olumi` when core marks it Olumi's. */
export type RestsOnItem = { readonly id: string; readonly n: number; readonly olumi: boolean }
/**
 * The "Rests on" lens on the core lane (DL 4 Nov, the hidden lenses back on, fed from the View only): every figure a person can set (core
 * offers it an edit) and every assumption and condition, in the View's order and numbered from 1. Olumi's (core's ◆ or ◐ on the card)
 * are the ones to check or set. A figure core works out from others (no edit) is not something the model rests on.
 */
export function restsOnOf(model: ViewModel): { items: ReadonlyMap<string, RestsOnItem>; olumi: number } {
  // And every card a Run finding rests on (stand-in `rests_on`: its what-ifs, estimates and approximations, by record id, on the card with
  // that id or the card whose badge folds it), so each is marked on the lens whatever kind of card it is.
  const basis = basisIdsOf(model)
  const onBasis = (c: ViewCard) => basis.includes(c.id) || c.badge?.records.some((r) => basis.includes(r)) === true
  const picked = model.cards.filter((c) => (c.figure?.edit ?? null) !== null || c.family === 'assumption' || c.family === 'condition' || onBasis(c))
  return { items: new Map(picked.map((c, i) => [c.id, { id: c.id, n: i + 1, olumi: c.olumi !== null }])), olumi: picked.filter((c) => c.olumi !== null).length }
}

/**
 * The "What would change" lens on the core lane (DL 4 Nov): each figure an option's chance moves most with (core's `driver.figure`, a
 * record id), on the card that draws it (the card with that id, else the card whose badge folds that record), with the options it moves,
 * in the View's order. Core's ids only, never a heading. No Run, or no driver named: none.
 */
export function driversOf(model: ViewModel): ReadonlyMap<string, readonly ViewCard[]> {
  const out = new Map<string, ViewCard[]>()
  for (const option of model.cards.filter((c) => (c.driver?.figure ?? null) !== null)) {
    const figure = option.driver!.figure!
    const card = model.cards.find((c) => c.id === figure) ?? model.cards.find((c) => c.badge?.records.includes(figure) === true)
    if (card !== undefined) out.set(card.id, [...(out.get(card.id) ?? []), option])
  }
  return out
}

/**
 * The links the What would change lens draws wider: each link leaving a figure an option's chance moves most with (a driver's card,
 * `driversOf`), or sized by one (core's `effect.figure` on the link names it). By the link's place in the View's `links`; core's ids only.
 * Core names no order among the figures, so the lens ranks none.
 */
export function driverLinksOf(model: ViewModel, drivers: ReadonlyMap<string, readonly ViewCard[]>): ReadonlySet<number> {
  const cardOf = (record: string) => model.cards.find((c) => c.id === record) ?? model.cards.find((c) => c.badge?.records.includes(record) === true)
  return new Set(model.links.flatMap((l, i) => (drivers.has(l.from) || (l.effect != null && drivers.has(cardOf(l.effect.figure)?.id ?? '')) ? [i] : [])))
}

/** The cards drawing the records a version changed (core's `version.changed`): the card with that id, else the card whose badge folds it. */
export function cardsOfRecords(model: ViewModel, records: readonly string[]): string[] {
  const ids = new Set(records)
  return model.cards.filter((c) => ids.has(c.id) || c.badge?.records.some((r) => ids.has(r)) === true).map((c) => c.id)
}

/**
 * The cards a newer version applied that the last View drew as core's proposed additions (`change.kind` 'added'): their ghosts were already
 * on the canvas, so they never arrive, and core's `version.changed` names the records it modified, not the ones it added (core
 * service.ts `changedOf`). An addition the approval left out is not in the newer model, so it is not pulsed.
 */
export function addedSince(before: ViewModel, after: ViewModel): string[] {
  const added = new Set(before.cards.filter((c) => c.change?.kind === 'added').map((c) => c.id))
  return after.cards.filter((c) => added.has(c.id)).map((c) => c.id)
}

/**
 * For a core that names no `version.changed` (before R2a): the cards a newer version applied, for the applied-edit pulse: each card the last View drew with core's change mark (a proposal's
 * addition or change, now approved), and each figure a person sets (core offers it an edit) that core now words differently (an edit).
 * A figure core works out from others moves with them and is not pulsed. Core's words compared as they are, never read. An arrived card
 * is pulsed by its arrival (canvas.ts).
 */
export function appliedSince(before: ViewModel, after: ViewModel): string[] {
  const was = new Map(before.cards.map((c) => [c.id, c]))
  return after.cards.filter((c) => { const w = was.get(c.id); return w !== undefined && (w.change !== null || ((c.figure?.edit ?? null) !== null && (w.figure?.text ?? null) !== (c.figure?.text ?? null))) }).map((c) => c.id)
}

/**
 * The Model tab's groups (ViewModelTab.tsx), the legacy outline's in its order (`model-tab-v2`), by how the canvas draws each card
 * (`drawKindOf`): Question & goal holds the aims and limits; Outcomes & risks the figures core works out from others and the risks.
 * Assumptions and conditions are the Rests on lens's.
 */
export function modelGroupsOf(model: ViewModel): { id: 'goal' | 'options' | 'factors' | 'outcomes-risks'; title: string; cards: ViewCard[] }[] {
  const of = (kinds: readonly string[]) => model.cards.filter((c) => c.family !== 'assumption' && c.family !== 'condition' && kinds.includes(drawKindOf(c, model)))
  return [
    { id: 'goal', title: MODEL_TAB_GOAL_GROUP_TITLE, cards: of(['goal', 'constraint']) },
    { id: 'options', title: MODEL_GROUP_TITLE.options, cards: of(['option']) },
    { id: 'factors', title: MODEL_GROUP_TITLE.factors, cards: of(['factor']) },
    { id: 'outcomes-risks', title: MODEL_GROUP_TITLE.outcomesRisks, cards: of(['outcome', 'risk']) },
  ]
}

/** The words for a link's end: the question's, or the heading of the card that draws the record (its own, else the one folding it). */
export function linkEndHeading(model: ViewModel, id: string): string {
  if (id === QUESTION) return model.question.text
  return (model.cards.find((c) => c.id === id) ?? model.cards.find((c) => c.badge?.records.includes(id) === true))?.heading ?? ''
}

/** The science kinds Worth checking first knows how to say (olumi.view/3 `run.science[].kind`). */
const WORTH_KINDS: ReadonlySet<string> = new Set(['worth'])
/**
 * The Run's science lines Worth checking first draws, each with its place in `run.science` (its View path): only the kinds it knows. A
 * kind core adds later (D2: middle, better, an 'unresolved' status) is drawn as nothing until this page knows what it means.
 */
export const worthLinesOf = <T extends { kind: string }>(science: readonly T[]): { line: T; i: number }[] =>
  science.map((line, i) => ({ line, i })).filter(({ line }) => WORTH_KINDS.has(line.kind))

/**
 * The DGAI node kind a View card is drawn as on the canvas (the original look), by its role in core's model, the same on every version: a
 * figure core works out from others (a `through` link arrives at it) is an outcome, any other figure a factor; the rest as `askKindOf`.
 * Never by whether it can be edited now: core withdraws every edit while a proposal is held and on a past version (R1 P1).
 */
export const drawKindOf = (c: ViewCard, model: ViewModel): 'factor' | 'outcome' | 'risk' | 'goal' | 'option' | 'constraint' => {
  if (c.family !== 'quantity') return askKindOf(c.family)
  // R24 (core 0a5f8e69: options → drivers → outcome → aim): a figure the options set is a driver, drawn as a factor in its own row; the
  // figures the drivers feed are the outcomes the aims read. No board before R24 has a driver (every golden and real fixture), so for
  // those the rule is the one before: a figure a `through` link arrives at is worked out from others, an outcome.
  if (isDriver(c, model)) return 'factor'
  if (model.links.some((l) => l.to === c.id && l.kind === 'through')) return 'outcome'
  return model.links.some((l) => l.to === c.id && isDriverId(l.from, model)) ? 'outcome' : 'factor'
}
const familyOf = (model: ViewModel, id: string): string | undefined => model.cards.find((c) => c.id === id)?.family
/**
 * A driver (R24, DL 7 Nov "show drivers"): a figure every `through` link into which comes from an option (the options set it), which feeds
 * another figure and no aim directly. Positions and shape only; its words are core's.
 */
export function isDriver(c: ViewCard, model: ViewModel): boolean {
  if (c.family !== 'quantity') return false
  const into = model.links.filter((l) => l.to === c.id && l.kind === 'through')
  if (into.length === 0 || into.some((l) => familyOf(model, l.from) !== 'option')) return false
  const out = model.links.filter((l) => l.from === c.id).map((l) => familyOf(model, l.to))
  return out.includes('quantity') && !out.some((f) => f === 'goal' || f === 'constraint')
}
const isDriverId = (id: string, model: ViewModel): boolean => { const c = model.cards.find((x) => x.id === id); return c !== undefined && isDriver(c, model) }
const PREFIX: Record<string, string> = { option: 'O', factor: 'F', outcome: 'OC', risk: 'R', constraint: 'C' }
/** Each card's number as the original canvas numbers them (O1, F1, OC1, …), per kind in the View's order; an assumption or condition
 *  is A1, …; the aim has none. */
export function cardNumbersOf(model: ViewModel): ReadonlyMap<string, string> {
  const seen = new Map<string, number>(), out = new Map<string, string>()
  for (const c of model.cards) {
    const p = c.family === 'assumption' || c.family === 'condition' ? 'A' : PREFIX[drawKindOf(c, model)]
    if (p === undefined) continue
    const n = (seen.get(p) ?? 0) + 1
    seen.set(p, n)
    out.set(c.id, `${p}${n}`)
  }
  return out
}

/** The top of the causal graph, which the camera centres on when a board is too large to read whole: the question, the aims beside it
 *  (R25) and the options. */
export const headOf = (model: ViewModel): ReadonlySet<string> => new Set([QUESTION, ...aimsOf(model), ...model.cards.filter((c) => c.family === 'option').map((c) => c.id)])

// R4 compared lines (compared.ts holds their per-line rules): which lines this page draws, and their groups. Picking
// lives here, the one layout module.
/** Core's compared lines this page draws, each with its place in `run.compared` (its View path): only the kinds it knows. */
export function comparedLinesOf(run: ViewRun | null): { line: ComparedLine; i: number }[] {
  const all = run?.compared
  if (!Array.isArray(all)) return []
  return all.map((line, i) => ({ line, i })).filter(({ line }) => COMPARED_KINDS.has(line.kind))
}

/** The groups to draw, in the order core first lists a line of each, each with its heading and lines; a group with no heading is left out. */
export function comparedGroupsOf(run: ViewRun | null): { group: ComparedGroup; heading: string; lines: { line: ComparedLine; i: number }[] }[] {
  const out: { group: ComparedGroup; heading: string; lines: { line: ComparedLine; i: number }[] }[] = []
  for (const x of comparedLinesOf(run)) {
    const g = groupOf(x.line), heading = comparedHeadingOf(run, g)
    if (heading === null) continue
    const at = out.find((o) => o.group === g)
    if (at) at.lines.push(x); else out.push({ group: g, heading, lines: [x] })
  }
  return out
}

/**
 * The Run's D6 lines under core's own heading (`run.tipping`, `run.tipping_heading`; tipping.ts), each with its place in the array (its View path),
 * and, for an aim with no crossing, core's one line saying why (`run.tipping_aims[].silent[].line`), once per aim; null when core sends no heading
 * or nothing to draw.
 */
export function tippingOf(run: ViewRun | null): { heading: string; lines: { line: TippingLine; i: number }[]; silent: { aim: string; line: string }[] } | null {
  if (run === null || !Array.isArray(run.tipping) || !nonEmpty(run.tipping_heading)) return null
  const lines = run.tipping.map((line, i) => ({ line, i })).filter(({ line }) => nonEmpty(line?.line))
  const silent = (Array.isArray(run.tipping_aims) ? run.tipping_aims : []).flatMap((a) => {
    if (a.lines.length > 0) return []
    const first = (a.silent ?? []).find((s) => nonEmpty(s?.line))
    return first === undefined ? [] : [{ aim: a.aim, line: first.line }]
  })
  return lines.length === 0 && silent.length === 0 ? null : { heading: run.tipping_heading, lines, silent }
}

/**
 * D5 (`run.failure`) and D8 (`run.rests`) under core's own headings: each line core's sentence, in core's order, with its hover; nothing without
 * a heading or a line. D5 is empty until a person names or commits to an option; D8's shares are positions only and are never drawn as numbers.
 */
export function failureOf(run: ViewRun | null) { return factsOf(run?.failure_heading, run?.failure) }
export function restsOf(run: ViewRun | null) { return factsOf(run?.rests_heading, run?.rests) }
function factsOf<T extends { id: string; line: string; hover: string }>(heading: string | undefined, all: readonly T[] | undefined): { heading: string; lines: { line: T; i: number }[] } | null {
  if (!nonEmpty(heading) || !Array.isArray(all)) return null
  const lines = all.map((line, i) => ({ line, i })).filter(({ line }) => nonEmpty(line?.line))
  return lines.length === 0 ? null : { heading, lines }
}

/**
 * The option the person has in front of them (D5, "What could go wrong?": core's facts are about an option the person names or commits to):
 * the one option card among the selected canvas nodes, by its id; null when none or more than one is selected (core then asks which they lean towards).
 */
export function optionInFocusOf(view: { model: ViewModel | null }, selected: ReadonlySet<string>): string | null {
  const options = (view.model?.cards ?? []).filter((c) => c.family === 'option' && selected.has(c.id))
  return options.length === 1 ? options[0]!.id : null
}

// ── The Reasoning tab's picks (Paul, 6 Nov: the previous PoC's sections; ViewReasoning.tsx draws them, picking is done only here) ──
/** The cards of the given families, in the View's order (the model at a glance: options, factors, risks). */
export const familyCards = (model: ViewModel, families: readonly string[]): ViewCard[] => model.cards.filter((c) => families.includes(c.family))
/** The cards core marks `challenged` (a challenge, a disagreement, evidence that challenges), in the View's order. */
export const challengedCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.challenged === true)
const REASONING_FAMILIES = ['assumption', 'condition', 'claim', 'evidence', 'left_out']
/** Every premise core put on any card, each once by its words (the first card it is on), then each reasoning card core draws whose words
 *  are not already among them and that is not a challenge. */
export function premisesOnce(model: ViewModel): { premises: { card: ViewCard; p: ViewCard['premises'][number]; j: number }[]; cards: ViewCard[] } {
  const seen = new Set<string>()
  const premises = model.cards.flatMap((c) => (c.premises ?? []).map((p, j) => ({ card: c, p, j }))).filter(({ p }) => (seen.has(p.text) ? false : (seen.add(p.text), true)))
  const cards = model.cards.filter((c) => REASONING_FAMILIES.includes(c.family) && c.challenged !== true && c.reason !== null && !seen.has(c.reason))
  return { premises, cards }
}
/** The model at a glance, as the previous PoC's strip (side-by-side, 6 Nov): Options, Factors, Risks and Outcomes, each row the cards the
 *  canvas draws as that kind (drawKindOf: a figure core works out from others is an outcome, never a factor), in the View's order; every
 *  row present, empty or not. Only options, risks and figures are counted: a reasoning card (assumption, claim, …) is not one of these. */
export type GlanceKind = 'option' | 'factor' | 'risk' | 'outcome'
export const GLANCE_KINDS: readonly GlanceKind[] = ['option', 'factor', 'risk', 'outcome']
export const glanceRows = (model: ViewModel): { kind: GlanceKind; cards: ViewCard[] }[] =>
  GLANCE_KINDS.map((kind) => ({ kind, cards: model.cards.filter((c) => (kind === 'option' || kind === 'risk' ? c.family === kind : c.family === 'quantity' && drawKindOf(c, model) === kind)) }))
/** The options whose chance carries core's two driver chances (`driver.low` / `driver.high`, finite): the ones drawn as a marker. */
export const markedOptions = (model: ViewModel): ViewCard[] => optionCards(model).filter((c) => c.driver != null && c.driver.low !== null && c.driver.high !== null && Number.isFinite(c.driver.low) && Number.isFinite(c.driver.high))

// ── The Model tab's outline picks (Paul, 6 Nov: the previous PoC's outline; ViewModelTab.tsx draws them, picking is done only here) ──
export type OutlineGroupId = 'goal' | 'options' | 'factors' | 'outcomes-risks' | 'relationships'
/**
 * The Model tab's outline narrowed to a filter's words (case aside): each group's cards by their heading, the question by its words, each
 * link by its two ends' words; `ids`, the groups the outline draws (every group with a card, the question's always, Relationships when there
 * is a link), whatever the filter. An empty filter narrows nothing.
 */
export function modelOutlineOf(model: ViewModel, filter: string) {
  const needle = filter.trim().toLowerCase(), matches = (words: string) => needle === '' || words.toLowerCase().includes(needle)
  const groups = modelGroupsOf(model).map((g) => ({ ...g, rows: g.cards.filter((c) => matches(c.heading)), question: g.id === 'goal' && matches(model.question.text) }))
  const links = model.links.map((l, i) => ({ l, i, from: linkEndHeading(model, l.from), to: linkEndHeading(model, l.to) })).filter((x) => matches(`${x.from} ${x.to}`))
  const ids: OutlineGroupId[] = [...groups.filter((g) => g.cards.length > 0 || g.id === 'goal').map((g) => g.id), ...(model.links.length === 0 ? [] : ['relationships' as const])]
  return { searching: needle !== '', groups, links, ids }
}
/** The canvas kinds among a group's cards that Outcomes & risks marks (outcome, risk), each once, in the cards' order. */
export const outcomeRiskKinds = (model: ViewModel, cards: readonly ViewCard[]): ('outcome' | 'risk')[] =>
  [...new Set(cards.map((c) => drawKindOf(c, model)))].filter((k): k is 'outcome' | 'risk' => k === 'outcome' || k === 'risk')

// ── The Analysis tab's sections (Paul, 6 Nov: the previous PoC's boxed sections; ViewChances.tsx draws them, picking is done only here) ──
/** How many worth lines "Behind this result" shows before "+N more" holds the rest (the previous PoC's "+3 more"). */
export const BEHIND_SHOWN = 2
/** A list split at `n`: the first `n` shown, the rest behind a disclosure, each keeping its place and its View path. */
export const firstFew = <T>(items: readonly T[], n: number): { shown: T[]; more: T[] } => ({ shown: items.slice(0, n), more: items.slice(n) })
/** The coach's newest next step (olumi.view/3 `chat[].answer.next`, the one core marks `newest`), with its turn's place (its View path,
 *  `chat.<k>`) and its first cite number as the conversation numbers it (after the reply's answer and Why lines); null when none. */
export function newestNextOf(chat: readonly ViewTurn[] | null | undefined): { turn: ViewTurn; k: number; next: NonNullable<ViewTurn['answer']>['next']; first: number } | null {
  const k = (chat ?? []).findIndex((t) => t.answer?.next.newest === true)
  if (k < 0) return null
  const turn = chat![k]!, a = turn.answer!
  const cites = [a.answer, ...a.why].flatMap((parts) => parts.flatMap((p) => ('cite' in p ? [p] : []))).length
  return { turn, k, next: a.next, first: 1 + cites }
}

// ── Sharpen your thinking (olumi.view/3 `model.sharpen`, core view/sharpen.ts; ViewChances.tsx draws them, picking is done only here) ──
/** One of core's prompts about the model's shape: its words (lead, emphasis, rationale) and the coach move it relates to. */
export type SharpenRow = { id: string; lead: string; emphasis: string; rationale: string; move: string | null }
/** How many prompts the card shows before "+N more" holds the rest (the previous PoC's two-row cap). */
export const SHARPEN_SHOWN = 2
/** Core's prompts in core's order, each with its index (its View path, `sharpen.<i>`); [] when core sends none, as a core before the field
 *  (read before the schema is vendored, as compared.ts and k5.ts read theirs: a View without the field draws nothing). */
export function sharpenRowsOf(model: ViewModel): { row: SharpenRow; i: number }[] {
  const raw = (model as { sharpen?: unknown }).sharpen
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r: unknown, i) => {
    const x = r as Partial<SharpenRow> | null
    return x && typeof x.id === 'string' && typeof x.lead === 'string' && typeof x.emphasis === 'string' && typeof x.rationale === 'string'
      ? [{ row: { id: x.id, lead: x.lead, emphasis: x.emphasis, rationale: x.rationale, move: typeof x.move === 'string' ? x.move : null }, i }] : []
  })
}
/** The canvas family a prompt is about, for its mark: a risk prompt is about risks, every other one about the options. */
export const sharpenKindOf = (id: string): 'risk' | 'option' => (id === 'risk_count' ? 'risk' : 'option')

// ── The session goal and the menu of plain questions (olumi.view/3 `session`, core src/app/session.ts; ViewChat.tsx draws them) ──
/** One goal or one question as core words it: its id (what a press sends) and its text (what is drawn, verbatim). */
export type SessionItem = { id: string; text: string }
export type SessionMethod = SessionItem & { first: boolean }
export type Session = { goal: SessionItem | null; set_by: string | null; goals: SessionItem[]; methods: SessionMethod[] }
const itemOf = (x: unknown): SessionItem | null => {
  const r = x as Partial<SessionItem> | null
  return r !== null && typeof r === 'object' && typeof r.id === 'string' && typeof r.text === 'string' ? { id: r.id, text: r.text } : null
}
/**
 * The View's session block exactly as core sent it: the goals and the questions in core's order, none dropped (an order, never a filter:
 * `first` is only an emphasis). Read before the schema is vendored, as compared.ts and sharpenRowsOf read theirs, by shape only, never
 * against a list of ids of the page's own. A View without the block, or with any entry this page cannot read, draws none of it (null):
 * a menu with a question silently missing would say every question is there when one is not.
 */
export function sessionOf(view: View): Session | null {
  const raw = (view as { session?: unknown }).session as { goal?: unknown; set_by?: unknown; goals?: unknown; methods?: unknown } | null | undefined
  if (raw === null || typeof raw !== 'object' || !Array.isArray(raw.goals) || !Array.isArray(raw.methods)) return null
  const goal = raw.goal === null ? null : itemOf(raw.goal)
  if (raw.goal !== null && goal === null) return null
  const goals = raw.goals.flatMap((g: unknown) => { const i = itemOf(g); return i === null ? [] : [i] })
  const methods = raw.methods.flatMap((m: unknown) => {
    const i = itemOf(m), first = (m as { first?: unknown } | null)?.first
    return i === null || typeof first !== 'boolean' ? [] : [{ ...i, first }]
  })
  if (goals.length !== raw.goals.length || methods.length !== raw.methods.length) return null
  return { goal, set_by: typeof raw.set_by === 'string' ? raw.set_by : null, goals, methods }
}

// ── "Let us give our figure first" (olumi.view/3 `session.figure_first`, core src/app/figure-first.ts; ViewFigureFirst.tsx draws it) ──
type Words = { text: string; title: string }
export type FigureFirstGiven = {
  label: string
  theirs: Words & ({ value: number } | { low: number; high: number })
  olumi: Words & { basis: string; low: number; high: number; likely: number | null }
  seen_before: { text: string }
  adopted: { text: string } | null
  note: string
}
export type FigureFirstHeadings = { theirs: string; olumi: string; basis: string; seen: string; adopted: string }
export type FigureFirst = { offer: { quantity: string; label: string; text: string } | null; given: FigureFirstGiven | null; headings: FigureFirstHeadings }
const str = (x: unknown): x is string => typeof x === 'string'
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
/**
 * The View's `session.figure_first` for this viewer, read by shape before the schema is vendored (as sessionOf): the offer, the figure they
 * gave beside Olumi's, and core's headings. Only the words are drawn; the numbers place the two figures on one axis (figureAxisOf) and are
 * never written out. A View without it, or with a part this page cannot read, draws none of it (null).
 */
export function figureFirstOf(view: View): FigureFirst | null {
  const raw = ((view as { session?: { figure_first?: unknown } }).session?.figure_first ?? null) as Record<string, unknown> | null
  if (raw === null || typeof raw !== 'object') return null
  const h = raw['headings'] as Record<string, unknown> | null | undefined
  if (!h || !str(h['theirs']) || !str(h['olumi']) || !str(h['basis']) || !str(h['seen']) || !str(h['adopted'])) return null
  const headings: FigureFirstHeadings = { theirs: h['theirs'], olumi: h['olumi'], basis: h['basis'], seen: h['seen'], adopted: h['adopted'] }
  const o = raw['offer'] as Record<string, unknown> | null | undefined
  const offer = o == null ? null : str(o['quantity']) && str(o['label']) && str(o['text']) ? { quantity: o['quantity'], label: o['label'], text: o['text'] } : undefined
  const g = raw['given'] as Record<string, unknown> | null | undefined
  let given: FigureFirstGiven | null | undefined = null
  if (g != null) {
    const t = g['theirs'] as Record<string, unknown> | undefined, ol = g['olumi'] as Record<string, unknown> | undefined
    const seen = g['seen_before'] as Record<string, unknown> | undefined, ad = g['adopted'] as Record<string, unknown> | null | undefined
    const theirs = t && str(t['text']) && str(t['title'])
      ? num(t['value']) ? { text: t['text'], title: t['title'], value: t['value'] } : num(t['low']) && num(t['high']) ? { text: t['text'], title: t['title'], low: t['low'], high: t['high'] } : null
      : null
    const olumi = ol && str(ol['text']) && str(ol['title']) && str(ol['basis']) && num(ol['low']) && num(ol['high'])
      ? { text: ol['text'], title: ol['title'], basis: ol['basis'], low: ol['low'], high: ol['high'], likely: num(ol['likely']) ? ol['likely'] : null } : null
    const adopted = ad == null ? null : str(ad['text']) ? { text: ad['text'] } : undefined
    given = theirs && olumi && seen && str(seen['text']) && str(g['label']) && str(g['note']) && adopted !== undefined
      ? { label: g['label'], theirs, olumi, seen_before: { text: seen['text'] }, adopted, note: g['note'] } : undefined
  }
  if (offer === undefined || given === undefined) return null
  return { offer, given, headings }
}

/** Where a figure sits on the side by side's one axis, in % of its width: a range from–to, or one value (from = to). */
export type AxisSpan = { from: number; to: number }
/**
 * Both figures on ONE shared axis (geometry only, nothing written out): the axis runs from the lowest end either figure gives to the highest,
 * with a little room each side, so each is placed exactly where its own numbers put it. No distance or overlap is worked out or shown.
 */
export function figureAxisOf(given: Pick<FigureFirstGiven, 'theirs' | 'olumi'>): { theirs: AxisSpan; olumi: AxisSpan; likely: number | null } {
  const t = given.theirs, o = given.olumi
  const [tl, th] = 'value' in t ? [t.value, t.value] : [t.low, t.high]
  const lo = Math.min(tl, o.low), hi = Math.max(th, o.high)
  if (!(hi > lo)) return { theirs: { from: 50, to: 50 }, olumi: { from: 50, to: 50 }, likely: o.likely === null ? null : 50 }
  const room = (hi - lo) * 0.08, a = lo - room, span = hi - lo + 2 * room
  const at = (v: number) => ((v - a) / span) * 100
  return { theirs: { from: at(tl), to: at(th) }, olumi: { from: at(o.low), to: at(o.high) }, likely: o.likely === null ? null : at(o.likely) }
}

// ── R19 time treatment (olumi.view/3 `model.run.readings` and `model.run.timing`), drawn once and verbatim ─────────────────────────────────
/** How the Run reads this aim or limit over its window (core's sentence), or null: none for it, or a core before R19. Drawn once, under the aim's own card. */
export const readingOf = (model: ViewModel, id: string): ViewReading | null => model.run?.readings?.find((r) => r.aim_id === id) ?? null

/** The straight form of a label inside core's quotes, so a label matches however the sentence quotes it. */
const bare = (x: string): string => x.replace(/[\u2018\u2019\u201c\u201d'"]/g, '').toLowerCase()
/**
 * The Run's notes without the generic Olumi what-if note for a quantity `run.timing` already says once ("Olumi's what-if for 'X', not their figure: …").
 * Core keeps that note on the quantity (API.md "Time treatment (R19)"); a page that draws `run.timing` skips it so the same assumption is not said twice.
 * Matched on core's own opening and the timing entry's label; any other note is kept whole.
 */
export function notesBesideTiming(run: ViewRun): ViewRun['notes'] {
  const timing = run.timing ?? []
  if (timing.length === 0) return run.notes
  const said = timing.map((t) => bare(`Olumi's what-if for ${t.label}, not their figure`))
  return run.notes.filter((n) => !said.some((w) => bare(n.text).startsWith(w)))
}
