/**
 * The page's one copy of the scenario's View (olumi.view/2), read from olumi-core. Not a source of truth: core is. It is read when the
 * scenario is first known, after the canvas's model changes, and when the person opens or closes a badge or every figure, which is a
 * new read of the View, never a re-fold here.
 *
 * Reads are numbered, as the Team tab's are: an answer a newer read has overtaken is dropped, so an expand answered after a collapse
 * never reopens it (Codex 00044). A failed read keeps the last good View and says why.
 *
 * A View for someone other than the person this page was opened for (another private link opened in this browser since: `you_id` is
 * not the page's person) is never installed: chat, canvas, results and Team all read this one copy, so none of them draws it. It reads
 * as a failed read in the person's words (NOT_FOR_THIS_PAGE), and the page's last View stays (final review 00004 #1).
 *
 * `at` is the approved version the person chose to look at (the version history's Draw): every read is then that version's own View
 * (core API v1.10), so a background read never swaps the latest back in unasked. Null is the latest. A version core does not serve as
 * asked is never installed (`readView` fails closed), and the canvas stays on what it drew.
 */
import { create } from 'zustand'
import { READ_FAILED, TeamApiError } from '../olumiCore/team/api'
import { coreScenarioIdOf } from '../olumiCore/team/sid'
import { isForThisPage, NOT_FOR_THIS_PAGE } from '../olumiCore/me'
import { readView, type Opened, type View } from './client'

export type ViewStatus = 'none' | 'loading' | 'ready' | 'error'

interface ViewState {
  readonly uuid: string | null
  readonly sid: string | null
  readonly view: View | null
  readonly opened: Opened
  readonly status: ViewStatus
  readonly error: string | null
  /** The canvas's model changed after this View was read: until a new one lands, none of its lines is current. */
  readonly stale: boolean
  /** The approved version on screen when the person chose an earlier one; null for the latest. */
  readonly at: number | null
  /** Point the store at a DGAI scenario; reads its View when core knows it. */
  readonly use: (uuid: string | null) => Promise<void>
  /** Read the View again. True when a whole, current answer was read. */
  readonly refresh: () => Promise<boolean>
  /** The canvas's model changed (a saved change, an approval): the View held is stale until the read this starts lands. */
  readonly modelChanged: () => Promise<boolean>
  /** Open or close a badge (its card id and the records the View said it holds), or every figure: a new read. */
  readonly setOpened: (opened: Opened) => Promise<boolean>
  /** Look at one approved version as it was (n), or go back to the latest (null): a new read. Null when it landed, else why not. */
  readonly look: (at: number | null) => Promise<string | null>
}

let seq = 0

/**
 * The model whose lines may be drawn beside the canvas: the View's, only while it is the approved model (no proposal held, whose lines
 * would be the proposal's), only while the last read succeeded (older lines are never shown as current), and never while the canvas's
 * model has changed since it was read (review 00051). Otherwise null, and the dock keeps its earlier block (review 00049).
 */
export const currentModel = (s: { view: View | null; error: string | null; stale: boolean }) => (s.error === null && !s.stale && s.view !== null && s.view.proposal === null ? s.view.model : null)

export const useViewStore = create<ViewState>()((set, get) => ({
  uuid: null, sid: null, view: null, opened: { open: new Map(), all: false }, status: 'none', error: null, stale: false, at: null,
  use: async (uuid) => {
    const sid = coreScenarioIdOf(uuid)
    if (get().uuid === uuid && get().sid === sid && get().status !== 'none' && get().status !== 'error') return
    const same = get().uuid === uuid
    seq += 1
    set({ uuid, sid, view: same ? get().view : null, opened: same ? get().opened : { open: new Map(), all: false }, at: same ? get().at : null, status: sid ? 'loading' : 'none', error: null })
    if (sid) await get().refresh()
  },
  refresh: async () => {
    // The pairing can be learned after the scenario is first drawn (a brand-new scenario): look again.
    const sid = get().sid ?? coreScenarioIdOf(get().uuid)
    if (!sid) { set({ sid: null, status: 'none' }); return false }
    const mine = ++seq
    set({ sid, status: get().view ? 'ready' : 'loading' })
    try {
      const view = await readView(sid, get().opened, get().at)
      if (mine !== seq) return false
      if (!isForThisPage(view)) { set({ status: get().view ? 'ready' : 'error', error: NOT_FOR_THIS_PAGE }); return false }
      set({ view, status: 'ready', error: null, stale: false })
      return true
    } catch (e) {
      if (mine !== seq) return false
      set({ status: get().view ? 'ready' : 'error', error: e instanceof TeamApiError ? e.message : READ_FAILED })
      return false
    }
  },
  modelChanged: async () => {
    set({ stale: true })
    return get().refresh()
  },
  setOpened: async (opened) => {
    const was = get().opened
    set({ opened })
    const ok = await get().refresh()
    // A read that failed puts back what was opened, so the page and the View agree. One a newer read overtook is that read's to settle.
    if (!ok && get().opened === opened && get().status !== 'loading') set({ opened: was })
    return ok
  },
  look: async (at) => {
    const sid = get().sid
    if (!sid) return READ_FAILED
    const mine = ++seq
    try {
      const view = await readView(sid, get().opened, at)
      if (mine !== seq) return null // a newer read settles what is on screen
      if (!isForThisPage(view)) return NOT_FOR_THIS_PAGE
      set({ view, at, status: 'ready', error: null, stale: false })
      return null
    } catch (e) {
      if (mine !== seq) return null
      // The View on screen stays, and with it the version it is: a failed look is said where the person asked, not as a failed read.
      return e instanceof TeamApiError ? e.message : READ_FAILED
    }
  },
}))
