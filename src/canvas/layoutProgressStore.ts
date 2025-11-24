import { create } from 'zustand'

export type LayoutProgressStatus = 'idle' | 'loading' | 'error'

interface LayoutProgressState {
  status: LayoutProgressStatus
  message: string | null
  canRetry: boolean
  retry: (() => void) | null
  start: (message: string, retry?: () => void) => void
  succeed: () => void
  fail: (message: string, retry?: () => void) => void
  cancel: () => void
}

export const useLayoutProgressStore = create<LayoutProgressState>((set) => ({
  status: 'idle',
  message: null,
  canRetry: false,
  retry: null,
  start: (message, retry) => {
    set({
      status: 'loading',
      message,
      canRetry: !!retry,
      retry: retry ?? null,
    })
  },
  succeed: () => {
    set({
      status: 'idle',
      message: null,
      canRetry: false,
      retry: null,
    })
  },
  fail: (message, retry) => {
    set({
      status: 'error',
      message,
      canRetry: !!retry,
      retry: retry ?? null,
    })
  },
  cancel: () => {
    set({
      status: 'idle',
      message: null,
      canRetry: false,
      retry: null,
    })
  },
}))
