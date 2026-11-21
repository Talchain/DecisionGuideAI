/**
 * V12 Simple bands (pure). Which band a drawn card stands in, the fixed band words, which figures no link touches, and which cards lie on a
 * selected card's causal path. Geometry and picking only: the words here are the boards' notation chrome (decided by the lead), never core's.
 */
import type { ViewCard, ViewModel } from '../../client'
import { cardLinks, drawKindOf, QUESTION } from '../../layout'
import { linkRole } from '../contract'
import { MODEL_GROUP_TITLE } from '../../../canvas/domain/vocabulary'
import { cardKind } from '../fields/fields'

export type BandId = 'options' | 'inputs' | 'outcomes' | 'aims' | 'points' | 'ideas'
/** Top to bottom. Aims are always their own row, never sharing the outcomes row. The points raised stand under the causal story (options, drivers,
 *  what happens, aims), never inside it (DL 21 Nov, Paul read notes in the drivers' row as drivers). */
export const BAND_ORDER: readonly BandId[] = ['options', 'inputs', 'outcomes', 'aims', 'points', 'ideas']
export type BandShape = 'square' | 'pill' | 'double' | 'diamond' | 'note' | 'idea'
/** Decided UI chrome (Funding-Working / Main boards): the label and the small shape icon of each band. */
export const BANDS: Readonly<Record<BandId, { label: string; shape: BandShape }>> = {
  options: { label: 'Options you could take', shape: 'square' },
  inputs: { label: 'What drives it (uncertain)', shape: 'pill' },
  outcomes: { label: 'What happens (worked out)', shape: 'double' },
  aims: { label: 'Aims', shape: 'diamond' },
  points: { label: 'Points raised', shape: 'note' },
  ideas: { label: 'Kept ideas', shape: 'idea' }, // neutral for every reader, as the panel's heading (Codex root 10:34:38Z; DL 11:3xZ)
}
/** The band's label: fixed, except the outcomes band holding a risk, which is "Outcomes & risks", the product's own label for that row
 *  (canvas/domain/vocabulary MODEL_GROUP_TITLE; the lead's D5, 17 Nov: a risk core cannot size is not "worked out"). The inputs band says "What drives
 *  it" always: only drivers stand there (`bandOf`); a card associated with the question by reasons alone stands under "Points raised" (Codex 019). */
export function bandLabelOf(band: BandId, model: ViewModel | null): string {
  // The ideas strip reads "Kept ideas" for every reader; each card says who kept it, from core's `kept_by` (ideaProvenance).
  if (band === 'outcomes' && model !== null && model.cards.some((c) => c.family === 'risk' && bandOf(c, model) === 'outcomes')) return MODEL_GROUP_TITLE.outcomesRisks
  return BANDS[band].label
}
/** Group an inputs band folds at (rule 7). */
export const FOLD_AT = 15

/** Node ids of cards this lane adds beside the model's: the kept ideas and the folded inputs' group. */
export const IDEA_PREFIX = 'idea:'
export const FOLD_ID = 'group:inputs'

/** The band a model card stands in: options; outcomes and risks (worked out); aims and limits; a driver (a figure, or a card in a causal link)
 *  an input; the rest are points raised. A note or a reported position (core's kind, fields.ts cardKind) is a point raised always, and so is any
 *  other card associated with the question by reasons alone (a link that is not a reason and not a size makes a cause; Codex 019): DL 21 Nov,
 *  Paul read the notes in "What drives it" as drivers. */
export function bandOf(card: ViewCard, model: ViewModel): Exclude<BandId, 'ideas'> {
  const k = drawKindOf(card, model)
  if (k === 'option') return 'options'
  if (k === 'outcome' || k === 'risk') return 'outcomes'
  if (k === 'goal' || k === 'constraint') return 'aims'
  if (card.family === 'quantity') return 'inputs'
  const kind = cardKind(card, model).kind
  if (kind === 'note' || kind === 'position') return 'points'
  return causalIds(model).has(card.id) ? 'inputs' : 'points'
}
/** The cards at either end of a causal link (a drawn link that is not a reason and not a size). */
const causalIds = (model: ViewModel): ReadonlySet<string> =>
  new Set(cardLinks(model).flatMap(({ link }) => (link.kind === 'reason' || linkRole(link) === 'size' ? [] : [link.from, link.to])))

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
