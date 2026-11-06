/**
 * D6 AND THE COMPUTED RECONSIDER TRIGGER (core wip/r17-int 5cdae21f, olumi.view/3, additive; API.md "D6 and the computed reconsider trigger"),
 * AHEAD OF THE VENDORED VIEW: read here until DGAI vendors that core's view.v3.json. Every field is optional, so a View without them draws
 * nothing. All words are core's, drawn verbatim and never formatted here:
 *  - `model.run.tipping[]` `{ id, kind, line, hover, ... olumi }` under `model.run.tipping_heading` ("What would have to be true");
 *  - `collab.suggested_triggers[]` `{ option, aim, fact, kind, text }`, for the current approved version only;
 *  - `collab.commitments[].trigger`: null, or `{ fact, text, stale: null | { reasons, text }, ... }`.
 * Picking (which lines are drawn) is layout.ts's `tippingOf`, the one module that picks; the suggestion for an option is olumiCore/team/triggers.ts.
 */
export type TippingLine = { id: string; kind: 'chance' | 'lead'; line: string; hover: string; aim: string; option: string; olumi: { glyph: string; title: string } | null }
export type SuggestedTrigger = { option: string; aim: string; fact: string; kind: 'chance' | 'lead'; text: string }
export type SavedTrigger = { fact: string; kind: 'chance' | 'lead'; option: string; aim: string; text: string; version: number; stale: { text: string } | null }

export const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim() !== ''

/** A saved commitment's trigger as core gives it, or null (a commitment made without one has none). */
export function savedTriggerOf(commitment: object): SavedTrigger | null {
  const t = (commitment as { trigger?: SavedTrigger | null }).trigger
  return t != null && nonEmpty(t.text) ? { ...t, stale: t.stale != null && nonEmpty(t.stale.text) ? { text: t.stale.text } : null } : null
}
