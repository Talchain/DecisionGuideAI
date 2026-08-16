/**
 * F-U1 (adversarial review of the 2.710 PR) — the PLoT bearer must NEVER
 * ride a same-origin `/bff/cee` call.
 *
 * THE DEFECT: `fetchWithBase` merged `plotAuthHeaders()` into EVERY request.
 * Harmless while every base pointed at PLoT — but 2.710 moved `biasCheck`
 * and `sensitivityCoach` onto the same-origin `/bff/cee` seam, and the
 * cee-proxy edge function forwards an incoming `authorization` header as
 * the USER-token slot. A provisioned `VITE_PLOT_BEARER` would therefore
 * have arrived at CEE masquerading as a Supabase user token on three
 * endpoints (elicit-belief was already seam-bound and equally exposed).
 * Latent today only because the var is unprovisioned.
 *
 * THE PINS, identity-bound to the endpoints the review named (trap 19 —
 * a value predicate another call could satisfy proves nothing):
 *   · `biasCheck` → `/bff/cee/bias-check`, NO Authorization header;
 *   · `sensitivityCoach` → `/bff/cee/sensitivity-coach`, NO Authorization;
 *   · `elicitBelief` → `/bff/cee/elicit-belief`, NO Authorization;
 * each with `VITE_PLOT_BEARER` STUBBED PRESENT, so the absence is the
 * scoping's doing and not the env's (the trap-13 control below proves the
 * stub is visible in this environment).
 *
 * ⚠ THE GUARANTEE HAS SINCE BEEN STRENGTHENED, AND THESE PINS STILL HOLD.
 * `plotAuthHeaders` published its bearer into a PUBLIC bundle chunk (Vite
 * inlines `import.meta.env.VITE_X` as a literal), so the module, the merge and
 * the credential were all removed: NO base carries an Authorization now, not
 * just `/bff/cee`. These three endpoint pins are unchanged and remain the
 * narrowest, most specific statement of that — the broader claim, and the
 * source-level pin that the bearer path is gone, live in
 * client.plotBearer.spec.ts.
 *
 * Mutant contract: re-merging any credential at the `fetchWithBase` headers
 * site turns the three endpoint pins RED; the predicate pin
 * (`isPlotDirectBase`) REDs if the absolute-base branch is widened to relative
 * bases or narrowed away from the draft base.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { CEEClient, isPlotDirectBase } from '../client'

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('VITE_PLOT_BEARER', 'leak-probe-token')
  fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(okJson({ insights: [] })))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function callTo(pathSuffix: string): { url: string; headers: Record<string, string> } | null {
  for (const call of fetchSpy.mock.calls) {
    const url = String(call[0] ?? '')
    if (url.endsWith(pathSuffix)) {
      return { url, headers: ((call[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string> }
    }
  }
  return null
}

describe('F-U1 — no PLoT bearer on the same-origin /bff/cee seam', () => {
  it('CONTROL (trap 13): the stubbed bearer IS visible in this environment', () => {
    // Same trap-13 intent as before, sourced differently: `plotAuthHeaders` is
    // DELETED (it was the module that published the credential into the bundle),
    // so the control can no longer route through it. It now reads the variable
    // the deleted module read, at the same seam, and proves the fixture is live.
    //
    // If this control ever fails, the three absence pins below are running
    // against an environment that carries no credential at all and prove
    // nothing — fix the stub, not the pins.
    //
    // ⚠ Read it WITHOUT an `(import.meta as any)` cast: that cast strips Vite's
    // env proxy and freezes the whole file's `import.meta.env` to a build-time
    // snapshot, at which point this reads `undefined` and reports a live fixture
    // as dead. (Measured; it is also why `VITE_CEE_DRAFT_BASE` cannot be stubbed
    // at all — see the header of client.plotBearer.spec.ts.)
    expect(import.meta.env.VITE_PLOT_BEARER).toBe('leak-probe-token')
  })

  it('biasCheck targets /bff/cee/bias-check and carries NO Authorization header', async () => {
    await new CEEClient().biasCheck({ nodes: [], edges: [] })
    const call = callTo('/bias-check')
    expect(call).not.toBeNull()
    expect(call!.url).toBe('/bff/cee/bias-check')
    expect(call!.headers).not.toHaveProperty('Authorization')
  })

  it('sensitivityCoach targets /bff/cee/sensitivity-coach and carries NO Authorization header', async () => {
    await new CEEClient().sensitivityCoach({ nodes: [], edges: [] }, {})
    const call = callTo('/sensitivity-coach')
    expect(call).not.toBeNull()
    expect(call!.url).toBe('/bff/cee/sensitivity-coach')
    expect(call!.headers).not.toHaveProperty('Authorization')
  })

  it('elicitBelief targets /bff/cee/elicit-belief and carries NO Authorization header', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(okJson({ suggested_value: 0.7, options: [] })),
    )
    await new CEEClient().elicitBelief({
      node_id: 'n1',
      node_label: 'Churn risk',
      user_expression: 'pretty likely',
      target_type: 'prior',
    })
    const call = callTo('/elicit-belief')
    expect(call).not.toBeNull()
    expect(call!.url).toBe('/bff/cee/elicit-belief')
    expect(call!.headers).not.toHaveProperty('Authorization')
  })

  it('the scoping predicate: absolute bases are PLoT-direct, every /bff seam is not', () => {
    // The base class that was once the ONE the bearer could ride — the deployed
    // absolute VITE_CEE_DRAFT_BASE. Nothing rides it now; the predicate is
    // retained as the leak-pin, and a `true` on a base this client actually
    // holds is a defect:
    expect(isPlotDirectBase('https://plot-lite-service-staging.onrender.com/v1/cee')).toBe(true)
    expect(isPlotDirectBase('http://localhost:8787/v1/cee')).toBe(true)
    // Never a same-origin seam:
    expect(isPlotDirectBase('/bff/cee')).toBe(false)
    expect(isPlotDirectBase('/bff/engine/v1/cee')).toBe(false)
  })
})
