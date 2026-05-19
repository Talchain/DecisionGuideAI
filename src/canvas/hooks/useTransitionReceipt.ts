import { create } from 'zustand'

export type TransitionReceiptKind = 'model-drafted'

interface TransitionReceiptState {
  /** Currently visible receipt, or null. */
  receipt: TransitionReceiptKind | null
  /** Show a receipt; auto-clears after `durationMs` (default 3000). */
  show: (kind: TransitionReceiptKind, durationMs?: number) => void
  /** Clear any active receipt immediately. */
  clear: () => void
}

let activeTimer: ReturnType<typeof setTimeout> | null = null

/**
 * UI-only store for transient transition receipts (e.g. "Model drafted.
 * Review readiness." banner at the top of the Analysis tab after first-use
 * auto-dock). Session-scoped — never persisted.
 */
export const useTransitionReceipt = create<TransitionReceiptState>((set) => ({
  receipt: null,
  show: (kind, durationMs = 3000) => {
    if (activeTimer !== null) {
      clearTimeout(activeTimer)
      activeTimer = null
    }
    set({ receipt: kind })
    if (durationMs > 0) {
      activeTimer = setTimeout(() => {
        set({ receipt: null })
        activeTimer = null
      }, durationMs)
    }
  },
  clear: () => {
    if (activeTimer !== null) {
      clearTimeout(activeTimer)
      activeTimer = null
    }
    set({ receipt: null })
  },
}))
