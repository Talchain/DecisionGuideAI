/**
 * THE ONE LAYOUT MODULE (View API design §3). The only place in src/olumiView/ that may pick, place or measure View values: which cards a
 * surface draws, and coordinate arithmetic. It never writes a word, formats a figure, orders what the View ordered, or joins strings:
 * core did all of that. Everything else here draws View strings exactly as they arrive (src/olumiView/__tests__/contract.spec.tsx).
 */
import type { ViewCard, ViewModel } from './client'

/**
 * The option cards core compares, in the View's own order: what the chances block draws. An option core does not compare carries its
 * status on its card ("removed", "ruled out"); it has no chance to show, and the block leaves it out as the base does (review 00051).
 */
export const optionCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.family === 'option' && c.status === null)

/** The cards whose figure the person may set, in the View's own order: core offers `figure.edit` only there, and only while no proposal is held. */
export const settableFigures = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.figure?.edit)

/** Core's own page geometry (olumi-core src/page/graph.ts): card width and the gaps between columns and cards, and the top margin. */
const W = 232, GAP_X = 48, GAP_Y = 14, TOP = 112

/** A View card's width on the canvas: core's page card (review 00063 #4). */
export const CARD_WIDTH = W

type At = { x: number; y: number }
/**
 * Where each card sits on the canvas, as core's page places it (olumi-core src/page/main.ts `drawModel`): in its column (`col`), stacked
 * down that column in the View's order; the first column starts lower when the model has reasoning about the whole question (`whole`).
 * Each card takes its drawn height (`drawn`, what the canvas measured), never less than core's `h`, so a long card pushes the next one
 * down (review 00063 #4). A card in `kept` (one the person moved) stays where it is, and no other card is put on it: a card that
 * would overlap it goes below it, and the rest of its column after (00063 #1).
 */
export function cardPlaces(model: ViewModel, drawn: ReadonlyMap<string, number> = new Map(), kept: ReadonlyMap<string, At> = new Map()): Map<string, At> {
  const height = (id: string, h: number) => Math.max(h, drawn.get(id) ?? 0)
  const held = model.cards.flatMap((c) => (kept.has(c.id) ? [{ ...kept.get(c.id)!, h: height(c.id, c.h) }] : []))
  const ys = new Map<number, number>(), places = new Map<string, At>()
  for (const c of model.cards) {
    if (kept.has(c.id)) { places.set(c.id, kept.get(c.id)!); continue }
    const x = 16 + c.col * (W + GAP_X), h = height(c.id, c.h)
    let y = ys.get(c.col) ?? TOP + (c.col === 0 && model.whole ? 20 : 0)
    for (let hit = held.find((k) => k.x < x + W && x < k.x + W && k.y < y + h && y < k.y + k.h); hit !== undefined; hit = held.find((k) => k.x < x + W && x < k.x + W && k.y < y + h && y < k.y + k.h)) y = hit.y + hit.h + GAP_Y
    places.set(c.id, { x, y })
    ys.set(c.col, y + h + GAP_Y)
  }
  return places
}

/** The heights the canvas measured for the nodes it drew, by id (React Flow's `measured`). */
export const drawnHeights = (nodes: readonly { id: string; measured?: { height?: number } }[]): Map<string, number> =>
  new Map(nodes.flatMap((n) => (typeof n.measured?.height === 'number' ? [[n.id, n.measured.height] as const] : [])))

/** A key that changes when any measured height does: the canvas re-places its cards then. */
export const drawnHeightsKey = (nodes: readonly { id: string; measured?: { height?: number } }[]): string =>
  nodes.map((n) => `${n.id}:${n.measured?.height ?? ''}`).join('|')

/** The canvas kind a View card's Olumi controls ask as (its family is core's id, never shown): every card can be challenged, as on core's page. */
export const askKindOf = (family: string): 'factor' | 'risk' | 'goal' | 'option' | 'constraint' =>
  family === 'risk' || family === 'goal' || family === 'option' ? family : family === 'limit' ? 'constraint' : 'factor'

/** The question's card on core's page (olumi-core src/view/model.ts QUESTION): what a link to the question as a whole ends at. */
export const QUESTION = 'page:question'

/** Where the question sits, as core's page places it (`drawModel`): across the top, as wide as the columns, at most 900px. */
export function questionPlace(model: ViewModel): { x: number; y: number; width: number } {
  const cols = Math.max(0, ...model.cards.map((c) => c.col)) + 1
  return { x: 16, y: 12, width: Math.min(Math.max(740, 48 + cols * (W + GAP_X) - GAP_X) - 40, 900) }
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
