/**
 * What the Team tab shows, derived from the olumi-core scenario view by pure functions (no component, no store).
 * Every number and word here is read from the view; nothing is composed, averaged or ranked.
 */
import type { TeamMember, TeamProvenanceBlock, TeamRecord, TeamScenario, TeamViewFact, TeamViewRow } from './types'

/**
 * Are figures served with a view? FALSE at olumi-core 2b84912: `POST views` ignores `figures` (app.ts reads `text` or `skip` only),
 * so a figure typed into a composer would be lost without a word. It flips to true only when a POST and a readback have been
 * shown to preserve every entered value (design plan r2, step 2). Until then the composer offers no figure rows, and the spread
 * strip draws only what a view itself carries.
 */
export const TEAM_FIGURES_SERVED = false

/** Is this answer a scenario view the tab can read? A read cut short, or any other body, is not one: it is never shown as a ready scenario. */
export function isTeamScenario(x: unknown): x is TeamScenario {
  const s = x as Partial<TeamScenario> | null
  if (s === null || typeof s !== 'object' || typeof s.id !== 'string' || typeof s.you !== 'string') return false
  const lists = [s.members, s.views, s.waiting, s.commitments, s.evidence]
  if (!lists.every(Array.isArray)) return false
  if (s.reveal === null || typeof s.reveal !== 'object' || !['open', 'ready', 'revealed'].includes(String((s.reveal as { state?: unknown }).state))) return false
  return s.version === null || (typeof s.version === 'object' && Array.isArray((s.version as { form?: { records?: unknown } }).form?.records))
}

// ── who you are, members and the held count ───────────────────────────────────────────────────────────────────────────────

/** Who this page was opened for (lib/tab.js puts the person on the page): their member id, or null when the page does not say. */
export function pageIdentity(): string | null {
  const w = globalThis as { __OLUMI_CORE__?: { person?: { id?: unknown } } }
  const id = w.__OLUMI_CORE__?.person?.id
  return id === undefined || id === null ? null : String(id)
}

/**
 * Which member is YOU, by identity and not by name (core permits two members with one name): the page's person id when the page says
 * it, else the one member who carries `you`'s name. Null when it cannot be told (two of that name and a page that does not say).
 */
export function youIdOf(s: Pick<TeamScenario, 'members' | 'you'>, pageId: string | null = pageIdentity()): string | null {
  if (pageId !== null) { const m = s.members.find((x) => String(x.id) === pageId); if (m) return m.id }
  const named = s.members.filter((x) => x.name === s.you)
  return named.length === 1 ? named[0]!.id : null
}

/** Is this scenario the one core holds for the person this page was opened for? A read for anyone else is never shown. */
export function isForThisPage(s: Pick<TeamScenario, 'members' | 'you'>, pageId: string | null = pageIdentity()): boolean {
  if (pageId === null) return true
  const m = s.members.find((x) => String(x.id) === pageId)
  return m !== undefined && m.name === s.you
}

export type MemberState = 'in' | 'held' | 'waiting' | 'notAnswering' | 'unclear'

/** My own latest view that has not been revealed, if I have given one: shown to me alone until the reveal. */
export const myOpenView = (s: Pick<TeamScenario, 'views'>): TeamViewRow | null => [...s.views].reverse().find((v) => v.mine && !v.revealed) ?? null

/**
 * Where each member stands THIS round, from `members[]`, `waiting[]`, `reveal` and (for you alone) your own view: never from others'
 * views, which are hidden until the reveal. `waiting[]` names people, and core lets two members share a name, so a name that two
 * members carry is resolved only as far as it can be: your own row from your own state, the other from what is left; when that is
 * still ambiguous the row says so ("unclear") and is never given a state it may not have. A skip is a given view (core takes it out of
 * `waiting`); only YOUR skip is known to you before the reveal. After a reveal core opens the next round with everyone waiting; that is
 * not "everyone is late", so a revealed state reads "in".
 */
export function memberStates(s: Pick<TeamScenario, 'members' | 'waiting' | 'reveal' | 'you' | 'views'>): ReadonlyArray<{ member: TeamMember; state: MemberState; you: boolean }> {
  const youId = youIdOf(s)
  const me = youId === null ? undefined : s.members.find((m) => m.id === youId)
  const mine = myOpenView(s)
  const count = (names: readonly string[]) => names.reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map<string, number>())
  const members = count(s.members.map((m) => m.name))
  const waiting = count(s.waiting)
  // Am I still to give a view this round? Core lists who is waiting by name only. When my name is mine alone, that is exact. When another
  // member shares it, the list settles me whenever it can: nobody of that name waiting means I am in; every one of that name waiting means I
  // am too (so a view I gave before the other joined does not count, and I can still give this round's). Only a list that waits for some of
  // them and not all leaves my own open view to decide.
  const sharing = me === undefined ? 0 : members.get(me.name) ?? 0
  const waitingMine = me === undefined ? 0 : waiting.get(me.name) ?? 0
  const iWaiting = me === undefined ? false : sharing === 1 ? waitingMine === 1 : waitingMine === 0 ? false : waitingMine >= sharing ? true : mine === null
  return s.members.map((member) => {
    const you = member.id === youId
    if (s.reveal.state === 'revealed') return { member, state: 'in' as const, you }
    if (you) return { member, state: iWaiting ? 'waiting' as const : mine?.skip ? 'notAnswering' as const : 'held' as const, you }
    const sameName = me !== undefined && me.name === member.name
    const others = (members.get(member.name) ?? 0) - (sameName ? 1 : 0)
    const stillWaiting = (waiting.get(member.name) ?? 0) - (sameName && iWaiting ? 1 : 0)
    return { member, state: stillWaiting <= 0 ? 'held' as const : stillWaiting >= others ? 'waiting' as const : 'unclear' as const, you }
  })
}

/** "2 of 3 have given a view" for the current round (and how many of those are known to be a skip), or null once the round has been revealed. */
export function heldOf(s: Pick<TeamScenario, 'members' | 'waiting' | 'reveal' | 'you' | 'views'>): { given: number; of: number; notAnswering: number } | null {
  if (s.reveal.state === 'revealed') return null
  const of = s.members.length
  if (of === 0) return null
  return { given: Math.max(0, Math.min(of, of - s.waiting.length)), of, notAnswering: memberStates(s).filter((m) => m.state === 'notAnswering').length }
}

/** The words for the held count, as the card mark and the tab both say them: "2 of 3 in (1 not answering)". */
export const heldWords = (h: { given: number; of: number; notAnswering?: number }): string =>
  `${h.given} of ${h.of} in${h.notAnswering ? ` (${h.notAnswering} not answering)` : ''}`

/** Who the reveal is waiting for, by person and not by name: "you", a name, or (for one of two people who share a name) that name with the doubt said. */
export function waitingNames(s: Pick<TeamScenario, 'members' | 'waiting' | 'reveal' | 'you' | 'views'>): string[] {
  return memberStates(s).flatMap(({ member, state, you }) => (state === 'waiting' || state === 'unclear')
    ? [you ? 'you' : state === 'unclear' ? `${member.name} (if they have not given theirs)` : member.name] : [])
}

/** What my own view panel shows: the composer, my view held, or (after the reveal) a summary of what I gave. */
export type ViewPhase = 'compose' | 'held' | 'revealed'
export function viewPhaseOf(s: Pick<TeamScenario, 'members' | 'waiting' | 'reveal' | 'you' | 'views'>): ViewPhase {
  if (s.reveal.state === 'revealed') return myRevealedView(s) !== null ? 'revealed' : 'compose'
  const me = memberStates(s).find((m) => m.you)
  if (me === undefined) return myOpenView(s) !== null ? 'held' : 'compose'
  return me.state === 'waiting' ? 'compose' : 'held'
}

/** The view I gave that was revealed, latest first: what the summary after the reveal says I gave. */
export const myRevealedView = (s: Pick<TeamScenario, 'views'>): TeamViewRow | null => [...s.views].reverse().find((v) => v.mine && v.revealed) ?? null

// ── views ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Every view that has been revealed, oldest first. Others' views are never here until core says so. */
export const revealedViews = (s: Pick<TeamScenario, 'views'>): readonly TeamViewRow[] => s.views.filter((v) => v.revealed)

// ── the approved model's records ──────────────────────────────────────────────────────────────────────────────────────────

const FAMILY_WORDS: Readonly<Record<string, string>> = {
  quantity: 'Figure', option: 'Option', goal: 'Aim', assumption: 'Assumption', condition: 'Condition', claim: 'Claim', dissent: 'Disagreement',
  risk: 'Risk', limit: 'Limit', left_out: 'Left out', preference: 'Preference',
}

/** A record's own words: its label, text or (for dissent) holder and position. Null when it has none to show. */
export function recordWords(r: TeamRecord): string | null {
  if (r.family === 'dissent' && r.holder && r.position) return `${r.holder}: ${r.position}`
  const own = r.label ?? r.text
  return typeof own === 'string' && own !== '' ? own : null
}

export interface RecordChoice { readonly id: string; readonly family: string; readonly familyWords: string; readonly words: string }

/** What evidence can bear on: the records of the APPROVED version that have words of their own. None before a version is approved. */
export function recordChoices(s: Pick<TeamScenario, 'version'>): readonly RecordChoice[] {
  return (s.version?.form.records ?? []).flatMap((r) => {
    const words = recordWords(r)
    return words === null || !FAMILY_WORDS[r.family] ? [] : [{ id: r.id, family: r.family, familyWords: FAMILY_WORDS[r.family]!, words }]
  })
}

/** The disagreements held in the approved model: the only ones a commitment can keep open. */
export const dissentsOf = (s: Pick<TeamScenario, 'version'>): readonly TeamRecord[] => (s.version?.form.records ?? []).filter((r) => r.family === 'dissent')

/** A record id as the person reads it in the approved model, or null when a later version no longer holds it. */
export function wordsOfRecord(s: Pick<TeamScenario, 'version'>, id: string): string | null {
  const r = s.version?.form.records.find((x) => x.id === id)
  return r ? recordWords(r) : null
}

// ── where the team differs (figures) ──────────────────────────────────────────────────────────────────────────────────────

export interface Position { readonly holder: string; readonly kind: 'point' | 'interval'; readonly value?: number; readonly low?: number; readonly high?: number; readonly rangeKind?: 'bounds' | 'plausible' }
export interface SpreadFor {
  readonly quantity: string
  readonly label: string
  readonly unit: string | null
  readonly positions: readonly Position[]
  /** The model's own figure for this quantity, drawn apart from the people; null when the model holds no known one. */
  readonly model: { readonly kind: 'point'; readonly value: number } | { readonly kind: 'interval'; readonly low: number; readonly high: number } | null
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** A figure as this page reads it: a point, or a range by its two ends (with the member's own reading of it when they gave one). */
export type ReadFigure =
  | { readonly kind: 'point'; readonly quantity: string; readonly value: number; readonly unit?: string }
  | { readonly kind: 'interval'; readonly quantity: string; readonly low: number; readonly high: number; readonly rangeKind?: 'bounds' | 'plausible'; readonly unit?: string }

/**
 * Read one figure of a view the way olumi-core serves it, which has no `kind`: a figure with a `value` is a point, one with `low` and `high` is a
 * range (API.md "Figures on a private view"). Anything else is NOT drawn and never throws: neither of the two, both at once, a number that is not
 * finite, or a range whose low end is above its high end. (Core never sends such a figure; a page that is shown one must not break on it.)
 */
export function readFigure(f: unknown): ReadFigure | null {
  if (f === null || typeof f !== 'object') return null
  const g = f as { quantity?: unknown; unit?: unknown; value?: unknown; low?: unknown; high?: unknown; range_kind?: unknown }
  if (typeof g.quantity !== 'string' || g.quantity === '') return null
  // The unit it was GIVEN in, which core keeps with the figure (a later version that changes the quantity's unit never changes what it meant).
  const unit = typeof g.unit === 'string' && g.unit !== '' && g.unit !== '1' ? { unit: g.unit } : {}
  const ranged = g.low !== undefined || g.high !== undefined
  if (g.value !== undefined && !ranged) return finite(g.value) ? { kind: 'point', quantity: g.quantity, value: g.value, ...unit } : null
  if (ranged && g.value === undefined) {
    if (!finite(g.low) || !finite(g.high) || g.low > g.high) return null
    return { kind: 'interval', quantity: g.quantity, low: g.low, high: g.high, ...(g.range_kind === 'bounds' || g.range_kind === 'plausible' ? { rangeKind: g.range_kind } : {}), ...unit }
  }
  return null
}

/**
 * One spread per quantity that at least TWO people gave a figure for in revealed views, with each person's own figure kept as
 * given: a range is carried by its two ends and is never reduced to a middle. Nothing is summed, averaged or ordered by merit.
 * Quantities are listed in the order they first appear.
 */
export function spreadsOf(s: Pick<TeamScenario, 'views' | 'version'>): readonly SpreadFor[] {
  const by = new Map<string, Position[]>()
  for (const v of revealedViews(s)) {
    for (const raw of v.figures ?? []) {
      const f = readFigure(raw)
      if (f === null) continue
      const list = by.get(f.quantity) ?? []
      list.push(f.kind === 'point' ? { holder: v.by, kind: 'point', value: f.value } : { holder: v.by, kind: 'interval', low: f.low, high: f.high, ...(f.rangeKind ? { rangeKind: f.rangeKind } : {}) })
      by.set(f.quantity, list)
    }
  }
  const out: SpreadFor[] = []
  for (const [quantity, positions] of by) {
    if (new Set(positions.map((p) => p.holder)).size < 2) continue
    const rec = s.version?.form.records.find((r) => r.id === quantity) as (TeamRecord & { unit?: string; assertion?: { kind: string; value?: number; low?: number; high?: number } }) | undefined
    const a = rec?.assertion
    const model = a?.kind === 'point' && finite(a.value) ? { kind: 'point' as const, value: a.value } : a?.kind === 'interval' && finite(a.low) && finite(a.high) ? { kind: 'interval' as const, low: a.low, high: a.high } : null
    out.push({ quantity, label: rec?.label ?? quantity, unit: rec?.unit && rec.unit !== '1' ? rec.unit : null, positions, model })
  }
  return out
}

// ── the model's band, for the commitment ──────────────────────────────────────────────────────────────────────────────────

export interface ModelBand {
  readonly id: string
  /** The option the range is under, in its own words; null when the finding names none. */
  readonly option: string | null
  /** What the range is of (the aim's measure), in its own words; null when it cannot be told. */
  readonly measure: string | null
  readonly low: number | null
  readonly high: number | null
  readonly unit: string | null
  /** Core's own `value` words, as stored: the figure of a range that carries no numbers. */
  readonly valueWords: string
  /** Core's own finding for this range, as stored, without the closing "It leaves out" which is shown apart. Nothing is composed here. */
  readonly words: string
  /** What the range leaves out, from the end of core's sentence; null when it says none. */
  readonly leavesOut: string | null
}
const LEAVES = /\s+It leaves out:\s*(.+?)\.?\s*$/

/** A figure of the band as a person reads it: three significant digits, no float noise ("89.7", "110"). */
export const bandNumber = (n: number): string => Number(n.toPrecision(3)).toLocaleString('en-GB', { maximumFractionDigits: 6 })

/**
 * The Run's range findings of the approved model: the band as its two numbers (`about.low`, `about.high`), the option and the
 * measure it is under, and what it leaves out. Nothing is rounded beyond three digits, composed or averaged; the middle is not drawn.
 */
export function modelBandOf(s: Pick<TeamScenario, 'version'>): readonly ModelBand[] {
  const records = s.version?.form.records ?? []
  const labelOf = (id: string | undefined) => { const r = records.find((x) => x.id === id); return r ? recordWords(r) : null }
  return (s.version?.facts ?? []).filter((f) => f.about?.kind === 'range').map((f) => {
    const a = f.about!
    const finiteBand = finite(a.low) && finite(a.high) && a.low <= a.high
    const goal = records.find((r) => r.id === a.goal)
    const unit = typeof a.unit === 'string' && a.unit !== '' && a.unit !== '1' ? a.unit : null
    const base = { id: f.id, option: labelOf(a.option), measure: labelOf(goal?.measure?.quantity), low: finiteBand ? a.low! : null, high: finiteBand ? a.high! : null, unit, valueWords: f.value }
    // A labelled fact (OLUMI_LABELS): its `text` is `label: item` pairs and is never read. The words come from `value` and `about`, and what the
    // aim leaves out from the left-out records `about.leaves` names.
    if (a.form === 'labels') {
      const left = (a.leaves ?? []).map((id) => wordsOfRecord(s, id)).filter((w): w is string => w !== null)
      const under = base.option ? `Under ‘${base.option}’, ` : ''
      const me = goal?.measure
      const how = [me?.frame && me.frame !== 'level' ? `as a ${me.frame.replace(/_/g, ' ')}` : '', me?.aggregation && me.aggregation !== 'end' ? `${me.aggregation.replace(/_/g, ' ')} over its period` : '', me?.per ? `per ${labelOf(me.per) ?? me.per}` : ''].filter(Boolean)
      const what = base.measure ? `‘${base.measure}’${how.length ? ` (${how.join(', ')})` : ''}` : 'the result'
      const rests = a.olumi === true ? ' This rests partly on what Olumi proposed.' : ''
      return { ...base, words: `${under}${what} is likely to be in this range (8 draws in 10).${rests}`, leavesOut: left.length ? left.join('; ') : null }
    }
    return { ...base, words: f.text.replace(LEAVES, '').trim() || f.value, leavesOut: LEAVES.exec(f.text)?.[1] ?? null }
  })
}

// ── D7: where the model and a member's figure disagree (OLUMI_D7) ─────────────────────────────────────────────────────────
//
// The words of a comparison belong to the AI (spec §3.0): nothing here says who leads, who is ahead or what a difference means. A row is core's own
// labels (`leader: reversed`), the names of the records, the chances each side gives and, apart, what each side rests on.

/**
 * A sampled chance as core writes it (never certain), so the words here agree with the Run's own. Held equal to the shim's (`labels.mjs` `chancePct`,
 * core's `pct`) by scienceConsumers.spec.mjs over the whole range.
 */
export const chancePct = (c: number): string => (c >= 1 ? 'over 99%' : c <= 0 ? 'under 1%' : c < 0.005 ? 'under 1%' : c > 0.995 ? 'over 99%' : `about ${Math.round(c * 100)}%`)

/**
 * Two chances a comparison names, with enough decimals to differ (up to three), as core's `apart`: 1.33% and 0.89% are "about 1.3%" and "about 0.9%",
 * never both "about 1%". Chances that are equal stay equal: they are not given invented decimals to differ.
 */
export function apartPct(a: number, b: number): [string, string] {
  if (a === b) return [chancePct(a), chancePct(b)]
  const at = (c: number, d: number): string => { const p = c * 100, step = 10 ** -d; return p < step ? `under ${step}%` : p > 100 - step ? `over ${+(100 - step).toFixed(d)}%` : `about ${p.toFixed(d)}%` }
  let x = chancePct(a), y = chancePct(b)
  for (let d = 1; x === y && d <= 3; d++) { x = at(a, d); y = at(b, d) }
  return [x, y]
}

/** Every reason core can give for a figure it did not run (`code`, API.md), in DGAI's words. A code it adds later gets the generic words below. */
const REFUSALS: Readonly<Record<string, string>> = {
  unknown_figure: 'the model does not hold that figure',
  derived_figure: 'that figure is worked out from others, so there is nothing to replace',
  structure_figure: 'that figure is fixed by how the model is built',
  no_figure: 'no figure was given',
  no_unit: 'the figure has no unit',
  unit_mismatch: 'the figure is in a different unit from the model\'s',
  not_a_figure: 'what was given is not a figure Olumi can use',
  outside_range: 'the figure lies outside what is possible for it',
  no_range_kind: 'the range does not say whether its ends are firm or a rough estimate',
  version_moved: 'the approved model has changed since it was given',
  capped: 'too many figures were revealed at once to run them all',
  model_not_run: 'the approved model has no result to compare with',
  option_left_out: 'an option could not be compared',
  view_cannot_compile: 'the model with that figure cannot be worked out',
  different_draws: 'the two runs could not be put on the same draws',
  view_not_run: 'the model with that figure did not run',
  draws_differ: 'the two runs did not use the same draws',
  no_aim_compared: 'there was no aim to compare on',
  view_error: 'something went wrong running it',
}
const GENERIC_REFUSAL = 'Olumi could not run it and cannot yet say why in plain words'
export type LeaderChange = 'same' | 'reversed' | 'now named' | 'now unnamed'
const LEADER_CHANGES: readonly string[] = ['same', 'reversed', 'now named', 'now unnamed']
/** What one side of a comparison rests on that is Olumi's or approximate: the Olumi mark is drawn when `olumi`, the lines are behind a disclosure. */
export interface ViewFindingSide { readonly olumi: boolean; readonly lines: readonly string[] }
export interface ViewFindingRow {
  readonly id: string
  readonly status: string
  readonly holder: string
  /** Core's word for what the figure did to the leader (`leader_change`); null when the figure was not run. */
  readonly change: LeaderChange | null
  /** The row as `label: item` pairs, in the order shown; `words` is the same joined as core's text is. */
  readonly pairs: readonly { readonly label: string; readonly item: string }[]
  readonly words: string
  readonly options: readonly { readonly option: string; readonly words: string }[]
  /** The provenance blocks of the unchanged model and of the model with the member's figure, read apart; null when the figure was not run. */
  readonly sides: { readonly model: ViewFindingSide; readonly view: ViewFindingSide } | null
}
export type ViewFindingsView =
  | { readonly status: 'stale'; readonly words: string }
  | { readonly status: 'current'; readonly rows: readonly ViewFindingRow[] }

/** What a block rests on, one plain line for each thing (no sentence of analysis): Olumi's figures, links and calculations with their approval, its reading of the aim, a target it proposed, approximate figures and premises. */
function sideOf(block: TeamProvenanceBlock | undefined, records: readonly TeamRecord[]): ViewFindingSide | null {
  if (!block || typeof block !== 'object') return null
  const q = (id: string): string => { const r = records.find((x) => x.id === id); const w = r ? recordWords(r) : null; return `‘${w ?? id.replace(/_/g, ' ')}’` }
  // An Olumi option's own setting of a figure is `<option>__<quantity>`.
  const figureName = (id: string): string => {
    if (records.some((r) => r.id === id)) return q(id)
    const at = id.indexOf('__')
    return at > 0 && records.some((r) => r.id === id.slice(0, at)) && records.some((r) => r.id === id.slice(at + 2)) ? `${q(id.slice(at + 2))} as ${q(id.slice(0, at))} sets it` : q(id)
  }
  const list = (xs: readonly string[]): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  const byApproval = (xs: readonly { id: string; approval?: string }[] | undefined) => {
    const all = Array.isArray(xs) ? xs.filter((x) => x && typeof x.id === 'string') : []
    return { approved: all.filter((x) => x.approval === 'approved'), proposed: all.filter((x) => x.approval !== 'approved') }
  }
  const lines: string[] = []
  const figs = byApproval(block.olumi_figures)
  if (figs.proposed.length) lines.push(`Olumi's what-if figures for ${list(figs.proposed.map((x) => figureName(x.id)))} (not yet approved)`)
  if (figs.approved.length) lines.push(`Olumi's what-if figures for ${list(figs.approved.map((x) => figureName(x.id)))} (approved)`)
  for (const [key, noun] of [['olumi_links', 'links'], ['olumi_mechanisms', 'calculations']] as const) {
    const got = byApproval(block[key])
    if (got.proposed.length) lines.push(`${noun} Olumi proposed (not yet approved)`)
    if (got.approved.length) lines.push(`${noun} Olumi proposed (approved)`)
  }
  if (block.olumi_reading === true) lines.push('Olumi\'s reading of the aim')
  if (block.target_by === 'olumi') lines.push(`a target Olumi proposed${block.target_approval === 'approved' ? ' (approved)' : ' (not yet approved)'}`)
  const approx = (block.approx_figures ?? []).filter((x): x is string => typeof x === 'string')
  if (approx.length) lines.push(`${list(approx.map(figureName))}, which they gave as approximate and Olumi reads as within 10% either way`)
  const premises = (block.rests ?? []).filter((x): x is string => typeof x === 'string')
  if (premises.length) lines.push(`the premises ${list(premises.map(q))}`)
  return { olumi: block.olumi === true, lines }
}

/**
 * What D7 says about the revealed figures, or null when it says nothing. Null when `view_findings` is absent or null (the flag is off, or no comparison
 * yet). A stale comparison shows its status and nothing else, however much it carries. A current one is a row for each fact, built from `about` only
 * (never `text`): a labelled rerun of the model with the member's figure, never an average and never a recommendation.
 */
export function viewFindingsOf(s: Pick<TeamScenario, 'view_findings' | 'version'>): ViewFindingsView | null {
  const vf = s.view_findings
  if (!vf || typeof vf !== 'object') return null
  if (vf.status === 'stale') {
    const words = vf.code === 'version_moved' ? 'The approved model has changed since these figures were compared, so the comparison is out of date.'
      : vf.code === 'reveal_moved' ? 'Views were revealed again since this comparison, so it is out of date.' : 'This comparison is out of date.'
    return { status: 'stale', words }
  }
  if (vf.status !== 'current' || !Array.isArray(vf.facts)) return null
  const records = s.version?.form.records ?? []
  const name = (id: string | null | undefined): string => { if (!id) return ''; const r = records.find((x) => x.id === id); const w = r ? recordWords(r) : null; return `‘${w ?? id.replace(/_/g, ' ')}’` }
  const sayChance = (c: number, exact: boolean | undefined): string => (exact && c === 1 ? 'always meets' : exact && c === 0 ? 'never meets' : chancePct(c))
  const rows = vf.facts.flatMap((f: TeamViewFact): ViewFindingRow[] => {
    const a = f.about
    if (a?.kind !== 'view') return []
    const holder = a.holder ?? 'A member'
    const join = (pairs: readonly { label: string; item: string }[]) => pairs.map((p) => `${p.label}: ${p.item}`).join('; ')
    const figure = { label: 'figure', item: `${name(a.quantity)}, ${holder}’s` }
    if (a.status !== 'ran') {
      const why = a.code && Object.prototype.hasOwnProperty.call(REFUSALS, a.code) ? REFUSALS[a.code]! : GENERIC_REFUSAL
      const pairs = [figure, { label: 'not run', item: why }]
      return [{ id: f.id, status: a.status ?? 'refused', holder, change: null, pairs, words: join(pairs), options: [], sides: null }]
    }
    const change = LEADER_CHANGES.includes(a.leader_change as string) ? a.leader_change as LeaderChange : null
    const replaces = a.model_figure_by === 'olumi' ? 'Olumi’s figure' : a.model_figure_by === 'person' ? 'a person’s figure' : null
    const pairs = [figure, { label: 'aim', item: name(a.goal) },
      ...(change ? [{ label: 'leader', item: change }] : []),
      { label: 'most likely on the model', item: a.model_leader ? name(a.model_leader) : 'none separated' },
      { label: `most likely on ${holder}’s figure`, item: a.leader ? name(a.leader) : 'none separated' },
      ...(replaces ? [{ label: 'replaces', item: replaces }] : [])]
    const options = (a.options ?? []).map((o) => {
      // Two sampled chances that would read the same are told apart (core's `apart`); a fixed one says so.
      const both = !o.model_exact && !o.view_exact
      const [m, v] = both ? apartPct(o.model, o.view) : [sayChance(o.model, o.model_exact), sayChance(o.view, o.view_exact)]
      return { option: o.option, words: `${name(o.option)}: ${m} on the model, ${v} on ${holder}’s figure.` }
    })
    const model = sideOf(a.model_side, records), view = sideOf(a.view_side, records)
    return [{ id: f.id, status: 'ran', holder, change, pairs, words: join(pairs), options, sides: model && view ? { model, view } : null }]
  })
  return { status: 'current', rows }
}
