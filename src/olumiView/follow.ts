/**
 * When the page reads the View: for the scenario on screen, and again whenever it changes. Every write reads the View again itself
 * (ViewChat `act`, the Team tab's `onWrote`), and another member's change arrives on the next read, so the canvas, the chat and the Team
 * tab always show one View.
 */
import { useEffect } from 'react'
import { useViewStore } from './store'

export function useViewFollows(on: boolean, uuid: string | null): void {
  useEffect(() => {
    if (on) void useViewStore.getState().use(uuid)
  }, [on, uuid])
}
