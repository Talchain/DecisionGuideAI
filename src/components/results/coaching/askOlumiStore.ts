/**
 * Parity P1 — the "Work through it with Olumi" drawer state (prototype
 * #olumiDrawer). One drawer per app; every routed ask on the Analysis tab
 * (decision pills, Actions methods, framing question, Strengthen
 * work-through, hero prompts) opens it with a context line and a PREFILLED,
 * EDITABLE draft instead of auto-sending a hidden message — the audit's
 * "routed asks never surface the conversation" fix.
 *
 * Plain zustand store so non-React call sites (menu handlers) can open it
 * via useAskOlumiStore.getState().openAsk(...).
 */
import { create } from 'zustand'

import type { OlumiAttentionNote } from '../../../canvas/utils/olumiAttention'

export interface AskOlumiPayload {
  /** Drawer context line, e.g. the method description or classification hint */
  context: string
  /** Prefilled editable draft for the textarea */
  draft: string
  /** Short label describing the ask (used as the dispatch label) */
  label: string
  /** Optional model target for the "Focus on canvas" action */
  targetId?: string
  /** Dispatch parameters forwarded on send (e.g. { method_id }) */
  parameters?: Record<string, unknown>
  /** Dispatch source tag (defaults to 'chip' — conversation-typed turn) */
  source?: string
  /**
   * The CEE intent this ask IS, when an accepted intent names the same move.
   * It is what makes the turn decision science rather than chat. Absent for
   * most asks; the wire gate fails closed, so absence changes nothing.
   */
  intent?: string
  /**
   * What Olumi has to SAY beside the element, carried to "Focus on canvas".
   *
   * ⚠ BUILT BY THE OPENER, NEVER BY THE DRAWER. A note needs a `move` from the
   * closed four-move grammar, and the drawer never receives `helpType` — so it
   * cannot derive one honestly, and composing a note here would be the UI
   * putting words in the producer's mouth. Openers that hold producer data
   * (Strengthen recommendations) build it with
   * `attentionNoteForRecommendation`; the rest pass nothing and keep exactly
   * the camera move they had, the same shape `intent` above uses.
   *
   * ⚠ NO COUNT IS QUOTED HERE, DELIBERATELY. This sentence has carried a
   * figure twice and been wrong both times ("nine", then "28"; two
   * independent instruments make it 26). Openers live across 14 files and the
   * set is open, so any number here is a floor that decays silently — and the
   * field is optional precisely so a new opener needs no change in this file.
   * What matters is the RULE: an opener that holds a `Recommendation` passes
   * the note; one that does not, does not.
   */
  attentionNote?: OlumiAttentionNote | null
}

interface AskOlumiState {
  isOpen: boolean
  context: string
  draft: string
  label: string
  targetId: string | null
  parameters: Record<string, unknown> | undefined
  source: string
  intent: string | undefined
  attentionNote: OlumiAttentionNote | null
  /**
   * MIXED AUTHORSHIP (DL ruling, 14 Oct 2026 — fail-safe): true only once the draft field has held NO text (trimmed
   * empty) at some point since this ask opened — i.e. none of Olumi's prefill can remain in it, so whatever is in the
   * field now was typed by the person. An ask that OPENS with an empty draft starts true (there was no Olumi text to
   * clear). It never turns back to false while the ask is open (re-typing Olumi's words after clearing them is still
   * the person typing); each `openAsk` resets it. Only `setDraft` (the drawer textarea's onChange) can set it.
   *
   * The drawer reads it to decide authorship: true → the person's own words, a chipless composer turn; false (sent
   * unedited OR edited without clearing) → Olumi's text, a chip. A wrong author is worse than lost credit.
   */
  promptCleared: boolean
  openAsk: (payload: AskOlumiPayload) => void
  setDraft: (draft: string) => void
  close: () => void
}

export const useAskOlumiStore = create<AskOlumiState>((set) => ({
  isOpen: false,
  context: '',
  draft: '',
  label: '',
  targetId: null,
  parameters: undefined,
  source: 'chip',
  intent: undefined,
  attentionNote: null,
  promptCleared: false,
  openAsk: (payload) =>
    set({
      isOpen: true,
      context: payload.context,
      draft: payload.draft,
      label: payload.label,
      targetId: payload.targetId ?? null,
      parameters: payload.parameters,
      source: payload.source ?? 'chip',
      // Absent stays absent — never defaulted to a routable intent.
      intent: payload.intent,
      // Absent stays absent here too: `focusModelTarget` treats a null note as
      // "focus without a card", which is the pre-existing behaviour.
      attentionNote: payload.attentionNote ?? null,
      promptCleared: payload.draft.trim() === '',
    }),
  setDraft: (draft) => set((s) => ({ draft, promptCleared: s.promptCleared || draft.trim() === '' })),
  close: () => set({ isOpen: false }),
}))

/** Convenience for non-React call sites. */
export function openAskOlumi(payload: AskOlumiPayload): void {
  useAskOlumiStore.getState().openAsk(payload)
}
