/**
 * THE JOURNEY TAB ON THE OLUMI-CORE LANE (wip/v12-tab-journey, 18 Nov; design: overnight/journey/DESIGN.md): what has happened in this
 * scenario, newest first, one line each, read only from core. "Where are we, and what has happened here", for someone coming back to a
 * scenario or joining it late. Nothing from the chat is repeated (no reply, no Next step, no proposal): the chat is the conversation, this
 * is the record of what was approved or done.
 *
 * Every dated line is one of core's own records and carries core's own time:
 *   - an approved version: core's stored versions (`GET /api/scenarios/:s/versions`: `n`, `by`, `at`), as the version history reads them;
 *   - what changed at the version shown: the View's `model.run.since.changed` (its cards' labels and whose they are), only on that version;
 *   - a commitment and each outcome recorded against it (`collab.commitments[]`, `.outcomes[]`: `by`, `at`, the person's own words);
 *   - a piece of evidence (`evidence[]`: `by`, `at`, its words);
 *   - a disagreement confirmed as kept on record (`collab.dissent[].confirmed.at`).
 * Views given (`collab.shared`) and kept ideas (`kept`) carry no time core vouches for as the moment it happened, so they are counted, never
 * placed on the timeline. No stage (STRATEGISE…IMPROVE) is drawn: core sends none. The page writes chrome only ("approved by", "made a
 * commitment"); every name and every quoted line is core's.
 */
import type { View } from '../../types'

/** One stored version, as core's version history answers (`olumiCore/versions.tsx` reads the same route). */
export type StoredVersion = { readonly n: number; readonly at: string; readonly by: string }

export type JourneyTarget =
  | { readonly kind: 'version'; readonly n: number; readonly latest: boolean }
  | { readonly kind: 'team' }
  | { readonly kind: 'evidence'; readonly id: number }

export type JourneyChange = { readonly id: string; readonly label: string; readonly olumi: boolean }

export type JourneyEntry = {
  /** Stable identity: the kind and core's own id for the record. */
  readonly key: string
  readonly kind: 'version' | 'commitment' | 'outcome' | 'evidence' | 'dissent'
  /** Core's ISO time for the record. */
  readonly at: string
  /** The one line: page chrome around core's name. */
  readonly line: string
  /** Core's own words for the record (the action, what happened, the evidence), drawn on one line; null where there are none. */
  readonly detail: string | null
  readonly target: JourneyTarget
  /** Only on the version whose `since` the View carries: the cards that changed at it. */
  readonly changed: readonly JourneyChange[]
}

export type JourneyCount = { readonly key: 'views' | 'kept'; readonly line: string; readonly target: JourneyTarget | null }

export type Journey = {
  /** The version the View is of (core's `version`), with who approved it when the stored versions say. Null before version 1. */
  readonly where: { readonly n: number; readonly by: string | null; readonly at: string | null; readonly atText: string | null } | null
  readonly entries: readonly JourneyEntry[]
  readonly counts: readonly JourneyCount[]
}

/** The words: chrome only. */
export const JOURNEY_WORDS = {
  heading: 'What has happened here',
  none: 'No version yet. Approve Olumi’s first model to make version 1.',
  version: (n: number, by: string | null) => (by === null ? `Version ${n}` : `Version ${n} approved by ${by}`),
  where: (n: number, by: string | null) => (by === null ? `Version ${n}` : `Version ${n} · approved by ${by}`),
  changed: 'What changed',
  commitment: (by: string) => `${by} made a commitment`,
  outcome: (by: string) => `${by} recorded what happened`,
  evidence: (by: string) => `${by} added evidence`,
  dissent: (holder: string) => `${holder}’s disagreement kept on record`,
  views: (n: number, names: readonly string[]) => `${n === 1 ? '1 view given' : `${n} views given`}${names.length > 0 ? ` · ${names.join(', ')}` : ''}`,
  kept: (n: number) => (n === 1 ? '1 idea kept' : `${n} ideas kept`),
  showAll: (n: number) => `Show all ${n}`,
  showFewer: 'Show fewer',
  earlier: (n: number) => `You are looking at version ${n}.`,
  back: 'Back to the latest',
  latest: 'On the canvas',
} as const

/** How many dated lines show at rest; the rest are behind one press. */
export const AT_REST = 6

const time = (iso: string): number => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/**
 * The scenario's journey from its View and core's stored versions (null when that read has not answered or failed: then the View's own
 * version is the only version line, with no approver named).
 */
export function journeyOf(view: View, versions: readonly StoredVersion[] | null): Journey {
  const v = view.version
  const stored = versions ?? []
  const latestN = stored.length > 0 ? Math.max(...stored.map((x) => x.n)) : v?.n ?? null
  const mine = v === null ? undefined : stored.find((x) => x.n === v.n)
  const where = v === null ? null : { n: v.n, by: mine?.by ?? null, at: mine?.at ?? v.at ?? null, atText: v.at_text ?? null }

  const since = view.model?.run?.since ?? null
  const changedAt = (n: number): JourneyChange[] =>
    since === null || since.to.n !== n ? [] : since.changed.map((c) => ({ id: c.id, label: c.label, olumi: c.whose === 'olumi' }))

  const entries: JourneyEntry[] = []
  const versionRows: StoredVersion[] = stored.length > 0 ? [...stored] : v !== null && v.at !== undefined ? [{ n: v.n, at: v.at, by: '' }] : []
  for (const x of versionRows) {
    entries.push({
      key: `version:${x.n}`, kind: 'version', at: x.at, line: JOURNEY_WORDS.version(x.n, x.by === '' ? null : x.by), detail: null,
      target: { kind: 'version', n: x.n, latest: x.n === latestN }, changed: changedAt(x.n),
    })
  }
  for (const k of view.collab?.commitments ?? []) {
    entries.push({ key: `commitment:${k.id}`, kind: 'commitment', at: k.at, line: JOURNEY_WORDS.commitment(k.by), detail: k.action, target: { kind: 'team' }, changed: [] })
    for (const o of k.outcomes) {
      entries.push({ key: `outcome:${o.id}`, kind: 'outcome', at: o.at, line: JOURNEY_WORDS.outcome(o.by), detail: o.happened, target: { kind: 'team' }, changed: [] })
    }
  }
  for (const e of view.evidence ?? []) {
    entries.push({ key: `evidence:${e.id}`, kind: 'evidence', at: e.at, line: JOURNEY_WORDS.evidence(e.by), detail: e.text, target: { kind: 'evidence', id: e.id }, changed: [] })
  }
  for (const d of view.collab?.dissent ?? []) {
    if (d.confirmed === null) continue
    entries.push({ key: `dissent:${d.id}`, kind: 'dissent', at: d.confirmed.at, line: JOURNEY_WORDS.dissent(d.holder), detail: d.position, target: { kind: 'team' }, changed: [] })
  }
  // Newest first; a tie keeps core's order (a version before what was done on it).
  const ranked = entries.map((e, i) => ({ e, i })).sort((a, z) => time(z.e.at) - time(a.e.at) || a.i - z.i).map((x) => x.e)

  const counts: JourneyCount[] = []
  const given = (view.collab?.shared ?? []).filter((s) => !s.skip)
  if (given.length > 0) {
    const names = [...new Set(given.map((s) => s.by))]
    counts.push({ key: 'views', line: JOURNEY_WORDS.views(given.length, names), target: { kind: 'team' } })
  }
  const kept = view.kept ?? []
  if (kept.length > 0) counts.push({ key: 'kept', line: JOURNEY_WORDS.kept(kept.length), target: null })

  return { where, entries: ranked, counts }
}
