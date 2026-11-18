/**
 * DETAILED: EACH FACT SAID ONCE ON THE BOARD (Paul, 17 Nov 2026: "a much better version of the detailed view to make it not overwhelming but
 * truly valuable with rich data"; his capture showed every option card repeating "No chance yet", the same limit and "Not calculated").
 * Where every option card would say the same words, the board says them once, on the card they are about (the aim, else the question), and
 * the option cards then say nothing of it (no empty track: Paul, 16 Nov). Read by field and compared as core's words; no word is changed or reordered.
 * Two or more options only: one option's words are never "shared".
 */
import type { ViewCard, ViewModel } from '../../client'
import { limitLeadOf } from '../contract'
import { chanceParts, noChanceLineOf } from '../cards/words'

type Row = ViewCard['rows'][number]
/** A said-once line: core's words, their whole hover, and the card they are about (an aim's id, or null for the question). */
export type Said = { readonly text: string; readonly title: string; readonly at: string | null }

const optionsOf = (model: ViewModel | null): ViewCard[] => (model?.cards ?? []).filter((c) => c.family === 'option')

/** The options whose face draws a no-chance line (headline `none`, not led by a limit result: CoreCard faceOf). */
const noChanceOptions = (opts: readonly ViewCard[]) => opts.filter((c) => c.headline?.state === 'none' && limitLeadOf(c) === null)

/**
 * The no-chance line every option says alike (words.ts noChanceLineOf: its next step, else its text), said once on the aim it is about. Null
 * where fewer than two options, any option has a chance or a fixed result, the lines differ, or the options head different aims.
 */
export function sharedNoChance(model: ViewModel | null): Said | null {
  const opts = optionsOf(model)
  const none = noChanceOptions(opts)
  if (opts.length < 2 || none.length !== opts.length) return null
  const lines = none.map((c) => noChanceLineOf(c.headline!))
  const aim = none[0]!.headline!.aim_id ?? null
  if (!lines.every((l) => l.line === lines[0]!.line) || !none.every((c) => (c.headline!.aim_id ?? null) === aim)) return null
  return { text: lines[0]!.line, title: lines[0]!.hover, at: aim !== null && model!.cards.some((c) => c.id === aim) ? aim : null }
}

/** A row's own state words (`state_text`, else `text`), for a row that says nothing can be worked out yet (`none`); else null. */
const noneWords = (r: Row): string | null => {
  if (r.kind !== 'none') return null
  const w = (r as { state_text?: string | null }).state_text || r.text
  return w != null && w !== '' ? w : null
}

/**
 * Per aim an option's other rows name (rows[].aim_id, other than its headline's): the state words every option says alike for that aim, when
 * every option has such a row and none of them is worked out. Said once on that aim's card; the option rows say nothing of it.
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
    out.set(aim, { text: words[0]!, title: rows[0]!.title || words[0]!, at: model!.cards.some((c) => c.id === aim) ? aim : null })
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
