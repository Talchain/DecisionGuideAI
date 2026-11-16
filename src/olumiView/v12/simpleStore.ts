/**
 * V12 Simple / Detailed level, per scenario. Both levels draw every card and link of the model: Simple draws each card as visuals (SimpleFace),
 * Detailed draws today's full faces ('working' is its stored name). Simple is the default; the person's choice is kept per scenario in
 * localStorage (every read and write guarded: it can be empty or throw).
 */
import { create } from 'zustand'
import { useViewStore } from '../store'

export type Level = 'simple' | 'working'
export const DEFAULT_LEVEL: Level = 'simple'
/** What a scenario with no choice of its own opens at: Simple. The unit-test run opens at Detailed (the full faces its older specs read) unless a spec
 *  says otherwise with `setDefaultLevel`; v12/__tests__/simple.spec.tsx sets Simple explicitly. */
let fallback: Level = import.meta.env?.MODE === 'test' ? 'working' : DEFAULT_LEVEL
export const setDefaultLevel = (level: Level): void => { fallback = level }
const KEY = (sid: string) => `olumi.v12.level.${sid}`

export function storedLevel(sid: string | null): Level | null {
  if (sid === null) return null
  try { const v = window.localStorage.getItem(KEY(sid)); return v === 'simple' || v === 'working' ? v : null } catch { return null }
}
function keep(sid: string, level: Level): void { try { window.localStorage.setItem(KEY(sid), level) } catch { /* the choice lasts this visit */ } }

type State = { readonly levels: Readonly<Record<string, Level>> }
export const useSimpleLevel = create<State>()(() => ({ levels: {} }))

/** The level for a scenario: the person's choice this visit, else the stored one, else Simple. */
export const levelOf = (sid: string | null, s: State = useSimpleLevel.getState()): Level => (sid === null ? fallback : s.levels[sid] ?? storedLevel(sid) ?? fallback)

const sidNow = (): string | null => useViewStore.getState().sid

export function setLevel(level: Level, sid: string | null = sidNow()): void {
  if (sid === null) return
  keep(sid, level)
  useSimpleLevel.setState((s) => ({ levels: { ...s.levels, [sid]: level } }))
}
/** "Detailed" (and the right-click menu's "Switch to Detailed"). */
export const showWholeModel = (sid?: string | null): void => setLevel('working', sid)
/** Back to Simple. */
export const showSimple = (sid?: string | null): void => setLevel('simple', sid)
export function toggleSimple(sid: string | null = sidNow()): Level {
  const next: Level = levelOf(sid) === 'simple' ? 'working' : 'simple'
  setLevel(next, sid)
  return next
}
/** The level now, for the scenario on screen. */
export const useLevel = (): Level => { const sid = useViewStore((s) => s.sid); return useSimpleLevel((s) => levelOf(sid, s)) }
