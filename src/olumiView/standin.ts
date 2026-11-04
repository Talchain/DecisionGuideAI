/**
 * STAND-IN for core's Analysis-wall change (DL 4 Nov, R3, approved shape; github-3c builds core's side after the R2 serve). Not yet in
 * the vendored View: every field here is optional and read through this one file, so the re-vendor is a one-file change (types.ts then
 * carries them, and this file reads them as given).
 *
 * On olumi.view/3 each chance fact keeps at most two sentences in its `text` (the finding and its uncertainty); what it rests on moves to
 * a structured `rests_on` and core's own one line, `rests_on_text`. Carried on each chance row (`model.cards[].rows[]`, kind 'chance')
 * and on `model.run.most_likely`. The card-level `rests_on: { id, whose }[]` is a different field and is untouched.
 */
import type { ViewModel, ViewRow, ViewRun } from './client'

/** What a finding rests on: the reading and the target as yes/no; the figures as record ids, by how they enter it. */
export type RestsOnBasis = { readonly reading: boolean; readonly target: boolean; readonly what_ifs: readonly string[]; readonly estimates: readonly string[]; readonly approx: readonly string[] }
export type Finding = { readonly text: string | null; readonly rests_on: RestsOnBasis | null; readonly rests_on_text: string | null }

type Carried = { text?: unknown; rests_on?: unknown; rests_on_text?: unknown }
const basisOf = (b: unknown): RestsOnBasis | null => (b !== null && typeof b === 'object' && Array.isArray((b as RestsOnBasis).what_ifs) ? b as RestsOnBasis : null)
const strOf = (s: unknown): string | null => (typeof s === 'string' && s !== '' ? s : null)

/** A chance row's finding as core gives it (absent on a core before the change: all null, and the row draws as before). */
export function findingOf(row: ViewRow): Finding {
  if (row.kind !== 'chance') return { text: null, rests_on: null, rests_on_text: null }
  const r = row as ViewRow & Carried
  return { text: strOf(r.text), rests_on: basisOf(r.rests_on), rests_on_text: strOf(r.rests_on_text) }
}

/** The most likely line's basis, as core gives it (its `text` is the line itself, already drawn). */
export function mostLikelyBasisOf(ml: NonNullable<ViewRun['most_likely']>): Pick<Finding, 'rests_on' | 'rests_on_text'> {
  const m = ml as typeof ml & Carried
  return { rests_on: basisOf(m.rests_on), rests_on_text: strOf(m.rests_on_text) }
}

/** Every record id the Run's findings rest on (what-ifs, estimates, approximations), in the View's order of first mention. */
export function basisIdsOf(model: ViewModel): string[] {
  const out: string[] = []
  const add = (b: RestsOnBasis | null) => { if (b !== null) for (const id of [...b.what_ifs, ...b.estimates, ...b.approx]) if (!out.includes(id)) out.push(id) }
  for (const c of model.cards) for (const row of c.rows) add(findingOf(row).rests_on)
  if (model.run?.most_likely != null) add(mostLikelyBasisOf(model.run.most_likely).rests_on)
  return out
}
