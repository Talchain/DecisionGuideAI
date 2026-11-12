/**
 * Where your explanations differ (core `GET /api/scenarios/:s/differences`, olumi-core wip/debate, API.md "Where your explanations differ"):
 * the revealed figures two members differ on, side by side per aim, with each one's chance for each option (core's two runs of the same
 * draws), core's sentence for what the difference does, what would tell the figures apart, and what the team chose. Every word and value
 * is core's; this module only reads it and checks its shape. A core without the route (404) or with another shape draws nothing.
 */
import { create } from 'zustand'
import type { View } from '../../olumiView/client'
import { call, TeamApiError } from './api'

/** `withheld` (core 84e2bada): a version's Run withholds a chance the other gives; said with its reason, never read as the same. */
export type DifferenceStatus = 'changes' | 'moves' | 'same' | 'withheld' | 'pending' | 'not_run'
export interface DifferenceSide { readonly view: number; readonly holder: string; readonly holder_id: string; readonly figure: string; readonly title: string; readonly leader: string | null; readonly text: string }
/** One holder's result: their version's chance, or (`chance` null) what their version's Run withholds, in its own words (`withheld.value`, and
 *  `withheld.reason` in full). Core never fills it from another run, and nothing here does either: `text` is drawn as given. */
export interface ChanceEntry { readonly holder_id: string; readonly chance: number | null; readonly text: string; readonly withheld?: { readonly value: string; readonly reason: string } | null }
export interface DifferenceOption { readonly option: string; readonly label: string; readonly model: string; readonly chances: ReadonlyArray<ChanceEntry> }
export interface Settle { readonly kind: 'crossing' | 'worth' | 'diagnostic' | 'no_change'; readonly text: string; readonly fact: string | null }
export interface StepShown { readonly id: number; readonly at: string; readonly by: string; readonly by_id: string; readonly step: 'dissent' | 'research'; readonly version: number; readonly text: string }
export interface Difference {
  /** A figure, a link (both its cards in `cards`) or a factor one member thinks is missing (no card). */
  readonly kind?: 'figure' | 'link' | 'factor'; readonly cards?: readonly string[]; readonly sides_heading?: string
  readonly record: string; readonly label: string; readonly goal: string; readonly goal_label: string
  readonly status: DifferenceStatus; readonly status_text: string
  readonly sides: readonly DifferenceSide[]; readonly options: readonly DifferenceOption[]; readonly settle: readonly Settle[]; readonly steps: readonly StepShown[]
  /** TM-04 (links only, additive): core's words for the doubted link's chip on the canvas, at most 28 characters, naming only who doubts
   *  it, never a keeper ("Cara doubts this link", else counted). Core b365e50e debate.ts:65. Absent on an older core. */
  readonly chip?: string
  /** SCI-HISTORY (core 2a5f61f7, additive, figures only; absent on every current entry): a difference revealed on an EARLIER version, read
   *  with that version's figures, stored runs and receipt. History: drawn read-only, after the current entries (EarlierDifference.tsx). */
  readonly earlier?: { readonly version: number; readonly text: string }
}
export interface DifferenceHeadings { readonly sides: string; readonly options: string; readonly model: string; readonly settle: string; readonly steps: string; readonly dissent: string; readonly research: string; readonly commit: string }
export interface Differences { readonly scenario: string; readonly version: number | null; readonly gated: boolean; readonly heading: string; readonly empty: string; readonly differences: readonly Difference[]; readonly headings: DifferenceHeadings
  /** Core's words for how a member holds their view (a picker); absent on an older core. */
  readonly stances?: ReadonlyArray<{ readonly id: string; readonly text: string }> }

const path = (sid: string) => `/api/scenarios/${encodeURIComponent(sid)}/differences`

/** The View a read is for: the scenario, the version, whether this viewer is gated and the revealed views, so the Team tab and the canvas
 *  share one read per View (and read again whenever a poll brings a reveal). */
export const differencesKey = (sid: string, view: View): string =>
  `${sid}|${view.version?.n ?? 'none'}|${view.gated ? 'g' : ''}|${view.collab.shared.map((s) => s.id).join(',')}|${view.signature}`

const isStr = (x: unknown): x is string => typeof x === 'string'
/** Core's shape, or null: a read that is not it is never drawn as if it were. */
export function differencesShape(x: unknown): Differences | null {
  const d = x as Partial<Differences> | null
  if (d === null || typeof d !== 'object' || !isStr(d.heading) || !isStr(d.empty) || typeof d.gated !== 'boolean' || !Array.isArray(d.differences) || d.headings === undefined) return null
  const h = d.headings as unknown as Record<string, unknown>
  if (!['sides', 'options', 'model', 'settle', 'steps', 'dissent', 'research', 'commit'].every((k) => isStr(h[k]))) return null
  const ok = d.differences.every((x) => isStr(x.record) && isStr(x.label) && isStr(x.status_text) && Array.isArray(x.sides) && Array.isArray(x.options) && Array.isArray(x.settle) && Array.isArray(x.steps))
  if (!ok) return null
  // TM-04's `chip` (additive): core's words, or it is dropped from that entry and never drawn as anything else.
  let out = d.differences.some((e) => e.chip !== undefined && !isStr(e.chip))
    ? { ...d, differences: d.differences.map((e) => (e.chip === undefined || isStr(e.chip) ? e : { ...e, chip: undefined })) }
    : d
  // SCI-HISTORY's `earlier`: an entry that carries one not in core's shape is dropped, never drawn as a current one with its steps.
  const isEarlier = (e: unknown) => e === undefined || (e !== null && typeof e === 'object' && Number.isInteger((e as { version?: unknown }).version) && isStr((e as { text?: unknown }).text))
  const ds = out.differences as readonly Difference[]
  if (ds.some((e) => !isEarlier(e.earlier))) out = { ...out, differences: ds.filter((e) => isEarlier(e.earlier)) }
  const st = (out as { stances?: unknown }).stances
  if (st !== undefined && !(Array.isArray(st) && st.every((e) => e !== null && typeof e === 'object' && isStr((e as { id?: unknown }).id) && isStr((e as { text?: unknown }).text)))) {
    const { stances: _drop, ...rest } = out as Differences
    return rest as Differences
  }
  return out as Differences
}

/** `key`: the View last read for (whether or not that read answered); `read`: the View `data` was read for. A failed read keeps the
 *  last answer drawn in the Team tab, under its own View, never under the new one (the canvas draws only a read for its very View). */
interface DifferencesState { readonly sid: string | null; readonly key: string | null; readonly read?: string | null; readonly data: Differences | null; readonly error: string | null }
/** The last read, by the View it was read for (`key`), so changing tabs neither re-reads nor forgets it. */
export const useDifferences = create<DifferencesState>()(() => ({ sid: null, key: null, read: null, data: null, error: null }))
const inFlight = new Map<string, Promise<void>>()

/** Read for this View (`key`: the scenario, the version and the revealed views), and again after a step. The last read for the same scenario
 *  stays drawn meanwhile. A core without the route draws nothing and says nothing. */
export function readDifferences(sid: string, key: string): Promise<void> {
  const going = inFlight.get(key)
  if (going) return going
  const p = (async () => {
    try {
      const got = differencesShape(await call<unknown>('GET', path(sid)))
      useDifferences.setState({ sid, key, read: key, data: got, error: null })
    } catch (e) {
      // 404: this core has no such read yet (served before wip/debate); nothing is drawn.
      if (e instanceof TeamApiError && e.status === 404) useDifferences.setState({ sid, key, read: key, data: null, error: null })
      else useDifferences.setState((s) => ({ sid, key, read: s.sid === sid ? s.read ?? null : null, data: s.sid === sid ? s.data : null, error: e instanceof TeamApiError ? e.message : 'Olumi could not be read just now. Try again in a moment.' }))
    } finally { inFlight.delete(key) }
  })()
  inFlight.set(key, p)
  return p
}

/** Keep the difference as a disagreement, or agree to find out (core `POST …/differences/:record/steps`): one shared row, no AI call. */
export const stepDifference = (sid: string, record: string, step: 'dissent' | 'research') =>
  // A link's or factor's record carries ':' (`link:<relation>:<part>`, `factor:<row>`), which core's route takes as it is.
  call<{ step: number }>('POST', `${path(sid)}/${encodeURIComponent(record).replace(/%3A/gi, ':')}/steps`, { step })

/** For specs. */
export function resetDifferences(): void { inFlight.clear(); useDifferences.setState({ sid: null, key: null, read: null, data: null, error: null }) }
