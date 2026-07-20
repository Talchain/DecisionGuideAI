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
import { stripHtmlComments } from '../../tests/helpers/stripSourceComments'

function indexHtml(): string {
  return readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
}

/**
 * index.html with HTML comments (`<!-- -->`) and the JS comments inside the
 * inline `<script>` blanked, so a commented-out `onrender.com` host — whether
 * `<!-- … -->` or `// …` in the safe-screen script — no longer false-reds
 * (the #386/#403 footgun; neither the JS nor the CSS stripper covers HTML, so
 * this uses the shared stripHtmlComments). String literals in the script (a
 * real `fetch('https://…onrender.com')`) are KEPT as code and still caught.
 */
function scannableIndexHtml(): string {
  return stripHtmlComments(indexHtml())
}

describe('index.html safe-screen health probe', () => {
  it('still probes engine health via the same-origin proxy (positive control)', () => {
    // Proves this spec is reading the real document and the probe exists —
    // without this, the absence assertions below could pass vacuously
    // against an empty or relocated file. Read the STRIPPED text to also prove
    // the strip leaves the live probe (code + strings) intact.
    const html = scannableIndexHtml()
    expect(html).toContain("var edge = '/engine'")
    expect(html).toContain("fetch(edge + '/health')")
  })

  it('never fetches the production PLoT host', () => {
    expect(scannableIndexHtml()).not.toMatch(/plot-lite-service\.onrender\.com/)
  })

  it('contains no cross-origin onrender.com URL at all', () => {
    // The probe must be same-origin only; _redirects decides the backend
    // per environment. Any onrender.com literal here is a cross-environment
    // leak waiting for a CSP block.
    expect(scannableIndexHtml()).not.toMatch(/https:\/\/[a-z0-9-]+\.onrender\.com/i)
  })
})

/**
 * Both-directions mutation proof for the HTML/script comment strip (#386/#403).
 */
describe('index.html probe — stripHtmlComments detector contract', () => {
  const onrender = /https:\/\/[a-z0-9-]+\.onrender\.com/i

  it('STILL catches a live cross-origin fetch in the script (string literal kept)', () => {
    const html = "<script>fetch('https://plot-lite-service.onrender.com/health')</script>"
    expect(onrender.test(stripHtmlComments(html))).toBe(true)
  })

  it('does NOT catch a host inside an <!-- HTML comment -->', () => {
    const html = '<!-- old: https://plot-lite-service.onrender.com/health --><script>var x=1</script>'
    expect(onrender.test(stripHtmlComments(html))).toBe(false)
  })

  it('does NOT catch a host inside a // comment in the script', () => {
    const html = "<script>\n  // fallback was https://plot-lite-service.onrender.com/health\n  var x=1\n</script>"
    expect(onrender.test(stripHtmlComments(html))).toBe(false)
  })

  it('does NOT catch a host inside a /* block comment */ in the script', () => {
    const html = '<script>/* https://x.onrender.com */ var y = 2</script>'
    expect(onrender.test(stripHtmlComments(html))).toBe(false)
  })

  it('does not mangle an https:// URL that sits in HTML text (no false line-comment)', () => {
    // A bare `//` in HTML text must NOT be treated as a JS line comment — only
    // script bodies get JS-comment stripping.
    const html = '<a href="https://ok.example.com/health">x</a><script>var z=3</script>'
    expect(stripHtmlComments(html)).toContain('https://ok.example.com/health')
  })
})
