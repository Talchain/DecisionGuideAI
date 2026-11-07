/**
 * The ported analysis components' one picking module (as `../layout.ts` is for the View tabs): which View rows go where, in the View's own
 * order. Nothing here formats, rounds, sorts or words a value; the numbers it reads place marks on a track and are never drawn.
 */
import type { ViewCard, ViewModel, ViewRow, ViewRun } from '../client'
import { optionCards } from '../layout'

/** One row of one option, at its View path (`<card id>.rows.<i>`). */
export type AimRow = { card: ViewCard; row: ViewRow; i: number }
/** Every option's rows about one aim: the aim's words are core's `row.aim`, drawn from the first row that carries them. */
export type AimGroup = { aimId: string | null; aim: { text: string; at: string } | null; rows: AimRow[] }

/**
 * Every compared option's rows, grouped by the aim each is about: the aims in the order they first appear, each option in core's card
 * order. Nothing is sorted by its chance and nothing is dropped (a row with no aim keeps a group of its own, with no heading).
 */
export function aimGroupsOf(model: ViewModel): AimGroup[] {
  const groups: AimGroup[] = []
  const byId = new Map<string | null, AimGroup>()
  for (const card of optionCards(model)) {
    card.rows.forEach((row, i) => {
      const id = row.aim_id ?? null
      let g = byId.get(id)
      if (g === undefined) { g = { aimId: id, aim: null, rows: [] }; byId.set(id, g); groups.push(g) }
      if (g.aim === null && row.kind !== 'none' && row.aim !== '') g.aim = { text: row.aim, at: `${card.id}.rows.${i}.aim` }
      g.rows.push({ card, row, i })
    })
  }
  return groups
}

/** Where one aim's outcome bands sit on a shared track: their lowest low and highest high, only when every band is in one unit. Layout only. */
export function outcomeDomainOf(rows: readonly AimRow[]): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity, unit: string | null | undefined
  for (const { row } of rows) {
    if (row.kind !== 'chance' || row.outcome == null) continue
    const o = row.outcome
    if (unit === undefined) unit = o.unit
    else if (unit !== o.unit) return null
    if (!Number.isFinite(o.low) || !Number.isFinite(o.high)) continue
    min = Math.min(min, o.low)
    max = Math.max(max, o.high)
  }
  return Number.isFinite(min) && Number.isFinite(max) && max > min ? { min, max } : null
}

/** A fraction of a track as a percent, held to the track. Layout only: never drawn as a number. */
export const trackPct = (fraction: number): number => Math.max(0, Math.min(100, fraction * 100))

export type TippingLine = NonNullable<ViewRun['tipping']>[number]

/** Core's "what would have to be true" lines for one option and one aim, at their View paths (`run.tipping.<i>`). */
export function tippingFor(run: ViewRun | null, option: string, aim: string | null): { line: TippingLine; i: number }[] {
  const out: { line: TippingLine; i: number }[] = []
  ;(run?.tipping ?? []).forEach((line, i) => { if (line.option === option && line.aim === aim && line.line !== '') out.push({ line, i }) })
  return out
}

/** The index of a card's first chance row: its driver (what moves its chance most) is drawn there once, never on every aim's row. */
export const driverRowOf = (card: ViewCard): number => card.rows.findIndex((r) => r.kind === 'chance')

/** Core's analysis lens words (olumi.view/3 `run.lenses`, wip/core-port-fields): one per lens this Run has data for; [] from a core without them. */
export type Lens = { id: 'goal' | 'outcome'; label: string; title: string }
/** Each lens core sends that this page draws, with its index in `run.lenses` (its View path). */
export function lensesOf(run: ViewRun | null): (Lens & { i: number })[] {
  const l = (run as { lenses?: unknown } | null)?.lenses
  const out: (Lens & { i: number })[] = []
  if (!Array.isArray(l)) return out
  ;(l as Partial<Lens>[]).forEach((x, i) => {
    if ((x?.id === 'goal' || x?.id === 'outcome') && typeof x.label === 'string' && x.label !== '') out.push({ id: x.id, label: x.label, title: typeof x.title === 'string' ? x.title : x.label, i })
  })
  return out
}

export type Reading = ViewRun['readings'][number]
/** Core's reading of one aim (`run.readings`, how Olumi reads the aim's words), at its View path. */
export function readingsFor(run: ViewRun | null, aim: string | null): { reading: Reading; i: number }[] {
  const out: { reading: Reading; i: number }[] = []
  ;(run?.readings ?? []).forEach((reading, i) => { if (reading.aim_id === aim && reading.text !== '') out.push({ reading, i }) })
  return out
}

export type ViewLinkT = ViewModel['links'][number]
/**
 * Each compared option with the links core sizes on its own path (`links[].effect`), at their View paths (`links.<i>`), in the View's link
 * order: links from the option itself, and from each card the option sets directly (its plain links: on an R24 board an option sets its
 * lever card, and the lever's `through` link carries the size). Options with none are left out.
 */
export function optionEffectsOf(model: ViewModel): { card: ViewCard; links: { link: ViewLinkT; i: number }[] }[] {
  const out: { card: ViewCard; links: { link: ViewLinkT; i: number }[] }[] = []
  for (const card of optionCards(model)) {
    const on = new Set<string>([card.id])
    for (const l of model.links) if (l.from === card.id && l.kind === 'plain') on.add(l.to)
    const links: { link: ViewLinkT; i: number }[] = []
    model.links.forEach((link, i) => { if (on.has(link.from) && link.effect != null && link.effect.text !== '') links.push({ link, i }) })
    if (links.length > 0) out.push({ card, links })
  }
  return out
}

/** A card by its id, when the model draws it. */
export const cardOf = (model: ViewModel, id: string | null | undefined): ViewCard | null => (id == null ? null : model.cards.find((c) => c.id === id) ?? null)

/** The compared options that carry what moves their chance most (`driver`), in card order. */
export function driverCardsOf(model: ViewModel): ViewCard[] {
  const out: ViewCard[] = []
  for (const card of optionCards(model)) if (card.driver != null && card.driver.text !== '') out.push(card)
  return out
}

/** One act-on-it row from core: a figure the chances wait on (`run.waits_on.items`), or a prompt about the model's shape (`model.sharpen`). */
export type ActRow =
  | { kind: 'wait'; key: string; i: number; item: NonNullable<ViewRun['waits_on']>['items'][number] }
  | { kind: 'sharpen'; key: string; i: number; item: ViewModel['sharpen'][number] }
/** Core's act-on-it rows in core's own order within each source: what the chances wait on first, then the prompts. Nothing ranked. */
export function actRowsOf(model: ViewModel): ActRow[] {
  const out: ActRow[] = []
  ;(model.run?.waits_on?.items ?? []).forEach((item, i) => { if (item.text !== '') out.push({ kind: 'wait', key: `wait:${item.id}`, i, item }) })
  ;(model.sharpen ?? []).forEach((item, i) => { if (item.lead !== '' || item.emphasis !== '') out.push({ kind: 'sharpen', key: `sharpen:${item.id}`, i, item }) })
  return out
}

/** The aim core's lenses are about: the aim its most likely line names (`run.most_likely.aim_id`, wip/core-port-fields); null without one. */
export function lensAimOf(run: ViewRun | null): string | null {
  const id = (run?.most_likely as { aim_id?: unknown } | null | undefined)?.aim_id
  return typeof id === 'string' && id !== '' ? id : null
}
