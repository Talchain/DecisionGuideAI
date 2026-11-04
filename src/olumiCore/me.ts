/**
 * Who this page is for on the olumi-core lane: the person whose private link this browser opened (`GET /api/me`, core's own answer
 * from its cookie). Read once when the page starts. Core serves this page on its own origin, so nothing else says who the person is.
 *
 * A page that later reads a View for someone else (another private link was opened in this browser since) says so and shows nothing
 * of theirs (`isForThisPage`), and no write is saved as them (`team/api.ts`, checked before every write).
 */
import { create } from 'zustand'
import { call, NOT_FOR_THIS_PAGE, setPagePerson } from './team/api'

export { NOT_FOR_THIS_PAGE }

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
      const me = m && typeof m.id === 'string' && typeof m.name === 'string' ? { id: m.id, name: m.name } : null
      setPagePerson(me?.id ?? null)
      set({ me, status: 'ready' })
    } catch { set({ status: 'error' }) }
  },
}))

/** Is this View for the person this page was opened for? True while either side cannot say (no page person yet, or a View without `you_id`). */
export function isForThisPage(view: { readonly you_id?: string | null }, me: Me | null = useMe.getState().me): boolean {
  return me === null || view.you_id == null || view.you_id === me.id
}
