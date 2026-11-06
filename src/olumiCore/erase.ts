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

/** Deletes the person's data; throws (a TeamApiError, in core's or the page's words) when it did not go through. */
export async function deleteMyData(): Promise<void> {
  await call<{ deleted?: unknown }>('POST', '/api/me/delete', { confirm: 'delete my data' })
  forgetThisPerson()
}
