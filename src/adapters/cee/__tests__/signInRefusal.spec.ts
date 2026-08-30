/**
 * Both of CEE's sign-in refusals are recognised — the casing split, closed.
 *
 * ── THE DEFECT THIS PR CREATED, AND THIS FIXES ─────────────────────────────
 * CEE emits two structurally different 401s meaning the same thing:
 *
 *   guest-on-versions  `details.code: "SIGN_IN_REQUIRED"`   (UPPER)
 *   JWT refusal        `details.code: "sign_in_required"`   (lower)
 *                      + `validator: "user_jwt"`
 *
 * The UI matched the UPPER form case-sensitively. So the JWT refusal fell
 * through to a generic refusal and the user was told *"…could not be saved
 * right now. Try again."* on a response CEE marks `retryable: false` — advice
 * that cannot work. On the graph read it became a silent hydration failure
 * with no prompt at all.
 *
 * ⚠ THE JWT REFUSAL WAS UNREACHABLE BEFORE THIS PR. `resolveUserIdentity` only
 *   reaches `refused` when a token is PRESENTED and fails to verify, and the
 *   UI presented none. Sending tokens is what makes an expired one reachable,
 *   which is why this is fixed in the same change rather than rowed.
 *
 * ── THE JWT BODY BELOW IS WIRE-WITNESSED, NOT INVENTED ─────────────────────
 * Captured from deployed staging by posting a JWT-shaped but invalid Bearer
 * to `/bff/cee/scenarios/<uuid>/graph`. A self-authored fixture would encode
 * this author's model of the producer rather than the producer (CLAUDE.md
 * trap 16), and the casing is the entire point.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { isSignInRequired, classifySignInRefusal } from '../signInRefusal'
import { fetchScenarioGraph } from '../scenarioGraph'
import { saveModelVersion, listModelVersions } from '../modelVersions'

const SCENARIO = '11111111-2222-4333-8444-555555555555'

/** VERBATIM from the wire — deployed staging, invalid Bearer, 401. */
const JWT_REFUSAL = {
  error: 'INGRESS_CONTRACT_VIOLATION',
  boundary: 'B1',
  direction: 'ingress',
  validator: 'user_jwt',
  details: {
    reason: 'sign_in_required',
    code: 'sign_in_required',
    recoverable: true,
    auth_reason: 'invalid_token',
  },
  request_id: '17cfcd04-f272-43cc-8c6c-89befe2622fd',
  retryable: false,
}

/** The guest form, upper-cased, from `assist.v1.scenario-versions.ts`. */
const GUEST_REFUSAL = {
  schema: 'error.v1',
  code: 'UNAUTHENTICATED',
  details: { code: 'SIGN_IN_REQUIRED' },
}

describe('isSignInRequired — recognises both producers', () => {
  it('recognises the JWT refusal (lower-case code + user_jwt validator)', () => {
    expect(isSignInRequired(401, JWT_REFUSAL)).toBe(true)
  })

  it('recognises the guest refusal (UPPER-case code, no validator)', () => {
    expect(isSignInRequired(401, GUEST_REFUSAL)).toBe(true)
  })

  it('is NOT true of every 401 — the discriminator', () => {
    // Without this the predicate could be `status === 401` and both cases
    // above would still pass, which would route every 403-adjacent refusal to
    // a sign-in prompt that cannot fix it.
    expect(isSignInRequired(401, { schema: 'error.v1', code: 'UNAUTHENTICATED' })).toBe(false)
    expect(isSignInRequired(401, { details: { code: 'RATE_LIMITED' } })).toBe(false)
  })

  it('is gated on 401 — the same body on another status is not this refusal', () => {
    expect(isSignInRequired(403, JWT_REFUSAL)).toBe(false)
    expect(isSignInRequired(200, GUEST_REFUSAL)).toBe(false)
  })

  it('survives bodies that carry no shape at all', () => {
    for (const body of [null, undefined, 'not json', 42, []]) {
      expect(isSignInRequired(401, body)).toBe(false)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE CAUSE — because "sign in again" and "this is ours" are DIFFERENT ANSWERS
// and the wire already distinguishes them.
//
// A consumer that collapses these two producers to one boolean and then
// re-splits on its OWN session object gets the JWT arm wrong 100% of the time:
// that arm is reachable ONLY when a token was presented (CEE returns
// `service_legacy`, not `refused`, with no JWT candidate — `user-identity.ts`
// :107-118), and the UI only sends `Authorization` when it holds a live session
// (`turnAuthHeaders.ts:19-21` over `getSessionIdentity`, `supabase.ts:98-105`).
// So "you are signed in, therefore this is Olumi's fault" is false exactly
// where it fires, and it withholds the one remedy the producer names.
//
// PRODUCER BYTES (CEE staging f18d941b), not this lane's model of them:
//   · `user-identity.ts:158-176` buildSignInRequiredError — validator
//     'user_jwt', details.code 'sign_in_required' (lower), recoverable: true,
//     auth_reason ∈ missing_token|invalid_token|expired_token|
//     verification_unavailable, retryable: false. Its own header: "recovery is
//     signing in", and auth_reason exists to "let the UI distinguish 'session
//     expired — refresh/re-login' from 'never signed in'".
//   · `assist.v1.scenario-versions.ts:462-473` — UPPER 'SIGN_IN_REQUIRED', no
//     validator, raised from SQLSTATE MV001, whose condition is
//     `scenarios.user_id IS NULL`
//     (20260824200000_c8_atomic_model_version_restore.sql:305-308) — a property
//     of the SCENARIO, not of the caller.
// ─────────────────────────────────────────────────────────────────────────────

describe('classifySignInRefusal — the wire already says which refusal this is', () => {
  it('a user_jwt refusal is the SESSION arm — the user can fix it by signing in', () => {
    expect(classifySignInRefusal(401, JWT_REFUSAL)).toBe('sessionLapsed')
  })

  it('OPPOSITE DIRECTION — the guest/MV001 refusal is NOT the session arm', () => {
    // The twin of the case above. One assertion alone cannot show the two arms
    // are told apart: a classifier that answered 'sessionLapsed' for every
    // sign-in refusal would satisfy the first test and this one catches it.
    expect(classifySignInRefusal(401, GUEST_REFUSAL)).toBe('scenarioUnowned')
  })

  it('an unverifiable sign-in is its own arm — signing in again cannot help', () => {
    // CEE logs this one as operator misconfiguration ("CEE_REQUIRE_USER_JWT is
    // on but the Supabase JWKS is not usable … refusing turn",
    // user-identity.ts:122-131). A new token fails to verify exactly as the old
    // one did, so routing it to "sign in again" is an instruction that loops.
    expect(
      classifySignInRefusal(401, {
        ...JWT_REFUSAL,
        details: { ...JWT_REFUSAL.details, auth_reason: 'verification_unavailable' },
      }),
    ).toBe('signInUnverifiable')
  })

  it('every OTHER auth_reason on the user_jwt arm stays the session arm', () => {
    // Written against the producer's DECLARED union, not against the one
    // reason that happens to be in the captured fixture.
    for (const auth_reason of ['missing_token', 'invalid_token', 'expired_token']) {
      expect(
        classifySignInRefusal(401, {
          ...JWT_REFUSAL,
          details: { ...JWT_REFUSAL.details, auth_reason },
        }),
      ).toBe('sessionLapsed')
    }
  })

  it('agrees with isSignInRequired on EVERY body — one predicate, two readings', () => {
    // The domain must not move. `isSignInRequired` is the older, wider-used
    // reader (scenarioGraph.ts also calls it); if classification ever admitted
    // or refused a body the boolean did not, that is trap 21 — two functions
    // answering one question and disagreeing.
    const bodies: unknown[] = [
      JWT_REFUSAL,
      GUEST_REFUSAL,
      { ...JWT_REFUSAL, details: { ...JWT_REFUSAL.details, auth_reason: 'expired_token' } },
      { schema: 'error.v1', code: 'UNAUTHENTICATED' },
      { details: { code: 'RATE_LIMITED' } },
      { details: { code: 'Sign_In_Required' } },
      null,
      undefined,
      'not json',
      42,
      [],
    ]
    for (const status of [200, 401, 403]) {
      for (const body of bodies) {
        expect(classifySignInRefusal(status, body) !== null).toBe(isSignInRequired(status, body))
      }
    }
  })

  it('is gated on 401, exactly as the boolean is', () => {
    expect(classifySignInRefusal(403, JWT_REFUSAL)).toBeNull()
    expect(classifySignInRefusal(200, GUEST_REFUSAL)).toBeNull()
  })
})

let fetchSpy: ReturnType<typeof vi.fn>

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response
}

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the adapters route the JWT refusal to signInRequired, not to "try again"', () => {
  it('fetchScenarioGraph: the wire-witnessed 401 becomes signInRequired', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, JWT_REFUSAL))

    const result = await fetchScenarioGraph(SCENARIO, { retryDelayMs: 0 })

    // Before this fix: { status: 'refused' } → hydration 'refused' → a canvas
    // that silently failed to hydrate with no prompt.
    expect(result).toEqual({ status: 'signInRequired' })
  })

  it('saveModelVersion: the wire-witnessed 401 becomes signInRequired', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, JWT_REFUSAL))

    const result = await saveModelVersion(SCENARIO, {})

    // Before this fix: { status: 'refused' } → "…could not be saved right now.
    // Try again." on a response CEE marks retryable: false.
    //
    // The CAUSE is asserted too, not merely tolerated. This fixture's
    // `auth_reason` is `invalid_token`, so the honest arm is the one the user
    // can act on — and a strict shape here is what stops the field being
    // quietly dropped again later.
    expect(result).toEqual({ status: 'signInRequired', cause: 'sessionLapsed' })
  })

  it('listModelVersions: gains the branch it never had', async () => {
    // LIST had NO sign-in handling at all — a guest list was an empty list, so
    // the only 401 reachable was one the UI could not produce.
    fetchSpy.mockResolvedValue(jsonResponse(401, JWT_REFUSAL))

    const result = await listModelVersions(SCENARIO, {})

    expect(result).toEqual({ status: 'signInRequired', cause: 'sessionLapsed' })
  })

  it('OPPOSITE-DIRECTION TWIN — a 403 is still a plain refusal', async () => {
    // Proves signInRequired is not swallowing every refusal. Without this, a
    // predicate of `status >= 401` would pass all three tests above.
    fetchSpy.mockResolvedValue(jsonResponse(403, { schema: 'error.v1', code: 'FORBIDDEN' }))

    const result = await fetchScenarioGraph(SCENARIO, { retryDelayMs: 0 })

    expect(result).toEqual({ status: 'refused', httpStatus: 403 })
  })
})
