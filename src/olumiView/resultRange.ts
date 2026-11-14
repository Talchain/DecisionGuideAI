/**
 * The option card's range and its reliance on Olumi's own guesses, read ONLY from what the View already serves (no core change):
 *  - `headline.range`, core's words for how far the chance moves with one figure ("under 1% if 'cups change' is low, over 99% if it is high");
 *  - `rows[kind=chance].chance`, the chance the headline names (a 0..1 number);
 *  - `model.run.rests[]` (`olumi_share`, `person_share`, `unassigned`), core's split of what the result's variation traces to.
 * The words are core's, drawn verbatim as the caption. The numbers only place marks: a band edge is a number the sentence itself states.
 * "under" and "over" are never dropped to a bare number: an open end runs to the end of the track (under N is 0..N, over N is N..100),
 * so the band cannot read tighter than the words say. A sentence not in core's shape draws no band (its words stay), never a guess.
 */
import type { ViewCard, ViewModel } from './client'

export type RangeBand = { readonly from: number; readonly to: number; readonly openLow: boolean; readonly openHigh: boolean }

const END = /(about|under|over) (\d+(?:\.\d+)?)%/
/** core's chance-range sentence: "<end> if '<figure>' is low, <end> if it is high" (the two ends may run either way). */
const SENTENCE = new RegExp(`^${END.source} if .+ is (?:low|high), ${END.source} if it is (?:high|low)$`)

/** The band the sentence states, in percent of the track (0..100), or null when the sentence is not core's two-ended shape. */
export function rangeBandOf(range: string | null | undefined): RangeBand | null {
  if (range == null) return null
  const m = SENTENCE.exec(range.trim())
  if (m === null) return null
  const ends = [{ kind: m[1]!, n: Number(m[2]) }, { kind: m[3]!, n: Number(m[4]) }]
  if (ends.some((e) => !Number.isFinite(e.n) || e.n < 0 || e.n > 100)) return null
  const lowers = ends.map((e) => (e.kind === 'under' ? 0 : e.n)), uppers = ends.map((e) => (e.kind === 'over' ? 100 : e.n))
  return {
    from: Math.min(...lowers), to: Math.max(...uppers),
    openLow: ends.some((e) => e.kind === 'under'), openHigh: ends.some((e) => e.kind === 'over'),
  }
}

/** The chance the headline names, as a fraction of the track, from the chance row for the headline's own aim; null when none is served. */
export function chanceAtOf(card: ViewCard): number | null {
  const h = card.headline
  if (card.family !== 'option' || h == null || h.state !== 'chance') return null
  const row = card.rows.find((r) => r.kind === 'chance' && r.aim_id === h.aim_id) as { chance?: number | null } | undefined
  return typeof row?.chance === 'number' && row.chance >= 0 && row.chance <= 1 ? row.chance : null
}

export type RestsShare = { readonly id: string; readonly olumi: number; readonly person: number; readonly unassigned: number; readonly line: string; readonly hover: string }
/** Below this a served share is numerical dust (core serves 5.5e-16 for "none"): drawn as a zero-width bar. It sets bar widths ONLY, never a word. */
export const SHARE_FLOOR = 0.005

/**
 * Core's `run.rests[]` entry for THIS option's chance of meeting THIS aim: the first entry of kind 'goal' with this option and this aim (never another
 * option's, never another aim's). Entries of kind 'limit' are deliberately not drawn on the card, and a second goal entry for the same option and
 * aim is not read. null only when no such entry is served. A share that is not a finite number is a bar of no width (0), never a reason to
 * hide the entry: the words are core's own line, whatever the shares.
 */
export function restsShareOf(model: ViewModel | null, card: ViewCard): RestsShare | null {
  const aim = card.headline?.aim_id ?? null
  if (model === null || card.family !== 'option' || aim === null) return null
  const r = (model.run?.rests ?? []).find((x) => x.kind === 'goal' && x.option === card.id && x.aim === aim)
  if (r === undefined) return null
  const share = (n: number): number => (Number.isFinite(n) ? n : 0)
  return { id: r.id, olumi: share(r.olumi_share), person: share(r.person_share), unassigned: share(r.unassigned), line: r.line, hover: r.hover }
}

/** Shown only where core serves no line for the entry: credits neither Olumi nor any person, and says nothing about the split. */
export const NEUTRAL_REST_WORDS = 'See what this result rests on'
export type RestWords = { readonly basis: 'line' | 'neutral'; readonly words: string }

/**
 * The words on the button come from the served entry (`run.rests[]`) and from nothing else: core's own scoped line for the entry, for every split
 * (all unassigned, equal halves, many people's figures alike). Shares never choose or write a word here: whether the result rests "mostly" on
 * anyone, or on "your" figures, is core's to say in its line (`person_share` is every person's figures together, so no reader is told they are
 * "own"). Where the line is blank, a neutral label that links to the same details.
 */
export const restWordsOf = (s: RestsShare): RestWords =>
  s.line.trim() === '' ? { basis: 'neutral', words: NEUTRAL_REST_WORDS } : { basis: 'line', words: s.line.trim() }

/** The served share as a width in percent: each side as served (never derived from the other), kept inside the track together. */
export function shareWidths(s: RestsShare): { olumi: number; person: number; unassigned: number } {
  const o = s.olumi < SHARE_FLOOR ? 0 : Math.min(1, Math.max(0, s.olumi)), p = s.person < SHARE_FLOOR ? 0 : Math.min(1, Math.max(0, s.person))
  // Core's own unassigned share, its own segment (never added to the person's): kept to what the two others leave of the track.
  const u = s.unassigned < SHARE_FLOOR ? 0 : Math.min(1, Math.max(0, s.unassigned))
  const total = o + p + u
  const k = total > 1 ? 1 / total : 1
  return { olumi: o * k * 100, person: p * k * 100, unassigned: u * k * 100 }
}
