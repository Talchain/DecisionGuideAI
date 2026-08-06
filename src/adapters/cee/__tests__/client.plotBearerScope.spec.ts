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
 * stub is visible to `plotAuthHeaders` in this environment).
 *
 * Mutant contract: re-merging `plotAuthHeaders()` unconditionally at the
 * `fetchWithBase` headers site turns the three endpoint pins RED; the
 * predicate pin (`isPlotDirectBase`) REDs if the absolute-base branch is
 * widened to relative bases or narrowed away from the draft base.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { CEEClient, isPlotDirectBase } from '../client'
import { plotAuthHeaders } from '../../../lib/plotAuthHeaders'

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
  it('CONTROL (trap 13): the stubbed bearer IS visible to plotAuthHeaders here', () => {
    // If this control ever fails, the three absence pins below are running
    // against an empty header source and prove nothing — fix the stub, not
    // the pins.
    expect(plotAuthHeaders()).toHaveProperty('Authorization', 'Bearer leak-probe-token')
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
    // The ONE base class the bearer may ride — the deployed absolute
    // VITE_CEE_DRAFT_BASE:
    expect(isPlotDirectBase('https://plot-lite-service-staging.onrender.com/v1/cee')).toBe(true)
    expect(isPlotDirectBase('http://localhost:8787/v1/cee')).toBe(true)
    // Never a same-origin seam:
    expect(isPlotDirectBase('/bff/cee')).toBe(false)
    expect(isPlotDirectBase('/bff/engine/v1/cee')).toBe(false)
  })
})
