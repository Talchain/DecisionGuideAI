/**
 * OWN VIEW FIRST (PILOT-PACK 1.1; DL 4 Nov): a member who joined by a colleague's link says what they think before Olumi's replies can
 * anchor them. Until they have given or skipped their view in this round, the dock opens on the Team tab at the private-view box and no
 * Olumi note is drawn. The creator (nobody invited them: their brief is the input) and anyone who has given or skipped land as before.
 *
 * Who was invited is core's own list (`GET /invites`, API v1.8: each invitee's person id), never a name; the View's chat carries no
 * writer id. A failed read decides nothing: the page lands as before. A member whose link the admin made is not in that list, so is
 * not held.
 */
import { useEffect, useState } from 'react'
import type { View } from '../olumiView/client'
import { useViewStore } from '../olumiView/store'
import { isForThisPage, useMe } from './me'
import { teamApi } from './team/api'

/** In a team, with a model to be anchored by, and nothing of their own given or skipped in this round. */
export function awaitsOwnView(view: View): boolean {
  const c = view.collab
  return view.model !== null && !c.alone && c.mine.length === 0 && !c.shared.some((s) => s.by_id === view.you_id)
}

/** The member was invited into this scenario and has not yet given or skipped their view. `invited` null: not read (or the read failed). */
export function ownViewPending(view: View, invited: ReadonlySet<string> | null): boolean {
  return invited !== null && invited.has(view.you_id) && awaitsOwnView(view)
}

/**
 * On the core lane: 'pending' while the person on this page owes their own view, 'clear' once they don't (or never did), 'unknown' while
 * core's invitations are being read (nothing of Olumi's is drawn meanwhile, so it cannot anchor them before the answer comes).
 */
export type OwnViewFirst = 'pending' | 'clear' | 'unknown'

export function useOwnViewFirst(on: boolean): OwnViewFirst {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const me = useMe((s) => s.me)
  const shown = on && view !== null && isForThisPage(view, me) ? view : null
  const asks = shown !== null && sid !== null && awaitsOwnView(shown)
  // Read once per scenario, and only while it can matter.
  const [read, setRead] = useState<{ sid: string; invited: ReadonlySet<string> | null } | null>(null)
  useEffect(() => {
    if (!asks || sid === null || read?.sid === sid) return
    let live = true
    teamApi.invites(sid).then(
      (r) => { if (live) setRead({ sid, invited: new Set(r.invites.map((i) => i.id)) }) },
      () => { if (live) setRead({ sid, invited: null }) },
    )
    return () => { live = false }
  }, [asks, sid]) // eslint-disable-line react-hooks/exhaustive-deps -- `read` is the answer this effect waits for
  if (!asks) return 'clear'
  if (read?.sid !== sid) return 'unknown'
  return ownViewPending(shown!, read.invited) ? 'pending' : 'clear'
}
