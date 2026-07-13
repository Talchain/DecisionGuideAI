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
}

interface AskOlumiState {
  isOpen: boolean
  context: string
  draft: string
  label: string
  targetId: string | null
  parameters: Record<string, unknown> | undefined
  source: string
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
  openAsk: (payload) =>
    set({
      isOpen: true,
      context: payload.context,
      draft: payload.draft,
      label: payload.label,
      targetId: payload.targetId ?? null,
      parameters: payload.parameters,
      source: payload.source ?? 'chip',
    }),
  setDraft: (draft) => set({ draft }),
  close: () => set({ isOpen: false }),
}))

/** Convenience for non-React call sites. */
export function openAskOlumi(payload: AskOlumiPayload): void {
  useAskOlumiStore.getState().openAsk(payload)
}
