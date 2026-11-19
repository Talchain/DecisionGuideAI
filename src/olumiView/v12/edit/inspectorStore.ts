/**
 * THE ONE SURFACE STORE (surfaces step 2, 18 Nov): what floats over the lane's canvas, held in ONE slot, so "at most one of the figure editor, the
 * edit form, the details panel, the right-click menu and the add form is open" is true by construction: showing any of them replaces the others.
 *   - a card's figure editor (FigureEdit's pop-over), the one small edit form (EditForm), the details panel (LaneInspector), the right-click menu
 *     (ViewCanvas) and the add form (AddFigure) all read their open state from `current`;
 *   - Escape and a press on empty canvas are decided in one place each (LaneEditingLayer's one key listener, ViewCanvas's pane press);
 *   - the card's hover pop-up reads `current !== null` and stays hidden while any of them is open.
 * THE PEEK (surfaces step A, 18 Nov): a card the pointer rests on, or that holds keyboard focus, is named in `peek`. It is NOT in the slot: it never
 * closes anything, and it is read only while the slot is empty (`boxOf`). The details panel draws it as the same box a press then pins.
 * A write in flight is never cut off (the details panel's is its card's "Your figure" save): while the open surface is sending, nothing replaces it and Escape or a pane press leave it be.
 * Drafts: a form's typed words are kept here, keyed by what it writes, until it saves or the person cancels it (Escape or Cancel), so showing another
 * surface never throws a person's typing away. (The figure editor and the add form keep their own words in components that stay mounted.)
 */
import { create } from 'zustand'
import type { ContextTarget } from '../../../canvas/contextMenu/types'
import { useWrites } from '../../../olumiCore/team/writes'
import { useViewStore } from '../../store'
import type { EditSpec } from './EditForm'
import { edgeIdOf } from '../../../canvas/contextMenu/laneMenu'
import type { OutputTab } from '../../../stores/uiStore'

/** What the details panel is showing: a card (by its record id) or a link (by its canvas edge id, `from->to:kind`). */
export type DetailsTarget = { readonly kind: 'card' | 'link'; readonly id: string }
export type Point = { readonly x: number; readonly y: number }

export type Surface =
  | { readonly kind: 'details'; readonly target: DetailsTarget; /** Surfaces step 5: a figure control opened these details to change the figure: the Value row's field takes focus (`aside`: the pending change was just set aside, and it says so). */ readonly edit?: 'value' | 'aside'; /** What Enter does (`try`: Try without saving, Set secondary) and the dock tab a try opens; the control's own, kept on the request. */ readonly primary?: 'set' | 'try'; readonly tab?: OutputTab; /** The press that opened these details was a mark about one section: it is drawn open. */ readonly section?: 'differ' }
  | { readonly kind: 'menu'; readonly target: ContextTarget }
  | { readonly kind: 'form'; readonly spec: EditSpec; readonly anchor: Point; /** The lane: the card or link the form stands beside (the details panel's own item); absent, it stands at `anchor`. */ readonly beside?: DetailsTarget; readonly busyKey: string }
  | { readonly kind: 'editor'; readonly key: string; readonly busyKey: string }
  | { readonly kind: 'add'; readonly busyKey: string }
/** The open one; `n` is new for every showing, so a form opened again starts from its own words and not the last one's. */
export type Showing = Surface & { readonly n: number }
export type Drafts = Readonly<Record<string, Readonly<Record<string, string>>>>

type State = {
  readonly current: Showing | null
  /** The card being previewed (the pointer rests on it, or it holds keyboard focus). Outside the slot; drawn only while the slot is empty. */
  readonly peek: DetailsTarget | null
  readonly setPeek: (t: DetailsTarget) => void
  /** Lets go of the preview only if it still names this card (a card that is left never clears the next one's). */
  readonly clearPeek: (id: string) => void
  readonly drafts: Drafts
  /** Details panel: show a card or link. (Kept as the name the canvas, the bands and the specs already use.) */
  readonly open: (t: DetailsTarget) => void
  /** Surfaces step 5: the ONE way a figure is changed on the lane. Whichever control asks (a card's pencil, the right-click row, the Model tab, an aim's question), the details of that card or link
   *  open with the Value row's field focused; asked again, it takes focus again. False, nothing changed, when the open surface is saving. */
  readonly openFigure: (t: DetailsTarget, how?: 'value' | 'aside', opts?: { readonly primary?: 'set' | 'try'; readonly tab?: OutputTab }) => boolean
  /** Show any surface in place of whatever is open. False, nothing changed, when the open one is saving. */
  readonly show: (s: Surface) => boolean
  /** Close the open surface if it is of this kind (and, for an editor, this key): a surface lets go of itself, whatever else is open stays. */
  readonly close: (kind?: Surface['kind'], key?: string) => void
  /** Escape or a press on empty canvas: close what is open unless it is saving. `explicit` (Escape) also drops a form's draft. True: there was something open. */
  readonly dismiss: (explicit: boolean) => boolean
  readonly setDraft: (key: string, values: Readonly<Record<string, string>>) => void
  readonly forgetDraft: (key: string) => void
}

let seq = 0
/**
 * The details panel's Value row is its item's one figure field, so it writes under the figure's own keys: a card's `${sid}:edit:${id}` (FigureEdit's setFigure) and,
 * where core offers its chance and size or its strength as `route: 'size'`, `${sid}:size:${record}` (EditForm's `writeKeyOf`); a link's is the size key alone.
 */
const detailsKeys = (sid: string, t: DetailsTarget): string[] => {
  const m = useViewStore.getState().view?.model
  if (t.kind === 'card') {
    const e = m?.cards.find((c) => c.id === t.id)?.figure?.edit as { route?: string; record?: unknown } | null | undefined // EditForm's `isSizeEdit`, which this module cannot import (it imports this one)
    return [`${sid}:edit:${t.id}`, ...(e != null && e.route === 'size' && typeof e.record === 'string' ? [`${sid}:size:${e.record}`] : [])]
  }
  const l = m?.links.find((x) => edgeIdOf(x) === t.id)
  const r = (l?.size?.edit as { record?: unknown } | null | undefined)?.record
  return typeof r === 'string' ? [`${sid}:size:${r}`] : []
}
const busyKeysOf = (s: Showing | null): string[] => {
  if (s === null) return []
  if (s.kind === 'form' || s.kind === 'editor' || s.kind === 'add') return [s.busyKey]
  if (s.kind === 'details') { const sid = useViewStore.getState().sid; return sid === null ? [] : detailsKeys(sid, s.target) }
  return []
}
/** Is the open surface sending a write? Its keys are the writers' own (`${sid}:edit:${id}`, `writeKeyOf(spec)`, `${sid}:add-figure`). */
export const surfaceBusy = (s: Showing | null): boolean => busyKeysOf(s).some((k) => useWrites.getState().sending[k] === true)

/** Closing a card's pinned box closes the box: it does not fall back to a preview of the same card because the pointer still rests there (the pointer must leave and return). */
const peekAfter = (closing: Showing, peek: DetailsTarget | null): DetailsTarget | null => (closing.kind === 'details' && peek !== null && peek.kind === closing.target.kind && peek.id === closing.target.id ? null : peek)

export const useLaneInspector = create<State>()((set, get) => ({
  current: null, peek: null, drafts: {},
  setPeek: (peek) => set((st) => (st.peek !== null && st.peek.kind === peek.kind && st.peek.id === peek.id ? st : { peek })),
  clearPeek: (id) => set((st) => (st.peek !== null && st.peek.id === id ? { peek: null } : st)),
  open: (target) => { get().show({ kind: 'details', target }) },
  openFigure: (target, how = 'value', opts = {}) => get().show({ kind: 'details', target, edit: how, ...(opts.primary !== undefined ? { primary: opts.primary } : {}), ...(opts.tab !== undefined ? { tab: opts.tab } : {}) }),
  show: (s) => {
    const cur = get().current
    if (surfaceBusy(cur)) return false
    // The same item's details asked for again (a second press on its card): the section a mark opened stays open, never shut under the reader.
    const section = s.kind === 'details' && s.section === undefined && cur !== null && cur.kind === 'details' && cur.target.kind === s.target.kind && cur.target.id === s.target.id ? cur.section : undefined
    set({ current: { ...s, ...(section !== undefined ? { section } : {}), n: ++seq } })
    return true
  },
  close: (kind = 'details', key) => set((st) => {
    const c = st.current
    if (c === null || c.kind !== kind || (c.kind === 'editor' && key !== undefined && c.key !== key)) return st
    return { current: null, peek: peekAfter(c, st.peek) }
  }),
  dismiss: (explicit) => {
    const c = get().current
    if (c === null) return false
    if (surfaceBusy(c)) return true
    if (explicit && c.kind === 'form') get().forgetDraft(draftKeyOf(c.spec))
    set({ current: null, peek: peekAfter(c, get().peek) })
    return true
  },
  setDraft: (key, values) => set((st) => ({ drafts: { ...st.drafts, [key]: values } })),
  forgetDraft: (key) => set((st) => { if (!(key in st.drafts)) return st; const { [key]: _gone, ...rest } = st.drafts; return { drafts: rest } }),
}))

/** A form's draft is kept under the write it would make. */
export const draftKeyOf = (spec: EditSpec): string => {
  switch (spec.kind) {
    case 'rename': return `${spec.sid}:rename:${spec.record}`
    case 'figure-add': return `${spec.sid}:add-figure`
    case 'item': return `${spec.sid}:item:${spec.item}:${spec.concerns.join(',')}`
    case 'figure-edit': return `${spec.sid}:edit:${spec.record}`
    case 'size': return `${spec.sid}:size:${spec.edit.record}`
    case 'remove-link': return `${spec.sid}:remove-link:${spec.remove.record}.${spec.remove.part ?? ''}`
  }
}

/** The details panel's target, or null while something else (or nothing) is open. */
export const detailsOf = (s: { readonly current: Showing | null }): DetailsTarget | null => (s.current !== null && s.current.kind === 'details' ? s.current.target : null)
/** THE ONE BOX: the pinned details' target, else (only while nothing at all is open) the card being previewed. */
export const boxOf = (s: { readonly current: Showing | null; readonly peek: DetailsTarget | null }): { readonly target: DetailsTarget; readonly pinned: boolean } | null => {
  const pinned = detailsOf(s)
  if (pinned !== null) return { target: pinned, pinned: true }
  return s.current === null && s.peek !== null ? { target: s.peek, pinned: false } : null
}
export const anySurfaceOpen = (s: { readonly current: Showing | null }): boolean => s.current !== null
