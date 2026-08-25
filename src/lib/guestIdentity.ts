/**
 * The guest sentinel, and the one rule for turning a caller identity into
 * something safe to send as a user id.
 *
 * ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────
 * `'guest'` was defined FOUR times independently (three CEE adapters and the
 * versions panel) and the "is this a real user id" predicate existed in THREE
 * forms — while the value itself is MINTED in a fifth place, `AuthContext`.
 * Five hand-maintained copies of one identity rule, and the rule is now
 * load-bearing for authorization: it decides what goes in the request body AND
 * what goes in the `Authorization`/`X-User-Id` headers. A copy that drifts
 * would put a sentinel where CEE expects a UUID, or send an identity for
 * someone who has none.
 *
 * Derived from one place, so the copies cannot disagree. The mint imports it
 * too — otherwise the constant here would just be a sixth copy that happens to
 * match today.
 */

/**
 * The sentinel `AuthContext` mints for a visitor with no Supabase session.
 * It is NOT a Supabase user id and must never be sent to CEE as one, through
 * the body or through a header — CEE's `scenarios.user_id` is a `uuid` column
 * and its ownership pre-flight compares against it.
 */
export const GUEST_USER_ID = 'guest'

/**
 * The caller's id if it is a real one, else `null`.
 *
 * ONE predicate, feeding BOTH the request body and the auth headers at every
 * call site. Two copies of "is this a real user id" is how a body and a header
 * start disagreeing about who the caller is — and after the ownership fix, a
 * disagreement is an authorization question rather than a cosmetic one.
 */
export function sanitiseUserId(userId: string | null | undefined): string | null {
  return typeof userId === 'string' && userId.length > 0 && userId !== GUEST_USER_ID
    ? userId
    : null
}
