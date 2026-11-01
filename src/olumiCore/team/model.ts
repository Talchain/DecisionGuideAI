/**
 * What the Team tab shows, derived from the olumi-core scenario view by pure functions (no component, no store).
 * Every number and word here is read from the view; nothing is composed, averaged or ranked.
 */
import type { TeamFigure, TeamMember, TeamRecord, TeamScenario, TeamViewRow } from './types'

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
  // Am I still to give a view this round? By name when my name is mine alone; else by whether I have one open.
  const iWaiting = me === undefined ? false : (members.get(me.name) === 1 ? waiting.has(me.name) : mine === null)
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

export interface Position { readonly holder: string; readonly kind: 'point' | 'interval'; readonly value?: number; readonly low?: number; readonly high?: number }
export interface SpreadFor {
  readonly quantity: string
  readonly label: string
  readonly unit: string | null
  readonly positions: readonly Position[]
  /** The model's own figure for this quantity, drawn apart from the people; null when the model holds no known one. */
  readonly model: { readonly kind: 'point'; readonly value: number } | { readonly kind: 'interval'; readonly low: number; readonly high: number } | null
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const validFigure = (f: TeamFigure): boolean => f.kind === 'point' ? finite(f.value) : f.kind === 'interval' ? finite(f.low) && finite(f.high) && f.low <= f.high : false

/**
 * One spread per quantity that at least TWO people gave a figure for in revealed views, with each person's own figure kept as
 * given: a range is carried by its two ends and is never reduced to a middle. Nothing is summed, averaged or ordered by merit.
 * Quantities are listed in the order they first appear.
 */
export function spreadsOf(s: Pick<TeamScenario, 'views' | 'version'>): readonly SpreadFor[] {
  const by = new Map<string, Position[]>()
  for (const v of revealedViews(s)) {
    for (const f of v.figures ?? []) {
      if (!validFigure(f)) continue
      const list = by.get(f.quantity) ?? []
      list.push(f.kind === 'point' ? { holder: v.by, kind: 'point', value: f.value } : { holder: v.by, kind: 'interval', low: f.low, high: f.high })
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
  /** Core's own `value` words, kept only for a range that carries no numbers. */
  readonly valueWords: string
  /** What the range leaves out, from the end of core's sentence; null when it says none. */
  readonly leavesOut: string | null
}
const LEAVES = /\s+It leaves out:\s*(.+?)\.?\s*$/

/** A figure of the band as a person reads it: three significant digits, no float noise ("89.7", "110"). */
export const bandNumber = (n: number): string => Number(n.toPrecision(3)).toLocaleString('en-GB', { maximumFractionDigits: 6 })

/**
 * The Run's range findings of the approved model: the band as its two numbers (`about.low`, `about.high`: 8 runs in 10), the option and the
 * measure it is under, and what it leaves out. Nothing is rounded beyond three digits, composed or averaged; the middle is not drawn.
 */
export function modelBandOf(s: Pick<TeamScenario, 'version'>): readonly ModelBand[] {
  const records = s.version?.form.records ?? []
  const labelOf = (id: string | undefined) => { const r = records.find((x) => x.id === id); return r ? recordWords(r) : null }
  return (s.version?.facts ?? []).filter((f) => f.about?.kind === 'range').map((f) => {
    const a = f.about!
    const finiteBand = finite(a.low) && finite(a.high) && a.low <= a.high
    const goal = records.find((r) => r.id === a.goal)
    return {
      id: f.id, option: labelOf(a.option), measure: labelOf(goal?.measure?.quantity),
      low: finiteBand ? a.low! : null, high: finiteBand ? a.high! : null,
      unit: typeof a.unit === 'string' && a.unit !== '' && a.unit !== '1' ? a.unit : null,
      valueWords: f.value, leavesOut: LEAVES.exec(f.text)?.[1] ?? null,
    }
  })
}
