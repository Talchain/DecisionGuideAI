/**
 * THE SCENARIO'S RECORD ON THE OLUMI-CORE LANE (wip/v12-tab-journey, 18 Nov; design: overnight/journey/DESIGN.md): what has happened in
 * this scenario, newest first, one line each, read only from the View. "Where are we, and what has happened here", for someone coming back
 * to a scenario or joining it late. It opens from the top bar's history icon, above core's own version list (`olumiCore/versions.tsx`),
 * which already says each version and who approved it; so versions are not repeated here (UI lead's ruling 18 Nov: no seventh tab, measured
 * at 317 px). Nothing from the chat is repeated either (no reply, no Next step, no proposal text).
 *
 * Every dated line is one of core's own records and carries core's own time:
 *   - a commitment and each outcome recorded against it (`collab.commitments[]`, `.outcomes[]`: `by`, `at`, the person's own words);
 *   - a piece of evidence (`evidence[]`: `by`, `at`, its words);
 *   - a disagreement its holder confirmed in their own words (`collab.dissent[].confirmed`: `at`, `words`; core record-writes.ts:73-87
 *     `confirmDissent`, holder only, words kept verbatim);
 *   - an idea of Olumi's that someone kept (`kept[]`: `kept_by`, `at`, the idea's words; core stamps `at` on the keep row itself,
 *     olumi-core src/app/kept.ts:46 `at: r.at`, read at 9ad89f81; Codex 01:39Z).
 * Above them, the cards that changed at the version shown (`model.run.since.changed`, only when `since.to` is that version). Views given
 * (`collab.shared`: only views this person may see; core sends none to a gated viewer, see `ViewsPanel.tsx`) carry no time in the View,
 * so they are counted, never placed on the timeline. A proposal not yet approved (Olumi's or a person's: core writes both) is said once
 * as provisional, never as a record. No stage (STRATEGISE…IMPROVE) is drawn: core sends none. The page writes chrome only
 * ("made a commitment"); every name and every quoted line is core's.
 */
import type { View } from '../../types'

export type JourneyTarget =
  | { readonly kind: 'team' }
  | { readonly kind: 'evidence'; readonly id: number }
  | { readonly kind: 'card'; readonly id: string }
  /** A kept idea: its canvas node is resolved on the press by the canvas's own rule (`keptIdeasOf`), which may fold it into a strategy idea. */
  | { readonly kind: 'kept'; readonly id: number; readonly turn: number; readonly text: string }
  | { readonly kind: 'olumi' }

export type JourneyChange = { readonly id: string; readonly label: string; readonly olumi: boolean }

export type JourneyEntry = {
  /** Stable identity: the kind and core's own id for the record. */
  readonly key: string
  readonly kind: 'commitment' | 'outcome' | 'evidence' | 'dissent' | 'kept'
  /** Core's ISO time for the record. */
  readonly at: string
  /** The one line: page chrome around core's name. */
  readonly line: string
  /** Core's own words for the record (the action, what happened, the evidence, the idea), drawn on one line. */
  readonly detail: string | null
  readonly target: JourneyTarget
}

export type Journey = {
  /** The cards that changed at the version the View is of, with that version's number; null where core sends no `since` for it. */
  readonly changed: { readonly n: number; readonly cards: readonly JourneyChange[] } | null
  readonly entries: readonly JourneyEntry[]
  /** Views given, counted (the View sends no time for them); null when none. */
  readonly views: { readonly line: string } | null
  /** A change proposed and not yet approved (the View's `proposal`, Olumi's or a person's): provisional work, not part of the record. */
  readonly pending: boolean
}

/** The words: chrome only. */
export const JOURNEY_WORDS = {
  heading: 'What has happened here',
  versions: 'Versions',
  changed: (n: number) => `Changed at version ${n}`,
  commitment: (by: string) => `${by} made a commitment`,
  outcome: (by: string) => `${by} recorded what happened`,
  evidence: (by: string) => `${by} added evidence`,
  dissent: (holder: string) => `${holder} confirmed their disagreement`,
  kept: (name: string) => `Olumi’s idea kept by ${name}`,
  views: (n: number, names: readonly string[]) => `${n === 1 ? '1 view given' : `${n} views given`}${names.length > 0 ? ` · ${names.join(', ')}` : ''}`,
  pending: 'A proposed change is waiting for approval',
  showAll: (n: number) => `Show all ${n}`,
  showFewer: 'Show fewer',
} as const

/** How many dated lines show at rest; the rest are behind one press. */
export const AT_REST = 6

const time = (iso: string): number => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** The scenario's record from its View: nothing here is read from anywhere else. */
export function journeyOf(view: View): Journey {
  const since = view.model?.run?.since ?? null
  const n = view.version?.n ?? null
  const changed = since === null || n === null || since.to.n !== n || since.changed.length === 0
    ? null
    : { n, cards: since.changed.map((c) => ({ id: c.id, label: c.label, olumi: c.whose === 'olumi' })) }

  const entries: JourneyEntry[] = []
  for (const k of view.collab?.commitments ?? []) {
    entries.push({ key: `commitment:${k.id}`, kind: 'commitment', at: k.at, line: JOURNEY_WORDS.commitment(k.by), detail: k.action, target: { kind: 'team' } })
    for (const o of k.outcomes) {
      entries.push({ key: `outcome:${o.id}`, kind: 'outcome', at: o.at, line: JOURNEY_WORDS.outcome(o.by), detail: o.happened, target: { kind: 'team' } })
    }
  }
  for (const e of view.evidence ?? []) {
    entries.push({ key: `evidence:${e.id}`, kind: 'evidence', at: e.at, line: JOURNEY_WORDS.evidence(e.by), detail: e.text, target: { kind: 'evidence', id: e.id } })
  }
  for (const d of view.collab?.dissent ?? []) {
    if (d.confirmed === null) continue
    entries.push({ key: `dissent:${d.id}`, kind: 'dissent', at: d.confirmed.at, line: JOURNEY_WORDS.dissent(d.holder), detail: d.confirmed.words, target: { kind: 'team' } })
  }
  for (const k of view.kept ?? []) {
    entries.push({ key: `kept:${k.id}`, kind: 'kept', at: k.at, line: JOURNEY_WORDS.kept(k.kept_by.name), detail: k.text, target: { kind: 'kept', id: k.id, turn: k.turn, text: k.text } })
  }
  // Newest first; a tie keeps core's order.
  const ranked = entries.map((e, i) => ({ e, i })).sort((a, z) => time(z.e.at) - time(a.e.at) || a.i - z.i).map((x) => x.e)

  const given = (view.collab?.shared ?? []).filter((s) => !s.skip)
  const views = given.length === 0 ? null : { line: JOURNEY_WORDS.views(given.length, [...new Set(given.map((s) => s.by))]) }

  return { changed, entries: ranked, views, pending: view.proposal !== null }
}
