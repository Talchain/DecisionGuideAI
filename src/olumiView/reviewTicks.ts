/**
 * The waiting proposal's choices, shared by the review's change list and the cards' "Olumi's suggestion" chips (old look, Paul 15 Nov ~13:10Z:
 * a UX that "empowers the user to help resolve" the AI's weaknesses). Nothing here is saved: core keeps a choice only on the review's one
 * commit, "Approve ticked" (approveSelected, the ticked lines), so a chip says so after every tap. A tick is a line's key (journey.ts lineKey);
 * `rejected` marks a line the person turned down from its card, so the plain Approve (every line) is held while one is set. Reset whenever
 * the proposal changes.
 */
import { create } from 'zustand'
import type { View } from './client'

type Change = NonNullable<View['proposal']>['changes'][number]
export const lineKey = (c: Change): string => `${c.top ? 'top' : 'rec'}:${c.id}`

type Ticks = { readonly pid: number | null; readonly ticked: ReadonlySet<string>; readonly rejected: ReadonlySet<string>; readonly review: number }
export const useReviewTicks = create<Ticks>()(() => ({ pid: null, ticked: new Set(), rejected: new Set(), review: 0 }))

/** The choices for proposal `pid`: an earlier proposal's are dropped. */
export const ticksFor = (s: Ticks, pid: number): Ticks => (s.pid === pid ? s : { pid, ticked: new Set(), rejected: new Set(), review: s.review })

/** ⛔ NEVER ORPHAN OLUMI'S FIGURE (R4, core v1.13 `together`): a line approved only with others is chosen and unchosen with them. */
export const withPartners = (changes: readonly Change[], c: Change): Change[] => {
  const ids = c.together?.ids ?? []
  return [c, ...changes.flatMap((o) => (!o.top && ids.includes(o.id) && o !== c ? [o] : []))]
}

/** Tick (`on`) or untick lines with their partners; a ticked line is no longer rejected. */
export function setTicks(pid: number, changes: readonly Change[], cs: readonly Change[], on: boolean): void {
  useReviewTicks.setState((s0) => {
    const s = ticksFor(s0, pid), t = new Set(s.ticked), r = new Set(s.rejected)
    for (const c of cs) for (const x of withPartners(changes, c)) { if (on) { t.add(lineKey(x)); r.delete(lineKey(x)) } else t.delete(lineKey(x)) }
    return { ...s, ticked: t, rejected: r }
  })
}

/** A card's choice: accept (tick), reject (untick and mark), or undo (neither). */
export function chooseFromCard(pid: number, changes: readonly Change[], c: Change, what: 'accept' | 'reject' | 'undo'): void {
  useReviewTicks.setState((s0) => {
    const s = ticksFor(s0, pid), t = new Set(s.ticked), r = new Set(s.rejected)
    for (const x of withPartners(changes, c)) {
      const k = lineKey(x)
      if (what === 'accept') { t.add(k); r.delete(k) } else if (what === 'reject') { t.delete(k); r.add(k) } else { t.delete(k); r.delete(k) }
    }
    return { ...s, ticked: t, rejected: r }
  })
}

/** One tap to the review's commit: the review opens and brings "Approve ticked" into view. */
export const openReview = (): void => useReviewTicks.setState((s) => ({ review: s.review + 1 }))
export const clearTicks = (): void => useReviewTicks.setState((s) => ({ pid: s.pid, ticked: new Set(), rejected: new Set(), review: s.review }))
