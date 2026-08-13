/**
 * plotSameOrigin — unit pins for `toSameOriginPlotBase`.
 *
 * THE DEFECT THIS EXISTS TO PREVENT
 * ---------------------------------
 * The browser used to authenticate its PLoT calls with
 * `Authorization: Bearer ${import.meta.env.VITE_PLOT_BEARER}`. Vite replaces
 * `import.meta.env.VITE_X` with the LITERAL at build time, so the emitted public
 * chunk carried a live shared server-to-server credential in plain text. The
 * variable NAME was compiled away, which is why every name-based check reported a
 * confident all-clear while the value sat there for any visitor to read.
 *
 * The credential now lives server-side in the `plot-proxy` edge function, which can
 * only inject it on the SAME-ORIGIN `/bff/engine/*` path it serves. That makes
 * same-origin routing the load-bearing property: an authenticated CROSS-ORIGIN
 * browser call is, by construction, a published credential — there is no version of
 * it that is safe. `toSameOriginPlotBase` is what keeps the two absolute-base
 * escape hatches (`VITE_CEE_DRAFT_BASE`, `VITE_PLOT_ENGINE_URL`) pointed at the
 * proxy, so setting either in the Netlify dashboard can no longer route around the
 * credential boundary.
 *
 * WHY THE NON-PLoT CASE IS A CONTRAST CONTROL, NOT A NICETY
 * --------------------------------------------------------
 * A helper that returned a relative path for EVERY absolute base would satisfy
 * every same-origin assertion here while silently redirecting genuinely external
 * services through our proxy. The non-PLoT and look-alike cases are what
 * discriminate "rewrites the PLoT host family" from "makes everything relative" —
 * without them the suite cannot tell the two apart, and a rewrite of the wrong
 * scope would read green.
 */
import { describe, it, expect } from 'vitest'
import { toSameOriginPlotBase, PLOT_PROXY_PREFIX } from '../plotSameOrigin'

describe('toSameOriginPlotBase', () => {
  it('exposes the proxy prefix the edge function serves, by exact value', () => {
    // Identity-bound: the prefix is a contract with netlify/edge-functions/plot-proxy.ts
    // and public/_redirects, not an implementation detail either side may drift.
    expect(PLOT_PROXY_PREFIX).toBe('/bff/engine')
  })

  describe('absolute PLoT bases are mapped onto the same-origin proxy path', () => {
    it('maps a PLoT host WITH a path to /bff/engine<path>', () => {
      expect(toSameOriginPlotBase('https://plot-lite-service-staging.onrender.com/v1/cee')).toBe(
        '/bff/engine/v1/cee',
      )
    })

    it('maps a PLoT host with NO path to the bare prefix', () => {
      expect(toSameOriginPlotBase('https://plot-lite-service-staging.onrender.com')).toBe(
        '/bff/engine',
      )
    })

    it('drops a trailing slash so callers appending /v1/… cannot double it', () => {
      expect(toSameOriginPlotBase('https://plot-lite-service-staging.onrender.com/')).toBe(
        '/bff/engine',
      )
    })

    it('PRESERVES a query string', () => {
      expect(
        toSameOriginPlotBase('https://plot-lite-service-staging.onrender.com/v1/cee?trace=1'),
      ).toBe('/bff/engine/v1/cee?trace=1')
    })

    it('matches the production host as well as an env-suffixed one', () => {
      // Both members of the canonical host family, asserted by exact result — a
      // "does not throw" or "starts with /bff" check would not distinguish them.
      expect(toSameOriginPlotBase('https://plot-lite-service.onrender.com/v2')).toBe(
        '/bff/engine/v2',
      )
      expect(toSameOriginPlotBase('https://plot-lite-service-staging.onrender.com/v2')).toBe(
        '/bff/engine/v2',
      )
    })
  })

  describe('everything else passes through UNCHANGED', () => {
    it('a relative base is returned byte-for-byte', () => {
      expect(toSameOriginPlotBase('/bff/engine/v1/cee')).toBe('/bff/engine/v1/cee')
      expect(toSameOriginPlotBase('/bff/cee')).toBe('/bff/cee')
    })

    it('CONTRAST CONTROL: a NON-PLoT absolute base is returned unchanged', () => {
      // The discriminating case. If this ever returns a relative path, the helper
      // has become "make everything relative" and would tunnel a third-party
      // service through our credential-injecting proxy.
      expect(toSameOriginPlotBase('https://example.test/api')).toBe('https://example.test/api')
      expect(toSameOriginPlotBase('http://localhost:8787/v1/cee')).toBe(
        'http://localhost:8787/v1/cee',
      )
    })

    it('a malformed absolute URL is returned unchanged rather than throwing', () => {
      // `http://` clears the protocol test but makes `new URL` throw; the helper
      // must degrade to a pass-through, never take down the caller.
      expect(toSameOriginPlotBase('http://')).toBe('http://')
      expect(toSameOriginPlotBase('https://[')).toBe('https://[')
    })

    it('a LOOK-ALIKE host that merely embeds the PLoT name does NOT match', () => {
      // The host regex is anchored at both ends. A suffix attack
      // (`…onrender.com.evil.test`) and a subdomain attack
      // (`evil.plot-lite-service.onrender.com`) must both fall through untouched —
      // a loose match here would rewrite an attacker-chosen base onto our proxy.
      expect(
        toSameOriginPlotBase('https://plot-lite-service-staging.onrender.com.evil.test/v2/run'),
      ).toBe('https://plot-lite-service-staging.onrender.com.evil.test/v2/run')
      expect(toSameOriginPlotBase('https://evil.plot-lite-service.onrender.com/v2/run')).toBe(
        'https://evil.plot-lite-service.onrender.com/v2/run',
      )
    })
  })
})
