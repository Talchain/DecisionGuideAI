/**
 * The dock reaches the bottom of the window on the olumi-core lane (Paul's 6 Nov test: "the right panel stops ~110 px short").
 * The dock is fixed to the window with `bottom: var(--bottombar-h)` (OutputsDock), and `:root` sets that to 72px for the routes that
 * draw a bottom bar. The legacy canvas zeroes it while it is mounted (ReactFlowGraph's reserve effect); the lane never mounts that
 * canvas, so the dock kept the 72px gap. The lane's canvas does the same here: zero while mounted, the previous value restored on leave.
 */
import { useEffect } from 'react'

export const BOTTOMBAR_VAR = '--bottombar-h'

export function useDockFullHeight(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const previous = root.style.getPropertyValue(BOTTOMBAR_VAR) || getComputedStyle(root).getPropertyValue(BOTTOMBAR_VAR)
    root.style.setProperty(BOTTOMBAR_VAR, '0px')
    return () => { root.style.setProperty(BOTTOMBAR_VAR, previous || '0px') }
  }, [])
}
