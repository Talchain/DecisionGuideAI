/**
 * The option card's range and its reliance on Olumi's own guesses, read ONLY from what the View already serves (no core change):
 *  - `headline.range`, core's words for how far the chance moves with one figure ("under 1% if 'cups change' is low, over 99% if it is high"), drawn as the caption only;
 *  - `rows[kind=chance].driver`, the same range as numbers (chances 0..1 at the figure's low and high ends), which place the band;
 *  - `rows[kind=chance].chance`, the chance the headline names (a 0..1 number);
 *  - `model.run.rests[]` (`olumi_share`, `person_share`, `unassigned`), core's split of what the result's variation traces to.
 * The words are core's, drawn verbatim as the caption. The numbers only place marks, and no mark is read from the words.
 */
import type { ViewCard, ViewModel } from './client'

export type RangeBand = { readonly from: number; readonly to: number; readonly openLow: boolean; readonly openHigh: boolean }

/**
 * The band, placed from the chance row's own numbers: `rows[kind=chance].driver.low` and `.high`, the chance (0..1) at the low and at the high end of the
 * driver figure's range, for the headline's own aim (core's schema/view.v3.json, ChanceRowV3.driver: "the numbers are for positions only"). Never read from
 * any sentence: core's words (`headline.range`, `row.value`) are drawn as the track's tip and can change without moving or removing the band. A band end
 * that sits at the very end of the track (0 or 1) is open there. No `driver` (or one that is not two finite chances) draws no band.
 */
export function rangeBandOf(card: ViewCard): RangeBand | null {
  const h = card.headline
  if (card.family !== 'option' || h == null || h.state !== 'chance') return null
  const row = card.rows.find((r): r is Extract<ViewCard['rows'][number], { kind: 'chance' }> => r.kind === 'chance' && r.aim_id === h.aim_id)
  const d = row?.driver
  if (d == null || ![d.low, d.high].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return null
  const lo = Math.min(d.low, d.high), hi = Math.max(d.low, d.high)
  return { from: lo * 100, to: hi * 100, openLow: lo <= 0, openHigh: hi >= 1 }
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
