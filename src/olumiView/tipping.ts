/**
 * D6 AND THE COMPUTED RECONSIDER TRIGGER, read through the vendored View contract (view.v3.json, core f10b02dd; types.ts). All words are core's,
 * drawn verbatim and never formatted here:
 *  - `model.run.tipping[]` under `model.run.tipping_heading` ("What would have to be true"), and `model.run.tipping_aims[].silent[].line`;
 *  - `collab.suggested_triggers[]`, for the current approved version only;
 *  - `collab.commitments[].trigger`: null, or a saved trigger with an optional `stale`.
 * Picking (which lines are drawn) is layout.ts's `tippingOf`, the one module that picks; the suggestion for an option is olumiCore/team/triggers.ts.
 */
import type { View, ViewRun } from './client'

export type TippingLine = ViewRun['tipping'][number]
export type SuggestedTrigger = View['collab']['suggested_triggers'][number]
type Commitment = View['collab']['commitments'][number]
export type SavedTrigger = NonNullable<Commitment['trigger']>

export const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim() !== ''

/** A saved commitment's trigger as core gives it, or null (a commitment made without one has none, or says nothing). */
export function savedTriggerOf(commitment: Pick<Commitment, 'trigger'>): (Omit<SavedTrigger, 'stale'> & { stale: { text: string } | null }) | null {
  const t = commitment.trigger
  return t != null && nonEmpty(t.text) ? { ...t, stale: t.stale != null && nonEmpty(t.stale.text) ? { text: t.stale.text } : null } : null
}
