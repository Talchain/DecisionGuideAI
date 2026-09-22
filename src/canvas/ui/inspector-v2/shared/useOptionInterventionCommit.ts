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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useModelEditAuthority,
  type OptionInterventionProposalOutcome,
} from '../../../hooks/useModelEditAuthority'
import type { SystemEventSendSettlement } from '../../../conversation/settleSystemEventSend'
import { useCanvasStore } from '../../../store'
import { interventionNumericValue } from '@/utils/interventionValue'

/** The copy, here rather than at each surface, for the same reason the hook is. */
export const OPTION_INTERVENTION_NEEDS_FRESH_BASE =
  'Not sent — Olumi has not seen this model this session. Ask it anything, then set this again.'
export const OPTION_INTERVENTION_NOT_ENCODABLE =
  'Not sent — this effect cannot be recorded on this model.'
/**
 * ⭐ THE THREE WAYS A SEND THAT LEFT CAN STILL END WITHOUT LANDING — one
 * sentence each, because they need opposite follow-ups (`settleSystemEventSend`
 * derives which one it was; this only says it). The wording follows the Model
 * tab's editor for the same carrier, so one gesture reads the same on both.
 */
export const OPTION_INTERVENTION_BLOCKED =
  'Not sent — another change is still in flight. Try again in a moment.'
export const OPTION_INTERVENTION_REFUSED =
  'Not saved — the model moved on while this was in flight. Ask Olumi anything, then set this again.'
/** ⚠ Neither saved nor unsaved: a write is not ruled out, so the copy may not pick one. */
export const OPTION_INTERVENTION_UNVERIFIED =
  'Olumi could not confirm whether that reached the model. Ask it anything about this decision to see where it stands.'

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

  /**
   * ⛔⛔ A PENDING NUMBER NEEDS A WAY TO END, AND IT HAD NONE.
   *
   * `settleSystemEventSend`'s own header: *"a caller that renders a pending
   * state MUST pass it, or that state has no way to end."* This hook rendered
   * `pending` and passed nothing, so a send the server refused went on showing
   * the number the model had just declined, with no notice — the optimistic
   * write this hook replaced, arriving by a different route.
   *
   * The attempt id fences every late answer: an answer about an EARLIER send
   * must not withdraw or relabel a LATER one, and an answer arriving after the
   * store already carries the value must not call a landed edit "not saved".
   */
  const attemptRef = useRef(0)
  const liveAttemptRef = useRef<number | null>(null)

  const settle = useCallback((attempt: number, settlement: SystemEventSendSettlement) => {
    // `sent` / `queued` say nothing about the MODEL — the store answers that.
    if (settlement === 'sent' || settlement === 'queued') return
    if (liveAttemptRef.current !== attempt) return
    liveAttemptRef.current = null
    setPending(null)
    setNotice(
      settlement === 'blocked'
        ? OPTION_INTERVENTION_BLOCKED
        : settlement === 'refused'
          ? OPTION_INTERVENTION_REFUSED
          : OPTION_INTERVENTION_UNVERIFIED,
    )
  }, [])

  /**
   * ⭐ THE CONFIRMATION IS THE CANONICAL STORE, NEVER AN ECHO. Pending ends when
   * THIS option's entry for THIS factor holds the number that was sent — i.e.
   * when the applied receipt has carried it into the model everything else
   * reads. From then on the row follows the record, so a later change (a chat
   * edit, an undo) is shown rather than masked by a stale pending value.
   */
  const recorded = useCanvasStore(s => {
    if (!pending || !nodeId) return undefined
    const option = s.nodes.find(n => n.id === nodeId)
    const map = (option?.data as Record<string, unknown> | undefined)?.interventions as
      | Record<string, unknown>
      | undefined
    return map ? interventionNumericValue(map[pending.factorId]) : undefined
  })
  useEffect(() => {
    if (pending !== null && recorded === pending.value) {
      liveAttemptRef.current = null
      setPending(null)
    }
  }, [pending, recorded])

  const commit = useCallback(
    (factorId: string, value: number): OptionInterventionProposalOutcome => {
      const attempt = ++attemptRef.current
      liveAttemptRef.current = attempt
      setPending({ factorId, value })
      setNotice(null)
      const outcome = authority.proposeOptionIntervention(factorId, value, {
        onSendSettled: settlement => settle(attempt, settlement),
      })
      if (outcome === 'dispatched') return outcome
      // Any refusal clears the optimistic display: showing the new number
      // beside "not sent" would be the split-brain this hook exists to avoid.
      liveAttemptRef.current = null
      setPending(null)
      setNotice(
        outcome === 'needs_fresh_base'
          ? OPTION_INTERVENTION_NEEDS_FRESH_BASE
          : OPTION_INTERVENTION_NOT_ENCODABLE,
      )
      return outcome
    },
    [authority, settle],
  )

  return { commit, pending, notice }
}
