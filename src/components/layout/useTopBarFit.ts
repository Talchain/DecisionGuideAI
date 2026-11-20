/**
 * The top bar never overlaps the dock (DL 10 Nov, Codex at 900 x 704 with eight people: with every avatar already collapsed the Summary control
 * still covered the Team heading). TeamPresence collapses avatars first; when none are left and the bar still runs past the dock's left edge,
 * the bar's other controls give way one step at a time, in this order: Share keeps its icon only, the version pill is dropped (the version is on
 * the Versions control), and only last the scenario name shortens. The name is the person's own words (Paul: never clipped at 1232), so it
 * goes after everything that can go without losing them; at 1232 the first two steps already fit the lens bar beside the pill. No control is
 * removed that has no other place.
 * On the core lane the limit also keeps room for the icon lens bar beside the pill (TeamPresence `topRowLimit`, Paul 17 Nov).
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { topRowLimit } from '../../olumiView/TeamPresence'

/** The step at which each control gives way (also the `data-tight` values TopBar.module.css reads: keep both in step). */
export const TIGHT_STEPS = { share: 1, version: 2, name: 3 } as const
export const TIGHT_MAX = TIGHT_STEPS.name

export function useTopBarFit(bar: RefObject<HTMLElement | null>, key: string): number {
  const [state, setState] = useState({ sig: '', level: 0 })
  // What measure last decided. Only measure writes the state, so this is always the state's own value.
  const latest = useRef(state)
  const measure = () => {
    const limit = topRowLimit()
    const sig = `${key}|${limit}`
    const el = bar.current
    // Over the limit with no avatar left to collapse (the "+N" chip is not an avatar): the next step.
    const over = el !== null && limit !== Infinity && el.getBoundingClientRect().right > limit && el.querySelector('[data-presence-disc]') === null
    // A measurement that changes nothing schedules NOTHING (DL 10 Nov: this effect runs after every render, and an update asked for on
    // every render, even one that leaves the state as it was, re-rendered the bar without end mid-draft: React's "maximum update depth").
    const s = latest.current
    const next = s.sig !== sig ? { sig, level: 0 } : over && s.level < TIGHT_MAX ? { sig, level: s.level + 1 } : s
    if (next === s) return
    latest.current = next; setState(next)
  }
  useLayoutEffect(measure)
  useEffect(() => {
    window.addEventListener('resize', measure); window.addEventListener('outputs-dock-opened', measure)
    const t = setInterval(measure, 500)
    return () => { clearInterval(t); window.removeEventListener('resize', measure); window.removeEventListener('outputs-dock-opened', measure) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure reads the latest key through the closure of each render's effect
  }, [key])
  return state.level
}
