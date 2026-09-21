/**
 * ONE owner for "the reader set an effect on this option".
 *
 * ⭐ IT EXISTS BECAUSE TWO SURFACES ASK THE SAME QUESTION, and this estate's
 * most expensive defect class is two surfaces answering it differently. The
 * option panel's intervention rows and `OptionAdvancedEditor`'s tech-mode rows
 * are the same gesture on the same data; before this they were two calls to
 * `mutations.setIntervention`, and a fix applied to one would have left the
 * other writing to the browser only — which is exactly the state this hook was
 * created to end (3 of 5 options on the founder's board carried no effect at
 * all, bundle `95b92672`).
 *
 * ⛔ NO LOCAL STORE WRITE. That is `useModelEditAuthority`'s ruling, not a
 * choice made here: *"the goal draft never changes the store before a real
 * applied response"*. The applied `graph_patch` owns the write.
 *
 * ⭐ WHICH IS WHY `pending` EXISTS. The row must still respond to the reader
 * while the turn is in flight — the same shape `EdgePanel` keeps for
 * `localStrength`. Without it the number visibly snaps back on every edit,
 * which reads as a broken control and is a worse lie than the one being fixed.
 * It is display state and nothing else: it is never read by a writer.
 *
 * ⛔ EVERY REFUSAL IS DISCLOSED, per the authority's own instruction that a
 * refusal "must be DISCLOSED by the caller, never silently swallowed". The two
 * are named apart because only ONE of them the reader can clear:
 * `needs_fresh_base` is the ordinary state after a reload (a restore reads
 * persistence with no CEE turn) and names its recovery; `not_encodable` does
 * not pretend to have one.
 */

import { useCallback, useState } from 'react'
import {
  useModelEditAuthority,
  type OptionInterventionProposalOutcome,
} from '../../../hooks/useModelEditAuthority'

/** The copy, here rather than at each surface, for the same reason the hook is. */
export const OPTION_INTERVENTION_NEEDS_FRESH_BASE =
  'Not sent — Olumi has not seen this model this session. Ask it anything, then set this again.'
export const OPTION_INTERVENTION_NOT_ENCODABLE =
  'Not sent — this effect cannot be recorded on this model.'

export interface OptionInterventionCommit {
  /** Send one effect value. Returns the authority's outcome, unflattened. */
  commit: (factorId: string, value: number) => OptionInterventionProposalOutcome
  /** Display-only: the value this row should show while a send is in flight. */
  pending: { factorId: string; value: number } | null
  /** The refusal to show the reader, or null. */
  notice: string | null
}

export function useOptionInterventionCommit(nodeId: string | null): OptionInterventionCommit {
  const authority = useModelEditAuthority(nodeId ?? null)
  const [pending, setPending] = useState<{ factorId: string; value: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const commit = useCallback(
    (factorId: string, value: number): OptionInterventionProposalOutcome => {
      setPending({ factorId, value })
      setNotice(null)
      const outcome = authority.proposeOptionIntervention(factorId, value)
      if (outcome === 'dispatched') return outcome
      // Any refusal clears the optimistic display: showing the new number
      // beside "not sent" would be the split-brain this hook exists to avoid.
      setPending(null)
      setNotice(
        outcome === 'needs_fresh_base'
          ? OPTION_INTERVENTION_NEEDS_FRESH_BASE
          : OPTION_INTERVENTION_NOT_ENCODABLE,
      )
      return outcome
    },
    [authority],
  )

  return { commit, pending, notice }
}
