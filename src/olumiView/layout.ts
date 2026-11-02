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

/** Core's own page geometry (olumi-core src/page/graph.ts): card width and the gaps between columns and cards, and the top margin. */
const W = 232, GAP_X = 48, GAP_Y = 14, TOP = 112

/**
 * Where each card sits on the canvas, as core's page places it (olumi-core src/page/main.ts `drawModel`): in its column (`col`), stacked
 * down that column in the View's order, each card its height (`h`) below the last; the first column starts lower when the model has
 * reasoning about the whole question (`whole`). Nothing is measured here and no card is moved by another rule.
 */
export function cardPlaces(model: ViewModel): Map<string, { x: number; y: number }> {
  const ys = new Map<number, number>(), places = new Map<string, { x: number; y: number }>()
  for (const c of model.cards) {
    const y = ys.get(c.col) ?? TOP + (c.col === 0 && model.whole ? 20 : 0)
    places.set(c.id, { x: 16 + c.col * (W + GAP_X), y })
    ys.set(c.col, y + c.h + GAP_Y)
  }
  return places
}

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
