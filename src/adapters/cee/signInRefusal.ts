/**
 * "You need to sign in again" — recognised from EITHER producer, one rule.
 *
 * ── WHY THIS EXISTS: TWO REFUSALS, DIFFERENT CASING, ONE CONSUMER ──────────
 * CEE emits two structurally different 401s that mean the same thing to a user:
 *
 *   · guest-on-versions  `details.code: "SIGN_IN_REQUIRED"`   (UPPER)
 *   · JWT refusal        `details.code: "sign_in_required"`   (lower)
 *                        + `validator: "user_jwt"`
 *
 * The UI matched the UPPER form case-sensitively, so the JWT refusal fell
 * through to a generic refusal and the user was told *"…could not be saved
 * right now. Try again."* — while CEE sets `retryable: false`, so retrying
 * cannot work. On the graph read the same 401 became a silent hydration
 * failure with no sign-in prompt at all.
 *
 * ⚠ THE JWT REFUSAL WAS UNREACHABLE UNTIL THE UI STARTED SENDING A TOKEN.
 *   `resolveUserIdentity` only reaches `refused` when a token is PRESENTED and
 *   fails to verify. So this bug is created by the change that sends tokens,
 *   which is why it is fixed in the same PR rather than rowed.
 *
 * ── THE PREDICATE DELIBERATELY HAS TWO DISJUNCTS ───────────────────────────
 * `validator === 'user_jwt'` is the ROBUST signal: it is a producer identity
 * and does not depend on the casing of a string constant maintained in two
 * services. The case-insensitive `code` match is the compatible one, and it
 * covers the guest form plus any future producer that keeps the code but not
 * the validator. Either alone would be a narrower guard than the domain.
 */

/** The `details.code`, if the body carries one. */
function detailsCode(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null
  const details = (body as Record<string, unknown>).details
  if (details === null || typeof details !== 'object') return null
  const code = (details as Record<string, unknown>).code
  return typeof code === 'string' ? code : null
}

/** The top-level `validator`, if the body is a BoundaryError. */
function validator(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null
  const v = (body as Record<string, unknown>).validator
  return typeof v === 'string' ? v : null
}

/**
 * Whether this response is CEE telling the caller to sign in.
 *
 * Gated on 401 as well as the body: a `sign_in_required` code arriving on some
 * other status is not this refusal, and treating it as one would route a user
 * to a sign-in prompt that cannot fix their problem.
 */
export function isSignInRequired(httpStatus: number, body: unknown): boolean {
  if (httpStatus !== 401) return false
  if (validator(body) === 'user_jwt') return true
  return detailsCode(body)?.toLowerCase() === 'sign_in_required'
}
