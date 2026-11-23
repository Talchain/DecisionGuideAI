/**
 * V12 Simple bands (pure). Which band a drawn card stands in, the fixed band words, which figures no link touches, and which cards lie on a
 * selected card's causal path. Geometry and picking only: the words here are the boards' notation chrome (decided by the lead), never core's.
 */
import type { ViewCard, ViewModel } from '../../client'
import { cardLinks, drawKindOf, legacyDrawKindOf, QUESTION } from '../../layout'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { declaredCardKind, type CardKindName } from '../fields/fields'
import { linkRole } from '../contract'
import { MODEL_GROUP_TITLE } from '../../../canvas/domain/vocabulary'

export type BandId = 'options' | 'inputs' | 'outcomes' | 'aims' | 'points' | 'ideas'
/** Top to bottom. Aims are always their own row, never sharing the outcomes row. The points raised stand under the causal story (options, drivers,
 *  what happens, aims), never inside it (DL 21 Nov, Paul read notes in the drivers' row as drivers). */
export const BAND_ORDER: readonly BandId[] = ['options', 'inputs', 'outcomes', 'aims', 'points', 'ideas']
export const BANDS: Readonly<Record<BandId, { label: string }>> = {
  options: { label: 'Options you could take' },
  inputs: { label: 'What drives it (uncertain)' },
  outcomes: { label: 'What happens (worked out)' },
  aims: { label: 'Aims' },
  points: { label: 'Points raised' },
  ideas: { label: 'Kept ideas' },
}
/** Name the risk explicitly when one shares the outcomes band. */
export function bandLabelOf(band: BandId, model: ViewModel | null): string {
  // The ideas strip reads "Kept ideas" for every reader; each card says who kept it, from core's `kept_by` (ideaProvenance).
  if (band === 'outcomes' && model !== null && model.cards.some((c) => bandOf(c, model) === 'outcomes' && drawKindOf(c, model) === 'risk')) return MODEL_GROUP_TITLE.outcomesRisks
  return BANDS[band].label
}
/** Group an inputs band folds at (rule 7). */
export const FOLD_AT = 15

/** Node ids of cards this lane adds beside the model's: the kept ideas and the folded inputs' group. */
export const IDEA_PREFIX = 'idea:'
export const FOLD_ID = 'group:inputs'

type CardBand = Exclude<BandId, 'ideas'>
const ROW_OF_KIND: Readonly<Record<CardKindName, CardBand>> = {
  option: 'options', result: 'outcomes', risk: 'outcomes', aim: 'aims', driver: 'inputs', position: 'points', note: 'points',
}

/** A supplied but unknown kind stands among the points raised. An omitted key leaves placement to the legacy rule. */
export function rowOfKind(card: ViewCard): CardBand | undefined {
  const kind = declaredCardKind(card)
  return kind === undefined ? undefined : ROW_OF_KIND[kind ?? 'note']
}

export function bandOf(card: ViewCard, model: ViewModel): CardBand {
  const row = isOlumiCoreLane() ? rowOfKind(card) : undefined
  if (row !== undefined) return row
  const k = legacyDrawKindOf(card, model)
  return k === 'option' ? 'options' : k === 'outcome' || k === 'risk' ? 'outcomes' : k === 'goal' || k === 'constraint' ? 'aims' : card.family === 'quantity' ? 'inputs' : 'points'
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
