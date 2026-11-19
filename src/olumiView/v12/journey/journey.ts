/**
 * CATCH UP ON A SCENARIO (olumi-core lane; redesign 19 Nov, plan: overnight/journey/critique/SYNTHESIS.md, Paul's go via the UI lead).
 * "Where has our reasoning got to, what is still open, what do I do next" for someone returning to a scenario or joining it late, read
 * only from fields the View already sends. Order of meaning, not of time:
 *   1. how the conclusions moved: per option and aim, core's chance before → now (`model.run.since.lines`: `from`/`to` place the marks,
 *      `from_text`/`to_text` say them, core's `line` one press away), and the one change core credits (`since.sole`) as a card to open;
 *      the cards that changed at the version shown (`since.changed`, with `was`), or `version.changed` when core sends no `since`;
 *   2. what is open, each with its exact action: what the result waits on (`run.waits_on.items`), evidence nobody has asked Olumi to
 *      consider (`evidence[].considered === null`), commitments with no outcome yet, a reconsider condition whose basis went stale
 *      (`trigger.stale`), the reader's own disagreement not yet confirmed, views ready to reveal (`collab.can_reveal`, `waiting`), a
 *      proposal waiting for approval;
 *   3. commitments as expectations: what was expected (`expect`, `expect_band.text`), when to review (`review_on`, as given), what would
 *      make them reconsider, and each outcome recorded against it (`happened`, `versus`, `figure.text`, `reconsider_triggered`);
 *   4. history, grouped by meaning (evidence with whether it was considered, confirmed disagreements with their `tell`, kept ideas, views
 *      given), behind one press.
 * The page writes chrome only; every sentence about the model is core's field or a person's own words. Nothing here is Olumi's AI talking:
 * a grounded catch-up, an "attention" line and a multi-version trajectory are engine fields the DL has been asked for (CODEX.md §3) and
 * are NOT imitated here. No stage is claimed. A target that cannot open is drawn unavailable with its reason, never a silent button.
 */
import type { View } from '../../types'

/** What a press opens: the exact record, never just "the Team tab" when the record has an identity. */
export type JourneyRef =
  | { readonly kind: 'card'; readonly id: string }
  | { readonly kind: 'kept'; readonly node: string }
  | { readonly kind: 'evidence'; readonly id: number }
  | { readonly kind: 'commitment'; readonly id: number }
  | { readonly kind: 'outcome-form'; readonly commitment: number }
  | { readonly kind: 'outcome'; readonly id: number }
  | { readonly kind: 'dissent'; readonly id: string }
  | { readonly kind: 'views' }
  | { readonly kind: 'chat' }

/** A press: where it goes, or why it cannot go there now (chrome, said where the press would be). */
export type JourneyPress = { readonly to: JourneyRef } | { readonly unavailable: string }

export const JOURNEY_WORDS = {
  moved: 'How the conclusions moved',
  changed: 'Changed',
  wasOlumi: 'was Olumi’s',
  wasTheirs: 'was the team’s',
  credited: 'Credited to',
  open: 'Open',
  notConsidered: (by: string) => `${by}’s evidence: not yet considered`,
  noOutcome: (owner: string) => `${owner}’s commitment: no outcome recorded yet`,
  reviewOn: (date: string) => `review on ${date}`,
  stale: 'The reason to reconsider has changed',
  confirmMine: 'Your disagreement: confirm it in your own words',
  reveal: 'Views are ready to reveal together',
  pending: 'A proposed change is waiting for approval',
  next: 'Go to the next step',
  commitments: 'Commitments',
  owner: (o: string) => `Owner: ${o}`,
  expected: 'Expected',
  reconsider: 'Reconsider if',
  happened: (by: string) => `${by} recorded what happened`,
  triggered: 'Recorded as meeting the reason to reconsider',
  history: 'Show history',
  hideHistory: 'Hide history',
  evidence: 'Evidence',
  considered: 'considered',
  notYet: 'not yet considered',
  dissent: 'Disagreements confirmed',
  tell: 'What would change their mind:',
  kept: 'Ideas kept',
  keptBy: (name: string) => `kept by ${name}`,
  views: (n: number, names: readonly string[]) => `${n === 1 ? '1 view given' : `${n} views given`}${names.length > 0 ? ` · ${names.join(', ')}` : ''}`,
  offCanvas: 'Not on the canvas now',
  earlier: 'Go back to the latest version to open this',
  versions: 'Versions',
} as const

export type Moved = {
  readonly key: string
  readonly option: string
  readonly aim: string
  /** Core's chances, 0–1, placing the marks only. */
  readonly from: number
  readonly to: number
  readonly fromText: string
  readonly toText: string
  readonly line: string
  readonly same: boolean
}
export type Changed = { readonly id: string; readonly label: string; readonly olumi: boolean; readonly was: 'olumi' | 'theirs' | null; readonly press: JourneyPress }
export type OpenItem = { readonly key: string; readonly label: string; readonly words: string | null; readonly title?: string; readonly olumi?: boolean; readonly press: JourneyPress }
export type Outcome = { readonly key: string; readonly by: string; readonly at: string; readonly happened: string; readonly versus: string; readonly figure: string | null; readonly triggered: boolean; readonly press: JourneyPress }
export type Commitment = {
  readonly key: string; readonly action: string; readonly owner: string; readonly expect: string; readonly band: string | null
  readonly reviewOn: string | null; readonly reconsider: string; readonly outcomes: readonly Outcome[]; readonly press: JourneyPress
}
export type HistoryEvidence = { readonly key: string; readonly by: string; readonly at: string; readonly text: string; readonly stance: string; readonly considered: boolean; readonly press: JourneyPress }
export type HistoryDissent = { readonly key: string; readonly holder: string; readonly at: string; readonly words: string; readonly tell: string | null; readonly press: JourneyPress }
export type HistoryKept = { readonly key: string; readonly name: string; readonly at: string; readonly text: string; readonly press: JourneyPress }

export type Journey = {
  readonly moved: { readonly heading: string; readonly from: string; readonly to: string; readonly rows: readonly Moved[]; readonly sole: Changed | null } | null
  readonly changed: { readonly n: number; readonly cards: readonly Changed[] } | null
  readonly open: readonly OpenItem[]
  readonly next: JourneyPress | null
  readonly commitments: readonly Commitment[]
  readonly history: { readonly evidence: readonly HistoryEvidence[]; readonly dissent: readonly HistoryDissent[]; readonly kept: readonly HistoryKept[]; readonly views: string | null }
}

/** What the caller knows that the View does not: the version drawn (null: the latest), the canvas's own node id for each kept idea
 *  (`keptIdeasOf` + `IDEA_PREFIX`, null when the canvas draws none for it), and whether the chat has a current Next step (`nextStepOf`). */
export type JourneyContext = { readonly at: number | null; readonly keptNode: (k: { id: number; turn: number; text: string }) => string | null; readonly hasNext: boolean }

/** A calendar date core sends as YYYY-MM-DD (`review_on`), written as the page writes dates; the date itself is unchanged. */
export const calendarDay = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const newestFirst = <T extends { at: string }>(xs: T[]): T[] => xs.map((x, i) => ({ x, i, t: Date.parse(x.at) || 0 })).sort((a, z) => z.t - a.t || a.i - z.i).map((y) => y.x)

export function journeyOf(view: View, ctx: JourneyContext): Journey {
  const model = view.model
  const cards = new Map((model?.cards ?? []).map((c) => [c.id, c.heading]))
  const label = (id: string) => cards.get(id) ?? null
  const onCanvas = (id: string): JourneyPress => (cards.has(id) ? { to: { kind: 'card', id } } : { unavailable: JOURNEY_WORDS.offCanvas })
  // Team's records are held while an earlier version is drawn (TeamTab): their presses say so instead of opening nothing.
  const team = (to: JourneyRef): JourneyPress => (ctx.at !== null ? { unavailable: JOURNEY_WORDS.earlier } : { to })

  const n = view.version?.n ?? null
  const since = model?.run?.since ?? null
  const sinceHere = since !== null && n !== null && since.to.n === n ? since : null

  const moved = sinceHere === null || sinceHere.lines.length === 0 ? null : {
    heading: sinceHere.heading, from: sinceHere.from.label, to: sinceHere.to.label,
    rows: sinceHere.lines.map((l) => ({ key: `move:${l.option}:${l.aim}`, option: label(l.option) ?? l.option, aim: label(l.aim) ?? l.aim,
      from: l.from, to: l.to, fromText: l.from_text, toText: l.to_text, line: l.line, same: l.from_text === l.to_text })),
    sole: sinceHere.sole === null ? null : { id: sinceHere.sole, label: label(sinceHere.sole) ?? sinceHere.sole, olumi: false, was: null, press: onCanvas(sinceHere.sole) },
  }

  const changed = n === null ? null : (() => {
    const list: Changed[] = sinceHere !== null
      ? sinceHere.changed.map((c) => ({ id: c.id, label: c.label, olumi: c.whose === 'olumi', was: c.was !== null && c.was !== c.whose ? c.was : null, press: onCanvas(c.id) }))
      : (view.version?.changed ?? []).flatMap((id) => { const l = label(id); return l === null ? [] : [{ id, label: l, olumi: false, was: null, press: onCanvas(id) }] })
    return list.length === 0 ? null : { n, cards: list }
  })()

  const open: OpenItem[] = []
  for (const w of model?.run?.waits_on?.items ?? []) {
    open.push({ key: `wait:${w.id}`, label: w.text, words: w.unknown, title: w.edit?.ask ?? w.title, press: onCanvas(w.id) })
  }
  for (const e of view.evidence ?? []) {
    if (e.considered === null) open.push({ key: `consider:${e.id}`, label: JOURNEY_WORDS.notConsidered(e.by), words: e.text, press: team({ kind: 'evidence', id: e.id }) })
  }
  const commitmentsIn = view.collab?.commitments ?? []
  for (const k of commitmentsIn) {
    if (k.outcomes.length === 0) {
      open.push({ key: `no-outcome:${k.id}`, label: JOURNEY_WORDS.noOutcome(k.owner) + (k.review_on ? ` · ${JOURNEY_WORDS.reviewOn(calendarDay(k.review_on))}` : ''), words: k.action, press: team({ kind: 'outcome-form', commitment: k.id }) })
    }
    if (k.trigger?.stale) open.push({ key: `stale:${k.id}`, label: JOURNEY_WORDS.stale, words: k.trigger.stale.text, press: team({ kind: 'commitment', id: k.id }) })
  }
  for (const d of view.collab?.dissent ?? []) {
    if (d.confirmed === null && d.holder_id !== null && d.holder_id === view.you_id) open.push({ key: `confirm:${d.id}`, label: JOURNEY_WORDS.confirmMine, words: d.position, press: team({ kind: 'dissent', id: d.id }) })
  }
  if (view.collab?.can_reveal) open.push({ key: 'reveal', label: JOURNEY_WORDS.reveal, words: view.collab.waiting, press: team({ kind: 'views' }) })
  if (view.proposal !== null) open.push({ key: 'proposal', label: JOURNEY_WORDS.pending, words: view.proposal.heading, press: { to: { kind: 'chat' } } })

  const commitments: Commitment[] = commitmentsIn.map((k) => ({
    key: `commitment:${k.id}`, action: k.action, owner: k.owner, expect: k.expect, band: k.expect_band?.text ?? null, reviewOn: k.review_on === null ? null : calendarDay(k.review_on), reconsider: k.reconsider,
    outcomes: k.outcomes.map((o) => ({ key: `outcome:${o.id}`, by: o.by, at: o.at, happened: o.happened, versus: o.versus, figure: o.figure?.text ?? null, triggered: o.reconsider_triggered, press: team({ kind: 'outcome', id: o.id }) })),
    press: team({ kind: 'commitment', id: k.id }),
  }))

  const given = (view.collab?.shared ?? []).filter((s) => !s.skip)
  const history = {
    evidence: newestFirst((view.evidence ?? []).map((e) => ({ key: `evidence:${e.id}`, by: e.by, at: e.at, text: e.text, stance: e.stance_text, considered: e.considered !== null, press: team({ kind: 'evidence', id: e.id }) }))),
    dissent: newestFirst((view.collab?.dissent ?? []).flatMap((d) => d.confirmed === null ? [] : [{ key: `dissent:${d.id}`, holder: d.holder, at: d.confirmed.at, words: d.confirmed.words, tell: d.confirmed.tell, press: team({ kind: 'dissent', id: d.id }) }])),
    kept: newestFirst((view.kept ?? []).map((k) => { const node = ctx.keptNode(k); return { key: `kept:${k.id}`, name: k.kept_by.name, at: k.at, text: k.text, press: node === null ? { unavailable: JOURNEY_WORDS.offCanvas } : { to: { kind: 'kept', node } as const } } })),
    views: given.length === 0 ? null : JOURNEY_WORDS.views(given.length, [...new Set(given.map((s) => s.by))]),
  }

  return { moved, changed, open, next: ctx.hasNext ? { to: { kind: 'chat' } } : null, commitments, history }
}

/** Anything to say at all; with nothing, the panel is core's versions alone, as before. */
export const isEmpty = (j: Journey): boolean =>
  j.moved === null && j.changed === null && j.open.length === 0 && j.next === null && j.commitments.length === 0
  && j.history.evidence.length === 0 && j.history.dissent.length === 0 && j.history.kept.length === 0 && j.history.views === null
