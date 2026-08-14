/**
 * runV2 — the analysis-run path carries NO credential, and cannot be routed
 * off-origin by an env var.
 *
 * THE DEFECT THIS PINS
 * --------------------
 * `runV2` is the fetch behind every analysis run — the single most important
 * browser→PLoT call. It used to ride `plotFetch`, which merged
 * `Authorization: Bearer ${import.meta.env.VITE_PLOT_BEARER}` into the request.
 * Vite inlines `import.meta.env.VITE_X` as a LITERAL at build time, so that bearer
 * was published verbatim in a public bundle chunk — a live shared server-to-server
 * credential readable by any visitor, with the variable name compiled away so no
 * name-based scan could see it.
 *
 * ⚠ WHY "NO HEADER WHEN THE VAR IS UNSET" WOULD BE VACUOUS. The old code was
 * deliberately fail-safe: with `VITE_PLOT_BEARER` empty it attached nothing. A test
 * asserting absence in that state was green throughout the defect's entire life and
 * proved only that the environment was empty. The pin below therefore stubs a
 * provisioned-looking bearer PRESENT, and a control asserts the stub is genuinely
 * visible — an absence claim needs a demonstrated ability to see a presence.
 *
 * THE SECOND HALF: SAME-ORIGIN ROUTING
 * ------------------------------------
 * `VITE_PLOT_ENGINE_URL` overrides the caller's base entirely. Pointed at PLoT's
 * absolute origin it would take `/v2/run` around the `/bff/engine/*` edge function
 * that injects the bearer server-side — and the only way to make such a call
 * succeed would be to publish a credential in the bundle again.
 * `toSameOriginPlotBase` now normalises it. The pin is bracketed by two controls:
 * the un-stubbed BASELINE (proving the rewritten URL is the override's doing, not
 * the fixture's) and a NON-PLoT override (proving the rewrite is scoped to the PLoT
 * host family rather than being "make everything relative").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runV2 } from '../adapter'
import type { V2AdapterConfig } from '../adapter'
import type { V2RunRequest } from '../types'

/** Obviously synthetic — never a real or realistic-looking credential. */
const SYNTHETIC_BEARER = 'a-provisioned-looking-token'

const config: V2AdapterConfig = { baseUrl: 'http://plot.test', timeout: 5000 }

const request = {
  request_id: 'req-bearer',
  nodes: [],
  edges: [],
  options: [],
} as unknown as V2RunRequest

let fetchSpy: ReturnType<typeof vi.fn>
let originalFetch: typeof globalThis.fetch

function okFetch() {
  return vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      clone: () => ({ text: () => Promise.resolve('') }),
      json: () => Promise.resolve({ status: 'ok', results: [] }),
    }),
  )
}

beforeEach(() => {
  originalFetch = globalThis.fetch
  fetchSpy = okFetch()
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
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

describe('runV2 — instrument controls', () => {
  it('CONTROL (trap 13): the stubbed bearer IS visible through import.meta.env', () => {
    // Without this, the absence pin below would be asserting nothing about an
    // environment that could never have carried a credential in the first place.
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)
    expect(import.meta.env.VITE_PLOT_BEARER).toBe(SYNTHETIC_BEARER)
  })

  it('CONTROL: the header reader can SEE an Authorization when one is present', () => {
    const control = 'Bearer synthetic-control-value'
    expect(authorizationOf({ headers: { Authorization: control } })).toBe(control)
    expect(authorizationOf({ headers: { authorization: control } })).toBe(control)
    expect(authorizationOf({ headers: { 'Content-Type': 'application/json' } })).toBeUndefined()
  })
})

describe('runV2 — POST /v2/run carries NO Authorization header', () => {
  it('attaches none even with VITE_PLOT_BEARER STUBBED PRESENT', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)

    await runV2(config, request)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Identity-bound to the run endpoint, so this cannot pass on some other call.
    expect(urlOfFirstFetch()).toBe('http://plot.test/v2/run')
    expect(initOfFirstFetch()?.method).toBe('POST')
    expect(authorizationOf(initOfFirstFetch())).toBeUndefined()
  })
})

/**
 * SEAM RETIREMENT — `VITE_PLOT_ENGINE_URL` is no longer read at all.
 *
 * ⚠ WHY NORMALISING THE OVERRIDE WAS NOT ENOUGH, which is the whole point of this
 * block and the reason the previous version of it was wrong.
 *
 * The earlier fix wrapped the override in `toSameOriginPlotBase`, which rewrites a
 * base whose host is in the PLoT family and — deliberately, correctly, for what it
 * was written to do — passes every OTHER absolute base through untouched. Its own
 * contrast control asserted exactly that, with `https://elsewhere.example.test/api`.
 *
 * That leaves the bypass open for any host that is not literally PLoT's. A
 * dashboard-set `VITE_PLOT_ENGINE_URL` still took `/v2/run` — the primary analysis
 * path — clean off-origin and clean around the credential-injecting edge function,
 * and the test suite AGREED, because "non-PLoT bases pass through" was written as
 * the desired behaviour of the normaliser rather than examined as a property of the
 * run path. The normaliser is not at fault; reading the variable is.
 *
 * So the read is gone. The run base is now the caller's, normalised, full stop, and
 * these pins bind to the OUTCOME (the URL fetched) rather than to the mechanism, so
 * they stay honest if the implementation changes again.
 */
describe('runV2 — VITE_PLOT_ENGINE_URL is retired and cannot route the run anywhere', () => {
  it('BASELINE CONTROL: with no override, the caller base is used unchanged', async () => {
    // The discriminating baseline. Without it, the assertions below could not
    // distinguish "the override was ignored" from "the override was never set" —
    // the fixture would agree with itself.
    await runV2(config, request)

    expect(urlOfFirstFetch()).toBe('http://plot.test/v2/run')
  })

  it('an absolute PLoT override is IGNORED — the caller base still decides', async () => {
    vi.stubEnv('VITE_PLOT_ENGINE_URL', 'https://plot-lite-service-staging.onrender.com')

    await runV2(config, request)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(urlOfFirstFetch()).toBe('http://plot.test/v2/run')
    // Stated as its own assertion because it is the actual security property: the
    // request must NOT reach PLoT's origin directly, where no proxy could inject a
    // credential and nothing but a published one would work.
    expect(urlOfFirstFetch()).not.toBe('https://plot-lite-service-staging.onrender.com/v2/run')
    // …and still no credential rides it.
    expect(authorizationOf(initOfFirstFetch())).toBeUndefined()
  })

  it('THE REGRESSION THIS RETIREMENT CLOSES: a NON-PLoT override is ignored too', async () => {
    // ⚠ This is the case the previous implementation got WRONG, and it is asserted
    // here with the exact host its own contrast control used to sanction. Under
    // normalisation this fetched `https://elsewhere.example.test/api/v2/run` — a
    // third-party origin, off-proxy, chosen by an env var. Now it is inert.
    vi.stubEnv('VITE_PLOT_ENGINE_URL', 'https://elsewhere.example.test/api')

    await runV2(config, request)

    expect(urlOfFirstFetch()).toBe('http://plot.test/v2/run')
    expect(urlOfFirstFetch()).not.toContain('elsewhere.example.test')
  })

  it('a caller base on the PLoT host IS still normalised to the same-origin proxy', async () => {
    // Retiring the env read must not retire the normalisation of the base the
    // caller genuinely passes — that is what keeps a PLoT-host base on the proxy
    // path. Bound to the run endpoint by identity.
    await runV2(
      { baseUrl: 'https://plot-lite-service-staging.onrender.com', timeout: 5000 },
      request,
    )

    expect(urlOfFirstFetch()).toBe('/bff/engine/v2/run')
    expect(authorizationOf(initOfFirstFetch())).toBeUndefined()
  })

  it('SOURCE PIN: adapter.ts contains no VITE_PLOT_ENGINE_URL read', async () => {
    // The behavioural pins above are the primary evidence. This one exists because
    // a reintroduced read could be added behind a condition none of the fixtures
    // above happen to enter, and the outcome assertions would stay green.
    //
    // ⚠ COMMENT-STRIPPED FIRST, and that is not incidental. The retired seam is
    // documented BY NAME at the call site — deliberately, so the next reader learns
    // why the read is absent — and this repo's dominant guard footgun (#385, #386)
    // is a source scan reddening CI over a token that lives only in prose. A raw
    // scan here fails on the very comment that explains the fix.
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const { stripComments } = await import('../../../../../tests/helpers/stripSourceComments')
    const raw = readFileSync(resolve(__dirname, '../adapter.ts'), 'utf8')
    const code = stripComments(raw, 'adapter.ts')

    // THE CLAIM.
    expect(code).not.toContain('VITE_PLOT_ENGINE_URL')

    // CONTROLS. Without these the assertion above passes on an empty string — a
    // mis-resolved path, a stripper that ate the file, or a rename would all read
    // as "the seam is retired".
    expect(code).toContain('export async function runV2')
    expect(code).toContain('toSameOriginPlotBase(baseUrl)')
    // …and the stripper is genuinely wired in: the name IS still present in the
    // raw file, in prose. If this ever fails, the pin above has stopped
    // discriminating and is passing for the wrong reason.
    expect(raw).toContain('VITE_PLOT_ENGINE_URL')
  })
})
