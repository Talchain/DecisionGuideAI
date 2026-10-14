/**
 * Restored-Run Reply Store — what CEE's Run said about the model an Undo restored, for one line.
 *
 * A committed restore is analysed by CEE: the restore route runs the existing Run turn on the restored model and
 * returns that turn's own reply (`analysis_turn`, CEE #3044). Hydration adopts the new Run's analysis state and result;
 * this store carries ONLY the reply's words from the Undo command to the conversation (`useConversation`), which
 * appends them as ONE synthetic assistant line, verbatim. It holds nothing else, and composes no copy of its own.
 *
 * ── WHY A STORE RATHER THAN A PROP ─────────────────────────────────────────
 * Same reason as `reloadDifferenceStore`: the restore is answered in a command module (`undo/undoCommand.ts`), the
 * line is appended by the conversation host, and zustand is the house pattern for that gap.
 *
 * ── ⚠ KEYED BY SCENARIO, AND THAT IS LOAD-BEARING ──────────────────────────
 * `contextIntegrityStore`'s header records a P0 caused by an unkeyed value that survived a scenario change and
 * rendered a PREVIOUS DECISION'S content. So the reply carries the scenario it describes, and the conversation refuses
 * to append it unless that id matches the live `currentScenarioId`.
 *
 * ── ⚠ `delivered` IS WHAT MAKES "NEVER TWICE" HOLD ACROSS A REMOUNT ────────
 * The conversation host can remount within one page load; a per-instance ref would forget it had appended the line
 * and append it again. The flag lives with the reply, and a NEW reply (a new `id`) starts undelivered.
 *
 * ── ⚠ WHAT THE LINE MAY NEVER SAY ──────────────────────────────────────────
 * Anything but CEE's own words. The text is the Run turn's `assistant_text` exactly as CEE answered it: no prefix, no
 * label, no summary. A restore whose Run did not answer offers nothing, and the UI never fills that gap with a line
 * of its own.
 */
import { create } from 'zustand'

export interface RestoredRunReplyState {
  /** The scenario whose restored model this reply describes. `null` when there is nothing to show. */
  scenarioId: string | null
  /** One id per offered reply; the conversation appends one line per id. */
  id: string | null
  /** CEE's reply, verbatim. */
  text: string | null
  /** Whether the conversation has already appended this reply's line. */
  delivered: boolean
  /**
   * `scenarioId` is REQUIRED, deliberately — a reply this store cannot attribute to a decision is one the
   * conversation must never show.
   */
  offer: (scenarioId: string, text: string) => void
  markDelivered: (id: string) => void
  clear: () => void
}

const EMPTY = {
  scenarioId: null,
  id: null,
  text: null,
  delivered: false,
}

function mintId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `restored-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export const useRestoredRunReplyStore = create<RestoredRunReplyState>((set) => ({
  ...EMPTY,
  offer: (scenarioId, text) => set({ scenarioId, id: mintId(), text, delivered: false }),
  markDelivered: (id) => set((s) => (s.id === id ? { delivered: true } : s)),
  clear: () => set({ ...EMPTY }),
}))
