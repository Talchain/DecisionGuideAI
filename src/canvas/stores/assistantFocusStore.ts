/**
 * Session-only authority for an assistant-directed canvas focus.
 *
 * This is deliberately not part of React Flow selection and deliberately not
 * one of the applied-edit highlight Sets:
 *
 *   - selection is authored by the user and may be carried on the next turn;
 *   - highlightedNodes/highlightedEdges own the short applied-edit pulse;
 *   - this store owns one persistent, explicitly dismissible assistant focus.
 *
 * A focus expires even when it is not dismissed. The token check in the timer
 * is load-bearing: an old target's timer must never clear a newer target after
 * an identity swap.
 */
import { create } from 'zustand'

export const ASSISTANT_FOCUS_MIN_DURATION_MS = 500
export const ASSISTANT_FOCUS_MAX_DURATION_MS = 10_000
// Default to the wire contract's longest permitted window: this makes focus
// meaningfully persistent beyond the 2s edit pulse, while the explicit close
// action and hard 10s ceiling prevent a stale, indefinite assistant takeover.
export const ASSISTANT_FOCUS_DEFAULT_DURATION_MS = ASSISTANT_FOCUS_MAX_DURATION_MS

export type AssistantFocusKind = 'node' | 'edge'

export interface AssistantFocusTarget {
  id: string
  kind: AssistantFocusKind
  label: string
  /** Scenario identity at dispatch, when one exists. Never persisted. */
  scenarioId: string | null
  expiresAt: number
  /** Monotonic timer ownership token; not a graph identity. */
  token: number
}

export interface ActivateAssistantFocusInput {
  id: string
  kind: AssistantFocusKind
  label: string
  scenarioId?: string | null
  durationMs?: number
}

interface AssistantFocusState {
  target: AssistantFocusTarget | null
  activate: (input: ActivateAssistantFocusInput) => void
  dismiss: () => void
}

let expiryTimer: ReturnType<typeof setTimeout> | null = null
let nextToken = 0

function cancelExpiryTimer(): void {
  if (expiryTimer === null) return
  clearTimeout(expiryTimer)
  expiryTimer = null
}

/** Defensive clamp for callers that bypass the already-bounded wire schema. */
export function normaliseAssistantFocusDuration(durationMs: unknown): number {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return ASSISTANT_FOCUS_DEFAULT_DURATION_MS
  }
  return Math.min(
    ASSISTANT_FOCUS_MAX_DURATION_MS,
    Math.max(ASSISTANT_FOCUS_MIN_DURATION_MS, Math.round(durationMs)),
  )
}

export const useAssistantFocusStore = create<AssistantFocusState>((set, get) => ({
  target: null,
  activate: (input) => {
    cancelExpiryTimer()
    const durationMs = normaliseAssistantFocusDuration(input.durationMs)
    const token = ++nextToken
    set({
      target: {
        id: input.id,
        kind: input.kind,
        label: input.label,
        scenarioId: input.scenarioId ?? null,
        expiresAt: Date.now() + durationMs,
        token,
      },
    })
    expiryTimer = setTimeout(() => {
      // A replaced focus owns a different token. Its predecessor's queued
      // callback is therefore harmless even if cancellation raced with it.
      if (get().target?.token !== token) return
      expiryTimer = null
      set({ target: null })
    }, durationMs)
  },
  dismiss: () => {
    cancelExpiryTimer()
    if (get().target === null) return
    set({ target: null })
  },
}))

export function activateAssistantFocus(input: ActivateAssistantFocusInput): void {
  useAssistantFocusStore.getState().activate(input)
}

export function dismissAssistantFocus(): void {
  useAssistantFocusStore.getState().dismiss()
}
