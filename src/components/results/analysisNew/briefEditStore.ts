/**
 * Whether the Reasoning tab's inline "Your question" form is open, so two
 * controls can open ONE form: the review row's pencil ("Edit the full
 * question") and the Method strip's "Edit decision brief".
 *
 * ⚠ A HOST MUST BE MOUNTED FOR `openBriefEdit` TO DO ANYTHING. The form renders
 * inside `ModelReviewTool`, which registers itself here while mounted. When no
 * host is registered, `openBriefEdit` opens nothing and returns `false`, so the
 * caller can fall back to its existing route instead of shipping a menu item
 * that does nothing.
 *
 * ⚠ THIS STORE HOLDS NO BRIEF TEXT. The form reads the brief from
 * `contextIntegrityStore` at render, behind that store's scenario-identity gate.
 */
import { create } from 'zustand'

interface BriefEditState {
  isOpen: boolean
  /** Mounted surfaces that render the form. */
  hosts: number
  /** Bumped on every open request, so an already-open form can take focus again. */
  openRequest: number
  setOpen: (open: boolean) => void
  /** Register a mounted host; returns its unregister. Safe to call twice. */
  registerHost: () => () => void
}

export const useBriefEditStore = create<BriefEditState>((set) => ({
  isOpen: false,
  hosts: 0,
  openRequest: 0,
  setOpen: (isOpen) => set((s) => (isOpen ? { isOpen, openRequest: s.openRequest + 1 } : { isOpen })),
  registerHost: () => {
    set((s) => ({ hosts: s.hosts + 1 }))
    let released = false
    return () => {
      if (released) return
      released = true
      // The last host leaving closes the form, so a later mount starts closed.
      set((s) => {
        const hosts = Math.max(0, s.hosts - 1)
        return hosts === 0 ? { hosts, isOpen: false } : { hosts }
      })
    }
  },
}))

/**
 * Open the form. Returns `false`, and opens nothing, when no mounted surface
 * would show it.
 */
export function openBriefEdit(): boolean {
  const state = useBriefEditStore.getState()
  if (state.hosts <= 0) return false
  state.setOpen(true)
  return true
}
