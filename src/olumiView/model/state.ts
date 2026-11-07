/**
 * THE MODEL TAB'S OWN STATE (Paul 7 Nov: an editable tab, the science behind an expert view or one press away).
 *
 * - `expert`: Plain or Expert, the crafted tab's one detail switch (legacy `ModelTabV2Panel` "Plain | Advanced"). The person's own
 *   preference, stored under the dock's existing key (`olumi.expertMode`, OutputsDock), so the next visit opens as they left it; the dock's
 *   own switch reads that key when it mounts (the two are not live-linked). A browser that blocks storage keeps it for this visit only. A
 *   content switch only: it never moves a row.
 * - `open`: the one row whose detail is open (legacy: one selected row, its detail region below). A card id, or a link's row
 *   (`linkRowOf`: by what it joins, never by where it sits in the list).
 * - `editing`: the one editor open (legacy "one edit at a time"): a figure (the quantity it changes, which for an aim's target or a link's
 *   strength is another card's), or a name. It holds what the editor opened on, the scenario and core's version (base-at-open, the canvas
 *   editors' rule), and the person's typing, so a group closed or a filter typed never drops either (UI audit of e8ebab94). Opening
 *   another row's detail never closes it, and nothing replaces it while a write is with core.
 * - `adding`: Add a figure's form while it is open: what it opened on (the scenario, core's version) and the person's typing, kept here as
 *   an editor's is, so a View that is not valid for a while (the tab then draws no form), a group closed or a filter typed never drops it.
 * - `fresh`: the editor (or Add a figure) a press has just opened, which takes focus once drawn; one drawn again later (the View was not
 *   valid for a while, its draft kept) takes focus only from nowhere, never from where the person put it.
 * - `busy`: the write key of the one write with core from this tab (an editor's, Add a figure's, Remove link's), from its send until the
 *   View read after it settles. While it is set no other write starts here and no editor opens over it (review a4d73faf).
 * - `receipt`: what the last edit here came to, said on its row: core's version once the View shows it ("Version n saved.", the notice's
 *   own words), or core's refusal when the editor was no longer on screen to show it. A link removed says it on its group
 *   (`RELATIONSHIPS_ROW`), since its own row is gone.
 * - `sid`: the scenario this state belongs to; another scenario starts clean (`follow`).
 * Nothing here holds a model value: the View is the one copy (store.ts).
 */
import { create } from 'zustand'

const EXPERT_KEY = 'olumi.expertMode'

function readExpert(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(EXPERT_KEY) === 'true' } catch { return false }
}

/** What an editor changes: a figure (the quantity) shown on a row, or a card's name. */
export type EditTarget = { readonly row: string; readonly what: 'figure'; readonly quantity: string } | { readonly row: string; readonly what: 'rename' }
/** An open editor: its target, what it opened on (the scenario, core's version), and the person's typing so far. */
export type Editing = EditTarget & { readonly sid: string; readonly base: number; readonly typed: string }
/** Add a figure's open form: what it opened on (base-at-open) and the person's typing so far. */
export type Adding = { readonly sid: string; readonly base: number; readonly label: string; readonly typed: string; readonly unit: string }
/** A write that landed but no View has shown yet: core's version (null when its answer gave none) and the View on screen then. */
export type Unseen = { readonly n: number | null; readonly view: unknown }
/** `unseen`: the write was saved but no View has shown it yet (core's version, and the View on screen then); a later one settles it. */
export type Receipt = { readonly row: string; readonly words: string; readonly tone: 'saved' | 'failed'; readonly unseen?: Unseen }

/** A group's own receipt row: what a write on the group came to when no row of it can say so (a removed link's row is gone; Add a figure's
 *  form, or Remove link's ask, left the screen while core had the write). */
export const groupRow = (id: string): string => `group:${id}`
export const RELATIONSHIPS_ROW = groupRow('relationships')
export const FACTORS_ROW = groupRow('factors')
/** Olumi's held change, set aside by the person: what that came to when no notice was on screen to say it, tied to that change (no row of
 *  the tab is this one). */
export const HELD_PREFIX = 'tab:held:'
export const heldRow = (id: number): string => `${HELD_PREFIX}${id}`

/** An editor's own tag, for `fresh`: what it changes, never its typing. Add a figure's is `ADD_TAG`. */
export const tagOf = (t: EditTarget): string => (t.what === 'figure' ? `${t.row}|figure|${t.quantity}` : `${t.row}|rename`)
export const ADD_TAG = 'add-figure'

/** The same editor: its target, in the same scenario when both say one. The typing and the base are what it holds, never who it is. */
export const sameEditor = (a: EditTarget | Editing | null, b: EditTarget | Editing | null): boolean =>
  a !== null && b !== null && a.row === b.row && a.what === b.what && (a.what === 'rename' || (b.what === 'figure' && a.quantity === b.quantity))
  && (!('sid' in a) || !('sid' in b) || a.sid === b.sid)

type ModelTabState = {
  readonly sid: string | null
  readonly expert: boolean
  readonly open: string | null
  readonly editing: Editing | null
  readonly adding: Adding | null
  readonly fresh: string | null
  readonly busy: string | null
  readonly receipt: Receipt | null
  readonly setExpert: (expert: boolean) => void
  readonly toggle: (row: string) => void
  /** Close a row's detail if it is the one open, and only then (a toggle could open another row in its place). */
  readonly close: (row: string) => void
  /** Open an editor on what it opened on: refused while a write is with core; the same editor already open keeps its typing. */
  readonly edit: (editing: Editing) => void
  /** The person's typing, kept with their editor. */
  readonly type: (mine: Editing, typed: string) => void
  /** An editor closes itself, and only itself. */
  readonly closeIf: (mine: EditTarget | Editing) => void
  /** Open Add a figure on what it opens on; one already open in this scenario keeps its typing. */
  readonly openAdding: (sid: string, base: number) => void
  readonly typeAdding: (typed: Partial<Pick<Adding, 'label' | 'typed' | 'unit'>>) => void
  readonly closeAdding: () => void
  /** Drawn: true once, for the editor a press has just opened (it takes focus); false for one drawn again. */
  readonly take: (tag: string) => boolean
  readonly setBusy: (key: string | null) => void
  readonly say: (receipt: Receipt | null) => void
  /** The scenario on screen: another one starts with nothing open. */
  readonly follow: (sid: string | null) => void
}

export const useModelTab = create<ModelTabState>()((set, get) => ({
  sid: null,
  expert: readExpert(),
  open: null,
  editing: null,
  adding: null,
  fresh: null,
  busy: null,
  receipt: null,
  setExpert: (expert) => {
    set({ expert })
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(EXPERT_KEY, String(expert)) } catch { /* storage blocked: this visit only */ }
  },
  toggle: (row) => set({ open: get().open === row ? null : row }),
  close: (row) => { if (get().open === row) set({ open: null }) },
  edit: (editing) => {
    if (get().busy !== null || sameEditor(get().editing, editing)) return
    set({ editing, receipt: null, fresh: tagOf(editing) })
  },
  type: (mine, typed) => { const e = get().editing; if (e !== null && sameEditor(e, mine)) set({ editing: { ...e, typed } }) },
  closeIf: (mine) => { if (sameEditor(get().editing, mine)) set({ editing: null, fresh: null }) },
  openAdding: (sid, base) => { if (get().adding?.sid !== sid) set({ adding: { sid, base, label: '', typed: '', unit: '' }, fresh: ADD_TAG }) },
  typeAdding: (typed) => { const a = get().adding; if (a !== null) set({ adding: { ...a, ...typed } }) },
  closeAdding: () => set({ adding: null, fresh: get().fresh === ADD_TAG ? null : get().fresh }),
  take: (tag) => { if (get().fresh !== tag) return false; set({ fresh: null }); return true },
  setBusy: (key) => set({ busy: key }),
  say: (receipt) => set({ receipt }),
  follow: (sid) => { if (get().sid !== sid) set({ sid, open: null, editing: null, adding: null, fresh: null, busy: null, receipt: null }) },
}))

/**
 * The person is forgotten (sign-out, or Delete my data: `forgetThisPerson`): nothing of theirs stays in this store, neither their typing
 * (an editor's or Add a figure's), an unseen write's View, nor a receipt (Codex review-ui 3). Plain | Expert stays: it is this browser's display preference, not theirs.
 */
export const forgetModelTab = (): void => useModelTab.setState({ sid: null, open: null, editing: null, adding: null, fresh: null, busy: null, receipt: null })

/** For specs: back to a fresh visit (the stored preference is read again). */
export const resetModelTab = (): void => useModelTab.setState({ sid: null, expert: readExpert(), open: null, editing: null, adding: null, fresh: null, busy: null, receipt: null })
