/**
 * The scenario routes carry a VERIFIED TOKEN — UI half of the ownership fix.
 *
 * ── WHY THIS SPEC EXISTS ────────────────────────────────────────────────────
 * `CEE_REQUIRE_USER_JWT` is ON in deployed staging (measured at the boot log:
 * `require_user_jwt: true`; and on the wire: a JWT-shaped invalid Bearer
 * answers 401 `validator: "user_jwt"`, a branch only reachable with the flag
 * on). These three adapters nevertheless sent NO `Authorization` header, so
 * every signed-in caller resolved `service_legacy` at CEE and the body
 * `user_id` was their ONLY identity — a field an unauthenticated caller can
 * forge, demonstrated end-to-end against deployed staging.
 *
 * CEE cannot strip that field until the token arrives, or it would refuse
 * signed-in users on their own scenarios. This spec pins the half that makes
 * the strip safe to land, and pins the guest posture that must not move.
 *
 * ── WHAT EACH ASSERTION BINDS TO ────────────────────────────────────────────
 * Every assertion binds by IDENTITY — the exact header name and the exact
 * token value — never by "some header was sent". A value predicate another
 * header could satisfy would pass on the wrong object.
 *
 * The pairs are deliberate: for every "sent when signed in" there is a
 * "NOT sent for a guest" twin. One direction alone cannot tell a working
 * header from a header that is always on, and always-on here would mean
 * sending `X-User-Id: guest` — the sentinel that is not a Supabase id.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { fetchScenarioGraph } from '../scenarioGraph'
import { registerScenarioGraph } from '../registerScenarioGraph'
import { listModelVersions, saveModelVersion, restoreModelVersion } from '../modelVersions'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const USER_ID = '99999999-8888-4777-8666-555555555555'

/** A JWT-shaped token. Distinctive so an assertion cannot match by accident. */
const ACCESS_TOKEN = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJzMy1zcGVjIn0.c2lnbmF0dXJl'

let fetchSpy: ReturnType<typeof vi.fn>

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response
}

/** The headers the adapter actually passed to `fetch`, for the one call made. */
function sentHeaders(): Record<string, string> {
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  const init = fetchSpy.mock.calls[0][1] as RequestInit
  return (init.headers ?? {}) as Record<string, string>
}

function sentBody(): Record<string, unknown> {
  const init = fetchSpy.mock.calls[0][1] as RequestInit
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * One table, five routes. Each entry drives its adapter with a signed-in
 * identity and then with a guest identity, so the pair is applied uniformly
 * and a route added later without a token is visible as a missing row.
 */
const ROUTES: ReadonlyArray<{
  readonly name: string
  readonly ok: unknown
  readonly call: (opts: { userId: string | null; accessToken: string | null }) => Promise<unknown>
}> = [
  {
    name: 'fetchScenarioGraph (read)',
    ok: { schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph: { nodes: [], edges: [] } },
    call: (o) => fetchScenarioGraph(SCENARIO_ID, { ...o, retryDelayMs: 0 }),
  },
  {
    name: 'registerScenarioGraph (write)',
    ok: { schema: 'scenario_graph_registration.v1', registered: true, node_count: 0, edge_count: 0 },
    call: (o) => registerScenarioGraph(SCENARIO_ID, { nodes: [], edges: [] }, { ...o, retryDelayMs: 0 }),
  },
  {
    name: 'listModelVersions (read)',
    ok: { schema: 'model_versions_list.v1', versions: [] },
    call: (o) => listModelVersions(SCENARIO_ID, o),
  },
  {
    name: 'saveModelVersion (write)',
    ok: { schema: 'model_version_save.v1', version: {} },
    call: (o) => saveModelVersion(SCENARIO_ID, o),
  },
  {
    name: 'restoreModelVersion (write)',
    ok: { schema: 'model_version_restore.v1' },
    call: (o) => restoreModelVersion(SCENARIO_ID, { ...o, versionId: 'v1' }),
  },
]

describe('scenario routes — a signed-in caller presents a verifiable token', () => {
  for (const route of ROUTES) {
    it(`${route.name} sends Authorization: Bearer <access token>`, async () => {
      fetchSpy.mockResolvedValue(jsonResponse(200, route.ok))

      await route.call({ userId: USER_ID, accessToken: ACCESS_TOKEN })

      // Bound by identity: the exact header, carrying the exact token.
      expect(sentHeaders().Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
    })

    it(`${route.name} still sends body user_id (CEE has not stripped it yet)`, async () => {
      fetchSpy.mockResolvedValue(jsonResponse(200, route.ok))

      await route.call({ userId: USER_ID, accessToken: ACCESS_TOKEN })

      // ⚠ THIS ASSERTION IS A DEPLOY-ORDER FENCE, NOT A PREFERENCE. CEE
      // resolves `service_legacy` for any caller it cannot verify, and in that
      // mode the body field is the only identity. Deleting it here before
      // CEE's strip is deployed would take ownership away from every signed-in
      // user. It comes out in the SAME change that lands the strip, not before.
      expect(sentBody().user_id).toBe(USER_ID)
    })
  }
})

describe('scenario routes — a guest is byte-identical to before this change', () => {
  for (const route of ROUTES) {
    it(`${route.name} sends NO auth headers for a guest`, async () => {
      fetchSpy.mockResolvedValue(jsonResponse(200, route.ok))

      await route.call({ userId: null, accessToken: null })

      const headers = sentHeaders()
      expect(headers.Authorization).toBeUndefined()
      expect(headers['X-User-Id']).toBeUndefined()
      // The only header a guest request carries is the content type.
      expect(Object.keys(headers)).toEqual(['Content-Type'])
    })

    it(`${route.name} never sends the 'guest' sentinel as an identity`, async () => {
      fetchSpy.mockResolvedValue(jsonResponse(200, route.ok))

      // The sentinel `AuthContext` mints. It is not a Supabase id and must not
      // reach CEE through EITHER channel — body or header.
      await route.call({ userId: 'guest', accessToken: null })

      expect(sentBody().user_id).toBeUndefined()
      expect(sentHeaders()['X-User-Id']).toBeUndefined()
    })
  }
})
