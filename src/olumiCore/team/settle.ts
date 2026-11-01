/**
 * An uncertain write (the connection dropped, or the server failed, after the request may have been saved) is settled by asking Olumi what
 * it holds, never by assuming either way. `landed` says whether the write is in the fresh scenario. A write that is not there when the read
 * succeeded was not saved, and may be sent again; when the read fails too nothing is known, and a second send is not offered.
 */
import { useTeamStore } from './store'
import type { TeamScenario } from './types'

export type Settled = 'saved' | 'not_saved' | 'unknown'
export const NOT_SAVED = 'That did not reach Olumi, so nothing was saved. You can send it again.'
export const UNKNOWN_SAVED = 'We could not tell whether that was saved. Check what Olumi holds before sending it again.'

export async function settleUncertain(refresh: () => Promise<boolean>, landed: (s: TeamScenario) => boolean): Promise<Settled> {
  const ok = await refresh()
  if (!ok) return 'unknown'
  const s = useTeamStore.getState().scenario
  return s !== null && landed(s) ? 'saved' : 'not_saved'
}
