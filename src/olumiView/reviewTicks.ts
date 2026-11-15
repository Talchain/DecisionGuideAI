/**
 * The waiting proposal's choices, shared by the review's change list and the cards' "Olumi's suggestion" chips (old look, Paul 15 Nov ~13:10Z:
 * a UX that "empowers the user to help resolve" the AI's weaknesses). Nothing here is saved: core keeps a choice only on the review's commit
 * (Approve ticked: approveSelected, the ticked lines; with one line, Approve or Set aside), so a chip says so after every tap. A tick is a line's
 * key (lineKey); `rejected` marks a line turned down from its card. A rejection is reversed only by that line's own tick or the card's Undo:
 * a group tick or a partner never re-ticks it (Codex 15 Nov). The choices belong to ONE scenario's ONE proposal (`key`), and are dropped when
 * the scenario or the proposal changes, and after Approve or Set aside.
 */
import { create } from 'zustand'
import type { View } from './client'
import { useViewStore } from './store'

type Change = NonNullable<View['proposal']>['changes'][number]
export const lineKey = (c: Change): string => `${c.top ? 'top' : 'rec'}:${c.id}`

type Ticks = { readonly key: string | null; readonly ticked: ReadonlySet<string>; readonly rejected: ReadonlySet<string>; readonly review: number }
const EMPTY = { ticked: new Set<string>(), rejected: new Set<string>() }
export const useReviewTicks = create<Ticks>()(() => ({ key: null, ...EMPTY, review: 0 }))

/** The choices' owner: this scenario's proposal. */
export const ticksKey = (sid: string | null, pid: number): string => `${sid ?? ''}#${pid}`
/** The choices for `key`; another owner's are never shown. */
export const ticksFor = (s: Ticks, key: string): Ticks => (s.key === key ? s : { key, ...EMPTY, review: s.review })

/** ⛔ NEVER ORPHAN OLUMI'S FIGURE (R4, core v1.13 `together`): a line approved only with others is chosen and unchosen with them. */
export const withPartners = (changes: readonly Change[], c: Change): Change[] => {
  const ids = c.together?.ids ?? []
  return [c, ...changes.flatMap((o) => (!o.top && ids.includes(o.id) && o !== c ? [o] : []))]
}

const update = (key: string, f: (t: Set<string>, r: Set<string>) => void): void => useReviewTicks.setState((s0) => {
  const s = ticksFor(s0, key), t = new Set(s.ticked), r = new Set(s.rejected)
  f(t, r)
  return { ...s, ticked: t, rejected: r }
})

/**
 * The list's ticks. `direct`: the person ticked this one line in the list, which reverses its own rejection. A line is never ticked while a
 * line it goes with (its partners, or itself when not direct) is rejected: R4 keeps them together, and only the rejected line's own tick or
 * its card's Undo reverses a rejection.
 */
export function setTicks(key: string, changes: readonly Change[], cs: readonly Change[], on: boolean, direct = false): void {
  update(key, (t, r) => {
    for (const c of cs) {
      const group = withPartners(changes, c)
      if (on) {
        if (direct) r.delete(lineKey(c))
        if (group.some((x) => r.has(lineKey(x)))) continue
        for (const x of group) t.add(lineKey(x))
      } else for (const x of group) t.delete(lineKey(x))
    }
  })
}

/** A card's choice: accept (tick with partners; not while a partner is rejected), reject (untick with partners, and mark), undo (neither). */
export function chooseFromCard(key: string, changes: readonly Change[], c: Change, what: 'accept' | 'reject' | 'undo'): void {
  update(key, (t, r) => {
    const group = withPartners(changes, c), k = lineKey(c)
    if (what === 'accept') { if (group.some((x) => x !== c && r.has(lineKey(x)))) return; r.delete(k); for (const x of group) t.add(lineKey(x)) }
    else if (what === 'reject') { for (const x of group) t.delete(lineKey(x)); r.add(k) }
    else { r.delete(k); for (const x of group) t.delete(lineKey(x)) }
  })
}

/** A partner of `c` that is rejected (Accept waits until that rejection is undone). */
export const rejectedPartner = (s: Ticks, changes: readonly Change[], c: Change): Change | null =>
  withPartners(changes, c).find((x) => x !== c && s.rejected.has(lineKey(x))) ?? null

/** One tap to the review's commit: the review opens and brings its commit into view. */
export const openReview = (): void => useReviewTicks.setState((s) => ({ review: s.review + 1 }))
/** Drop the choices of `key` (after Approve or Set aside of that proposal; another owner's choices are left alone). */
export const clearTicks = (key: string): void => useReviewTicks.setState((s) => (s.key === key ? { key, ...EMPTY } : {}))

// A new scenario on the page drops every choice: none is ever shown for a scenario it was not made in.
useViewStore.subscribe((s, prev) => { if (s.sid !== prev.sid) useReviewTicks.setState({ key: null, ...EMPTY }) })
