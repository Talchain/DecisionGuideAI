/**
 * Who this page is for on the olumi-core lane: the person whose private link this browser opened (`GET /api/me`, core's own answer
 * from its cookie). Read once when the page starts. Core serves this page on its own origin, so nothing else says who the person is.
 *
 * A page that later reads a View for someone else (another private link was opened in this browser since) says so and shows nothing
 * of theirs: `isForThisPage`.
 */
import { create } from 'zustand'
import { call } from './team/api'

export interface Me { readonly id: string; readonly name: string }

interface MeState {
  /** null until read, or when the browser holds no private link. */
  readonly me: Me | null
  readonly status: 'none' | 'loading' | 'ready' | 'error'
  readonly load: () => Promise<void>
}

export const useMe = create<MeState>()((set, get) => ({
  me: null, status: 'none',
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return
    set({ status: 'loading' })
    try {
      const r = await call<{ me?: { id?: unknown; name?: unknown } | null }>('GET', '/api/me')
      const m = r?.me
      set({ me: m && typeof m.id === 'string' && typeof m.name === 'string' ? { id: m.id, name: m.name } : null, status: 'ready' })
    } catch { set({ status: 'error' }) }
  },
}))

/** What the page says when a View is for a different person from the one this page was opened for. */
export const NOT_FOR_THIS_PAGE = 'This page was opened with a different private link from the one this browser holds now, so nothing is shown here. Reload this page to continue as the person whose private link is open now.'

/** Is this View for the person this page was opened for? True while either side cannot say (no page person yet, or a View without `you_id`). */
export function isForThisPage(view: { readonly you_id?: string | null }, me: Me | null = useMe.getState().me): boolean {
  return me === null || view.you_id == null || view.you_id === me.id
}
