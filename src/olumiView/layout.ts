/**
 * THE ONE LAYOUT MODULE (View API design §3). The only place in src/olumiView/ that may pick, place or measure View values: which cards a
 * surface draws, and coordinate arithmetic. It never writes a word, formats a figure, orders what the View ordered, or joins strings:
 * core did all of that. Everything else here draws View strings exactly as they arrive (src/olumiView/__tests__/contract.spec.tsx).
 */
import { MODEL_GROUP_TITLE, MODEL_TAB_GOAL_GROUP_TITLE } from '../canvas/domain/vocabulary'
import type { Edge, Node } from '@xyflow/react'
import { FOOT_CLEAR, FOOT_W, STORY_ROOM_Y } from './regions'
import type { View, ViewCard, ViewModel, ViewReading, ViewRow, ViewRun, ViewTurn } from './client'
import { nonEmpty, type TippingLine } from './tipping'
import { COMPARED_KINDS, comparedHeadingOf, groupOf, type ComparedGroup, type ComparedLine } from './compared'
import { layoutGraph, solveLayoutCardWidths } from '../canvas/utils/layout'
import { packRows } from '../canvas/utils/packRows'
import { LAYOUT_NODE_GAP, LAYOUT_PADDING_X, MAX_CARDS_PER_ROW, REPEATED_CARD_W } from '../canvas/utils/nodeLayoutConstants'
import { basisIdsOf } from './standin'
import type { WhatIfVariant } from './whatif'

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
/** A limit's row on the previous layout: its own, between the consequences and the goal. */
export const LIMIT_TIER = 4
const W = REPEATED_CARD_W, GAP_X = 48 // UI restore stage 1: the previous product's card, the width its layout places (nodeLayoutConstants)
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
  // UI restore stage 1: the question is the previous product's decision card, at the width its layout places it (solveLayoutCardWidths).
  return { width: solveLayoutCardWidths(engineNodes(model, (_id, w, h) => ({ width: w, height: h })), { preserveLocked: false }).decision ?? QUESTION_W }
}
/** The question's width on the prototype's board (J1 gate). */
export const QUESTION_W = W
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
/** The View's cards and question as the previous product's layout reads them: each by its kind (the question as the decision). */
const engineNodes = (model: ViewModel, at: (id: string, w: number, h: number) => Size): Node[] => [
  { id: QUESTION, type: 'decision', data: { kind: 'decision' }, position: { x: 0, y: 0 }, measured: at(QUESTION, W, 85) },
  ...model.cards.map((c): Node => { const kind = drawKindOf(c, model); return { id: c.id, type: kind, data: { kind, ...(kind === 'constraint' ? { layoutTier: LIMIT_TIER } : {}) }, position: { x: 0, y: 0 }, measured: at(c.id, W, c.h) } }),
]
/**
 * THE PREVIOUS PRODUCT'S GRAPH FOR CORE'S MODEL (UI restore stage 1, rows 5 and 6; DL ruling 10 Nov on Paul's test: "so much worse than it
 * used to be"). Each View card as its kind and each View link as an edge, placed by the previous product's own layout (`layoutGraph`,
 * canvas/utils/layout.ts) and by nothing else: one layered layout, top to bottom by default, its direction and spacing the ones the
 * layout store holds. No family rows, no four-card wrap, no left column of routes, no aims beside the question laid over it (the
 * overrides of 4 to 8 Nov are gone). `size` is each card as the canvas measured it (else core's height). Positions only: no word of
 * core's is read or written here.
 */
export async function causalPlaces(model: ViewModel, size: ReadonlyMap<string, Size>, options: { direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'; spacing?: number; row?: { cardW: number; gapX: number } } = {}): Promise<Map<string, { x: number; y: number }>> {
  const nodes = engineNodes(model, (id, w, h) => size.get(id) ?? { width: w, height: h })
  const edges: Edge[] = cardLinks(model).map(({ link, i }) => ({ id: `l${i}`, source: link.from, target: link.to }))
  const direction = options.direction ?? 'DOWN'
  // DL-538: the options stand in one row (the row is sized to the stage, stageRow); a tier wraps only past the wider of that row and the
  // previous layout's own cap.
  const maxPerRow = Math.max(MAX_CARDS_PER_ROW, allOptionCards(model).length)
  const laid = await layoutGraph(nodes, edges, { direction, spacing: options.spacing, preserveLocked: false, maxPerRow })
  const places = new Map(laid.nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]))
  if (direction !== 'DOWN' && direction !== 'UP') return places
  const packed = packRows(places, QUESTION, options.row?.cardW ?? W, options.row?.gapX ?? ROW_GAP_X)
  // DL-538: the question bar spans the options row (questionBarWidth), so it starts where the row starts.
  const opts = allOptionCards(model).map((c) => packed.get(c.id)).filter((p): p is { x: number; y: number } => p !== undefined), q = packed.get(QUESTION)
  if (options.row !== undefined && q !== undefined && opts.length > 0) packed.set(QUESTION, { x: Math.min(...opts.map((p) => p.x)), y: q.y })
  return packed
}
/** The room between two cards in a row of the board: the previous layout's own (its node gap and its box padding). */
export const ROW_GAP_X = LAYOUT_NODE_GAP + LAYOUT_PADDING_X
/**
 * J1 step 1 (Codex's order, DL 8 Nov: "one readable path"): a relation core draws as a card, whose reason links name the two drawn cards
 * of a link between them, is that link: the board draws the link and not the card ("Visits revenue" and "Reminded" were cards sitting
 * between the cards they join). Its words stay core's, on the Model tab and in the View. A relation card that explains no drawn link
 * (a link core does not draw) stays a card, so no dependency is lost. Picking only: no word is read or written.
 */
export function linkCards(model: ViewModel): ReadonlySet<string> {
  const isRelation = new Set(model.cards.filter((c) => c.family === 'relation').map((c) => c.id))
  const joined = new Set(model.links.filter((l) => l.kind !== 'reason' && !isRelation.has(l.from) && !isRelation.has(l.to)).map((l) => `${l.from}>${l.to}`))
  const out = new Set<string>()
  for (const id of isRelation) {
    const ends = model.links.filter((l) => l.kind === 'reason' && l.from === id).map((l) => l.to)
    if (ends.length === 2 && (joined.has(`${ends[0]}>${ends[1]}`) || joined.has(`${ends[1]}>${ends[0]}`))) out.add(id)
  }
  return out
}
/** J1 gate: whether Olumi inferred the link between two cards: the relation card core draws as that link (`linkCards`) is Olumi's
 *  (`author.by`). The board draws such a link dashed in Olumi's colour, as the prototype does. False with no such card. */
export function linkByOlumi(model: ViewModel, from: string, to: string): boolean {
  for (const id of linkCards(model)) {
    const ends = model.links.filter((l) => l.kind === 'reason' && l.from === id).map((l) => l.to)
    if ((ends[0] === from && ends[1] === to) || (ends[0] === to && ends[1] === from)) return model.cards.find((c) => c.id === id)?.author?.by === 'olumi'
  }
  return false
}
/** The model the board draws: core's, less the relation cards that are their link (`linkCards`) and those cards' reason links. */
export function drawnModelOf(model: ViewModel): ViewModel {
  const asLinks = linkCards(model)
  if (asLinks.size === 0) return model
  return { ...model, cards: model.cards.filter((c) => !asLinks.has(c.id)), links: model.links.filter((l) => !asLinks.has(l.from) && !asLinks.has(l.to)) }
}
/**
 * J1 step 3 (nothing repeated): while no option has a chance yet (every option card's rows are core's "none" kind), each option card leaves
 * that row to the panel, which says what is not yet there once. Keyed by the rows' kind, never their words. False when any option has a
 * chance or a limit row, or there is no option.
 */
export function optionsNotYet(model: ViewModel | null | undefined): boolean {
  const options = (model?.cards ?? []).filter((c) => c.family === 'option')
  return options.length > 0 && options.every((c) => c.rows.length > 0 && c.rows.every((r) => r.kind === 'none'))
}

/**
 * J1 step 4 (DL 8 Nov, Codex's order: "on J1, a focused panel"): a scenario's first look is its first version with only the brief's turn
 * said and no view revealed: the dock is the brief's account, not the tabs.
 */
export function isFirstLook(view: View | null): boolean {
  return view?.model != null && view.version?.n === 1 && view.chat.length === 1 && view.collab.shared.length === 0
}
/**
 * What the brief's account says, every item core's own words: the brief; the cards the team stated and those Olumi proposed (by core's
 * author.by, in the model's order, by their headings; a relation the board draws as a link by core's label for it); core's left-out records
 * by their labels; whether there is an aim yet and whether any option has a chance; Olumi's one question (the newest reply's next step).
 * Core's notes on what Olumi used, inferred and left out (ED-12) are not served yet: `notes` says so, and nothing stands in for them.
 */
/** A part of the brief Olumi left out (ED-12, core 11df609): the words left out as the brief has them (`quote`, null when they are not in
 *  it), else the record's own label, and core's note on why (`why`, absent on a core before it). */
export type LeftOut = { readonly id: string; readonly quote: string | null; readonly label: string | null; readonly why: string | null }
export type BriefAccount = {
  readonly brief: string; readonly by: string | null; readonly version: string | null; readonly versionAt: string | null
  readonly used: readonly string[]; readonly inferred: readonly string[]; readonly leftOut: readonly LeftOut[]
  readonly noAim: boolean; readonly noChances: boolean; readonly notes: null
  readonly question: { readonly label: string | null; readonly text: string } | null
}
export function briefAccountOf(view: View): BriefAccount {
  const model = view.model!
  // The board's cards (a relation it draws as a link is not a card: linkCards), by who core says they are from: the person's, the brief's
  // and the mixed ones (their figure, Olumi's range) were used from the brief; Olumi's own were inferred.
  const asLinks = linkCards(model)
  const cards = model.cards.filter((c) => !asLinks.has(c.id))
  const by = (who: readonly string[]) => cards.filter((c) => c.author != null && who.includes(c.author.by)).map((c) => c.heading)
  const next = view.chat.at(-1)?.answer?.next ?? null
  return {
    brief: view.brief, by: view.chat[0]?.by ?? null, version: view.version?.label ?? null, versionAt: view.version?.at_text ?? null,
    used: by(['person', 'brief', 'mixed']), inferred: by(['olumi']),
    leftOut: view.collab.records.flatMap((r) => (r.family === 'left_out' && (r.quote != null || r.label !== null)
      ? [{ id: r.id, quote: r.quote ?? null, label: r.label, why: r.why ?? null }] : [])),
    noAim: aimsOf(model).length === 0, noChances: optionsNotYet(model) || model.cards.every((c) => c.family !== 'option'), notes: null,
    // A cite in Olumi's question points at a Run finding; a first version has none, so only its words are read.
    question: next === null ? null : { label: next.label, text: next.text.map((t) => ('text' in t ? t.text : '')).join('') },
  }
}

/**
 * SC-01 PREVIEW (option A, Paul 8 Nov: "Show me your recommended option. I don't want to commit to it yet"): the cause-to-aim story read
 * left to right in three columns, so a 16-card board is seen whole at 1232 x 704 at the 0.9 floor (camera.ts READABLE_WHOLE_ZOOM).
 *   0: the question, then the options, in the View's order;
 *   1: the causes: every card further than two links from an aim (or with no path to one), each reason card beside the cause it explains;
 *   2: the mechanism and the aims: cards within two links of an aim, the furthest first, then the aims and limits.
 * A reason card (`relation`) sits in the column of the first card it explains (its upstream end). `railed` cards carry a chip rail below,
 * so the next card leaves it room. Positions only: no word of core's is read or written here.
 */
export const COLUMN_GAP_X = 56, COLUMN_GAP_Y = 12, RAIL_GAP_Y = 32 // a rail is 28 px: one chip (24) and its 4 px margin
export function causalColumns(model: ViewModel, size: ReadonlyMap<string, Size>, questionWidth: number, railed: ReadonlySet<string> = new Set()): Map<string, { x: number; y: number }> {
  const at = (id: string): Size => size.get(id) ?? (id === QUESTION ? { width: questionWidth, height: 85 } : { width: W, height: model.cards.find((c) => c.id === id)?.h ?? 0 })
  const reasonCard = (c: ViewCard) => c.family === 'relation'
  // Where the story ends: the aims and limits; on a board with none yet (J1, a first version), the figures every link leads to (a card
  // with a plain link into it and none out of it), so the story still reads from its causes to what they move.
  const plainOut = new Set(model.links.filter((l) => l.kind !== 'reason').map((l) => l.from)), plainIn = new Set(model.links.filter((l) => l.kind !== 'reason').map((l) => l.to))
  const stated = aimsOf(model)
  const aims = new Set(stated.length > 0 ? stated : model.cards.filter((c) => !reasonCard(c) && drawKindOf(c, model) !== 'option' && plainIn.has(c.id) && !plainOut.has(c.id)).map((c) => c.id))
  // How many plain links lie between a card and an aim (the longest way): 0 for an aim, undefined with no way to one.
  const out = new Map<string, string[]>()
  for (const l of model.links) if (l.kind !== 'reason') out.set(l.from, [...(out.get(l.from) ?? []), l.to])
  const depth = new Map<string, number | undefined>()
  const seen = new Set<string>()
  const depthOf = (id: string): number | undefined => {
    if (aims.has(id)) return 0
    if (depth.has(id)) return depth.get(id)
    if (seen.has(id)) return undefined
    seen.add(id)
    const ds = (out.get(id) ?? []).map(depthOf).filter((d): d is number => d !== undefined)
    const d = ds.length === 0 ? undefined : 1 + Math.max(...ds)
    depth.set(id, d)
    return d
  }
  const columnOf = new Map<string, number>([[QUESTION, 0]])
  // The right column takes where the story ends, then each next layer by distance from it while that column stays no taller than the
  // middle one would be (J1: the figure alone, its drivers in the middle; the 16-card growth board: the aim and the two figures feeding it).
  const causes = model.cards.filter((c) => !reasonCard(c) && drawKindOf(c, model) !== 'option')
  const layer = (c: ViewCard) => depthOf(c.id) ?? Number.POSITIVE_INFINITY
  const tall = (cs: readonly ViewCard[]) => { let h = 0; for (const c of cs) h += at(c.id).height + COLUMN_GAP_Y; return h }
  const layers = [...new Set(causes.map(layer))].filter(Number.isFinite)
  let reach = 0
  for (const d of Array.from({ length: layers.length }, (_, k) => k)) {
    const right = causes.filter((c) => layer(c) <= d), middle = causes.filter((c) => layer(c) > d)
    if (d === 0 || tall(right) <= tall(middle)) reach = d
    else break
  }
  for (const c of model.cards) {
    if (reasonCard(c)) continue
    columnOf.set(c.id, drawKindOf(c, model) === 'option' ? 0 : layer(c) <= reach ? 2 : 1)
  }
  // A reason card beside the first card it explains (its links run from it to the two cards of the link it explains).
  const explains = (c: ViewCard) => model.links.filter((l) => l.from === c.id).map((l) => l.to).filter((id) => columnOf.has(id))
  for (const c of model.cards) if (reasonCard(c)) { const first = explains(c)[0]; columnOf.set(c.id, first === undefined ? 1 : columnOf.get(first)!) }
  const order: string[][] = [[QUESTION], [], []]
  const plain = model.cards.filter((c) => !reasonCard(c))
  for (let col = 0; col <= 2; col++) {
    const inCol = plain.filter((c) => columnOf.get(c.id) === col).map((c) => c.id)
    // The right column reads down to the aim: the furthest from the aims first, the aims last; the View's order within each.
    const far = Math.max(0, ...inCol.map((id) => depthOf(id) ?? 0))
    // Each column reads down toward where the story ends: the furthest from it first, the ends last; the View's order within each.
    const unreached = inCol.filter((id) => depthOf(id) === undefined)
    const here = col === 0 ? inCol : [...unreached, ...Array.from({ length: far }, (_, k) => inCol.filter((id) => !aims.has(id) && depthOf(id) === far - k)).flat(), ...inCol.filter((id) => aims.has(id))]
    for (const id of here) {
      order[col]!.push(id)
      // Each reason card straight after the first card it explains, in this column.
      for (const r of model.cards) if (reasonCard(r) && columnOf.get(r.id) === col && explains(r)[0] === id) order[col]!.push(r.id)
    }
  }
  // A reason card whose first card is in another column still sits in its own, at the end.
  for (const r of model.cards) if (reasonCard(r) && !order.some((o) => o.includes(r.id))) order[columnOf.get(r.id)!]!.push(r.id)
  const places = new Map<string, { x: number; y: number }>()
  let x = 0
  for (const col of order) {
    let y = 0
    for (const id of col) { places.set(id, { x, y }); y += at(id).height + (railed.has(id) ? RAIL_GAP_Y : COLUMN_GAP_Y) }
    x += Math.max(W, ...col.map((id) => at(id).width)) + COLUMN_GAP_X
  }
  return places
}

/** The routes' column, the room beside it, the room between two cards in a row and between two rows (flow units; J1 gate). */
export const ROUTE_GAP_X = 24, TREE_GAP_X = 16, TREE_GAP_Y = 20, ROUTE_GAP_Y = 10, TREE_ROOM_Y = 96, TREE_ROOM_X = 80
/** The room a chip rail takes under its card on the route board: a chip whose words wrap to two lines (RevealMarks: rails as wide as the card). */
export const TREE_RAIL_Y = 44
/**
 * J1 GATE (UI session 8 Nov, Paul: "the prototypes look beautiful"): the prototype's board. The question and, under it, the options (the
 * routes) stand in a column on the left; the story reads top down beside them: the causes furthest from where it ends first, each row
 * one link nearer, where it ends (the aims; on a board with none yet, the figures every link leads to) at the bottom, each row centred.
 * Positions only: no word of core's is read or written here.
 */
export function routeTree(model: ViewModel, size: ReadonlyMap<string, Size>, questionWidth: number, railed: ReadonlySet<string> = new Set(), room = 0, roomW = 0): Map<string, { x: number; y: number }> {
  const at = (id: string): Size => size.get(id) ?? (id === QUESTION ? { width: questionWidth, height: 85 } : { width: W, height: model.cards.find((c) => c.id === id)?.h ?? 0 })
  const below = (id: string) => at(id).height + (railed.has(id) ? TREE_RAIL_Y : 0)
  const reasonCard = (c: ViewCard) => c.family === 'relation'
  const plain = model.links.filter((l) => l.kind !== 'reason')
  const plainOut = new Set(plain.map((l) => l.from)), plainIn = new Set(plain.map((l) => l.to))
  const options = model.cards.filter((c) => !reasonCard(c) && drawKindOf(c, model) === 'option').map((c) => c.id)
  const stated = aimsOf(model)
  const ends = new Set(stated.length > 0 ? stated : model.cards.filter((c) => !reasonCard(c) && drawKindOf(c, model) !== 'option' && plainIn.has(c.id) && !plainOut.has(c.id)).map((c) => c.id))
  const out = new Map<string, string[]>()
  for (const l of plain) out.set(l.from, [...(out.get(l.from) ?? []), l.to])
  // How many plain links lie between a card and where the story ends (the longest way): 0 at the end, undefined with no way there.
  const depth = new Map<string, number | undefined>(), seen = new Set<string>()
  const depthOf = (id: string): number | undefined => {
    if (ends.has(id)) return 0
    if (depth.has(id)) return depth.get(id)
    if (seen.has(id)) return undefined
    seen.add(id)
    const ds = (out.get(id) ?? []).map(depthOf).filter((d): d is number => d !== undefined)
    const d = ds.length === 0 ? undefined : 1 + Math.max(...ds)
    depth.set(id, d)
    return d
  }
  const causes = model.cards.filter((c) => !reasonCard(c) && !options.includes(c.id))
  const far = Math.max(0, ...causes.map((c) => depthOf(c.id) ?? 0))
  // A card with no way to the end sits in the top row (the furthest), in the View's order.
  const rows: string[][] = Array.from({ length: far + 1 }, (_, k) => causes.filter((c) => (depthOf(c.id) ?? far) === far - k).map((c) => c.id))
  // A reason card that stays a card (it explains no drawn link) sits in the row of the first card it explains, after it.
  for (const r of model.cards) {
    if (!reasonCard(r)) continue
    const first = model.links.find((l) => l.from === r.id && l.to !== r.id)?.to
    const row = rows.find((ids) => first !== undefined && ids.includes(first)) ?? rows[0]!
    row.push(r.id)
  }
  // The question heads the left column and the routes stand under it; the story's rows sit beside them from the top, so the whole board
  // is in view at full size on Paul's 1232 x 704 screen (the 16-card growth board: 856 x 554 flow units beside the 300 px dock).
  const head = [QUESTION, ...options]
  // The room across, as the room down (`roomW`, flow units at full size): what the widest row leaves goes between its cards, then
  // between the routes and the story, each up to TREE_ROOM_X (the prototype's sparse J1 board).
  const cardsOf = (ids: readonly string[]) => { let w = 0; for (const id of ids) w += at(id).width; return w }
  const column = Math.max(...head.map((id) => at(id).width))
  const most = Math.max(1, ...rows.map((ids) => ids.length))
  const tight = Math.max(0, ...rows.map((ids) => cardsOf(ids) + Math.max(0, ids.length - 1) * TREE_GAP_X))
  const spare = Math.max(0, roomW - column - ROUTE_GAP_X - tight)
  const gapX = most < 2 ? TREE_GAP_X : Math.min(TREE_ROOM_X, TREE_GAP_X + spare / (most - 1))
  const widthOf = (ids: readonly string[]) => cardsOf(ids) + Math.max(0, ids.length - 1) * gapX
  const span = Math.max(0, ...rows.map(widthOf))
  const left = column + ROUTE_GAP_X + Math.min(TREE_ROOM_X - ROUTE_GAP_X, Math.max(0, roomW - column - ROUTE_GAP_X - span) / 2)
  const places = new Map<string, { x: number; y: number }>()
  let y = 0
  for (const id of head) { places.set(id, { x: 0, y }); y += below(id) + (id === QUESTION ? TREE_GAP_Y / 2 : ROUTE_GAP_Y) }
  // The rows share the free canvas's height (`room`, flow units at full size), as the prototype's sparse board does: the room left over
  // goes between them, never less than TREE_GAP_Y and never more than TREE_ROOM_Y.
  const drawn = rows.filter((ids) => ids.length > 0)
  let tall = 0
  for (const ids of drawn) tall += Math.max(...ids.map(below))
  const gap = drawn.length < 2 ? TREE_GAP_Y : Math.min(TREE_ROOM_Y, Math.max(TREE_GAP_Y, (room - tall) / (drawn.length - 1)))
  y = 0
  for (const ids of drawn) {
    let x = left + (span - widthOf(ids)) / 2
    for (const id of ids) { places.set(id, { x, y }); x += at(id).width + gapX }
    y += Math.max(...ids.map(below)) + gap
  }
  // V11 rehearsal (DL 9 Nov, at 1232x704): the opening board shows the question, the aims and the options before any card detail. Where
  // this board puts any of them outside the room the camera opens on (a large first model: the aims end a tall story at its foot), the head
  // is organised instead: the question and the aims across the top, the options under them, the story below.
  const opening = [QUESTION, ...aimsOf(model), ...options]
  if (room > 0 && roomW > 0 && !headInRoom(places, opening, at, below, room, roomW)) return headFirst(model, rows, opening, options, at, below, roomW, room)
  return places
}

/** Whether every head card lies inside the room the camera opens on: the board's top at the room's top, the head's width within the room. */
function headInRoom(places: ReadonlyMap<string, { x: number; y: number }>, head: readonly string[], at: (id: string) => Size, below: (id: string) => number, room: number, roomW: number): boolean {
  let x0 = Infinity, x1 = -Infinity, y1 = 0
  for (const id of head) { const p = places.get(id); if (p === undefined) continue; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + at(id).width); y1 = Math.max(y1, p.y + below(id)) }
  return x1 - x0 <= roomW && y1 <= room
}

/**
 * The head first (V11 rehearsal): the question and the aims in one band across the top, the options in the next, each band wrapping at
 * the room's width; the story's rows below them, the furthest cause first, as `routeTree` orders them, starting below the room (V11
 * pixel pass, 9 Nov: no story card is drawn cut at the window's foot at 704). Positions only.
 */
function headFirst(model: ViewModel, rows: readonly (readonly string[])[], head: readonly string[], options: readonly string[], at: (id: string) => Size, below: (id: string) => number, roomW: number, room: number): Map<string, { x: number; y: number }> {
  const places = new Map<string, { x: number; y: number }>()
  const band = (ids: readonly string[], top: number, wrap: boolean, x0 = 0): number => {
    let x = x0, y = top, tall = 0
    for (const id of ids) {
      if (wrap && x > x0 && x + at(id).width > roomW) { x = x0; y += tall + TREE_GAP_Y; tall = 0 }
      places.set(id, { x, y }); x += at(id).width + TREE_GAP_X; tall = Math.max(tall, below(id))
    }
    return ids.length === 0 ? top : y + tall
  }
  const top = head.filter((id) => !options.includes(id))
  // The question flanks the aims and the options (DL ruling 9 Nov, hiring at 1232x704): where it is the tallest head card and the aims and the
  // options each fit one row beside it, it stands as the left column and they sit to its right, so the head row is as tall as the aims,
  // not the question. Otherwise the bands run across the top as before.
  const aims = top.filter((id) => id !== QUESTION), rowW = (ids: readonly string[]) => { let w = 0; for (const id of ids) w += at(id).width + TREE_GAP_X; return w - TREE_GAP_X }
  let tallAims = 0
  for (const id of aims) tallAims = Math.max(tallAims, below(id))
  const qx = top.includes(QUESTION) ? at(QUESTION).width + TREE_GAP_X : 0
  const flank = qx > 0 && aims.length > 0 && below(QUESTION) > tallAims && qx + rowW(aims) <= roomW && qx + rowW(options) <= roomW
  let y: number
  if (flank) {
    places.set(QUESTION, { x: 0, y: 0 })
    y = Math.max(band(options, band(aims, 0, true, qx) + TREE_GAP_Y, true, qx), below(QUESTION))
  } else {
    y = band(top, 0, true) + TREE_GAP_Y
    y = band(options, y, true)
  }
  y += STORY_ROOM_Y
  const placedHead = new Set(head)
  const story = rows.map((ids) => ids.filter((id) => !placedHead.has(id) && model.cards.some((c) => c.id === id))).filter((ids) => ids.length > 0)
  // A story row is read whole on the opening board when it fits the room (regions.ts; the person's first figures, DL 9 Nov): a card over
  // the foot controls' columns (x < FOOT_W) ends FOOT_CLEAR above the room's foot, any other within it, placed as `band` places it, left to
  // right from x 0. A row that does not fit starts past the room instead, so no card is drawn cut at the window's foot (9 Nov).
  const fits = (ids: readonly string[], top: number) => { let fx = 0, ok = true; for (const id of ids) { if (top + below(id) > room - (fx < FOOT_W ? FOOT_CLEAR : 0)) ok = false; fx += at(id).width + TREE_GAP_X } return ok }
  // Story rows do not wrap at the room's width: wrapping put cards across the links of the rows above (crossings 9 -> 17 on hiring, round 7).
  for (const rest of story) {
    if (!fits(rest, y) && y < room + TREE_ROOM_Y) y = room + TREE_ROOM_Y
    y = band(rest, y, false) + TREE_GAP_Y
  }
  return places
}

/**
 * The aims whose one shared reason covers this option (core's `run.shared_blockers`, by aim id and option id, never by its words). Core
 * says that reason once for every option it covers and the panel draws it once (ViewChances `SharedBlockers`); the option card leaves that
 * row to it (SC-01 preview). Fails closed: a core without the field covers nothing.
 */
export function sharedAimsOf(run: ViewRun | null | undefined, option: string): readonly string[] {
  return (run?.shared_blockers ?? []).filter((b) => b.options.includes(option)).map((b) => b.aim_id)
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

/**
 * A route's link that runs round the board as a rail (the routes head the left column, below the story's first row) is drawn only while
 * either of its cards is hovered or selected, as a reason link is: four routes' rails never cross the board at rest (the prototype draws
 * the routes' links only for the route in focus). Every other link is unaffected.
 */
export const routeRailAtRest = (link: { from: string; to: string }, fromRoute: boolean, railed: boolean, active: ReadonlySet<string>): boolean =>
  !(railed && fromRoute) || active.has(link.from) || active.has(link.to)

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
/** The reasons of the cards core marks challenged: each is drawn as its challenge (ViewReasoning's Challenge rows), so a premise in the same
 *  words is that same thing (core sends it at both paths, SC-02) and is not said again as a premise, in the door or the rack. */
export const challengedReasons = (model: ViewModel): Set<string> =>
  new Set(model.cards.flatMap((c) => (c.challenged === true && c.reason !== null ? [c.reason] : [])))
/** Every premise core put on any card, each once by its words (the first card it is on), then each reasoning card core draws whose words
 *  are not already among them and that is not a challenge. */
export function premisesOnce(model: ViewModel, optionsSaidElsewhere = false): { premises: { card: ViewCard; p: ViewCard['premises'][number]; j: number }[]; cards: ViewCard[] } {
  // `optionsSaidElsewhere`: each live option's own premises are drawn in its row of the rack (the options it draws, `optionCards`), so
  // neither they nor the same words on another card are said again here; a ruled-out option's are still said here, the rack not drawing it.
  const seen = challengedReasons(model)
  if (optionsSaidElsewhere) for (const c of optionCards(model)) for (const p of c.premises ?? []) seen.add(p.text)
  const premises = model.cards.flatMap((c) => (c.premises ?? []).map((p, j) => ({ card: c, p, j }))).filter(({ p }) => (seen.has(p.text) ? false : (seen.add(p.text), true)))
  const cards = model.cards.filter((c) => REASONING_FAMILIES.includes(c.family) && c.challenged !== true && c.reason !== null && !seen.has(c.reason))
  return { premises, cards }
}
/** The model at a glance, as the previous PoC's strip (side-by-side, 6 Nov): Options, Factors, Risks and Outcomes, each row the cards the
 *  canvas draws as that kind (drawKindOf: a figure core works out from others is an outcome, never a factor), in the View's order; every
 *  row present, empty or not. Assumptions and conditions are not counted (they are what the others rest on). */
export type GlanceKind = 'option' | 'factor' | 'risk' | 'outcome'
export const GLANCE_KINDS: readonly GlanceKind[] = ['option', 'factor', 'risk', 'outcome']
// V11 pixel pass (9 Nov): one picking with the Model tab's outline (modelGroupsOf: every card the canvas draws as that kind, assumptions
// and conditions aside), so Reasoning and Model never count the same kind differently (the re-score found Factors 3 against 6 on J1).
export const glanceRows = (model: ViewModel): { kind: GlanceKind; cards: ViewCard[] }[] =>
  GLANCE_KINDS.map((kind) => ({ kind, cards: model.cards.filter((c) => c.family !== 'assumption' && c.family !== 'condition' && drawKindOf(c, model) === kind) }))
/** The options whose chance carries core's two driver chances (`driver.low` / `driver.high`, finite): the ones drawn as a marker. */
export const markedOptions = (model: ViewModel): ViewCard[] => optionCards(model).filter((c) => c.driver != null && c.driver.low !== null && c.driver.high !== null && Number.isFinite(c.driver.low) && Number.isFinite(c.driver.high))

// ── The Model tab's outline picks (Paul, 6 Nov: the previous PoC's outline; ViewModelTab.tsx draws them, picking is done only here) ──
export type OutlineGroupId = 'goal' | 'options' | 'factors' | 'outcomes-risks' | 'relationships'
/**
 * The Model tab's outline narrowed to a filter's words (case aside): each group's cards by their heading, the question by its words, each
 * link by its two ends' words; `ids`, the groups the outline draws (every group with a card, the question's always, Relationships when there
 * is a link, and Factors where the first figure is added), whatever the filter. An empty filter narrows nothing.
 */
export function modelOutlineOf(model: ViewModel, filter: string) {
  const needle = filter.trim().toLowerCase(), matches = (words: string) => needle === '' || words.toLowerCase().includes(needle)
  const groups = modelGroupsOf(model).map((g) => ({ ...g, rows: g.cards.filter((c) => matches(c.heading)), question: g.id === 'goal' && matches(model.question.text) }))
  const links = model.links.map((l, i) => ({ l, i, from: linkEndHeading(model, l.from), to: linkEndHeading(model, l.to) })).filter((x) => matches(`${x.from} ${x.to}`))
  const ids: OutlineGroupId[] = [...groups.filter((g) => g.cards.length > 0 || g.id === 'goal' || g.id === 'factors').map((g) => g.id), ...(model.links.length === 0 ? [] : ['relationships' as const])]
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

/**
 * COACHING ON ITS CARD (track 4 step 2, DL 7 Nov), THE ONE ADAPTER from a reply's next step to the cards it names: today core's
 * `next.about` (record ids, which the canvas uses as its card ids), each once, in core's order. When the DL's coaching field lands, only
 * this body changes; a record that is not a card maps to its card HERE. An id with no card on the canvas lights nothing (ring.ts).
 */
export function nextCardsOf(next: { readonly about: readonly string[] }): readonly string[] {
  return [...new Set(next.about)]
}
/** The cards the newest next step keeps lit at rest: its cards in core's order, less any already in the person's focus (a card they
 *  selected, or the card Olumi's note is open on): one focus per screen. */
export function restingRingOf(cards: readonly string[], inFocus: readonly string[]): readonly string[] {
  return cards.filter((id) => !inFocus.includes(id))
}

/** The card a figure's quantity is drawn on: its own card, else the card whose badge holds that record; null when the canvas has neither. */
export function cardOfQuantity(view: View, quantity: string): string | null {
  const cards = view.model?.cards ?? []
  if (cards.some((c) => c.id === quantity)) return quantity
  return cards.find((c) => c.badge?.records.includes(quantity) === true)?.id ?? null
}

/** The cards a piece of evidence concerns, each once, in core's order; a record the canvas does not draw is left out. */
export function evidenceCards(view: View, e: View['evidence'][number]): readonly string[] {
  const out: string[] = []
  for (const r of e.concerns) { const c = cardOfQuantity(view, r); if (c !== null && !out.includes(c)) out.push(c) }
  return out
}

/** The evidence drawn on one card, in core's order. None for a member core still holds (gated): as with the reveal, nothing of the team's is drawn on the board for them until they have given their own view. */
export function evidenceOn(view: View | null, card: string): readonly View['evidence'][number][] {
  if (view === null || view.gated || view.model == null) return []
  return view.evidence.filter((e) => evidenceCards(view, e).includes(card))
}

/** Revealed chip identities for camera placement, in the View's order. */
export const chipViewIds = (marks: readonly { readonly isChip: boolean; readonly view: number }[]): number[] =>
  marks.filter((m) => m.isChip).map((m) => m.view)

// ── N3 (strategy screen): the picks the reveal, the docks and the header make, here in the one module allowed to pick ─────────────────
type RevealMarkPick = { readonly view: number; readonly by_id: string; readonly card: string; readonly isChip: boolean }

/** The revealed views to draw: every shared view but a skip, in core's order. */
export function revealedViews(view: View): View['collab']['shared'] {
  return view.collab.shared.filter((v) => !v.skip)
}

/** The marks on one card: its chips, and its initials (each person once, among the views no chip there gathers). */
export function marksOnCard<M extends RevealMarkPick>(marks: readonly M[], card: string): { readonly chips: readonly M[]; readonly initials: readonly M[] } {
  const here = marks.filter((m) => m.card === card)
  const chips = here.filter((m) => m.isChip)
  const chipped = new Set(chips.map((m) => m.view))
  const eligible = here.filter((m) => !m.isChip && !chipped.has(m.view))
  return { chips, initials: eligible.filter((m, i) => eligible.findIndex((x) => x.by_id === m.by_id) === i) }
}

/** The other views on an open chip's card, each once, in core's order: the ones that chip does not gather. */
export function otherViewsOn(marks: readonly RevealMarkPick[], card: string, gathered: readonly number[]): number[] {
  return [...new Set(marks.filter((m) => m.card === card && !gathered.includes(m.view)).map((m) => m.view))]
}

/** The views among `lead` core ran a figure of (any effect). */
export function withEffects<V>(lead: readonly V[], effects: (v: V) => readonly unknown[]): V[] {
  return lead.filter((v) => effects(v).length > 0)
}

/** The evidence on a card that no chip there already gathers. */
export function evidenceOffChips<E extends { readonly id: number }>(items: readonly E[], chipped: ReadonlySet<number>): E[] {
  return items.filter((e) => !chipped.has(e.id))
}

/** Core's chain split into its observation lines and the steps after them, each in core's order. */
export function chainParts<S extends { readonly level: string }>(steps: readonly S[]): { readonly seen: readonly S[]; readonly rest: readonly S[] } {
  return { seen: steps.filter((st) => st.level === 'observation'), rest: steps.filter((st) => st.level !== 'observation') }
}

/** The members other than the viewer, in core's order. */
export function othersOf(view: View): View['members'] {
  return view.members.filter((m) => m.id !== view.you_id)
}

/** Every item of a list but one, in its order. */
export function allBut<T>(list: readonly T[], x: T): T[] {
  return list.filter((y) => y !== x)
}

type LinkMarkOf = NonNullable<View['collab']['link_marks']>[number]
/** Core's link marks kept off the line (`line: false`): the ones drawn on the card core names (`card`), in its chip rail (RevealMarks). */
export function cardLinkMarksOf(view: View | null, card: string): LinkMarkOf[] {
  return view?.collab.link_marks?.filter((m) => !m.line && m.card === card) ?? []
}

/** The team's link differences (TM-04) on a link core does not mark: a link core marks is drawn once, by its mark (core's link_marks fold
 *  the served doubt chip), never again as a difference. */
export function unmarkedDiffers<D extends { readonly record: string }>(view: View | null, differs: readonly D[]): D[] {
  const marked = new Set((view?.collab.link_marks ?? []).map((m) => m.link.record))
  return differs.filter((d) => !marked.has(d.record))
}

/**
 * TM-27, TRY A FIGURE IN PLACE (the approved J5 TryRange comp; DL 10 Nov: "a person changes one number and watches the chance move"). What a
 * try on a copy (core's what-if, whatif.ts: nothing saved, no AI call) draws on one card's face: on the card tried, the figure as the person
 * typed it, core's words for the edit and core's own refusal when it could not run; on each option, the copy's lead chance row in core's row
 * shape, beside its saved headline. Every word is core's or the person's. Null where the try says nothing on this card.
 */
export type TryOnCard =
  | { kind: 'option'; row: ChanceRow; words: string }
  | { kind: 'tried'; typed: string; words: string; said: string | null }
type ChanceRow = Extract<ViewRow, { kind: 'chance' }>
export function tryOnCardOf(variant: WhatIfVariant, quantity: string, typed: string, card: ViewCard): TryOnCard | null {
  const words = variant.edits.map((e) => e.words).join(' ')
  if (card.id === quantity) return { kind: 'tried', typed, words, said: variant.blocked ?? variant.stopped ?? null }
  if (card.family !== 'option' || variant.blocked !== null || variant.stopped !== null) return null
  const rows = variant.rows.find((o) => o.option_id === card.id)?.rows ?? []
  const row = rows.find((r): r is ChanceRow => r.kind === 'chance')
  return row === undefined ? null : { kind: 'option', row, words }
}

/** SCI-13: core's size lines (`variants[].size`) for one option, each with its place in `size` (its View path), in core's order; none with
 *  no words. Picking by the option's id only: the lines are drawn verbatim, nothing in them is read. */
export const sizeLinesOf = <T extends { option: string; line: string }>(size: readonly T[] | undefined, option: string): { s: T; k: number }[] =>
  (size ?? []).map((s, k) => ({ s, k })).filter(({ s }) => s.option === option && s.line !== '')

/** The narrowest a card is drawn when the stage is narrow (DL-538: the target at 1128 draws five options across at about 145px). */
export const CARD_MIN_W = 140
/** The readable floor the row is sized for (camera.ts READABLE_WHOLE_ZOOM: 11px text over 12px), kept here so layout does not import the camera. */
const READABLE_FLOOR = 11 / 12
/**
 * DL-538 (14 Nov, the target screen): the board's rows are sized to the stage. The card width (and the row gap) are the ones at which the
 * widest row of options fits the free canvas across (`roomW`, ViewCanvas's insets) at the readable floor: the full card and the full gap
 * where they fit, else the layout's node gap and a card between CARD_MIN_W and the full card. The question bar spans that row. A stage
 * too narrow even at CARD_MIN_W pans (the camera never shrinks the board to a zoomed-out face).
 */
export function stageRow(model: ViewModel, roomW: number): { cardW: number; gapX: number } {
  const n = Math.max(1, allOptionCards(model).length), room = roomW / READABLE_FLOOR
  if (roomW <= 0 || n * W + (n - 1) * ROW_GAP_X <= room) return { cardW: W, gapX: ROW_GAP_X }
  return { cardW: Math.max(CARD_MIN_W, Math.min(W, Math.floor((room - (n - 1) * LAYOUT_NODE_GAP) / n))), gapX: LAYOUT_NODE_GAP }
}
/** The question bar's width over a row of options: the whole row. */
export const questionBarWidth = (model: ViewModel, row: { cardW: number; gapX: number }): number => { const n = Math.max(1, allOptionCards(model).length); return n * row.cardW + (n - 1) * row.gapX }
