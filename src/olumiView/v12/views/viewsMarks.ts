/**
 * V12 "Views": the one switch for the reveal marks on the canvas (the chips, initials, evidence marks and option lines that
 * ../../RevealMarks.tsx draws on each card). On by default, so nothing the person had is taken away; off hides the marks only, never the
 * data, the Team tab or the dock. Per-viewer convenience: nothing is saved.
 */
import { create } from 'zustand'

interface ViewsMarksState { readonly on: boolean; readonly set: (on: boolean) => void }
export const useViewsMarks = create<ViewsMarksState>()((set) => ({ on: true, set: (on) => set({ on }) }))
export const viewsMarksOn = (): boolean => useViewsMarks.getState().on
