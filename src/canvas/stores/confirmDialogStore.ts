/**
 * confirmDialogStore — Lightweight Zustand store driving the ConfirmDialog component.
 *
 * Context menu actions and deletion flows set `pending` when a destructive action
 * requires user confirmation. ReactFlowGraph renders the ConfirmDialog when pending
 * is non-null. The dialog calls `dismiss()` on cancel or after confirm completes.
 */
import { create } from 'zustand'

export interface ConfirmDialogOptions {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
}

interface ConfirmDialogState {
  /** Currently pending confirmation, or null if no dialog is shown */
  pending: ConfirmDialogOptions | null
  /** Show a confirmation dialog */
  show: (opts: ConfirmDialogOptions) => void
  /** Dismiss the dialog without confirming */
  dismiss: () => void
}

export const useConfirmDialogStore = create<ConfirmDialogState>((set) => ({
  pending: null,
  show: (opts) => set({ pending: opts }),
  dismiss: () => set({ pending: null }),
}))
