/**
 * CORE'S ANALYSIS-WALL FIELDS (DL 4 Nov, R3; core wip/r3-analysis-wall 550ad5f, olumi.view/3, additive): read through this one file.
 * Every field is optional, so a View without them draws as before.
 *
 * On olumi.view/3 each chance fact keeps at most two sentences in its `text` (the finding and its uncertainty); what it rests on moves to
 * a structured `rests_on` and core's own one line, `rests_on_text`. Carried on each chance row (`model.cards[].rows[]`, kind 'chance')
 * and on `model.run.most_likely`. The card-level `rests_on: { id, whose }[]` is a different field and is untouched.
 */
import type { ViewModel, ViewRow, ViewRun } from './client'

/** What a finding rests on: the reading and the target as yes/no; the figures as record ids, by how they enter it. */
export type RestsOnBasis = { readonly reading: boolean; readonly target: boolean; readonly what_ifs: readonly string[]; readonly estimates: readonly string[]; readonly approx: readonly string[] }
export type Finding = { readonly text: string | null; readonly rests_on: RestsOnBasis | null; readonly rests_on_text: string | null }

const strOf = (s: string | undefined): string | null => (s === undefined || s === '' ? null : s)

/** A chance row's finding as core gives it (absent on a core before the change: all null, and the row draws as before). */
export function findingOf(row: ViewRow): Finding {
  if (row.kind !== 'chance') return { text: null, rests_on: null, rests_on_text: null }
  return { text: strOf(row.text), rests_on: row.rests_on ?? null, rests_on_text: strOf(row.rests_on_text) }
}

/** The most likely line's basis, as core gives it (its `text` is the line itself, already drawn). */
export function mostLikelyBasisOf(ml: NonNullable<ViewRun['most_likely']>): Pick<Finding, 'rests_on' | 'rests_on_text'> {
  return { rests_on: ml.rests_on ?? null, rests_on_text: strOf(ml.rests_on_text) }
}

/** Every record id the Run's findings rest on (what-ifs, estimates, approximations), in the View's order of first mention. */
export function basisIdsOf(model: ViewModel): string[] {
  const out: string[] = []
  const add = (b: RestsOnBasis | null) => { if (b !== null) for (const id of [...b.what_ifs, ...b.estimates, ...b.approx]) if (!out.includes(id)) out.push(id) }
  for (const c of model.cards) for (const row of c.rows) add(findingOf(row).rests_on)
  if (model.run?.most_likely != null) add(mostLikelyBasisOf(model.run.most_likely).rests_on)
  return out
}

/**
 * R5 `if_approved` (poc-core-server, core wip/r5-if-approved c91f363, olumi.view/3, additive), read here until DGAI vendors that core: on each
 * chance row, band entry and `run.most_likely`, core's own mark for a value a pending proposal moves ({ glyph, title }, title "if approved;
 * now <the base version's value>"), null where nothing moves. Undefined on a core before R5 (no key), so the caller keeps its R4 rule there.
 */
export function ifApprovedFieldOf(x: object): { readonly glyph: string; readonly title: string } | null | undefined {
  if (!('if_approved' in x)) return undefined
  const v = (x as { if_approved?: { glyph: string; title: string } | null }).if_approved
  return v == null ? null : v
}
