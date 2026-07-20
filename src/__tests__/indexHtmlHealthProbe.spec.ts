/**
 * Rehearsal-triage Item B (2026-07-20) — the safe-screen health probe in
 * index.html must never fetch a cross-origin service host.
 *
 * index.html's inline safe-screen script probes PLoT health on EVERY page
 * load (the safe screen is hidden pre-React, but the fetch has already been
 * dispatched). Its failure fallback was a hardcoded
 * `https://plot-lite-service.onrender.com/health` — the PRODUCTION host —
 * which staging's CSP (connect-src pins the staging host only) blocks with
 * two console errors precisely when the proxied probe is already failing
 * (dress-rehearsal console.log 09:58:36Z). The e2e helpers even allowlist
 * that exact error (e2e/helpers/canvas.ts) — a tolerated broken alarm.
 *
 * The rule this spec pins: the inline probe stays SAME-ORIGIN only
 * (`/engine/*` and `/bff/engine/*`), because the per-environment
 * `_redirects`/netlify.toml own which backend those paths reach — staging
 * probes staging, production probes production, and CSP never fires.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function indexHtml(): string {
  return readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
}

describe('index.html safe-screen health probe', () => {
  it('still probes engine health via the same-origin proxy (positive control)', () => {
    // Proves this spec is reading the real document and the probe exists —
    // without this, the absence assertions below could pass vacuously
    // against an empty or relocated file.
    const html = indexHtml()
    expect(html).toContain("var edge = '/engine'")
    expect(html).toContain("fetch(edge + '/health')")
  })

  it('never fetches the production PLoT host', () => {
    expect(indexHtml()).not.toMatch(/plot-lite-service\.onrender\.com/)
  })

  it('contains no cross-origin onrender.com URL at all', () => {
    // The probe must be same-origin only; _redirects decides the backend
    // per environment. Any onrender.com literal here is a cross-environment
    // leak waiting for a CSP block.
    expect(indexHtml()).not.toMatch(/https:\/\/[a-z0-9-]+\.onrender\.com/i)
  })
})
