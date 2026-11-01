/**
 * The Team tab's one copy of the scenario, read from olumi-core. Not a source of truth: core is. This holds the last answer so the
 * tab, the question card's held count and the canvas share one read instead of three. Nothing polls on a timer: it is read when
 * the scenario is first known, when the tab opens, after each write, and when the person presses "Check for new views".
 */
import { create } from 'zustand'
import { teamApi, TeamApiError } from './api'
import { coreScenarioIdOf } from './sid'
import type { TeamScenario } from './types'

export type TeamStatus = 'none' | 'loading' | 'ready' | 'error'

interface TeamState {
  readonly uuid: string | null
  readonly sid: string | null
  readonly scenario: TeamScenario | null
  readonly status: TeamStatus
  readonly error: string | null
  /** Point the store at a DGAI scenario; reads it when core knows it. */
  readonly use: (uuid: string | null) => Promise<void>
  /** Read the scenario again (after a write, on open, on the person's press). */
  readonly refresh: () => Promise<void>
}

let seq = 0

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
    if (!sid) { set({ sid: null, status: 'none' }); return }
    const mine = ++seq
    set({ sid, status: get().scenario ? 'ready' : 'loading' })
    try {
      const scenario = await teamApi.read<TeamScenario>(sid)
      if (mine === seq) set({ scenario, status: 'ready', error: null })
    } catch (e) {
      if (mine !== seq) return
      set({ status: get().scenario ? 'ready' : 'error', error: e instanceof TeamApiError ? e.message : 'Olumi could not be read just now.' })
    }
  },
}))
