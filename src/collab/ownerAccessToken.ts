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
 * `collabService` is imported by the PUBLIC participant page, which holds no
 * Supabase session by construction. Putting this accessor there would drag the
 * auth client into every participant's bundle through a shared import — a
 * transitive route past the guard that `collabParticipantRouteIsPublic.spec.tsx`
 * checks at the page. It lives here so that import edge never exists.
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
