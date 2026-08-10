/**
 * COLLAB — the OWNER's bearer, from the one canonical session seam.
 *
 * ── WHY THIS MODULE EXISTS RATHER THAN A CONTEXT READ ─────────────────────
 * `PanelSetupPage` used to take its token from `useAuth()`:
 *
 *     const { session } = useAuth() as { session?: { access_token?: string } | null }
 *     const accessToken = session?.access_token ?? ''
 *
 * `AuthContext` has no `session` member — it receives the session and keeps
 * only `session.user` — so this was ALWAYS `''`. The `as` is why the compiler
 * said nothing: a cast asserts a shape onto a value that does not have it, and
 * `?? ''` then turned "absent" into a perfectly well-typed empty string.
 *
 * `getSessionIdentity()` is the repo's declared single-`getSession()`-per-turn
 * identity read, and it is FULLY TYPED — `{ userId: string | null; accessToken:
 * string | null }`. Reading it needs no cast, and a rename would be a compile
 * error rather than a silent empty header.
 *
 * ── WHY IT IS NOT IN collabService.ts ─────────────────────────────────────
 * SEPARATION OF CONCERNS, not bundle weight. `collabService` describes the wire
 * — URLs, headers, error shapes — and knows nothing about where a credential
 * comes from; this module knows about the session and nothing about the wire.
 * Keeping them apart is what lets the participant half of that file be read,
 * and tested, without a session anywhere in view.
 *
 * ⚠ AN EARLIER VERSION OF THIS COMMENT CLAIMED A BUNDLE HARM, AND IT WAS FALSE.
 * It said putting the accessor in `collabService` would "drag the auth client
 * into every participant's bundle". The auth client is ALREADY in the eagerly
 * loaded app-shell chunk: `AppPoC.tsx` statically imports `AuthProvider`, and
 * `contexts/AuthContext.tsx` statically imports `{ supabase, getProfile }` from
 * `../lib/supabase`. An adversarial review proved it in a real production
 * build — the `AppPoC-*.js` chunk contains `GoTrueClient` AND declares
 * `path="/panel/:round_id"`, with a positive control showing zero occurrences
 * of that marker in the `ParticipantPacketPage` chunk. The split is good
 * hygiene; it was never load-bearing for bundle content, and a comment that
 * invents a harm is the same defect class as a test name that overreaches.
 *
 * ── NO THIRD OUTCOME ──────────────────────────────────────────────────────
 * A non-empty string, or a throw. Deliberately no `''` fallback: at CEE an
 * empty bearer is indistinguishable from an absent one, so a "harmless" default
 * would restore exactly the defect this replaces, three hops from where a
 * reader could see it.
 */

import { getSessionIdentity } from '../lib/supabase'
import { ownerSignInRequired } from './collabService'

export async function requireOwnerAccessToken(): Promise<string> {
  const { accessToken } = await getSessionIdentity()
  if (accessToken === null || accessToken.trim() === '') throw ownerSignInRequired()
  return accessToken
}
