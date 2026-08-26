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
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchScenarioGraph } from '../scenarioGraph'
import { registerScenarioGraph } from '../registerScenarioGraph'
import { listModelVersions, saveModelVersion, restoreModelVersion } from '../modelVersions'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const USER_ID = '99999999-8888-4777-8666-555555555555'

/** A JWT-shaped token. Distinctive so an assertion cannot match by accident. */
const ACCESS_TOKEN = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJzMy1zcGVjIn0.c2lnbmF0dXJl'
/** A token from a DIFFERENT session — distinct bytes, so a mix-up is visible. */
const OTHER_TOKEN = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJvdGhlci1zZXNzIn0.b3RoZXJzaWc'

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
  /** The exported adapter function this row exercises — the derived guard's key. */
  readonly fn: string
  readonly ok: unknown
  readonly call: (opts: { userId: string | null; accessToken: string | null }) => Promise<unknown>
}> = [
  {
    name: 'fetchScenarioGraph (read)',
    fn: 'fetchScenarioGraph',
    ok: { schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph: { nodes: [], edges: [] } },
    call: (o) => fetchScenarioGraph(SCENARIO_ID, { ...o, retryDelayMs: 0 }),
  },
  {
    name: 'registerScenarioGraph (write)',
    fn: 'registerScenarioGraph',
    ok: { schema: 'scenario_graph_registration.v1', registered: true, node_count: 0, edge_count: 0 },
    call: (o) => registerScenarioGraph(SCENARIO_ID, { nodes: [], edges: [] }, { ...o, retryDelayMs: 0 }),
  },
  {
    name: 'listModelVersions (read)',
    fn: 'listModelVersions',
    ok: { schema: 'model_versions_list.v1', versions: [] },
    call: (o) => listModelVersions(SCENARIO_ID, o),
  },
  {
    name: 'saveModelVersion (write)',
    fn: 'saveModelVersion',
    ok: { schema: 'model_version_save.v1', version: {} },
    call: (o) => saveModelVersion(SCENARIO_ID, o),
  },
  {
    name: 'restoreModelVersion (write)',
    fn: 'restoreModelVersion',
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

/**
 * ── THE TWO CLASSES THE SIGNED-IN / GUEST PAIR CANNOT SEE ──────────────────
 *
 * The pair above varies both fields together: (id + token) or (null + null).
 * That is structurally blind to every input where the two DISAGREE — and
 * disagreement is exactly what the call sites were fixed to prevent, so the
 * corpus has to be able to observe it or the fix is unguarded at rest.
 *
 * Neither class is a defect in the adapter. The adapter is a transport and
 * cannot know which session a value came from. They are pinned so the wire is
 * documented, and so a future change to either channel has to face them.
 */
describe('identity classes the signed-in/guest pair is blind to', () => {
  for (const route of ROUTES) {
    it(`${route.name}: a real id with NO token sends the body id and no header`, async () => {
      fetchSpy.mockResolvedValue(jsonResponse(200, route.ok))

      // The pre-#851 world, and the world any signed-in user is in whenever
      // the token read fails or the session has gone. CEE resolves this as
      // `service_legacy`, where the body id is the only identity — which is
      // precisely the channel the CEE-side strip will close.
      await route.call({ userId: USER_ID, accessToken: null })

      expect(sentBody().user_id).toBe(USER_ID)
      expect(sentHeaders().Authorization).toBeUndefined()
    })

    it(`${route.name}: a real id with ANOTHER session's token sends both verbatim`, async () => {
      fetchSpy.mockResolvedValue(jsonResponse(200, route.ok))

      await route.call({ userId: USER_ID, accessToken: OTHER_TOKEN })

      // Both go out as given. The adapter does not and cannot arbitrate; the
      // guarantee that these two never disagree lives at the CALL SITE, which
      // is why every call site reads both fields from one session object.
      // CEE is the arbiter: with the flag on, the verified `sub` wins and the
      // body id is ignored, so a mismatch is telemetry and not a privilege.
      expect(sentBody().user_id).toBe(USER_ID)
      expect(sentHeaders().Authorization).toBe(`Bearer ${OTHER_TOKEN}`)
    })
  }
})

/**
 * ── THE ROUTE TABLE ABOVE IS HAND-MAINTAINED, AND THAT IS THE DEFECT ───────
 *
 * A sixth scenario-route adapter added later would get NO coverage here, and
 * nothing would go red — the table would simply be short, and a short list
 * reads exactly like a complete one. This estate's dominant defect.
 *
 * Review found this shape live: `useProvisionalAnalysisDelivery.ts` was a
 * SIXTH `fetchScenarioGraph` call site with no token, invisible to the grep
 * that found the other five because it passes the adapter by reference
 * (`read: fetchScenarioGraph`) rather than calling it by name.
 *
 * So the completeness check is DERIVED FROM SOURCE rather than written down.
 * The rule: in these three adapter modules, an exported `async function` is a
 * request-issuing route (each module has exactly one `await fetch(` and the
 * only other exports are synchronous `*Url` builders). Every one of them must
 * appear in ROUTES.
 *
 * ⚠ Derivation proves AGREEMENT, never completeness (CLAUDE.md trap 12d): this
 *   guard catches a route the table forgot, and CANNOT catch a request issued
 *   from somewhere other than these three modules. That is what the
 *   `accessToken`-manifest check in review is for. Both are needed; neither
 *   supersedes the other.
 */
describe('the route table cannot silently go short', () => {
  const ADAPTERS = ['scenarioGraph.ts', 'registerScenarioGraph.ts', 'modelVersions.ts']

  function exportedAsyncFunctions(): string[] {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const names: string[] = []
    for (const file of ADAPTERS) {
      const src = readFileSync(path.join(dir, '..', file), 'utf8')
      for (const m of src.matchAll(/^export async function (\w+)/gm)) names.push(m[1])
    }
    return names
  }

  it('POSITIVE CONTROL — the deriver can actually see functions', () => {
    // Without this, an extractor that silently returned [] would make the
    // assertion below pass by testing nothing (CLAUDE.md trap 13).
    const found = exportedAsyncFunctions()
    expect(found.length).toBeGreaterThanOrEqual(5)
    expect(found).toContain('fetchScenarioGraph')
  })

  it('every request-issuing adapter export is covered by ROUTES', () => {
    const covered = new Set(ROUTES.map((r) => r.fn))
    const missing = exportedAsyncFunctions().filter((n) => !covered.has(n))
    // Named, not counted: the failure message must say WHICH route is uncovered.
    expect(missing).toEqual([])
  })
})
