/**
 * The top bar never overlaps the dock (DL 10 Nov, Codex at 900 x 704 with eight people: with every avatar already collapsed the Summary control
 * still covered the Team heading). TeamPresence collapses avatars first; when none are left and the bar still runs past the dock's left edge,
 * the bar's other controls give way one step at a time, in this order: the scenario name shortens (it already ends in "…"), the version pill
 * is dropped (the version is on the Versions control), then Share keeps its icon only. No control is removed that has no other place.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { measureDockInset } from '../../canvas/components/FloatingOlumiPanel'
import { DOCK_GAP } from '../../olumiView/TeamPresence'

export const TIGHT_MAX = 3

export function useTopBarFit(bar: RefObject<HTMLElement | null>, key: string): number {
  const [state, setState] = useState({ sig: '', level: 0 })
  // What measure last decided. Only measure writes the state, so this is always the state's own value.
  const latest = useRef(state)
  const measure = () => {
    const inset = measureDockInset(), limit = inset > 0 ? window.innerWidth - inset - DOCK_GAP : Infinity
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
