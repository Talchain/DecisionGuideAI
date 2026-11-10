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
 * Every compared option's rows, grouped by the aim each is about: the aim core's lead speaks of first (`leadAimOf`), then the others in the
 * order they first appear, each option in core's card order. Nothing is sorted by its chance and nothing is dropped (a row with no aim keeps
 * a group of its own, with no heading). DL round 5 (hiring, 9 Nov): core lists an option's unchecked aim before the aim its lead and every
 * card headline give a chance for, so in first-appearance order "Not checked yet: maintaining code quality" sat straight under "Chance of
 * 'increase productivity'" while the canvas said "about 23% chance": one field read two ways.
 */
export function aimGroupsOf(model: ViewModel): AimGroup[] {
  const groups: AimGroup[] = []
  const byId = new Map<string | null, AimGroup>()
  for (const card of optionCards(model)) {
    // AN-01: an option's one row with no aim, when it is the line its headline is about (`headlineRowOf`), sits in the headline's aim's group.
    const head = headlineRowOf(card)
    card.rows.forEach((row, i) => {
      const id = row.aim_id ?? (i === head ? card.headline!.aim_id : null)
      let g = byId.get(id)
      if (g === undefined) { g = { aimId: id, aim: null, rows: [] }; byId.set(id, g); groups.push(g) }
      if (g.aim === null && row.kind !== 'none' && row.aim !== '') g.aim = { text: row.aim, at: `${card.id}.rows.${i}.aim` }
      g.rows.push({ card, row, i })
    })
  }
  const lead = leadAimOf(model), at = lead === null ? -1 : groups.findIndex((g) => g.aimId === lead)
  return at > 0 ? [groups[at]!, ...groups.slice(0, at), ...groups.slice(at + 1)] : groups
}

/** The aim core's lead speaks of: its most-likely line's aim, else the aim the options' headlines are about (the canvas's chance). */
export function leadAimOf(model: ViewModel): string | null {
  return lensAimOf(model.run) ?? optionCards(model).find((c) => c.headline != null)?.headline!.aim_id ?? null
}

/**
 * AN-01 (core e179f7c6, `cards[].headline`): the row an option's headline is about. Every headline keeps the dock's aim: its row for that
 * aim, else its option-wide reason (its one row with no aim, which core gives an option the Run says nothing about), else -1: the option
 * has no line for the aim, and its headline is drawn on its own in that aim's group (`headlinesAloneOf`).
 */
export function headlineRowOf(card: ViewCard): number {
  const h = card.headline
  if (h == null) return -1
  const own = card.rows.findIndex((r) => (r.aim_id ?? null) === h.aim_id)
  return own >= 0 || h.aim_id === null ? own : card.rows.findIndex((r) => r.kind === 'none' && (r.aim_id ?? null) === null)
}

/** The options whose headline has no row to sit on (`headlineRowOf` -1), in core's card order: each is still drawn, never dropped. */
export function headlinesAloneOf(model: ViewModel): ViewCard[] {
  return optionCards(model).filter((c) => c.headline != null && headlineRowOf(c) === -1)
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

/**
 * What the option rows already say (SC-02, say each thing once): each option whose driver sentence its first chance row draws, and every
 * tipping line a row draws for its option and aim (`tippingFor`, as AnalysisHeroPanel hands each row). The evidence disclosure leaves these out.
 */
export function drawnByRows(model: ViewModel): { drivers: ReadonlySet<string>; tipping: ReadonlySet<number> } {
  const run = model.run ?? null, drivers = new Set<string>(), tipping = new Set<number>()
  if (run === null) return { drivers, tipping }
  for (const g of aimGroupsOf(model)) for (const { card, row, i } of g.rows) {
    if (row.kind === 'chance' && card.driver != null && driverRowOf(card) === i) drivers.add(card.id)
    for (const t of tippingFor(run, card.id, g.aimId)) tipping.add(t.i)
  }
  return { drivers, tipping }
}

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

/** The aim core's lenses are about: the aim its most likely line names (`run.most_likely.aim_id`, wip/core-port-fields); null without one. */
export function lensAimOf(run: ViewRun | null): string | null {
  const id = (run?.most_likely as { aim_id?: unknown } | null | undefined)?.aim_id
  return typeof id === 'string' && id !== '' ? id : null
}
