/**
 * THE MODEL TAB'S OWN STATE (Paul 7 Nov: an editable tab, the science behind an expert view or one press away).
 *
 * - `expert`: Plain or Expert, the crafted tab's one detail switch (legacy `ModelTabV2Panel` "Plain | Advanced"). It is the person's own
 *   preference, kept under the dock's existing key (`olumi.expertMode`, OutputsDock), so one choice serves both; a browser that blocks
 *   storage keeps it for this visit only. A content switch only: it never moves a row.
 * - `open`: the one row whose detail is open (legacy: one selected row, its detail region below). A card id, or `links.<i>` for a link.
 * - `editing`: the one editor open (legacy "one edit at a time"): a figure (the quantity it changes, which for an aim's target or a link's
 *   strength is another card's), or a name.
 * - `saved`: the receipt of the last edit made here, said beside its row ("Version n saved.", the notice's own words) until another
 *   edit or row takes its place.
 * Nothing here holds a model value: the View is the one copy (store.ts).
 */
import { create } from 'zustand'

const EXPERT_KEY = 'olumi.expertMode'

function readExpert(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(EXPERT_KEY) === 'true' } catch { return false }
}

export type Editing = { readonly row: string; readonly what: 'figure'; readonly quantity: string } | { readonly row: string; readonly what: 'rename' }

type ModelTabState = {
  readonly expert: boolean
  readonly open: string | null
  readonly editing: Editing | null
  readonly saved: { readonly row: string; readonly words: string } | null
  readonly setExpert: (expert: boolean) => void
  readonly toggle: (row: string) => void
  readonly edit: (editing: Editing | null) => void
  readonly said: (saved: { readonly row: string; readonly words: string } | null) => void
}

export const useModelTab = create<ModelTabState>()((set, get) => ({
  expert: readExpert(),
  open: null,
  editing: null,
  saved: null,
  setExpert: (expert) => {
    set({ expert })
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(EXPERT_KEY, String(expert)) } catch { /* storage blocked: this visit only */ }
  },
  toggle: (row) => set({ open: get().open === row ? null : row, editing: get().editing?.row === row ? get().editing : null }),
  edit: (editing) => set({ editing, saved: null }),
  said: (saved) => set({ saved }),
}))

/** For specs: back to a fresh visit (the stored preference is read again). */
export const resetModelTab = (): void => useModelTab.setState({ expert: readExpert(), open: null, editing: null, saved: null })
