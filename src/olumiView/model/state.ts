/**
 * THE MODEL TAB'S OWN STATE (Paul 7 Nov: an editable tab, the science behind an expert view or one press away).
 *
 * - `expert`: Plain or Expert, the crafted tab's one detail switch (legacy `ModelTabV2Panel` "Plain | Advanced"). The person's own
 *   preference, stored under the dock's existing key (`olumi.expertMode`, OutputsDock), so the next visit opens as they left it; the dock's
 *   own switch reads that key when it mounts (the two are not live-linked). A browser that blocks storage keeps it for this visit only. A
 *   content switch only: it never moves a row.
 * - `open`: the one row whose detail is open (legacy: one selected row, its detail region below). A card id, or `links.<i>` for a link.
 * - `editing`: the one editor open (legacy "one edit at a time"): a figure (the quantity it changes, which for an aim's target or a link's
 *   strength is another card's), or a name. Opening another row's detail never closes it, and nothing replaces it while its write is with
 *   core (`busy`), so typing is never dropped and a save never closes an editor that is not its own (review a4d73faf).
 * - `receipt`: what the last edit here came to, said on its row: core's version once the View shows it ("Version n saved.", the notice's
 *   own words), or core's refusal when the editor was no longer on screen to show it.
 * - `sid`: the scenario this state belongs to; another scenario starts clean (`follow`).
 * Nothing here holds a model value: the View is the one copy (store.ts).
 */
import { create } from 'zustand'

const EXPERT_KEY = 'olumi.expertMode'

function readExpert(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(EXPERT_KEY) === 'true' } catch { return false }
}

export type Editing = { readonly row: string; readonly what: 'figure'; readonly quantity: string } | { readonly row: string; readonly what: 'rename' }
export type Receipt = { readonly row: string; readonly words: string; readonly tone: 'saved' | 'failed' }

const same = (a: Editing | null, b: Editing | null): boolean =>
  a !== null && b !== null && a.row === b.row && a.what === b.what && (a.what === 'rename' || (b.what === 'figure' && a.quantity === b.quantity))

type ModelTabState = {
  readonly sid: string | null
  readonly expert: boolean
  readonly open: string | null
  readonly editing: Editing | null
  readonly busy: Editing | null
  readonly receipt: Receipt | null
  readonly setExpert: (expert: boolean) => void
  readonly toggle: (row: string) => void
  /** Open an editor (or none): refused while another editor's write is with core. */
  readonly edit: (editing: Editing | null) => void
  /** An editor closes itself, and only itself. */
  readonly closeIf: (mine: Editing) => void
  readonly setBusy: (mine: Editing | null) => void
  readonly say: (receipt: Receipt | null) => void
  /** The scenario on screen: another one starts with nothing open. */
  readonly follow: (sid: string | null) => void
}

export const useModelTab = create<ModelTabState>()((set, get) => ({
  sid: null,
  expert: readExpert(),
  open: null,
  editing: null,
  busy: null,
  receipt: null,
  setExpert: (expert) => {
    set({ expert })
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(EXPERT_KEY, String(expert)) } catch { /* storage blocked: this visit only */ }
  },
  toggle: (row) => set({ open: get().open === row ? null : row }),
  edit: (editing) => { if (get().busy === null) set({ editing, receipt: null }) },
  closeIf: (mine) => { if (same(get().editing, mine)) set({ editing: null }) },
  setBusy: (mine) => set({ busy: mine }),
  say: (receipt) => set({ receipt }),
  follow: (sid) => { if (get().sid !== sid) set({ sid, open: null, editing: null, busy: null, receipt: null }) },
}))

/** For specs: back to a fresh visit (the stored preference is read again). */
export const resetModelTab = (): void => useModelTab.setState({ sid: null, expert: readExpert(), open: null, editing: null, busy: null, receipt: null })
