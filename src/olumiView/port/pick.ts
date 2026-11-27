/**
 * The Analysis and Reasoning tabs' one picking module (as `../layout.ts` is for the View tabs): which View rows go where, in the View's own
 * order. Nothing here formats, rounds or words a value; the numbers it reads place marks on a track and are never drawn.
 *
 * The tab's state is read from the options' ROWS (design, 18 Nov), never from run fields: a qualitative Run still carries `all_withheld:
 * false`, a `sensitivity` sentence and a `waits_on.head` about the chance, so a run field cannot say whether any option has a chance.
 */
import type { View, ViewCard, ViewModel, ViewRow, ViewRun } from '../client'
import { optionCards, worthLinesOf } from '../model/selectors'
import { cardKindOf } from '../v12/cards/kind'
import { linkRole } from '../v12/contract'
import { cardOfRecord } from '../v12/lenses/layers'

export { trackPct } from '../resultRange'

/** A card by its id, when the model draws it. */
export const cardOf = (model: ViewModel, id: string | null | undefined): ViewCard | null => (id == null ? null : model.cards.find((c) => c.id === id) ?? null)

/** The aim core's lenses and most likely line are about (`run.most_likely.aim_id`); null without one. */
export function lensAimOf(run: ViewRun | null): string | null {
  const id = (run?.most_likely as { aim_id?: unknown } | null | undefined)?.aim_id
  return typeof id === 'string' && id !== '' ? id : null
}

/** The aim the tab's chart is about: core's most-likely line's aim, else the aim the options' headlines are about, else the first chance row's. */
export function leadAimOf(model: ViewModel): string | null {
  const options = optionCards(model)
  return lensAimOf(model.run ?? null)
    ?? options.find((c) => c.headline != null && c.headline.aim_id !== null)?.headline!.aim_id
    ?? options.flatMap((c) => c.rows).find((r) => r.kind === 'chance')?.aim_id
    ?? null
}

export type ChanceRow = Extract<ViewRow, { kind: 'chance' }>
export type LimitRow = Extract<ViewRow, { kind: 'limit' }>
const hasChance = (r: ViewRow): r is ChanceRow => r.kind === 'chance' && typeof r.chance === 'number' && Number.isFinite(r.chance)

/**
 * The tab's state, from the options' rows:
 * - `chance`: some option has a chance row with a number (the chart is drawn);
 * - `limit`: no chance, but some option has a limit row (each option's state against the limit is drawn);
 * - `none`: no option has either (what a result needs is the tab's answer).
 */
export type TabState = 'chance' | 'limit' | 'none'
export function tabStateOf(model: ViewModel): TabState {
  const rows = optionCards(model).flatMap((c) => c.rows)
  return rows.some(hasChance) ? 'chance' : rows.some((r) => r.kind === 'limit') ? 'limit' : 'none'
}

/** One bar of the chance chart: an option's chance row for one aim, at its View path (`<card id>.rows.<i>`). */
export type ChartRow = { card: ViewCard; row: ChanceRow; i: number }
/** Each option's chance row for the lead aim, in core's card order. An option with no such row is left out (it is in Check). */
export function chartRowsOf(model: ViewModel): ChartRow[] {
  return chartGroupsOf(model)[0]?.rows ?? []
}

/**
 * One chart per aim that has a chance: the lead aim first (its title is core's lead), then every other aim in the order core's option rows
 * first name it (its title is core's `row.aim`, at the first row that carries it). Inside each, every option with a chance for that aim, in
 * core's card order. Nothing is ranked; an option whose chance for an aim is not a number is in Check with core's words.
 */
export type ChartGroup = { aimId: string; lead: boolean; aim: { text: string; at: string }; rows: ChartRow[] }
export function chartGroupsOf(model: ViewModel): ChartGroup[] {
  const lead = leadAimOf(model), out: ChartGroup[] = []
  for (const card of optionCards(model)) card.rows.forEach((row, i) => {
    if (!hasChance(row)) return
    let g = out.find((x) => x.aimId === row.aim_id)
    if (g === undefined) { g = { aimId: row.aim_id, lead: row.aim_id === lead, aim: { text: row.aim, at: `${card.id}.rows.${i}.aim` }, rows: [] }; out.push(g) }
    if (!g.rows.some((r) => r.card.id === card.id)) g.rows.push({ card, row, i })
  })
  const at = out.findIndex((g) => g.lead)
  return at > 0 ? [out[at]!, ...out.slice(0, at), ...out.slice(at + 1)] : out
}

/** The figure a chart row's chance moves most with, and both chances (`row.driver`), when core sends them as numbers. */
export function rangeOf(row: ChanceRow): { figure: string; low: number; high: number } | null {
  const d = row.driver
  return d == null || !Number.isFinite(d.low) || !Number.isFinite(d.high) ? null : { figure: d.figure, low: d.low, high: d.high }
}

type RestFigure = NonNullable<ViewRun['rests'][number]['figures']>[number]
/**
 * The figures the chart's chances move most with, each once in the order the chart first names it: its card, which options' chances move
 * with it, and core's share line for it from the rests (`run.rests[].figures`), where core sends one.
 */
export function moversOf(model: ViewModel): { card: ViewCard; options: string[]; share: { f: RestFigure; at: string } | null }[] {
  const out: { card: ViewCard; options: string[]; share: { f: RestFigure; at: string } | null }[] = []
  for (const { card: option, row } of chartGroupsOf(model).flatMap((g) => g.rows)) {
    const r = rangeOf(row)
    if (r === null) continue
    const had = out.find((m) => m.card.id === r.figure)
    if (had !== undefined) { had.options.push(option.id); continue }
    const card = cardOf(model, r.figure)
    if (card === null) continue
    let share: { f: RestFigure; at: string } | null = null
    ;(model.run?.rests ?? []).forEach((rest, k) => {
      if (share !== null) return
      const j = (rest.figures ?? []).findIndex((f) => f.id === card.id && f.text !== '')
      if (j >= 0) share = { f: rest.figures![j]!, at: `run.rests.${k}.figures.${j}` }
    })
    out.push({ card, options: [option.id], share })
  }
  return out
}

/**
 * What would change which option leads, as core says it: its first tipping line about the lead (`run.tipping`, kind `lead`), else the first
 * line it gives for why nothing tested does (`run.tipping_aims[].silent`, crossing `lead`). Null when core says neither.
 */
export type LeadChange =
  | { kind: 'tipping'; at: string; line: string; hover: string; figure: string | null }
  | { kind: 'silent'; at: string; line: string; hover: string; figure: null }
export function leadChangeOf(run: ViewRun | null): LeadChange | null {
  if (run === null) return null
  const t = (run.tipping ?? []).findIndex((x) => x.kind === 'lead' && x.line !== '')
  if (t >= 0) { const x = run.tipping[t]!; return { kind: 'tipping', at: `run.tipping.${t}.line`, line: x.line, hover: x.hover, figure: x.figure?.id ?? null } }
  const aims = run.tipping_aims ?? []
  for (let a = 0; a < aims.length; a++) {
    const s = aims[a]!.silent.findIndex((x) => x.crossing === 'lead' && x.line !== '')
    if (s >= 0) { const x = aims[a]!.silent[s]!; return { kind: 'silent', at: `run.tipping_aims.${a}.silent.${s}.line`, line: x.line, hover: x.text, figure: null } }
  }
  return null
}

/**
 * Core's reason, per aim, for saying nothing about what would change which option leads (`run.tipping_aims[].silent[]`): the aim's first line about
 * the lead (crossing `lead`), else its first line about the aim itself (crossing null: no option is clearly ahead, or the lead rests on Olumi's own
 * differing estimates, so there is no lead to test). One per aim, core's `line` verbatim; a reason about one option (crossing `chance`) is not this.
 */
export type AimSilent = { aim: string; at: string; line: string; hover: string }
export function aimSilentsOf(run: ViewRun | null): AimSilent[] {
  return (run?.tipping_aims ?? []).flatMap((a, ai): AimSilent[] => {
    const pick = (crossing: 'lead' | null) => a.silent.findIndex((x) => x.crossing === crossing && x.option === undefined && x.line !== '')
    const si = pick('lead') >= 0 ? pick('lead') : pick(null)
    return si < 0 ? [] : [{ aim: a.aim, at: `run.tipping_aims.${ai}.silent.${si}.line`, line: a.silent[si]!.line, hover: a.silent[si]!.text }]
  })
}

/** Each limit an option is checked against, with every option's row for it, in core's order (the aim's words are core's `row.aim`). */
export function limitGroupsOf(model: ViewModel): { aimId: string; aim: { text: string; at: string }; rows: { card: ViewCard; row: LimitRow; i: number }[] }[] {
  const out: { aimId: string; aim: { text: string; at: string }; rows: { card: ViewCard; row: LimitRow; i: number }[] }[] = []
  for (const card of optionCards(model)) card.rows.forEach((row, i) => {
    if (row.kind !== 'limit') return
    let g = out.find((x) => x.aimId === row.aim_id)
    if (g === undefined) { g = { aimId: row.aim_id, aim: { text: row.aim, at: `${card.id}.rows.${i}.aim` }, rows: [] }; out.push(g) }
    g.rows.push({ card, row, i })
  })
  return out
}

/** Figures Core names in result bases or needs, or links into a calculation or aim. */
export function resultFigureCardsOf(model: ViewModel, view: View): ViewCard[] {
  // A figure no one has sized yet, which Core lets the person give (typed: an edit with empty words), is named too.
  const named = new Set(model.cards.filter((c) => c.figure != null && c.figure.edit != null && c.figure.text === '').map((c) => c.id))
  const addRecord = (id: string) => {
    const card = cardOfRecord(model, id)
    if (card !== undefined) named.add(card.id)
  }
  for (const card of model.cards) {
    for (const row of card.rows) {
      if (row.kind !== 'chance' || row.rests_on == null) continue
      const { estimates, approx, what_ifs } = row.rests_on
      for (const id of [...estimates, ...approx, ...what_ifs]) addRecord(id)
    }
  }
  for (const rest of model.run?.rests ?? []) {
    for (const figure of rest.figures ?? []) addRecord(figure.id)
  }
  const inputs = new Set<string>()
  for (const link of model.links) {
    const role = linkRole(link)
    if (role === 'input' || role === 'size' || role === 'measures' || role === 'target') {
      inputs.add(link.from)
    } else if (role === 'effect') {
      const target = cardOf(model, link.to)
      if (target !== null && cardKindOf(target, model, view).shape === 'calculated') inputs.add(link.from)
    }
  }
  return model.cards.filter((card) =>
    (named.has(card.id) || (card.family === 'quantity' && inputs.has(card.id))) &&
    cardKindOf(card, model, view).shape !== 'calculated')
}

/**
 * Core's ranking of what to find out first, per aim, with any line or figure; its worth lines the ranking does not already name (one home);
 * and every figure either already offers core's give ✎ for (so no other place offers a second one).
 */
export function findOutOf(run: ViewRun | null) {
  const aims = (run?.find_out ?? []).map((aim, a) => ({ aim, a })).filter(({ aim }) => aim.line !== '' || aim.figures.length > 0)
  const said = new Set(aims.flatMap(({ aim }) => aim.figures.map((f) => f.fact)))
  const worth = run?.science == null ? [] : worthLinesOf(run.science).filter(({ line }) => !said.has(line.id) && line.line !== '')
  const given = new Set(aims.flatMap(({ aim }) => aim.figures.filter((f) => f.give != null).map((f) => f.id)))
  for (const { line } of worth) if (line.figure?.give != null) given.add(line.figure.id)
  return { aims, worth, given }
}
