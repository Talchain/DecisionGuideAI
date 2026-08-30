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

/** `details.auth_reason` — the JWT arm's own account of WHY it refused. */
function authReason(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null
  const details = (body as Record<string, unknown>).details
  if (details === null || typeof details !== 'object') return null
  const reason = (details as Record<string, unknown>).auth_reason
  return typeof reason === 'string' ? reason : null
}

/**
 * WHICH sign-in refusal this is — because "sign in again" and "this is ours to
 * fix" are different answers and the wire already tells them apart.
 *
 * ⚠ WHY A BOOLEAN IS NOT ENOUGH, AND WHY THE CLIENT'S OWN SESSION CANNOT STAND
 *   IN FOR IT. A consumer that collapses these producers and then re-splits on
 *   its own `userId` gets the JWT arm wrong on EVERY occurrence: that arm is
 *   reachable only when a token was PRESENTED (CEE answers `service_legacy`,
 *   not `refused`, when no JWT candidate is on the request —
 *   `user-identity.ts:107-118`), and this UI only sends `Authorization` when it
 *   holds a live session (`turnAuthHeaders.ts:19-21` over `getSessionIdentity`,
 *   `supabase.ts:98-105`). So `userId !== null` is not evidence of anything on
 *   that arm — it is a tautology — and "you are signed in, so this is Olumi's
 *   fault" fires 100% of the time while denying the user the one remedy the
 *   producer names.
 *
 * THE THREE ARMS, derived at CEE staging `f18d941b`:
 *
 *   · `sessionLapsed` — `validator: 'user_jwt'` with `auth_reason` ∈
 *     {missing_token, invalid_token, expired_token}. `buildSignInRequiredError`
 *     (`user-identity.ts:158-176`) sets `retryable: false` at the top level and
 *     `details.recoverable: true` inside, and its header states the resolution
 *     of that apparent contradiction: *"retrying the same request unchanged
 *     cannot succeed; recovery is signing in."* Both facts are true at once —
 *     they answer different questions.
 *
 *   · `signInUnverifiable` — the same arm with `auth_reason:
 *     'verification_unavailable'`. CEE logs it as operator misconfiguration
 *     (*"CEE_REQUIRE_USER_JWT is on but the Supabase JWKS is not usable …
 *     refusing turn"*, `:122-131`). A fresh token fails to verify exactly as
 *     the old one did, so "sign in again" here is an instruction that loops.
 *     It is split from `sessionLapsed` for that reason alone.
 *
 *   · `scenarioUnowned` — the UPPER `SIGN_IN_REQUIRED`, no validator
 *     (`assist.v1.scenario-versions.ts:462-473`), raised from SQLSTATE MV001
 *     whose condition is `scenarios.user_id IS NULL`
 *     (`20260824200000_c8_atomic_model_version_restore.sql:305-308`) — a
 *     property of the SCENARIO, not of the caller. A fully signed-in user hits
 *     it on an unowned scenario.
 *
 * ⚠ THE DOMAIN IS IDENTICAL TO `isSignInRequired`'s, deliberately. Same two
 *   disjuncts, same order, same case-insensitivity. This function decides WHICH
 *   refusal, never WHETHER — widening it here would silently widen the older,
 *   more widely-called predicate below (`scenarioGraph.ts` also reads it), and
 *   two functions answering one question is how they start to disagree. A spec
 *   asserts the two agree on every body.
 */
export type SignInRefusalCause = 'sessionLapsed' | 'signInUnverifiable' | 'scenarioUnowned'

export function classifySignInRefusal(
  httpStatus: number,
  body: unknown,
): SignInRefusalCause | null {
  if (httpStatus !== 401) return null
  if (validator(body) === 'user_jwt') {
    return authReason(body) === 'verification_unavailable'
      ? 'signInUnverifiable'
      : 'sessionLapsed'
  }
  return detailsCode(body)?.toLowerCase() === 'sign_in_required' ? 'scenarioUnowned' : null
}

/**
 * Whether this response is CEE telling the caller to sign in.
 *
 * Gated on 401 as well as the body: a `sign_in_required` code arriving on some
 * other status is not this refusal, and treating it as one would route a user
 * to a sign-in prompt that cannot fix their problem.
 *
 * DERIVED from the classifier rather than restating its rule, so the two can
 * never drift apart.
 */
export function isSignInRequired(httpStatus: number, body: unknown): boolean {
  return classifySignInRefusal(httpStatus, body) !== null
}
