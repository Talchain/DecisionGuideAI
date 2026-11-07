/**
 * THE MODEL MOVED, IN WORDS (TIER-C-DESIGN-QA defect 7 and 9; capability inventory item 3). Two one-line notices at the head of the
 * conversation, both about an approved version of the model:
 *   - `saved`: the person's own approval landed ("Version 2 saved. Approved by Ada."), version number from core's approve answer
 *     (`{ n }`), the name the page was opened for (the View's `you`);
 *   - `moved`: another member's approval reached this page on the background re-read ("Model changed to version 2. Approved by Bea."),
 *     the number from the View's `version.n`, the name from core's stored versions (`GET …/versions`, `by`).
 * Only a number and a name are drawn: no model value is computed or formatted here. A version this person approved never reads as
 * "changed" to them (`by` is theirs), and a notice is kept only for the scenario it was made for.
 */
import { create } from 'zustand'
import { call } from '../olumiCore/team/api'
import { useViewStore } from './store'

/** `by` null: the person's own direct edit (a figure, a name, a new figure card), saved as their version with no approval to name. */
export type ModelNotice = { readonly kind: 'saved' | 'moved'; readonly n: number; readonly by: string | null; readonly sid: string }

export const useModelNotice = create<{ readonly notice: ModelNotice | null }>()(() => ({ notice: null }))

export const noticeWords = (x: ModelNotice): string =>
  x.kind === 'saved' ? (x.by === null ? `Version ${x.n} saved.` : `Version ${x.n} saved. Approved by ${x.by}.`) : `Model changed to version ${x.n}. Approved by ${x.by ?? 'someone'}.`

/** The person's own approval landed: version `n`, approved by the name this page was opened for. */
export function noteSaved(answer: unknown, approved = true): void {
  const { sid, view } = useViewStore.getState()
  const n = (answer as { n?: unknown } | null)?.n
  if (sid === null || view === null || typeof n !== 'number' || !Number.isInteger(n)) return
  useModelNotice.setState({ notice: { kind: 'saved', n, by: approved ? view.you : null, sid } })
}
/** The person's own direct edit saved (a figure, a name, a figure card added): its version's receipt, never "Approved by" (nothing was
 *  approved: core saves the edit as their version at once). */
export const noteEditSaved = (answer: unknown): void => noteSaved(answer, false)

/**
 * The background re-read found a newer approved version than the one held. Core's stored versions say who approved it; one the person
 * approved themselves is not "changed" to them. A read that fails says nothing (the changed cards still pulse).
 */
export async function noteMoved(sid: string, n: number): Promise<void> {
  const held = useModelNotice.getState().notice
  if (held !== null && held.sid === sid && held.n >= n) return
  try {
    const r = await call<{ versions: Array<{ n: number; by: string }> }>('GET', `/api/scenarios/${encodeURIComponent(sid)}/versions`)
    const v = r.versions.find((x) => x.n === n)
    const st = useViewStore.getState()
    if (v === undefined || st.sid !== sid || st.view === null || v.by === st.view.you) return
    const now = useModelNotice.getState().notice
    if (now !== null && now.sid === sid && now.n >= n) return
    useModelNotice.setState({ notice: { kind: 'moved', n, by: v.by, sid } })
  } catch { /* nothing is said on a failed read */ }
}
