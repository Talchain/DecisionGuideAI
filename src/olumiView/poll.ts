/**
 * THE VIEW, READ AGAIN WHILE THE PAGE IS SEEN (R1 blocker, 4 Nov): another member's input (their evidence, their view, an approval)
 * reaches this page without a press or a reload. About every POLL_MS while the page is visible, the store reads the View again through
 * its numbered reads (`store.refresh`), so a newer read (a write's own) always wins and an older answer is dropped. Never two at once: a
 * re-read waits for its own answer before the next is timed, and none starts while any other read is on its way. Paused while the page is
 * hidden; on coming back into view it reads at once.
 */
import { useEffect } from 'react'
import { isReading, useViewStore } from './store'
import { noteMoved } from './notice'

export const POLL_MS = 10_000

export function useViewPoll(on: boolean): void {
  useEffect(() => {
    if (!on) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let going = false, stopped = false
    const seen = () => typeof document === 'undefined' || document.visibilityState === 'visible'
    const next = () => { if (!stopped && seen()) timer = setTimeout(() => void tick(), POLL_MS) }
    const tick = async () => {
      timer = null
      if (stopped || going) return
      const { sid, view } = useViewStore.getState()
      // (Hidden, no re-read is timed: `next` sets none, and hiding clears the one set.)
      if (sid !== null && view !== null && !isReading()) {
        going = true
        const was = view.version?.n ?? 0
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
    next()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stopped = true; if (timer !== null) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [on])
}
