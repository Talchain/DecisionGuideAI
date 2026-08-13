/**
 * CEEClient — ⚠ PREMISE INVERTED. The source-level pin now asserts the bearer path
 * is GONE, where it used to assert the path was LIVE.
 *
 * THE DEFECT THIS PINS
 * --------------------
 * `fetchWithBase` used to merge `plotAuthHeaders()` onto PLoT-direct (absolute)
 * bases. That header's value was `import.meta.env.VITE_PLOT_BEARER`, and Vite
 * replaces `import.meta.env.VITE_X` with the LITERAL at build time — so a live,
 * shared server-to-server credential was emitted verbatim into a PUBLIC bundle
 * chunk that any visitor could fetch. The variable NAME was compiled away, which is
 * why every name-based scan reported a confident all-clear while the value itself
 * sat there in plain text.
 *
 * The credential is gone from the client entirely. `plotAuthHeaders` is deleted, the
 * merge is deleted, and `CEE_DRAFT_ENGINE_BASE` is wrapped in
 * `toSameOriginPlotBase` so the one absolute escape hatch (`VITE_CEE_DRAFT_BASE`,
 * measured SET to PLoT's origin on staging) lands back on the `/bff/engine/*` path
 * where the edge function injects the bearer server-side. `isPlotDirectBase` is
 * retained only as the leak-pin predicate.
 *
 * ⚠ WHY THE BEHAVIOURAL PINS STUB THE BEARER PRESENT. "No Authorization header when
 * `VITE_PLOT_BEARER` is unset" is a VACUOUS test: the removed code was deliberately
 * fail-safe and attached nothing when the variable was empty, so such a test was
 * green for the whole life of the defect. The only assertion with content is that
 * the header is absent EVEN WITH a provisioned-looking bearer in the environment.
 *
 * ⚠⚠ A MEASURED INSTRUMENT LIMIT, STATED SO THE NEXT READER DOES NOT WRITE A
 * VACUOUS TEST BY ACCIDENT. `VITE_CEE_DRAFT_BASE` CANNOT be stubbed in-process.
 * `client.ts` reads it as `(import.meta as any).env?.VITE_CEE_DRAFT_BASE`, and that
 * cast STRIPS Vite's env proxy — the whole module's `import.meta.env` becomes a
 * build-time snapshot taken from the real shell environment at config load. Proven
 * here, in this repo, with a distinct-path probe: `vi.stubEnv`, direct
 * `import.meta.env` mutation, and a `process.env` write followed by
 * `vi.resetModules()` + dynamic import ALL failed to move the base (the module
 * genuinely re-evaluated — the re-imported class had a fresh identity), while
 * exporting the variable in the SHELL moved it immediately and correctly
 * (`…onrender.com/v9/probe` → `/bff/engine/v9/probe/draft-graph?schema=v3`).
 *
 * The trap that follows is subtle and is the reason for this paragraph: the URL a
 * stubbed test WOULD assert, `/bff/engine/v1/cee/draft-graph?schema=v3`, is
 * BYTE-IDENTICAL to the URL the un-stubbed fallback produces. So a test written as
 * "stub the absolute base, assert the same-origin URL" passes whether or not the
 * stub was ever seen, and whether or not `toSameOriginPlotBase` is even called —
 * a guard agreeing with itself. The guarantee is therefore pinned in three
 * separable, individually falsifiable pieces instead:
 *   · the MAPPING — `toSameOriginPlotBase` on the deployed staging value, asserted
 *     by exact result (the full case battery lives in plotSameOrigin.spec.ts);
 *   · the WIRING — a source pin that `CEE_DRAFT_ENGINE_BASE` is wrapped in it, which
 *     REDs the moment anyone unwraps it (the behavioural pin cannot see that);
 *   · the OUTCOME — the exact URL `draftModel` requests, and that it is relative.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CEEClient, isPlotDirectBase } from '../client'
import { toSameOriginPlotBase } from '../../../lib/plotSameOrigin'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

/** Obviously synthetic — never a real or realistic-looking credential. */
const SYNTHETIC_BEARER = 'a-provisioned-looking-token'

/** The value `VITE_CEE_DRAFT_BASE` is measured SET to on staging. */
const DEPLOYED_ABSOLUTE_DRAFT_BASE = 'https://plot-lite-service-staging.onrender.com/v1/cee'

vi.mock('../../../lib/observability-headers', () => ({
  withObservabilityHeaders: vi.fn(
    async (_url: string, _method: string, _body: unknown, headers: Record<string, string>) => ({
      headers,
      startTime: Date.now(),
    }),
  ),
  recordBffResponse: vi.fn(),
  recordBffError: vi.fn(),
  recordBffResponsePayload: vi.fn(),
}))

vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
}))

vi.mock('../../../lib/api-schemas', () => ({
  CEEDraftResponseSchema: {},
  warnOnInvalidApiResponse: vi.fn(),
}))

vi.mock('../../../lib/fetchWithRetry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

const CLIENT_SOURCE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'client.ts',
)

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ nodes: [], edges: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function urlOfFirstFetch(): string {
  return String(fetchSpy.mock.calls[0]?.[0] ?? '')
}
function initOfFirstFetch(): RequestInit | undefined {
  return fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
}

/** Read one header by EXACT name (case-insensitively — a lower-case leak is a leak). */
function authorizationOf(init: RequestInit | undefined): string | undefined {
  const headers = init?.headers
  if (!headers) return undefined
  if (headers instanceof Headers) return headers.get('Authorization') ?? undefined
  if (Array.isArray(headers)) {
    for (const [name, value] of headers) if (name.toLowerCase() === 'authorization') return value
    return undefined
  }
  for (const [name, value] of Object.entries(headers as Record<string, string>)) {
    if (name.toLowerCase() === 'authorization') return value
  }
  return undefined
}

describe('CEEClient source: the published-credential path is GONE', () => {
  it('carries NO plotAuthHeaders identifier and NO VITE_PLOT_BEARER read in CODE', () => {
    const raw = readFileSync(CLIENT_SOURCE_PATH, 'utf8')
    const code = stripComments(raw, 'client.ts')

    // POSITIVE CONTROL, and the reason a naive grep is wrong here: the file
    // legitimately DISCUSSES both removed names in prose, so a raw-text scan fails
    // on its own documentation. These two assertions prove the stripper is doing
    // real work — if the prose ever goes, they RED and this test is re-examined
    // rather than quietly becoming a scan of nothing.
    expect(raw).toContain('plotAuthHeaders')
    expect(raw).toContain('VITE_PLOT_BEARER')

    // SECOND CONTROL: the stripper did not simply blank the file. An empty string
    // satisfies every absence assertion below, so the absence claim is worthless
    // without evidence that real code survived.
    expect(code).toContain('export function isPlotDirectBase')
    expect(code).toContain('export class CEEClient')

    // THE CLAIM.
    expect(code).not.toContain('plotAuthHeaders')
    expect(code).not.toContain('VITE_PLOT_BEARER')
  })

  it('WIRING: CEE_DRAFT_ENGINE_BASE is wrapped in toSameOriginPlotBase', () => {
    // The pin the behavioural tests structurally CANNOT provide: under test the
    // fallback base is already relative, so unwrapping this call changes no URL
    // any spec observes — it would only surface on the deployed build, where
    // VITE_CEE_DRAFT_BASE is set to PLoT's absolute origin and the request would
    // go cross-origin, past the proxy that holds the credential.
    const raw = readFileSync(CLIENT_SOURCE_PATH, 'utf8')
    const code = stripComments(raw, 'client.ts').replace(/\s+/g, ' ')

    expect(code).toContain('CEE_DRAFT_ENGINE_BASE = toSameOriginPlotBase(')
    expect(code).toContain("import { toSameOriginPlotBase } from '../../lib/plotSameOrigin'")
  })
})

describe('CEEClient draftModel — no credential, same origin', () => {
  it('CONTROL (trap 13): the stubbed bearer IS visible through import.meta.env', () => {
    // Read WITHOUT an `(import.meta as any)` cast — that cast is precisely what
    // freezes this file's env to a build-time snapshot (see the header).
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)
    expect(import.meta.env.VITE_PLOT_BEARER).toBe(SYNTHETIC_BEARER)
  })

  it('CONTROL: the header reader can SEE an Authorization when one is present', () => {
    const control = 'Bearer synthetic-control-value'
    expect(authorizationOf({ headers: { Authorization: control } })).toBe(control)
    expect(authorizationOf({ headers: { authorization: control } })).toBe(control)
    expect(authorizationOf({ headers: { 'Content-Type': 'application/json' } })).toBeUndefined()
  })

  it('carries NO Authorization header even with VITE_PLOT_BEARER STUBBED PRESENT', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)

    await new CEEClient().draftModel('a brief')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Identity-bound to the draft endpoint, so this cannot pass on another call.
    expect(urlOfFirstFetch()).toBe('/bff/engine/v1/cee/draft-graph?schema=v3')
    expect(authorizationOf(initOfFirstFetch())).toBeUndefined()
    // The observability headers the client DOES send are untouched — proof the
    // header object reached the spy populated, not empty.
    expect((initOfFirstFetch()?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
  })

  it('requests a SAME-ORIGIN URL, and the deployed absolute base maps onto exactly it', async () => {
    await new CEEClient().draftModel('a brief')

    // OUTCOME: the exact URL, and that it is relative — `isPlotDirectBase` is the
    // client's own predicate, so a base that ever went absolute REDs here.
    expect(urlOfFirstFetch()).toBe('/bff/engine/v1/cee/draft-graph?schema=v3')
    expect(isPlotDirectBase(urlOfFirstFetch())).toBe(false)

    // MAPPING: the staging value of VITE_CEE_DRAFT_BASE composes to that same URL.
    // Asserted through the real helper rather than by stubbing the variable, which
    // is unreachable in-process (header). This is what makes the pin bite: it fixes
    // the deployed absolute base to the same-origin URL above, so a change to the
    // host regex or the proxy prefix breaks the equality rather than passing on a
    // fallback that happens to look identical.
    expect(`${toSameOriginPlotBase(DEPLOYED_ABSOLUTE_DRAFT_BASE)}/draft-graph?schema=v3`).toBe(
      '/bff/engine/v1/cee/draft-graph?schema=v3',
    )
    expect(isPlotDirectBase(toSameOriginPlotBase(DEPLOYED_ABSOLUTE_DRAFT_BASE))).toBe(false)

    // CONTRAST CONTROL: the predicate is not simply always-false, and the deployed
    // value really is the absolute base being normalised away.
    expect(isPlotDirectBase(DEPLOYED_ABSOLUTE_DRAFT_BASE)).toBe(true)
  })
})
