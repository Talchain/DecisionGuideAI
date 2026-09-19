import { create } from 'zustand'

export type LayoutProgressStatus = 'idle' | 'loading' | 'error'

interface LayoutProgressState {
  status: LayoutProgressStatus
  message: string | null
  canRetry: boolean
  retry: (() => void) | null
  /**
   * What the action button says.
   *
   * ⭐ IT EXISTS BECAUSE "Retry" WAS A LIE IN ONE REACHABLE STATE. When a
   * deploy has replaced the hashed assets under an open tab, the lazy chunk is
   * permanently 404 and retrying re-requests the same dead URL forever. The
   * founder pressed Retry, then Auto-arrange, and reported neither helped —
   * the product had told him to do both (19 Sep 2026).
   *
   * ⚠ IT IS AN EXPLICIT FIELD, NOT DERIVED FROM `message`. Reading the label
   * out of the copy would be a hand-maintained mirror (CLAUDE.md trap 12): the
   * sentence and the verb would drift apart the first time either is reworded,
   * silently, with no red anywhere.
   */
  actionLabel: string
  start: (message: string, retry?: () => void) => void
  succeed: () => void
  fail: (message: string, retry?: () => void, actionLabel?: string) => void
  cancel: () => void
}

/** The verb for an ordinary failure — one that retrying can genuinely fix. */
const DEFAULT_ACTION_LABEL = 'Retry'

export const useLayoutProgressStore = create<LayoutProgressState>((set) => ({
  status: 'idle',
  message: null,
  canRetry: false,
  retry: null,
  actionLabel: DEFAULT_ACTION_LABEL,
  start: (message, retry) => {
    set({
      status: 'loading',
      message,
      canRetry: !!retry,
      retry: retry ?? null,
      actionLabel: DEFAULT_ACTION_LABEL,
    })
  },
  succeed: () => {
    set({
      status: 'idle',
      message: null,
      canRetry: false,
      retry: null,
      actionLabel: DEFAULT_ACTION_LABEL,
    })
  },
  fail: (message, retry, actionLabel) => {
    set({
      status: 'error',
      message,
      canRetry: !!retry,
      retry: retry ?? null,
      actionLabel: actionLabel ?? DEFAULT_ACTION_LABEL,
    })
  },
  cancel: () => {
    set({
      status: 'idle',
      message: null,
      canRetry: false,
      retry: null,
      actionLabel: DEFAULT_ACTION_LABEL,
    })
  },
}))
