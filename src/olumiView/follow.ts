/**
 * When the page reads the View: for the scenario on screen, and again whenever it changes. Every write reads the View again itself
 * (ViewChat `act`, the Team tab's `onWrote`), and another member's change arrives on the next read, so the canvas, the chat and the Team
 * tab always show one View.
 */
import { useEffect } from 'react'
import { useViewStore } from './store'

export function useViewFollows(on: boolean, uuid: string | null): void {
  useEffect(() => {
    if (!on) return
    // Pre-screen row 10 (DL 10 Nov): the store outlives the page, so a scenario reopened can arrive with its last View already held
    // (`use` then reads nothing) and showed it for a whole poll interval, or a past version left open. Reopened, it is read at once, on
    // the latest version.
    const held = useViewStore.getState()
    if (uuid !== null && held.uuid === uuid && held.sid !== null && held.view !== null) { if (held.at !== null) void held.look(null); else void held.refresh(); return }
    void held.use(uuid)
  }, [on, uuid])
}
