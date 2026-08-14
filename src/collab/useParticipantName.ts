/**
 * COLLAB — `useParticipantName`: the React half of render-time name resolution.
 *
 * Takes the `elicited_from` value straight off a node's `observed_state` (which
 * reaches the client through a `.passthrough()` schema, so it is `unknown` by
 * honest typing) and answers with a resolution the surface can render.
 *
 * ── WHY IT NEVER SUSPENDS AND NEVER THROWS ────────────────────────────────
 * The first paint of an attributed factor happens before any roster can have
 * arrived, so the hook's FIRST answer is always `roster_unavailable` and the
 * surface must already be truthful in that state. That is the point of the
 * fallback copy being the existing "From your panel" rather than a spinner or a
 * blank: a name appearing a moment later ADDS detail to a sentence that was
 * already true, instead of replacing a placeholder that was not.
 *
 * ── ONE REQUEST PER ROUND, NOT ONE PER SURFACE ────────────────────────────
 * Every instance calls `ensureRoster`, which dedups in flight and memoises the
 * result, so N attributed factors from one round cost one request. The
 * subscription exists so the instances that did not initiate the fetch still
 * re-render when it lands.
 */

import { useEffect, useState } from 'react'
import { ensureRoster, peekRoster, subscribeToRosters } from './roundRosterCache'
import {
  readElicitedFrom,
  resolveParticipantName,
  type ParticipantNameResolution,
} from './participantNames'

export function useParticipantName(elicitedFrom: unknown): ParticipantNameResolution {
  const ref = readElicitedFrom(elicitedFrom)
  const roundId = ref?.round_id ?? ''

  // A revision counter, not the roster itself: the cache owns the data, and
  // duplicating it into component state is how two copies start disagreeing.
  const [, bumpRevision] = useState(0)

  useEffect(() => {
    if (roundId === '') return
    const unsubscribe = subscribeToRosters(() => bumpRevision((n) => n + 1))
    // Fire-and-forget: `ensureRoster` never rejects, and the re-render comes
    // from the subscription rather than from this promise, so an instance that
    // mounts while another's request is in flight is woken by the same event.
    void ensureRoster(roundId)
    return unsubscribe
  }, [roundId])

  // Resolution happens during RENDER from the cache's current answer, so a
  // roster that was already warm names the person on the FIRST paint with no
  // intermediate unresolved frame.
  return resolveParticipantName(elicitedFrom, roundId === '' ? undefined : peekRoster(roundId))
}
