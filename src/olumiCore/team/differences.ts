/**
 * Where your explanations differ (core `GET /api/scenarios/:s/differences`, olumi-core wip/debate, API.md "Where your explanations differ"):
 * the revealed figures two members differ on, side by side per aim, with each one's chance for each option (core's two runs of the same
 * draws), core's sentence for what the difference does, what would tell the figures apart, and what the team chose. Every word and value
 * is core's; this module only reads it and checks its shape. A core without the route (404) or with another shape draws nothing.
 */
import { create } from 'zustand'
import { call, TeamApiError } from './api'

export type DifferenceStatus = 'changes' | 'moves' | 'same' | 'pending' | 'not_run'
export interface DifferenceSide { readonly view: number; readonly holder: string; readonly holder_id: string; readonly figure: string; readonly title: string; readonly leader: string | null; readonly text: string }
export interface DifferenceOption { readonly option: string; readonly label: string; readonly model: string; readonly chances: ReadonlyArray<{ readonly holder_id: string; readonly chance: number; readonly text: string }> }
export interface Settle { readonly kind: 'crossing' | 'worth' | 'diagnostic' | 'no_change'; readonly text: string; readonly fact: string | null }
export interface StepShown { readonly id: number; readonly at: string; readonly by: string; readonly by_id: string; readonly step: 'dissent' | 'research'; readonly version: number; readonly text: string }
export interface Difference {
  readonly record: string; readonly label: string; readonly goal: string; readonly goal_label: string
  readonly status: DifferenceStatus; readonly status_text: string
  readonly sides: readonly DifferenceSide[]; readonly options: readonly DifferenceOption[]; readonly settle: readonly Settle[]; readonly steps: readonly StepShown[]
}
export interface DifferenceHeadings { readonly sides: string; readonly options: string; readonly model: string; readonly settle: string; readonly steps: string; readonly dissent: string; readonly research: string; readonly commit: string }
export interface Differences { readonly scenario: string; readonly version: number | null; readonly gated: boolean; readonly heading: string; readonly empty: string; readonly differences: readonly Difference[]; readonly headings: DifferenceHeadings }

const path = (sid: string) => `/api/scenarios/${encodeURIComponent(sid)}/differences`

const isStr = (x: unknown): x is string => typeof x === 'string'
/** Core's shape, or null: a read that is not it is never drawn as if it were. */
export function differencesShape(x: unknown): Differences | null {
  const d = x as Partial<Differences> | null
  if (d === null || typeof d !== 'object' || !isStr(d.heading) || !isStr(d.empty) || typeof d.gated !== 'boolean' || !Array.isArray(d.differences) || d.headings === undefined) return null
  const h = d.headings as unknown as Record<string, unknown>
  if (!['sides', 'options', 'model', 'settle', 'steps', 'dissent', 'research', 'commit'].every((k) => isStr(h[k]))) return null
  const ok = d.differences.every((x) => isStr(x.record) && isStr(x.label) && isStr(x.status_text) && Array.isArray(x.sides) && Array.isArray(x.options) && Array.isArray(x.settle) && Array.isArray(x.steps))
  return ok ? (d as Differences) : null
}

interface DifferencesState { readonly sid: string | null; readonly key: string | null; readonly data: Differences | null; readonly error: string | null }
/** The last read, by the View it was read for (`key`), so changing tabs neither re-reads nor forgets it. */
export const useDifferences = create<DifferencesState>()(() => ({ sid: null, key: null, data: null, error: null }))
const inFlight = new Map<string, Promise<void>>()

/** Read for this View (`key`: the scenario, the version and the revealed views), and again after a step. The last read for the same scenario
 *  stays drawn meanwhile. A core without the route draws nothing and says nothing. */
export function readDifferences(sid: string, key: string): Promise<void> {
  const going = inFlight.get(key)
  if (going) return going
  const p = (async () => {
    try {
      const got = differencesShape(await call<unknown>('GET', path(sid)))
      useDifferences.setState({ sid, key, data: got, error: null })
    } catch (e) {
      // 404: this core has no such read yet (served before wip/debate); nothing is drawn.
      if (e instanceof TeamApiError && e.status === 404) useDifferences.setState({ sid, key, data: null, error: null })
      else useDifferences.setState((s) => ({ sid, key, data: s.sid === sid ? s.data : null, error: e instanceof TeamApiError ? e.message : 'Olumi could not be read just now. Try again in a moment.' }))
    } finally { inFlight.delete(key) }
  })()
  inFlight.set(key, p)
  return p
}

/** Keep the difference as a disagreement, or agree to find out (core `POST …/differences/:record/steps`): one shared row, no AI call. */
export const stepDifference = (sid: string, record: string, step: 'dissent' | 'research') =>
  call<{ step: number }>('POST', `${path(sid)}/${encodeURIComponent(record)}/steps`, { step })

/** For specs. */
export function resetDifferences(): void { inFlight.clear(); useDifferences.setState({ sid: null, key: null, data: null, error: null }) }
