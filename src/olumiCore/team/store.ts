/**
 * The Team tab's one copy of the scenario, read from olumi-core. Not a source of truth: core is. This holds the last answer so the
 * tab, the question card's held count and the canvas share one read instead of three. Nothing polls on a timer: it is read when
 * the scenario is first known, when the tab opens, after each write, and when the person presses "Check for new views".
 *
 * An answer is kept only when it is a whole scenario view for the person this page was opened for; a read cut short, or one that is
 * for anyone else, is a failed read and the last good answer stays.
 */
import { create } from 'zustand'
import { READ_FAILED, teamApi, TeamApiError } from './api'
import { isForThisPage, isTeamScenario } from './model'
import { coreScenarioIdOf } from './sid'
import type { TeamScenario } from './types'

export type TeamStatus = 'none' | 'loading' | 'ready' | 'error'

/** What the page says when core answered with a view that is not for this page's person (the tab is for someone else). */
export const NOT_FOR_THIS_PAGE = 'This page was opened with a different private link from the one this browser holds now, so nothing is shown here. Reload this page to continue as the person whose private link is open now.'

interface TeamState {
  readonly uuid: string | null
  readonly sid: string | null
  readonly scenario: TeamScenario | null
  readonly status: TeamStatus
  readonly error: string | null
  /** Point the store at a DGAI scenario; reads it when core knows it. */
  readonly use: (uuid: string | null) => Promise<void>
  /** Read the scenario again (after a write, on open, on the person's press). True when a whole, current answer was read. */
  readonly refresh: () => Promise<boolean>
}

let seq = 0

/**
 * Told when a read shows the approved model has moved on (another member approved a change): the page reads the saved model again so the
 * canvas shows it too (registered by the dock; the store knows nothing of the canvas). It answers whether the canvas now shows that model.
 * The store keeps the version the CANVAS last confirmed, apart from the version the Team tab shows, and asks again on every read until they agree:
 * a read of the saved model that failed is tried again on the next read, never given up with the Team tab alone on the newer version.
 */
let onModelMoved: ((uuid: string, version: number) => Promise<boolean>) | null = null
export function setOnModelMoved(fn: ((uuid: string, version: number) => Promise<boolean>) | null): void { onModelMoved = fn }

let canvasAt: { uuid: string; n: number } | null = null
let syncing = false
async function syncCanvas(uuid: string, n: number, current: () => number | null): Promise<void> {
  if (syncing || onModelMoved === null) return
  syncing = true
  let adopted = false
  try {
    adopted = await onModelMoved(uuid, n) === true
    if (adopted) canvasAt = { uuid, n }
  } catch { /* the canvas stays where it was: the next read asks again */ } finally { syncing = false }
  // A newer version arrived while the canvas was reading this one. (A failed read is not asked again here, only on the next read.)
  const now = current()
  if (adopted && now !== null && now !== n) void syncCanvas(uuid, now, current)
}
/** For specs. */
export function resetCanvasSync(): void { canvasAt = null; syncing = false }

export const useTeamStore = create<TeamState>()((set, get) => ({
  uuid: null, sid: null, scenario: null, status: 'none', error: null,
  use: async (uuid) => {
    const sid = coreScenarioIdOf(uuid)
    if (get().uuid === uuid && get().sid === sid && get().status !== 'none' && get().status !== 'error') return
    seq += 1
    set({ uuid, sid, scenario: get().uuid === uuid ? get().scenario : null, status: sid ? 'loading' : 'none', error: null })
    if (sid) await get().refresh()
  },
  refresh: async () => {
    // The pairing can be learned after the scenario is first drawn (a brand-new scenario): look again.
    const sid = get().sid ?? coreScenarioIdOf(get().uuid)
    if (!sid) { set({ sid: null, status: 'none' }); return false }
    const mine = ++seq
    set({ sid, status: get().scenario ? 'ready' : 'loading' })
    try {
      const scenario = await teamApi.read<unknown>(sid)
      if (mine !== seq) return false
      if (!isTeamScenario(scenario)) throw new TeamApiError(0, READ_FAILED)
      if (!isForThisPage(scenario)) throw new TeamApiError(409, NOT_FOR_THIS_PAGE)
      set({ scenario, status: 'ready', error: null })
      const now = scenario.version?.n ?? null
      const uuid = get().uuid
      if (uuid && now !== null) {
        // The first read of a scenario is the model the canvas booted from; after that the canvas must agree with what the tab shows.
        if (canvasAt === null || canvasAt.uuid !== uuid) canvasAt = { uuid, n: now }
        else if (canvasAt.n !== now) void syncCanvas(uuid, now, () => get().scenario?.version?.n ?? null)
      }
      return true
    } catch (e) {
      if (mine !== seq) return false
      const refused = e instanceof TeamApiError && e.status === 409
      // A read that is for someone else is never kept; any other failed read leaves the last good answer.
      set({ scenario: refused ? null : get().scenario, status: !refused && get().scenario ? 'ready' : 'error', error: e instanceof TeamApiError ? e.message : READ_FAILED })
      return false
    }
  },
}))
