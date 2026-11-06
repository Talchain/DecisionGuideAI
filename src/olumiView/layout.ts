/**
 * THE ONE LAYOUT MODULE (View API design §3). The only place in src/olumiView/ that may pick, place or measure View values: which cards a
 * surface draws, and coordinate arithmetic. It never writes a word, formats a figure, orders what the View ordered, or joins strings:
 * core did all of that. Everything else here draws View strings exactly as they arrive (src/olumiView/__tests__/contract.spec.tsx).
 */
import { MODEL_GROUP_TITLE, MODEL_TAB_GOAL_GROUP_TITLE } from '../canvas/domain/vocabulary'
import type { Edge, Node } from '@xyflow/react'
import type { View, ViewCard, ViewModel, ViewRow, ViewRun } from './client'
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
export function questionPlace(_model: ViewModel): { width: number } {
  return { width: 2 * W + GAP_X }
}

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
  const nodes: Node[] = [
    { id: QUESTION, type: 'decision', data: { kind: 'decision' }, position: { x: 0, y: 0 }, measured: at(QUESTION, questionWidth, 85) },
    ...model.cards.map((c): Node => { const kind = askKindOf(c.family); return { id: c.id, type: kind, data: { kind }, position: { x: 0, y: 0 }, measured: at(c.id, W, c.h) } }),
  ]
  const edges: Edge[] = cardLinks(model).map(({ link, i }) => ({ id: `l${i}`, source: link.from, target: link.to }))
  const elk = await layoutGraph(nodes, edges, { direction: 'DOWN' })
  const sized = new Map(nodes.map((n) => [n.id, n.measured as Size]))
  // PROTOTYPE (poc/fit-prototype, for Paul's morning call; never served): the previous PoC's family rows. Each card's row is its family's,
  // not its dependency depth: question / options / factors and assumptions / outcomes and risks / aims and limits. ELK keeps the x order.
  const tierOf = new Map<string, number>([[QUESTION, 0], ...model.cards.map((c): [string, number] => {
    const k = drawKindOf(c, model)
    return [c.id, k === 'option' ? 1 : k === 'outcome' || k === 'risk' ? 3 : k === 'goal' || k === 'constraint' ? 4 : 2]
  })])
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
  return wrapTiers(under)
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
export const HEAD_ROW_MAX = 900
/** PROTOTYPE: the room between two family rows. */
const FAMILY_ROW_GAP = 56

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
export const drawKindOf = (c: ViewCard, model: ViewModel): 'factor' | 'outcome' | 'risk' | 'goal' | 'option' | 'constraint' =>
  c.family === 'quantity' && model.links.some((l) => l.to === c.id && l.kind === 'through') ? 'outcome' : askKindOf(c.family)
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

/** The top of the causal graph, which the camera centres on when a board is too large to read whole: the question and the options. */
export const headOf = (model: ViewModel): ReadonlySet<string> => new Set([QUESTION, ...model.cards.filter((c) => c.family === 'option').map((c) => c.id)])

// R4 compared lines (compared.ts holds their stand-in types and per-line rules): which lines this page draws, and their groups. Picking
// lives here, the one layout module.
/** Core's compared lines this page draws, each with its place in `run.compared` (its View path): only the kinds it knows. */
export function comparedLinesOf(run: ViewRun | null): { line: ComparedLine; i: number }[] {
  const all = (run as { compared?: unknown } | null)?.compared
  if (!Array.isArray(all)) return []
  return (all as ComparedLine[]).map((line, i) => ({ line, i })).filter(({ line }) => COMPARED_KINDS.has(line.kind))
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
