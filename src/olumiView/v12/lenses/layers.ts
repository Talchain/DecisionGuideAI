/**
 * V12 LAYERS (production's lens list, rebuilt for the core lane; OPEN-FINDINGS row 8). Pure derivation from core's View only: every word about the
 * scenario (headings, authors, sentences) is the View's, every figure is a field the View holds, and nothing is worked out here that a card or
 * link does not already say. A layer annotates or re-weights the canvas and writes nothing. It is separate from R24's lens bar (`lens.ts`,
 * frozen): its own ids, its own store.
 *
 * Left out on purpose: comparable link strength (core reserves `strength.share`/`relative_to` as null) and Robustness (the View has no field named
 * for it; `run.tipping` is "what would have to be true", a different finding, so it is not relabelled).
 */
import type { View, ViewCard, ViewLink, ViewModel } from '../../client'
import { driverLinksOf, driversOf, optionCards } from '../../layout'

export type LayerId = 'full' | 'sensitivity' | 'sensitive_assumptions' | 'causal' | 'evidence' | `option:${string}`
export const OPTION_PREFIX = 'option:'
export const optionLayerId = (card: string): LayerId => `${OPTION_PREFIX}${card}`
export const optionOfLayer = (layer: LayerId): string | null => (layer.startsWith(OPTION_PREFIX) ? layer.slice(OPTION_PREFIX.length) : null)

/** Chrome words: the names of the layers themselves. An option's entry is that card's heading, the View's words. */
export const LAYER_LABEL = {
  full: 'Full model', sensitivity: 'Sensitivity', sensitive_assumptions: 'Sensitive assumptions', causal: 'Causal graph', evidence: 'Evidence quality',
} as const

export interface LayerEntry { id: LayerId; label: string; kind: 'full' | 'option' | 'analysis' }

/** The card that draws a record: the card with that id, else the card whose badge folds it. */
export const cardOfRecord = (model: ViewModel, record: string): ViewCard | undefined =>
  model.cards.find((c) => c.id === record) ?? model.cards.find((c) => c.badge?.records.includes(record) === true)

/** Olumi's own: core's author for the card, else its mark. */
export const isOlumis = (c: ViewCard): boolean => (c.author != null ? c.author.by === 'olumi' || c.author.by === 'mixed' : c.olumi !== null)

/** The figure cards: the ones that carry a figure a person can read or set. */
export const figureCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.figure !== null && c.status === null)

export type Basis = 'grounded' | 'challenged' | 'unclear' | 'assumed' | 'nodata'
/**
 * What each state says: only what is attached, never a judgement of its quality (Codex 006: "Grounded" claimed more than a stance count
 * establishes). Authorship stays its own mark (the card's glyph); "(Olumi's)" only separates the two no-evidence groups in the lens list.
 */
export const BASIS_LABEL: Record<Basis, string> = { grounded: 'Has supporting evidence', challenged: 'Has challenging evidence', unclear: 'Evidence unclear', assumed: "No attached evidence (Olumi's)", nodata: 'No attached evidence' }
export const BASIS_ORDER: readonly Basis[] = ['grounded', 'challenged', 'unclear', 'assumed', 'nodata']

/**
 * Evidence quality from the View's own fields, read by the stance the person gave each piece of evidence (`evidence[].stance`).
 * Grounded: evidence attached to the figure (`evidence[].concerns`) and every piece of it supports. Challenged: any piece challenges it (even beside
 * supporting ones: the challenge is never hidden under a Grounded). Evidence unclear: attached, but only unclear (or a stance this build does not
 * know). Assumed: no evidence, and the figure is Olumi's (core's author). No data: no evidence and the figure is not Olumi's.
 */
export function evidenceOf(view: View): { basis: ReadonlyMap<string, Basis>; grounded: number; challenged: number; figures: number; olumiLinks: number } {
  const model = view.model
  if (model === null) return { basis: new Map(), grounded: 0, challenged: 0, figures: 0, olumiLinks: 0 }
  const stances = new Map<string, Set<string>>()
  for (const e of view.evidence) for (const r of e.concerns) {
    const c = cardOfRecord(model, r)
    if (c !== undefined) { const set = stances.get(c.id) ?? new Set<string>(); set.add(e.stance); stances.set(c.id, set) }
  }
  const basis = new Map<string, Basis>()
  for (const c of figureCards(model)) {
    const st = stances.get(c.id)
    basis.set(c.id, st === undefined ? (isOlumis(c) ? 'assumed' : 'nodata')
      : st.has('challenges') ? 'challenged'
      : [...st].every((x) => x === 'supports') ? 'grounded' : 'unclear')
  }
  const count = (b: Basis) => [...basis.values()].filter((x) => x === b).length
  return {
    basis, figures: basis.size, grounded: count('grounded'), challenged: count('challenged'),
    olumiLinks: model.links.filter((l) => l.causal != null && (l.causal.author?.by === 'olumi' || l.causal.author?.by === 'mixed')).length,
  }
}

/** Cards that carry a figure an option's chance moves most with (core's `driver.figure`), with the options each moves. */
export const sensitivityOf = (model: ViewModel): ReadonlyMap<string, readonly ViewCard[]> => driversOf(model)

/** The sensitive figures that are Olumi's: the ones to check first. */
export function sensitiveAssumptionsOf(model: ViewModel): ReadonlyMap<string, readonly ViewCard[]> {
  const out = new Map<string, readonly ViewCard[]>()
  for (const [id, options] of driversOf(model)) { const c = model.cards.find((x) => x.id === id); if (c !== undefined && isOlumis(c)) out.set(id, options) }
  return out
}

export const hasCausal = (model: ViewModel): boolean => model.links.some((l) => l.causal != null)

/** The entries the menu lists: only the layers the View can fill. Robustness is never listed (see the file head). */
export function layerEntries(view: View | null): LayerEntry[] {
  const model = view?.model ?? null
  if (view === null || model === null) return []
  const out: LayerEntry[] = [{ id: 'full', label: LAYER_LABEL.full, kind: 'full' }]
  for (const o of optionCards(model)) out.push({ id: optionLayerId(o.id), label: o.heading, kind: 'option' })
  if (sensitivityOf(model).size > 0) out.push({ id: 'sensitivity', label: LAYER_LABEL.sensitivity, kind: 'analysis' })
  if (sensitiveAssumptionsOf(model).size > 0) out.push({ id: 'sensitive_assumptions', label: LAYER_LABEL.sensitive_assumptions, kind: 'analysis' })
  if (hasCausal(model)) out.push({ id: 'causal', label: LAYER_LABEL.causal, kind: 'analysis' })
  if (figureCards(model).length > 0) out.push({ id: 'evidence', label: LAYER_LABEL.evidence, kind: 'analysis' })
  return out
}

/** The cards on an option's paths: the option, the figures it sets, what each leads to along the View's links, and what it is said to rest on (reason links into it). */
export function optionPathOf(model: ViewModel, option: string): { cards: ReadonlySet<string>; links: ReadonlySet<number> } {
  const start = model.cards.find((c) => c.id === option)
  if (start === undefined) return { cards: new Set(), links: new Set() }
  const cards = new Set<string>([option]), links = new Set<number>()
  const options = new Set(model.cards.filter((c) => c.family === 'option').map((c) => c.id))
  for (const s of start.sets ?? []) { const c = cardOfRecord(model, s.id); if (c !== undefined) cards.add(c.id) }
  const queue = [...cards]
  while (queue.length > 0) {
    const at = queue.shift()!
    model.links.forEach((l: ViewLink, i) => {
      if (l.from !== at || l.kind === 'reason') return
      if (options.has(l.to) && l.to !== option) return
      links.add(i)
      if (!cards.has(l.to)) { cards.add(l.to); queue.push(l.to) }
    })
  }
  model.links.forEach((l, i) => { if (l.to === option && l.kind === 'reason') { links.add(i); cards.add(l.from) } })
  return { cards, links }
}

/** How the canvas is annotated by a layer: which cards and links stand out, which fall back, and a tag on a card. */
export interface LayerMarks {
  readonly layer: LayerId
  readonly on: ReadonlySet<string>
  readonly tags: ReadonlyMap<string, string>
  readonly basis: ReadonlyMap<string, Basis>
  readonly links: ReadonlySet<number>
  /** The sign each causal link carries, by link index (only links the View types). */
  readonly signs: ReadonlyMap<number, NonNullable<ViewLink['causal']>['sign']>
  /** True when cards outside `on` fall back (everything but Causal graph and Evidence quality, which annotate every card they speak about). */
  readonly dim: boolean
}
const NONE: ReadonlySet<never> = new Set()

export function marksOf(view: View | null, layer: LayerId): LayerMarks | null {
  const model = view?.model ?? null
  if (view === null || model === null || layer === 'full') return null
  const base = { layer, on: NONE as ReadonlySet<string>, tags: new Map<string, string>(), basis: new Map<string, Basis>(), links: NONE as ReadonlySet<number>, signs: new Map<number, never>(), dim: false }
  const option = optionOfLayer(layer)
  if (option !== null) { const p = optionPathOf(model, option); return { ...base, on: p.cards, links: p.links, dim: true } }
  if (layer === 'sensitivity' || layer === 'sensitive_assumptions') {
    const drivers = layer === 'sensitivity' ? sensitivityOf(model) : sensitiveAssumptionsOf(model)
    const tags = new Map<string, string>()
    for (const [id, options] of drivers) tags.set(id, options.map((o) => o.heading).join(' · '))
    return { ...base, on: new Set(drivers.keys()), tags, links: layer === 'sensitivity' ? driverLinksOf(model, drivers) : NONE, dim: true }
  }
  if (layer === 'causal') {
    const signs = new Map<number, NonNullable<ViewLink['causal']>['sign']>()
    model.links.forEach((l, i) => { if (l.causal != null) signs.set(i, l.causal.sign) })
    return { ...base, links: new Set(signs.keys()), signs }
  }
  const e = evidenceOf(view)
  return { ...base, basis: e.basis, on: new Set(e.basis.keys()) }
}

/** The sign as chrome words; the View's enum, converted once. */
export const SIGN_WORDS = { increases: 'Increases', decreases: 'Decreases', none: 'No effect', unknown: 'Direction not said' } as const
export const SIGN_GLYPH = { increases: '+', decreases: '−', none: '0', unknown: '?' } as const

export interface EdgeRow { index: number; from: string; to: string; sign: NonNullable<ViewLink['causal']>['sign']; strength: string | null; disputed: boolean; by: string | null; hover: string }
const nameOf = (model: ViewModel, id: string): string => cardOfRecord(model, id)?.heading ?? id

/**
 * The edge table: every link the View types as one causal step (`causal` non-null), with its endpoints' headings. Strength only where the model holds
 * one (`strength.state` sized with a likely figure: its own unit, its range where core gives one); otherwise core's own line for the link (`size.text`,
 * e.g. "no strength yet") or nothing. No strength is ever computed or compared here.
 */
export function edgeTableOf(model: ViewModel): EdgeRow[] {
  const rows: EdgeRow[] = []
  model.links.forEach((l, i) => {
    const c = l.causal
    if (c == null) return
    const s = c.strength, unit = s.unit === null ? '' : ` ${s.unit}`
    const strength = s.state === 'sized' && s.likely !== null
      ? `${s.likely}${unit}${s.low !== null && s.high !== null ? ` (${s.low} to ${s.high})` : ''}`
      : (l.size?.text ?? null)
    rows.push({ index: i, from: nameOf(model, l.from), to: nameOf(model, l.to), sign: c.sign, strength, disputed: c.disputed, by: c.author?.text ?? null, hover: c.text })
  })
  return rows
}
