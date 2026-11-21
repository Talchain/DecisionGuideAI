/** Card grouping, labels, fold state and causal-path highlighting for Simple. */
import type { ViewCard, ViewModel } from '../../client'
import { cardLinks, drawKindOf, QUESTION } from '../../layout'
import { linkRole } from '../contract'
import { MODEL_GROUP_TITLE } from '../../../canvas/domain/vocabulary'

export type BandId = 'options' | 'inputs' | 'outcomes' | 'aims' | 'points' | 'ideas'
/** Points raised sit below the causal rows so supporting notes cannot be read as drivers. */
export const BAND_ORDER: readonly BandId[] = ['options', 'inputs', 'outcomes', 'aims', 'points', 'ideas']
export type BandShape = 'square' | 'pill' | 'double' | 'diamond' | 'note' | 'idea'
export const BANDS: Readonly<Record<BandId, { label: string; shape: BandShape }>> = {
  options: { label: 'Options you could take', shape: 'square' },
  inputs: { label: 'What drives it (uncertain)', shape: 'pill' },
  outcomes: { label: 'What happens (worked out)', shape: 'double' },
  aims: { label: 'Aims', shape: 'diamond' },
  points: { label: 'Points raised', shape: 'note' },
  ideas: { label: 'Kept ideas', shape: 'idea' },
}
/** Give outcomes a risk-aware label when the band actually contains a risk. */
export function bandLabelOf(band: BandId, model: ViewModel | null): string {
  if (band === 'outcomes' && model !== null && model.cards.some((c) => c.family === 'risk' && bandOf(c, model) === 'outcomes')) return MODEL_GROUP_TITLE.outcomesRisks
  return BANDS[band].label
}
export const FOLD_AT = 15

/** Synthetic IDs for the kept-ideas strip and the folded inputs group. */
export const IDEA_PREFIX = 'idea:'
export const FOLD_ID = 'group:inputs'

/** An unlinked quantity still belongs to inputs. Supporting notes belong to Points raised. */
export function bandOf(card: ViewCard, model: ViewModel): Exclude<BandId, 'ideas'> {
  const k = drawKindOf(card, model)
  return k === 'option' ? 'options' : k === 'outcome' || k === 'risk' ? 'outcomes' : k === 'goal' || k === 'constraint' ? 'aims' : card.family === 'quantity' ? 'inputs' : 'points'
}

export const inputIdsOf = (model: ViewModel): string[] => model.cards.filter((c) => bandOf(c, model) === 'inputs').map((c) => c.id)

export const foldsInputs = (model: ViewModel): boolean => inputIdsOf(model).length >= FOLD_AT

/** Omit folded inputs and their incident links from layout. */
export function withoutInputs(model: ViewModel): ViewModel {
  const gone = new Set(inputIdsOf(model))
  return { ...model, cards: model.cards.filter((c) => !gone.has(c.id)), links: model.links.filter((l) => !gone.has(l.from) && !gone.has(l.to)) }
}

/** Figures (quantities) that no drawn link touches: each is marked "not linked". A link to the question does not count as a figure's link. */
export function unlinkedIds(model: ViewModel): string[] {
  const touched = new Set<string>()
  for (const { link } of cardLinks(model)) { touched.add(link.from); touched.add(link.to) }
  return model.cards.filter((c) => c.family === 'quantity' && !touched.has(c.id)).map((c) => c.id)
}

/**
 * The cards on `selected`'s causal path: it, every card it is reached from through the links drawn (causes, and their causes) and every card
 * it reaches (effects, and theirs). A size link rides on another link and carries no cause; a reason link is a reason, not a cause. Null when
 * the selected card has no neighbour to follow (nothing is dimmed then).
 */
export function causalPathOf(model: ViewModel, selected: string | null): ReadonlySet<string> | null {
  if (selected === null || selected === QUESTION) return null
  const out = new Map<string, string[]>(), into = new Map<string, string[]>()
  for (const { link } of cardLinks(model)) {
    if (link.kind === 'reason' || linkRole(link) === 'size') continue
    out.set(link.from, [...(out.get(link.from) ?? []), link.to])
    into.set(link.to, [...(into.get(link.to) ?? []), link.from])
  }
  const path = new Set<string>([selected])
  for (const next of [out, into]) {
    const todo = [selected]
    for (let id = todo.pop(); id !== undefined; id = todo.pop()) for (const n of next.get(id) ?? []) if (!path.has(n)) { path.add(n); todo.push(n) }
  }
  return path.size > 1 ? path : null
}
