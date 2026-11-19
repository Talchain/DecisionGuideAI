/**
 * The Analysis and Reasoning tabs' one picking module (as `../layout.ts` is for the View tabs): which View rows go where, in the View's own
 * order. Nothing here formats, rounds or words a value; the numbers it reads place marks on a track and are never drawn.
 *
 * The tab's state is read from the options' ROWS (design, 18 Nov), never from run fields: a qualitative Run still carries `all_withheld:
 * false`, a `sensitivity` sentence and a `waits_on.head` about the chance, so a run field cannot say whether any option has a chance.
 */
import type { ViewCard, ViewModel, ViewRow, ViewRun } from '../client'
import { optionCards, worthLinesOf } from '../layout'
import { worthCheckingOf } from '../v12/cards/marks'

/** A fraction of a track as a percent, held to the track. Layout only: never drawn as a number. */
export const trackPct = (fraction: number): number => Math.max(0, Math.min(100, fraction * 100))

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
/** Each option's chance row for the lead aim, in core's card order. An option with no such row is left out (it is in "what a result needs"). */
export function chartRowsOf(model: ViewModel): ChartRow[] {
  return chartGroupsOf(model)[0]?.rows ?? []
}

/**
 * One chart per aim that has a chance: the lead aim first (its title is core's lead), then every other aim in the order core's option rows
 * first name it (its title is core's `row.aim`, at the first row that carries it). Inside each, every option with a chance for that aim, in
 * core's card order. Nothing is ranked; an option whose chance for an aim is not a number is in "what a result needs" with core's words.
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

type CoreEdit = { prompt: string; ask: string }
/**
 * One row of "what a result needs": core's words at their View path, the card a press goes to, and core's edit where a press can give the
 * figure. Each class is fixed by the tab (never by the content), and inside a class the order is core's:
 *   1. `blocks`: what stops an option's chance (`run.shared_blockers`; each option row `none` for an aim no shared blocker covers, once;
 *      a chance row core gives no number, by its own words);
 *   2. `waits`: what the chances wait on (`run.waits_on.items`);
 *   3. `size`: a figure no one has given yet (`cards[].figure` with no words and core's edit; never a result core works out);
 *   4. `worth`: Olumi's observation on a card (`worth_checking`), where core sends one.
 * The same card is listed once, in its first class.
 */
export type Need = { key: string; cls: 'blocks' | 'waits' | 'size' | 'worth'; text: string; at: string | null; title: string; card: string | null; edit: CoreEdit | null }
export function needsOf(model: ViewModel): Need[] {
  const run = model.run ?? null, out: Need[] = [], seenCard = new Set<string>(), seenText = new Set<string>()
  const push = (n: Need) => {
    // DL/Codex 19 Nov: Olumi's worth-checking finding is its own observation, never the same line as the card's other need, so a card already
    // listed (a figure to give, a wait) does not drop it; the same words twice still do.
    if (n.text === '' || (seenText.has(n.text) && !n.key.startsWith('held:')) || (n.card !== null && n.cls !== 'blocks' && n.cls !== 'worth' && seenCard.has(n.card))) return
    seenText.add(n.text); if (n.card !== null) seenCard.add(n.card); out.push(n)
  }
  const blockers = run?.shared_blockers ?? []
  blockers.forEach((b, i) => push({ key: `blocks:${i}`, cls: 'blocks', text: b.text, at: `run.shared_blockers.${i}.text`, title: b.text, card: b.aim_id, edit: cardOf(model, b.aim_id)?.figure?.edit ?? null }))
  // A shared blocker says it once for the options it names, for its aim: only those option/aim lines are covered by it (Codex 01:56Z).
  const covered = (option: string, aim: string | null) => aim !== null && blockers.some((b) => b.aim_id === aim && (b.options ?? []).includes(option))
  for (const c of optionCards(model)) c.rows.forEach((r, i) => {
    // An option's line for an aim that no result is drawn for: core's own words for why, unless a shared blocker already says it for it.
    // Core's comparison baseline for this aim (candidate 14, `aim_role: "reference"`, an optional typed key)
    // is no missing result: its sentence stays on the card, it is not a need. A contender with a missing mechanism carries no role and stays.
    if (r.kind === 'none' && r.aim_role !== 'reference' && !covered(c.id, r.aim_id)) {
      const ref = r.blocked_by?.[0]?.ref ?? r.aim_id ?? null
      push({ key: `none:${c.id}.${i}`, cls: 'blocks', text: r.text, at: `${c.id}.rows.${i}.text`, title: r.title, card: ref, edit: cardOf(model, ref)?.figure?.edit ?? null })
    }
    if (r.kind === 'chance' && (typeof r.chance !== 'number' || !Number.isFinite(r.chance)) && r.value !== '') push({ key: `held:${c.id}.${i}`, cls: 'blocks', text: r.value, at: `${c.id}.rows.${i}.value`, title: r.title, card: c.id, edit: null })
  })
  ;(run?.waits_on?.items ?? []).forEach((it, i) => push({ key: `waits:${it.id}`, cls: 'waits', text: it.text, at: `run.waits_on.items.${i}.text`, title: it.title, card: it.id, edit: it.edit ?? null }))
  for (const c of model.cards) {
    const f = c.figure
    // A figure core works out from others (a result, with its own values) is not one to give: it is sized by the model.
    if (f != null && f.edit != null && f.text === '' && c.status === null && c.kind !== 'result' && c.values == null) push({ key: `size:${c.id}`, cls: 'size', text: c.heading, at: `${c.id}.heading`, title: f.title, card: c.id, edit: f.edit })
  }
  for (const c of model.cards) worthCheckingOf(c).forEach((w, j) => push({ key: `worth:${c.id}.${j}`, cls: 'worth', text: w.title, at: null, title: `${c.heading}\n${w.text}`, card: c.id, edit: null }))
  return out
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
