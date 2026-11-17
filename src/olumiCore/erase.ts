/**
 * "Delete my data" on the olumi-core lane (core batch R15: `POST /api/me/delete`, the private-link cookie, JSON).
 *   `{"confirm":null}`             only previews: core answers `{ preview: true, words: [...] }`, the sentences the person reads first.
 *   `{"confirm":"delete my data"}` deletes: core removes or anonymises the person's rows, ends their link and clears this browser's cookie.
 * Anything else core refuses with a 400 and its own message, and nothing changes. The page shows core's `words` verbatim and never
 * rebuilds a sentence from the counts beside them (the UI formats no value, DL 5 Nov).
 *
 * Both go through `call`, so before each one core is asked whose link this browser holds now, and a different person's is refused
 * before anything is sent (team/api.ts stillThisPerson): one person's page never deletes another person's data.
 */
import { create } from 'zustand'
import { forgetThisPerson } from './signout'
import { call, TeamApiError } from './team/api'

/** A preview that came back without core's sentences: nothing is offered for deletion unread. */
export const PREVIEW_UNREADABLE = 'Olumi could not show what deleting would remove, so nothing was deleted. Try again in a moment.'

/** Core's sentences for what deleting would do, in core's order, exactly as core wrote them. */
export async function previewMyDataDeletion(): Promise<readonly string[]> {
  const r = await call<{ preview?: unknown; words?: unknown }>('POST', '/api/me/delete', { confirm: null })
  const words = r?.words
  if (r?.preview !== true || !Array.isArray(words) || words.length === 0 || !words.every((w): w is string => typeof w === 'string')) {
    throw new TeamApiError(0, PREVIEW_UNREADABLE)
  }
  return words
}

/**
 * Core's whole reply to a completed deletion. `aiLogLeft` is present ONLY when core could not clear its AI request log after the store
 * deletion went through (core 74b3dbca, `POST /api/me/delete`): `ref` is the request id and `words` core's own sentence naming what is
 * left and who to write to. Optional: an older core never sends it, and then nothing is drawn.
 */
export interface DeleteReply {
  readonly deleted?: unknown
  readonly removed?: unknown
  readonly anonymised?: unknown
  readonly scenarios?: unknown
  readonly aiLogLeft?: { readonly ref: string; readonly words: string }
}

const KEPT = 'olumi-delete-ai-log-left'
/** Only the typed warning is read back after a reload; anything else in storage is ignored. */
function readKept(): DeleteReply['aiLogLeft'] | undefined {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEPT) ?? 'null') as { ref?: unknown; words?: unknown } | null
    return v && typeof v.ref === 'string' && typeof v.words === 'string' && v.words !== '' ? { ref: v.ref, words: v.words } : undefined
  } catch { return undefined }
}
function keep(a: DeleteReply['aiLogLeft']): void {
  try { if (a) sessionStorage.setItem(KEPT, JSON.stringify(a)); else sessionStorage.removeItem(KEPT) } catch { /* storage may be blocked: the warning then shows once, without surviving a reload */ }
}

/** The last completed deletion's reply, kept so the signed-out screen can draw core's partial-cleanup warning (it survives a reload). */
export const useDeleteReply = create<{ readonly reply: DeleteReply | null }>()(() => ({ reply: null }))

/** The warning core sent with the last deletion, in core's words; undefined when core sent none. */
export function aiLogLeftNow(): DeleteReply['aiLogLeft'] {
  return useDeleteReply.getState().reply?.aiLogLeft ?? readKept()
}

/** Deletes the person's data; throws (a TeamApiError, in core's or the page's words) when it did not go through. Returns core's whole reply. */
export async function deleteMyData(): Promise<DeleteReply> {
  const r = await call<DeleteReply>('POST', '/api/me/delete', { confirm: 'delete my data' })
  const a = r?.aiLogLeft
  const typed = a && typeof a.ref === 'string' && typeof a.words === 'string' && a.words !== '' ? { ref: a.ref, words: a.words } : undefined
  const { aiLogLeft: _untyped, ...rest } = r ?? {}
  const reply: DeleteReply = { ...rest, ...(typed ? { aiLogLeft: typed } : {}) }
  keep(typed)
  useDeleteReply.setState({ reply })
  forgetThisPerson()
  return reply
}
