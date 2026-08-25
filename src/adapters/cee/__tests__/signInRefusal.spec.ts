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

import { isSignInRequired } from '../signInRefusal'
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
    expect(result).toEqual({ status: 'signInRequired' })
  })

  it('listModelVersions: gains the branch it never had', async () => {
    // LIST had NO sign-in handling at all — a guest list was an empty list, so
    // the only 401 reachable was one the UI could not produce.
    fetchSpy.mockResolvedValue(jsonResponse(401, JWT_REFUSAL))

    const result = await listModelVersions(SCENARIO, {})

    expect(result).toEqual({ status: 'signInRequired' })
  })

  it('OPPOSITE-DIRECTION TWIN — a 403 is still a plain refusal', async () => {
    // Proves signInRequired is not swallowing every refusal. Without this, a
    // predicate of `status >= 401` would pass all three tests above.
    fetchSpy.mockResolvedValue(jsonResponse(403, { schema: 'error.v1', code: 'FORBIDDEN' }))

    const result = await fetchScenarioGraph(SCENARIO, { retryDelayMs: 0 })

    expect(result).toEqual({ status: 'refused', httpStatus: 403 })
  })
})
