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

// ── members and the held count ────────────────────────────────────────────────────────────────────────────────────────────

export type MemberState = 'in' | 'held' | 'waiting'

/**
 * Where each member stands THIS round, from `members[]`, `waiting[]` and `reveal`: never from `views[]`, which hides others'
 * private views and also holds the rounds already revealed. A skip is a given view (core takes it out of `waiting`).
 * After a reveal core opens the next round with everyone waiting; that is not "everyone is late", so a revealed state reads "in".
 */
export function memberStates(s: Pick<TeamScenario, 'members' | 'waiting' | 'reveal'>): ReadonlyArray<{ member: TeamMember; state: MemberState }> {
  const waiting = new Set(s.waiting)
  return s.members.map((member) => ({
    member,
    state: s.reveal.state === 'revealed' ? 'in' : waiting.has(member.name) ? 'waiting' : 'held',
  }))
}

/** "2 of 3 have given a view" for the current round, or null once the round has been revealed (the next round has not begun). */
export function heldOf(s: Pick<TeamScenario, 'members' | 'waiting' | 'reveal'>): { given: number; of: number } | null {
  if (s.reveal.state === 'revealed') return null
  const of = s.members.length
  if (of === 0) return null
  return { given: Math.max(0, Math.min(of, of - s.waiting.length)), of }
}

/** The words for the held count, as the card mark and the tab both say them. */
export const heldWords = (h: { given: number; of: number }): string => `${h.given} of ${h.of} views held`

// ── views ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** My view of this round, if I have given one: shown to me alone until the reveal. */
export const myOpenView = (s: Pick<TeamScenario, 'views'>): TeamViewRow | null => s.views.find((v) => v.mine && !v.revealed) ?? null

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
