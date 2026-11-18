/**
 * DETAILED: EACH FACT SAID ONCE ON THE BOARD (Paul, 17 Nov 2026: "a much better version of the detailed view to make it not overwhelming but
 * truly valuable with rich data"; his capture showed every option card repeating "No chance yet", the same limit and "Not calculated").
 * Where every option card would say the same thing, the board says it once, on the card it is about (the aim, else the question), and
 * the option cards then say nothing of it (no empty track: Paul, 16 Nov). Read by field and compared as core's words; no word is changed or reordered.
 * Two or more options only: one option's words are never "shared".
 *
 * SAID ONCE ONLY FOR IDENTICAL MEANING (18 Nov, two reviews): a line stands for several options only where core says it is shared, or where
 * EVERYTHING a person could read of it is equal on every option: the line AND its hover, a row's words AND title AND question AND Olumi mark.
 * The same short status over different reasons is not shared: each option keeps its own line with its own hover. A said-once line never
 * carries one option's hover for the others, and an option says nothing only where the said-once line says exactly what it would have said.
 */
import type { ViewCard, ViewModel } from '../../client'
import { limitLeadOf } from '../contract'
import { chanceParts, noChanceLineOf, sharedNoChanceOf } from '../cards/words'

type Row = ViewCard['rows'][number]
type Headline = NonNullable<ViewCard['headline']>
type Mark = { readonly glyph: string; readonly title: string }
/** A said-once line: core's words, their whole hover, the card they are about (an aim's id, or null for the question), and Olumi's mark where
 *  every row it stands for carries the same one. */
export type Said = { readonly text: string; readonly title: string; readonly at: string | null; readonly olumi?: Mark | null }

const optionsOf = (model: ViewModel | null): ViewCard[] => (model?.cards ?? []).filter((c) => c.family === 'option')

/** The options whose face draws a no-chance line (headline `none`, not led by a limit result: CoreCard faceOf). */
const noChanceOptions = (opts: readonly ViewCard[]) => opts.filter((c) => c.headline?.state === 'none' && limitLeadOf(c) === null)

/** The fields of a no-chance headline a person can read on the option's face: its line and its hover are made of these (words.ts noChanceLineOf, CoreCard). */
const READ = ['text', 'title', 'why', 'add'] as const

/**
 * The no-chance line the options say alike, said once on the aim it is about. Null where fewer than two options, any option has a chance or a
 * fixed result, or the options head different aims. Otherwise shared by one of two routes:
 *  - everything readable is equal on every option (`text`, `title`, `why`, `add`): the line and its hover are every option's own;
 *  - core says so (the Simple face's rule, words.ts sharedNoChanceOf: every option waits, core marks the headline `shared`, no step of its own):
 *    the line is core's shared `text`, and its hover holds only the fields every option sends alike, never one option's reason for the others.
 */
export function sharedNoChance(model: ViewModel | null): Said | null {
  const opts = optionsOf(model)
  const none = noChanceOptions(opts)
  if (opts.length < 2 || none.length !== opts.length) return null
  const heads = none.map((c) => c.headline!), first = heads[0]!
  const aim = first.aim_id ?? null
  if (!heads.every((h) => (h.aim_id ?? null) === aim)) return null
  const same = (k: (typeof READ)[number]) => heads.every((h) => (h[k] ?? '') === (first[k] ?? ''))
  if (!READ.every(same) && sharedNoChanceOf(model, aim) === null) return null
  const common: Headline = { ...first, title: same('title') ? first.title : '', why: same('why') ? first.why : null, add: same('add') ? first.add : null }
  const { line, hover } = noChanceLineOf(common)
  return { text: line, title: hover, at: aim !== null && model!.cards.some((c) => c.id === aim) ? aim : null }
}

/** Whether the board's said-once line says exactly what this option's own no-chance line would (its line and its hover): only then does the
 *  option say nothing of it. An option whose reason differs keeps its own line, so its face is never left empty. */
export function saysNoChanceOnce(said: Said | null, h: Headline): boolean {
  if (said === null) return false
  const own = noChanceLineOf(h)
  return own.line === said.text && own.hover === said.title
}

/** A row's own state words (`state_text`, else `text`), for a row that says nothing can be worked out yet (`none`); else null. */
const noneWords = (r: Row): string | null => {
  if (r.kind !== 'none') return null
  const w = (r as { state_text?: string | null }).state_text || r.text
  return w != null && w !== '' ? w : null
}
/** What a person can read of a row beside its words: its hover's title and question, and Olumi's mark (marks.tsx ResultRow). */
const readOf = (r: Row) => {
  const x = r as { title?: string | null; question?: string | null; olumi?: Mark | null; likely?: Mark | null }
  return { title: x.title ?? '', question: x.question ?? '', olumi: x.olumi ?? null, likely: x.likely ?? null }
}

/**
 * Per aim an option's other rows name (rows[].aim_id, other than its headline's): the state every option says alike for that aim, when every
 * option has such a row, none of them is worked out, and their words AND title AND question AND Olumi mark are equal (a row with a likely-value
 * mark is never shared: the said-once line has no place for it). Said once on that aim's card, with the shared title and question its hover and
 * the shared Olumi mark beside it; the option rows say nothing of it. Rows that differ in any of these are each drawn, with their own hover.
 */
export function sharedRowStates(model: ViewModel | null): ReadonlyMap<string, Said> {
  const opts = optionsOf(model), out = new Map<string, Said>()
  if (opts.length < 2) return out
  const aims = new Set(opts.flatMap((c) => c.rows.flatMap((r) => (r.aim_id != null && r.aim_id !== (c.headline?.aim_id ?? null) ? [r.aim_id] : []))))
  for (const aim of aims) {
    const rows = opts.map((c) => c.rows.find((r) => r.aim_id === aim && aim !== (c.headline?.aim_id ?? null)) ?? null)
    if (rows.some((r) => r === null)) continue
    const words = rows.map((r) => noneWords(r!))
    if (words.some((w) => w === null) || !words.every((w) => w === words[0])) continue
    const read = rows.map((r) => readOf(r!)), one = read[0]!
    if (read.some((x) => x.likely !== null || x.title !== one.title || x.question !== one.question || x.olumi?.glyph !== one.olumi?.glyph || x.olumi?.title !== one.olumi?.title)) continue
    const hover = [one.title, one.question].filter((x, j, a) => x !== '' && a.indexOf(x) === j).join('\n')
    out.set(aim, { text: words[0]!, title: hover !== '' ? hover : words[0]!, at: model!.cards.some((c) => c.id === aim) ? aim : null, olumi: one.olumi })
  }
  return out
}

/**
 * The qualifier every option's chance carries alike (core's words after the number: words.ts chanceParts), said once on the question card.
 * Null unless two or more options are on the rail and EVERY one of them (charts.tsx Rail: each option with a headline) is a chance with the same
 * qualifier: a line under the rail reads as true of every row above it, so one row without that clause (a fixed result, no chance yet, another
 * condition or none) means each row keeps its own words, whole, and nothing is said once.
 */
export function sharedQualifier(model: ViewModel | null): string | null {
  const heads = optionsOf(model).flatMap((c) => (c.headline != null ? [c.headline] : []))
  if (heads.length < 2 || !heads.every((h) => h.state === 'chance')) return null
  const quals = heads.map((h) => chanceParts(h.text).qualifier)
  return quals[0] != null && quals[0] !== '' && quals.every((q) => q === quals[0]) ? quals[0] : null
}

/** What the question card says once, and what each aim card says once (by aim id). */
export function saidOnceOf(model: ViewModel | null): { readonly question: readonly Said[]; readonly aims: ReadonlyMap<string, readonly Said[]>; readonly qualifier: string | null; readonly none: Said | null } {
  const question: Said[] = [], aims = new Map<string, Said[]>()
  const put = (s: Said) => { if (s.at === null) question.push(s); else aims.set(s.at, [...(aims.get(s.at) ?? []), s]) }
  const none = sharedNoChance(model)
  if (none !== null) put(none)
  for (const s of sharedRowStates(model).values()) put(s)
  return { question, aims, qualifier: sharedQualifier(model), none }
}
