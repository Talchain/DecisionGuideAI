/**
 * THE VIEW, READ AGAIN WHILE THE PAGE IS SEEN (R1 blocker, 4 Nov): another member's input (their evidence, their view, an approval)
 * reaches this page without a press or a reload. About every POLL_MS while the page is visible, the store reads the View again through
 * its numbered reads (`store.refresh`), so a newer read (a write's own) always wins and an older answer is dropped. Never two at once: a
 * re-read waits for its own answer before the next is timed, and none starts while any other read is on its way. Paused while the page is
 * hidden; on coming back into view, or when its window gains focus again, it reads at once.
 *
 * AI JOBS (core API v1.26, 8 Nov): a first draft runs in the server after its brief is accepted, and the View's `draft` says how far it
 * is, in core's words. While the scenario on screen is drafting, this same loop reads about every DRAFT_POLL_MS (no second loop, the same
 * rules: never two at once, paused while hidden, a newer read wins); once the draft has ended, or the page is on another scenario or a
 * past version, it is back to POLL_MS. A read that fails keeps the last View (store.refresh): it never marks the draft failed and never
 * sends the brief again. Reading never starts work in core.
 */
import { useEffect } from 'react'
import { isReading, useViewStore } from './store'
import { noteMoved } from './notice'

export const POLL_MS = 10_000
export const DRAFT_POLL_MS = 1_500

/** The scenario on screen is the latest and its first draft is still running in core, or its View has not been read yet (a brief was just
 *  accepted and the first read failed: read again soon, never wait a whole POLL_MS to learn its state; Codex r1 #4). */
// Core API v1.28: a turn Olumi is answering in core (the View's `turn`) is read at the same pace as a drafting first model; v1.29: so is
// Olumi's reply to an edit while it runs (the View's `reply`).
const drafting = (): boolean => { const { view, at, sid } = useViewStore.getState(); return sid !== null && at === null && (view === null || view.draft?.status === 'drafting' || view.turn?.status === 'answering' || view.reply?.status === 'running') }

export function useViewPoll(on: boolean): void {
  useEffect(() => {
    if (!on) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let going = false, stopped = false, fast = false
    const seen = () => typeof document === 'undefined' || document.visibilityState === 'visible'
    const next = () => { if (!stopped && seen()) { fast = drafting(); timer = setTimeout(() => void tick(), fast ? DRAFT_POLL_MS : POLL_MS) } }
    const tick = async () => {
      timer = null
      if (stopped || going) return
      const { sid, view } = useViewStore.getState()
      // (Hidden, no re-read is timed: `next` sets none, and hiding clears the one set.)
      // A selected scenario is read even before its first View loaded (that first read may have failed).
      if (sid !== null && !isReading()) {
        going = true
        const was = view?.version?.n ?? 0
        try { await useViewStore.getState().refresh() } finally { going = false }
        // A newer approved version arrived (another member's approval): say so in words, once, with who approved it (`notice.ts`).
        const now = useViewStore.getState()
        if (now.at === null && now.sid === sid && now.view !== null && (now.view.version?.n ?? 0) > was) void noteMoved(sid, now.view.version!.n)
      }
      next()
    }
    const onVisibility = () => {
      if (seen()) { if (timer === null && !going) void tick() } else if (timer !== null) { clearTimeout(timer); timer = null }
    }
    // Back to this window (X2 rehearsal, DL 9 Nov: another window approved; re-entering the same address reads nothing, since a browser
    // fires no event for an identical URL): read at once, as on coming back into view, unless a read is on its way.
    const onFocus = () => { if (seen() && !going) { if (timer !== null) { clearTimeout(timer); timer = null } void tick() } }
    // A draft that starts while a slow re-read is timed (the page just moved to the scenario its brief made): time the next one sooner.
    const unwatch = useViewStore.subscribe(() => { if (timer !== null && !fast && !going && drafting()) { clearTimeout(timer); timer = null; next() } })
    next()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => { stopped = true; unwatch(); if (timer !== null) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('focus', onFocus) }
  }, [on])
}
