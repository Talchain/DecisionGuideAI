/**
 * THE ONE SURFACE STORE (surfaces step 2, 18 Nov): what floats over the lane's canvas, held in ONE slot, so "at most one of the figure editor, the
 * edit form, the details panel, the right-click menu and the add form is open" is true by construction: showing any of them replaces the others.
 *   - a card's figure editor (FigureEdit's pop-over), the one small edit form (EditForm), the details panel (LaneInspector), the right-click menu
 *     (ViewCanvas) and the add form (AddFigure) all read their open state from `current`;
 *   - Escape and a press on empty canvas are decided in one place each (LaneEditingLayer's one key listener, ViewCanvas's pane press);
 *   - the card's hover pop-up reads `current !== null` and stays hidden while any of them is open.
 * A write in flight is never cut off (the details panel's is its card's "Your figure" save): while the open surface is sending, nothing replaces it and Escape or a pane press leave it be.
 * Drafts: a form's typed words are kept here, keyed by what it writes, until it saves or the person cancels it (Escape or Cancel), so showing another
 * surface never throws a person's typing away. (The figure editor and the add form keep their own words in components that stay mounted.)
 */
import { create } from 'zustand'
import type { ContextTarget } from '../../../canvas/contextMenu/types'
import { useWrites } from '../../../olumiCore/team/writes'
import { useViewStore } from '../../store'
import type { EditSpec } from './EditForm'

/** What the details panel is showing: a card (by its record id) or a link (by its canvas edge id, `from->to:kind`). */
export type DetailsTarget = { readonly kind: 'card' | 'link'; readonly id: string }
export type Point = { readonly x: number; readonly y: number }

export type Surface =
  | { readonly kind: 'details'; readonly target: DetailsTarget }
  | { readonly kind: 'menu'; readonly target: ContextTarget }
  | { readonly kind: 'form'; readonly spec: EditSpec; readonly anchor: Point; /** The lane: the card or link the form stands beside (the details panel's own item); absent, it stands at `anchor`. */ readonly beside?: DetailsTarget; readonly busyKey: string }
  | { readonly kind: 'editor'; readonly key: string; readonly busyKey: string }
  | { readonly kind: 'add'; readonly busyKey: string }
/** The open one; `n` is new for every showing, so a form opened again starts from its own words and not the last one's. */
export type Showing = Surface & { readonly n: number }
export type Drafts = Readonly<Record<string, Readonly<Record<string, string>>>>

type State = {
  readonly current: Showing | null
  readonly drafts: Drafts
  /** Details panel: show a card or link. (Kept as the name the canvas, the bands and the specs already use.) */
  readonly open: (t: DetailsTarget) => void
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
/** The details panel of a card holds its "Your figure" save, which writes under `${sid}:edit:${id}` (FigureEdit's setFigure); a link's panel writes nothing itself (its forms are their own surface). */
const busyKeyOf = (s: Showing | null): string | null => {
  if (s === null) return null
  if (s.kind === 'form' || s.kind === 'editor' || s.kind === 'add') return s.busyKey
  if (s.kind === 'details' && s.target.kind === 'card') { const sid = useViewStore.getState().sid; return sid === null ? null : `${sid}:edit:${s.target.id}` }
  return null
}
/** Is the open surface sending a write? Its keys are the writers' own (`${sid}:edit:${id}`, `writeKeyOf(spec)`, `${sid}:add-figure`). */
export const surfaceBusy = (s: Showing | null): boolean => { const k = busyKeyOf(s); return k !== null && useWrites.getState().sending[k] === true }

export const useLaneInspector = create<State>()((set, get) => ({
  current: null, drafts: {},
  open: (target) => { get().show({ kind: 'details', target }) },
  show: (s) => {
    if (surfaceBusy(get().current)) return false
    set({ current: { ...s, n: ++seq } })
    return true
  },
  close: (kind = 'details', key) => set((st) => {
    const c = st.current
    if (c === null || c.kind !== kind || (c.kind === 'editor' && key !== undefined && c.key !== key)) return st
    return { current: null }
  }),
  dismiss: (explicit) => {
    const c = get().current
    if (c === null) return false
    if (surfaceBusy(c)) return true
    if (explicit && c.kind === 'form') get().forgetDraft(draftKeyOf(c.spec))
    set({ current: null })
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
export const anySurfaceOpen = (s: { readonly current: Showing | null }): boolean => s.current !== null

/**
 * Escape keys a canvas surface has taken. The one key listener (LaneEditingLayer) records every Escape it consumed; a waiting challenge's own
 * listener reads this, so one press closes the top canvas surface and only the next one cancels the challenge.
 */
const consumed = new WeakSet<Event>()
export const consumeEscape = (e: Event): void => { consumed.add(e) }
export const escapeConsumed = (e: Event): boolean => consumed.has(e)
