/**
 * THE ONE LAYOUT MODULE (View API design §3). The only place in src/olumiView/ that may pick, place or measure View values: which cards a
 * surface draws, and coordinate arithmetic. It never writes a word, formats a figure, orders what the View ordered, or joins strings:
 * core did all of that. Everything else here draws View strings exactly as they arrive (src/olumiView/__tests__/contract.spec.tsx).
 */
import type { Edge, Node } from '@xyflow/react'
import type { ViewCard, ViewModel, ViewRow } from './client'
import { layoutGraph } from '../canvas/utils/layout'
import { wrapTiers } from '../canvas/utils/wrapTiers'

/** Every option card in the View's order, live or not (the Summary shows a withheld option's status and reason too). */
export const allOptionCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.family === 'option')
/**
 * The option cards core compares, in the View's own order: what the chances block draws. An option core does not compare carries its
 * status on its card ("removed", "ruled out"); it has no chance to show, and the block leaves it out as the base does (review 00051).
 */
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

/** Core's key item for Olumi's mark (`model.key`, "Olumi") and its place in the key, or null when the View carries none. */
export function olumiKey(model: ViewModel): { glyph: string; text: string; i: number } | null {
  const i = (model.key ?? []).findIndex((k) => k.text === 'Olumi')
  return i < 0 ? null : { ...model.key[i]!, i }
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
  const laid = await layoutGraph(nodes, edges, { direction: 'DOWN' })
  // A tier wider than four cards wraps (DL 4 Nov), so the board reads at fit as the original canvas does.
  const sized = new Map(nodes.map((n) => [n.id, n.measured as Size]))
  return wrapTiers(laid.nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, ...sized.get(n.id)! })))
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
  const picked = model.cards.filter((c) => (c.figure?.edit ?? null) !== null || c.family === 'assumption' || c.family === 'condition')
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

/** The DGAI node kind a View card is drawn as on the canvas (the original look): a figure a person sets is a factor, one core works out
 *  from others (no edit) an outcome; the rest as `askKindOf`. */
export const drawKindOf = (c: ViewCard): 'factor' | 'outcome' | 'risk' | 'goal' | 'option' | 'constraint' =>
  c.family === 'quantity' && c.figure !== null && (c.figure.edit ?? null) === null ? 'outcome' : askKindOf(c.family)
const PREFIX: Record<string, string> = { option: 'O', factor: 'F', outcome: 'OC', risk: 'R', constraint: 'C' }
/** Each card's number as the original canvas numbers them (O1, F1, OC1, …), per kind in the View's order; an assumption or condition
 *  is A1, …; the aim has none. */
export function cardNumbersOf(model: ViewModel): ReadonlyMap<string, string> {
  const seen = new Map<string, number>(), out = new Map<string, string>()
  for (const c of model.cards) {
    const p = c.family === 'assumption' || c.family === 'condition' ? 'A' : PREFIX[drawKindOf(c)]
    if (p === undefined) continue
    const n = (seen.get(p) ?? 0) + 1
    seen.set(p, n)
    out.set(c.id, `${p}${n}`)
  }
  return out
}

/** The top of the causal graph, which the camera centres on when a board is too large to read whole: the question and the options. */
export const headOf = (model: ViewModel): ReadonlySet<string> => new Set([QUESTION, ...model.cards.filter((c) => c.family === 'option').map((c) => c.id)])
