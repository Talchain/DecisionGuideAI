/**
 * V12 Simple bands (pure). Which band a drawn card stands in, the fixed band words, which figures no link touches, and which cards lie on a
 * selected card's causal path. Geometry and picking only: the words here are the boards' notation chrome (decided by the lead), never core's.
 */
import type { ViewCard, ViewModel } from '../../client'
import { cardLinks, drawKindOf, QUESTION } from '../../layout'
import { linkRole } from '../contract'

export type BandId = 'options' | 'inputs' | 'outcomes' | 'aims' | 'ideas'
/** Top to bottom. Aims are always their own row, never sharing the outcomes row. */
export const BAND_ORDER: readonly BandId[] = ['options', 'inputs', 'outcomes', 'aims', 'ideas']
export type BandShape = 'square' | 'pill' | 'double' | 'diamond' | 'idea'
/** Decided UI chrome (Funding-Working / Main boards): the label and the small shape icon of each band. */
export const BANDS: Readonly<Record<BandId, { label: string; shape: BandShape }>> = {
  options: { label: 'Options you could take', shape: 'square' },
  inputs: { label: 'What drives it (uncertain)', shape: 'pill' },
  outcomes: { label: 'What happens (worked out)', shape: 'double' },
  aims: { label: 'Aims', shape: 'diamond' },
  ideas: { label: 'Ideas you kept', shape: 'idea' },
}
/** The inputs band's neutral label, where nothing in it takes part in a causal link (Codex 019, 18:19Z): readings of success, reported
 *  positions and other notes are associated with the question by reasons, not drivers of it, so "What drives it" would claim a cause. */
export const INPUTS_ASSOCIATED_LABEL = 'Points raised'
/** The band's label for this model: the inputs band says "What drives it" only where one of its cards is in a causal link (a link that is not a
 *  reason and not a size); otherwise its neutral label. Every other band keeps its fixed label. */
export function bandLabelOf(band: BandId, model: ViewModel | null): string {
  if (band !== 'inputs' || model === null) return BANDS[band].label
  const inputs = new Set(inputIdsOf(model))
  const causal = cardLinks(model).some(({ link }) => link.kind !== 'reason' && linkRole(link) !== 'size' && (inputs.has(link.from) || inputs.has(link.to)))
  return causal ? BANDS.inputs.label : INPUTS_ASSOCIATED_LABEL
}
/** Group an inputs band folds at (rule 7). */
export const FOLD_AT = 15

/** Node ids of cards this lane adds beside the model's: the kept ideas and the folded inputs' group. */
export const IDEA_PREFIX = 'idea:'
export const FOLD_ID = 'group:inputs'

/** The band a model card stands in: options; outcomes and risks (worked out); aims and limits; every other figure an input. */
export function bandOf(card: ViewCard, model: ViewModel): Exclude<BandId, 'ideas'> {
  const k = drawKindOf(card, model)
  return k === 'option' ? 'options' : k === 'outcome' || k === 'risk' ? 'outcomes' : k === 'goal' || k === 'constraint' ? 'aims' : 'inputs'
}

/** The ids of the input cards (the band rule 7 folds). */
export const inputIdsOf = (model: ViewModel): string[] => model.cards.filter((c) => bandOf(c, model) === 'inputs').map((c) => c.id)

/** Whether Simple folds the inputs: 15 or more of them. */
export const foldsInputs = (model: ViewModel): boolean => inputIdsOf(model).length >= FOLD_AT

/** The model with the folded inputs and every link that touches one left out (what the board draws while they are folded). */
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
