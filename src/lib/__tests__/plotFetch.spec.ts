/**
 * plotFetch — the pin that the browser→PLoT seam carries NO credential.
 *
 * THE DEFECT THIS PINS
 * --------------------
 * This wrapper used to merge `plotAuthHeaders()` — `Authorization: Bearer
 * ${import.meta.env.VITE_PLOT_BEARER}` — into every PLoT-direct request. Vite
 * replaces `import.meta.env.VITE_X` with the LITERAL at build time, so the emitted
 * PUBLIC chunk contained a live, shared server-to-server credential in plain text.
 * The variable name was compiled away, so every name-based check reported a
 * confident all-clear while the value itself was published to anyone who fetched
 * the asset. `plotFetch` is now a bare pass-through; the credential is injected
 * server-side by the `/bff/engine/*` edge function.
 *
 * ⚠ WHY EVERY TEST BELOW STUBS THE BEARER PRESENT
 * -----------------------------------------------
 * "No Authorization header when `VITE_PLOT_BEARER` is unset" is a VACUOUS test. It
 * passes against the defective code too — the old wrapper was deliberately
 * fail-safe and attached nothing when the variable was empty — so it would have
 * been green for the entire life of the defect. The only assertion with any content
 * is: **the header is absent EVEN WHEN a provisioned-looking bearer is sitting in
 * the environment.** Every absence pin here therefore stubs one present first, and
 * a CONTROL asserts the stub is genuinely visible through `import.meta.env` (trap
 * 13 — an absence assertion needs a demonstrated ability to see a presence).
 *
 * ⚠ AND THE HEADER READER GETS ITS OWN POSITIVE CONTROLS. `init.headers` may be a
 * plain object, a `Headers` instance or a tuple array. A reader that silently
 * cannot see INTO one of those shapes reports "no Authorization" for every request
 * in that shape — an instrument that cannot fail, agreeing with itself. So
 * `authorizationOf` is first shown to READ BACK an Authorization from all three
 * shapes, and only then used to assert absence.
 *
 * ⚠ NEVER PUT A REAL OR REALISTIC TOKEN IN THIS FILE. The fixtures below are
 * obviously synthetic by construction; a plausible-looking literal in a spec is the
 * same publication defect one directory over.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { plotFetch } from '../plotFetch'

/** Obviously synthetic — never a real or realistic-looking credential. */
const SYNTHETIC_BEARER = 'a-provisioned-looking-token'

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function inputOfFirstCall(): unknown {
  return fetchSpy.mock.calls[0]?.[0]
}
function initOfFirstCall(): RequestInit | undefined {
  return fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
}

/**
 * Read one header, by EXACT name, out of any of the three `HeadersInit` shapes.
 *
 * Matching is case-insensitive because HTTP header names are: a credential leaked
 * as `authorization` is exactly as published as one leaked as `Authorization`, and
 * a pin that only looked for the capitalised spelling would miss the lowercase one.
 */
function authorizationOf(init: RequestInit | undefined): string | undefined {
  const headers = init?.headers
  if (!headers) return undefined
  const wanted = 'authorization'
  if (headers instanceof Headers) return headers.get('Authorization') ?? undefined
  if (Array.isArray(headers)) {
    for (const [name, value] of headers) if (name.toLowerCase() === wanted) return value
    return undefined
  }
  for (const [name, value] of Object.entries(headers as Record<string, string>)) {
    if (name.toLowerCase() === wanted) return value
  }
  return undefined
}

/** Every header name the caller's init carries, lower-cased. */
function headerNamesOf(init: RequestInit | undefined): string[] {
  const headers = init?.headers
  if (!headers) return []
  if (headers instanceof Headers) return [...headers.keys()].map((n) => n.toLowerCase())
  if (Array.isArray(headers)) return headers.map(([name]) => name.toLowerCase())
  return Object.keys(headers as Record<string, string>).map((n) => n.toLowerCase())
}

describe('plotFetch — instrument controls', () => {
  it('CONTROL (trap 13): the stubbed bearer IS visible through import.meta.env', () => {
    // If this fails, every absence pin below is running against an environment
    // where no credential could have appeared anyway, and they prove nothing.
    // Fix the stub, never the pins.
    //
    // ⚠ Read it WITHOUT an `(import.meta as any)` cast. That cast strips Vite's env
    // proxy and freezes the whole file's `import.meta.env` to a build-time snapshot,
    // at which point this control reads `undefined` and reports the fixture dead
    // when it is live. (Measured in this repo; it is also why the CEE draft base
    // cannot be stubbed at all — see client.plotBearer.spec.ts.)
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)
    expect(import.meta.env.VITE_PLOT_BEARER).toBe(SYNTHETIC_BEARER)
  })

  it('CONTROL: the header reader can SEE an Authorization in all three init shapes', () => {
    // The positive control for `authorizationOf`. Without it, "no Authorization in
    // a Headers instance" could pass simply because the reader cannot look inside
    // a Headers instance — an absence assertion resting on a blind instrument.
    const control = 'Bearer synthetic-control-value'

    expect(authorizationOf({ headers: { Authorization: control } })).toBe(control)
    expect(authorizationOf({ headers: new Headers({ Authorization: control }) })).toBe(control)
    expect(authorizationOf({ headers: [['Authorization', control]] })).toBe(control)

    // …and the lower-case spelling, which is what a Headers instance normalises to.
    expect(authorizationOf({ headers: { authorization: control } })).toBe(control)
    expect(authorizationOf({ headers: [['authorization', control]] })).toBe(control)

    // …and reads nothing where there is nothing.
    expect(authorizationOf({ headers: { 'Content-Type': 'application/json' } })).toBeUndefined()
    expect(authorizationOf(undefined)).toBeUndefined()
  })
})

describe('plotFetch — no Authorization header, with the bearer STUBBED PRESENT', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)
  })

  it('a same-origin proxy path carries none', async () => {
    await plotFetch('/bff/engine/v1/limits')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(inputOfFirstCall()).toBe('/bff/engine/v1/limits')
    expect(authorizationOf(initOfFirstCall())).toBeUndefined()
    expect(headerNamesOf(initOfFirstCall())).not.toContain('authorization')
  })

  it('an ABSOLUTE PLoT URL carries none either', async () => {
    // The case that mattered: a cross-origin PLoT call is the ONE request the
    // published credential existed to authenticate. Nothing is attached now, so
    // such a call simply fails at PLoT rather than succeeding on a leaked secret.
    await plotFetch('https://plot-lite-service-staging.onrender.com/v2/run', { method: 'POST' })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(inputOfFirstCall()).toBe('https://plot-lite-service-staging.onrender.com/v2/run')
    expect(authorizationOf(initOfFirstCall())).toBeUndefined()
    expect(headerNamesOf(initOfFirstCall())).not.toContain('authorization')
  })

  it('init.headers as a PLAIN OBJECT gains none', async () => {
    await plotFetch('/bff/engine/v1/limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(authorizationOf(initOfFirstCall())).toBeUndefined()
    // The caller's own header is untouched — this is a pass-through, and the
    // assertion binds to the exact header name, not to a header count.
    expect(
      (initOfFirstCall()?.headers as Record<string, string>)['Content-Type'],
    ).toBe('application/json')
    expect(headerNamesOf(initOfFirstCall())).toEqual(['content-type'])
  })

  it('init.headers as a HEADERS INSTANCE gains none', async () => {
    await plotFetch('/bff/engine/v1/limits', {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    })

    expect(authorizationOf(initOfFirstCall())).toBeUndefined()
    expect(headerNamesOf(initOfFirstCall())).toEqual(['content-type'])
  })

  it('init.headers as a TUPLE ARRAY gains none', async () => {
    await plotFetch('/bff/engine/v1/limits', {
      method: 'POST',
      headers: [['Content-Type', 'application/json']],
    })

    expect(authorizationOf(initOfFirstCall())).toBeUndefined()
    expect(headerNamesOf(initOfFirstCall())).toEqual(['content-type'])
  })

  it('no init at all: nothing is invented to hold a header', async () => {
    await plotFetch('/bff/engine/v1/health')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(inputOfFirstCall()).toBe('/bff/engine/v1/health')
    // Not `{}`, not `{ headers: {} }` — a bare fetch passes `undefined` through.
    expect(initOfFirstCall()).toBeUndefined()
    expect(authorizationOf(initOfFirstCall())).toBeUndefined()
  })
})

describe('plotFetch — it is a PASS-THROUGH, not a rewriter', () => {
  it('forwards the EXACT SAME init reference and input, untouched', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)
    const input = '/bff/engine/v1/limits'
    const init: RequestInit = { method: 'POST', headers: { 'X-Foo': 'bar' }, cache: 'no-store' }

    await plotFetch(input, init)

    // Identity, not equality: a clone would satisfy `toEqual` while proving the
    // wrapper still reshapes the request — which is exactly where a header merge
    // would have to live if one were ever reintroduced.
    expect(fetchSpy.mock.calls[0][1]).toBe(init)
    expect(fetchSpy.mock.calls[0][0]).toBe(input)
    // The object itself was not mutated in place either.
    expect(init.headers).toEqual({ 'X-Foo': 'bar' })
  })

  it('PRESERVES a caller-supplied Authorization header verbatim', async () => {
    // plotFetch must not become a scrubber. Callers on other seams legitimately
    // carry their own credentials (a Supabase user token, say); silently stripping
    // them would be a different defect, and one that fails at runtime rather than
    // in review. The guarantee is "attaches nothing", not "removes everything".
    const callerSupplied = 'Bearer synthetic-caller-supplied-value'

    await plotFetch('/bff/engine/v1/limits', { headers: { Authorization: callerSupplied } })

    expect(authorizationOf(initOfFirstCall())).toBe(callerSupplied)
  })
})
