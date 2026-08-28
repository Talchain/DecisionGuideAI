/**
 * CI guard: A MISSING CONTENT-HASHED ASSET MUST 404, NEVER SERVE THE SPA INDEX.
 *
 * ── THE DEFECT, MEASURED ────────────────────────────────────────────────────
 * `public/_redirects` ends in the SPA catch-all `/*  /index.html  200`. Netlify
 * processes that file BEFORE `netlify.toml` `[[redirects]]` and applies the
 * first matching rule top-to-bottom, so the catch-all is the last word on every
 * path that no earlier rule and no real file claims.
 *
 * For ROUTES that is correct and necessary — `/scenarios` must boot the app.
 * For `/assets/*` it is a lie with a user-visible cost. Vite emits
 * content-hashed, immutable chunk filenames, so EVERY deploy retires the
 * previous deploy's chunk names. A browser that loaded the app before a deploy
 * still holds the OLD names, and its next lazy `import()` asks for a file that
 * no longer exists. Instead of a 404 the edge returns the SPA index:
 *
 *     HTTP 200, content-type: text/html
 *
 * The browser then refuses it — `Failed to load module script: Expected a
 * JavaScript module script but the server responded with a MIME type of
 * "text/html"` — and the feature is simply dead in that tab until a manual
 * reload. NOTHING 404s, so no status-code monitor can see it.
 *
 * Measured on staging at UI 07a807a3 (2026-08-27), one invocation:
 *   /assets/flags-BOFkajto.js            200 text/html  4883   (once deployed)
 *   /assets/index-COspGXQe.js            200 text/html  4883   (once deployed)
 *   /assets/plotAuthHeaders-Bazgbw-s.js  200 text/html  4883   (once deployed)
 *   /assets/zzz-fabricated-9f3K.js       200 text/html  4883   (FABRICATED CONTROL)
 *   /assets/index-iic11nFi.js            200 application/javascript 147605  (LIVE — contrast)
 *   /scenarios                           200 text/html  4949   (SPA ROUTE — contrast)
 * A transitive crawl of the live entry chunk returned `hardNotFound: 0` across
 * 81 paths. The fabricated control is what proves the fallback catches
 * everything rather than the crawl being wrong; the live-entry contrast is what
 * proves the probe discriminates at all.
 *
 * ── THE FIX THIS GUARD PINS ─────────────────────────────────────────────────
 * A `404` rule for the hashed-asset prefix, ABOVE the catch-all, UNFORCED:
 *
 *     /assets/*   /404.html   404
 *
 * Netlify's shadowing behaviour is the whole mechanism: an unforced rule does
 * not apply when a real file exists at the path, so every asset that WAS built
 * is still served normally and only absent ones reach the rule. Netlify's own
 * documentation of this pattern says it explicitly — "the 404 pages will only
 * be returned for nonexistent assets under the above paths".
 *
 * ⚠ THE FORCE FLAG IS THE FOOT-GUN, AND IT IS ASSERTED AGAINST BELOW. Writing
 * `404!` forces the rule and defeats shadowing, which would 404 EVERY asset and
 * take the whole site down. A guard that only checked "a 404 rule exists" would
 * pass on that catastrophe.
 *
 * ── WHY THE PREFIX IS DERIVED, NOT WRITTEN ──────────────────────────────────
 * The prefix comes from `vite.config.ts`'s `assetsDir`/`base`, read at run
 * time. A hardcoded `/assets/` here would be a hand-maintained mirror: someone
 * changes `assetsDir`, the guard keeps cheerfully verifying a prefix nothing is
 * emitted to, and the defect returns under a green suite. The deriver has its
 * own positive control below — a broken deriver would make every other
 * assertion in this file vacuous.
 *
 * ── WHAT THIS GUARD DOES NOT COVER, STATED SO NOBODY OVER-READS IT ──────────
 * It is a static read of `public/_redirects`, `netlify.toml` and
 * `vite.config.ts`. It CANNOT prove the deployed edge behaves this way, that
 * `public/404.html` renders acceptably, or that shadowing works as documented
 * at this site. Those need the live probe recorded in the PR body — and the
 * real closure is a re-drive ACROSS a deploy boundary, not a green suite.
 *
 * CONTROLS (every CI pass, not once by hand):
 *   · POSITIVE — the ACTUAL pre-fix `_redirects`, frozen at 07a807a3, MUST be
 *     flagged. Pinned to the historical artefact permanently; never regenerate
 *     it from the current file, or it decays into a tautology the first time
 *     "current" changes.
 *   · NEGATIVE — the fixed shape must NOT be flagged.
 *   · PRECEDENCE — a 404 rule placed BELOW the catch-all MUST still be flagged.
 *   · FORCE — a forced (`404!`) rule MUST be flagged, because it breaks the site.
 *   · CONTRAST — the SPA catch-all must SURVIVE, unforced, still serving
 *     `/index.html` with 200. Without this arm the fix could delete routing and
 *     the suite would applaud.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'

const REPO_ROOT = resolvePath(__dirname, '../..')
const REDIRECTS_PATH = join(REPO_ROOT, 'public/_redirects')
const VITE_CONFIG_PATH = join(REPO_ROOT, 'vite.config.ts')

// ── parsing ─────────────────────────────────────────────────────────────────

export interface RedirectRule {
  from: string
  to: string
  /** Raw status token as written, e.g. `200`, `404`, `200!`. */
  status: string
  /** True when the rule carries Netlify's force flag (`!`). */
  forced: boolean
  /** Position in file order, comments excluded. */
  index: number
}

/**
 * Parse `public/_redirects` into ordered rules. Comments are skipped, so a path
 * discussed in prose (several are, by design — that file is heavily commented)
 * is never treated as a declaration.
 */
export function parseRedirects(redirectsText: string): RedirectRule[] {
  const rules: RedirectRule[] = []
  for (const rawLine of redirectsText.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const parts = line.split(/\s+/)
    if (!parts[0]) continue
    const status = parts[2] ?? ''
    rules.push({
      from: parts[0],
      to: parts[1] ?? '',
      status,
      forced: status.endsWith('!'),
      index: rules.length,
    })
  }
  return rules
}

/**
 * Derive the URL prefix that carries content-hashed, immutable build output,
 * from the Vite config that emits it.
 *
 * Throws rather than guessing. A deriver that silently fell back to `/assets/`
 * would keep this whole file green while guarding a prefix nothing is written
 * to — which is the failure mode the derivation exists to prevent.
 */
export function deriveHashedAssetPrefix(viteConfigText: string): string {
  const assetsDirMatch = viteConfigText.match(/\bassetsDir\s*:\s*['"]([^'"]+)['"]/)
  if (!assetsDirMatch) {
    throw new Error(
      'Could not derive assetsDir from vite.config.ts. This guard cannot verify a ' +
        'prefix it cannot derive — fix the deriver rather than hardcoding a prefix.',
    )
  }
  const assetsDir = assetsDirMatch[1].replace(/^\/+|\/+$/g, '')

  // `base` shifts every emitted URL. Default is '/'.
  const baseMatch = viteConfigText.match(/^\s*base\s*:\s*['"]([^'"]+)['"]/m)
  const base = (baseMatch?.[1] ?? '/').replace(/\/+$/, '')

  return `${base}/${assetsDir}/`
}

// ── the invariants ──────────────────────────────────────────────────────────

/**
 * Defects in how `_redirects` treats the hashed-asset prefix.
 * Empty array = a missing asset 404s and real assets are untouched.
 */
export function findAssetFallbackDefects(redirectsText: string, assetPrefix: string): string[] {
  const rules = parseRedirects(redirectsText)
  const catchAllIndex = rules.findIndex((r) => r.from === '/*')
  const defects: string[] = []

  // Wildcard form of the prefix, e.g. `/assets/*`.
  const assetGlob = `${assetPrefix}*`

  const assetRules = rules.filter((r) => r.from === assetGlob)

  if (assetRules.length === 0) {
    defects.push(
      `${assetGlob} has no rule of its own, so the SPA catch-all answers every missing ` +
        `asset with 200 text/html instead of 404`,
    )
    return defects
  }

  for (const rule of assetRules) {
    if (!rule.status.startsWith('404')) {
      defects.push(`${assetGlob} is declared with status "${rule.status}", expected 404`)
      continue
    }
    // Below the catch-all is dead on arrival — first match wins, top to bottom.
    if (catchAllIndex !== -1 && rule.index > catchAllIndex) {
      defects.push(
        `${assetGlob} declares 404 but sits BELOW the SPA catch-all, so the catch-all ` +
          `matches first and the rule never runs`,
      )
      continue
    }
    // Forced defeats shadowing and 404s files that DO exist — i.e. the site.
    if (rule.forced) {
      defects.push(
        `${assetGlob} carries the force flag ("${rule.status}"), which defeats Netlify ` +
          `shadowing and would 404 assets that exist — taking the site down`,
      )
    }
  }

  return defects
}

/**
 * THE CONTRAST ARM. Routing must survive the fix: `/*` still rewrites to the
 * SPA index with 200, unforced.
 */
export function findSpaRouteDefects(redirectsText: string): string[] {
  const rules = parseRedirects(redirectsText)
  const catchAll = rules.find((r) => r.from === '/*')
  if (!catchAll) {
    return ['the SPA catch-all `/*` is gone — every client route would 404']
  }
  const defects: string[] = []
  if (catchAll.to !== '/index.html') {
    defects.push(`the SPA catch-all targets "${catchAll.to}", expected /index.html`)
  }
  if (!catchAll.status.startsWith('200')) {
    defects.push(`the SPA catch-all has status "${catchAll.status}", expected 200`)
  }
  if (catchAll.index !== rules.length - 1) {
    defects.push('the SPA catch-all is not last — rules after it are unreachable')
  }
  return defects
}

// ── FROZEN HISTORICAL FIXTURE ───────────────────────────────────────────────
// The real rule block of `public/_redirects` at commit 07a807a3, immediately
// before this fix. PINNED — never regenerate from the current file. Its whole
// job is to keep proving the detector can still see the defect that shipped.
const HISTORICAL_REDIRECTS_07A807A3 = `# BFF proxies (must come BEFORE SPA catch-all)
# ... (prose omitted; comments are skipped by the parser anyway)

# Static routes
/poc           /poc.html                                               200
/fixtures/*    /fixtures/:splat                                        200

# SPA catch-all (MUST BE LAST - catches all unmatched routes)
/*             /index.html                                             200
`

describe('Netlify hashed-asset 404 precedence', () => {
  // ── the deriver's own control ─────────────────────────────────────────────
  it("POSITIVE CONTROL: the deriver reads the repo's real assetsDir", () => {
    // If this breaks, every assertion below is about a prefix nothing emits to.
    const prefix = deriveHashedAssetPrefix(readFileSync(VITE_CONFIG_PATH, 'utf8'))
    expect(prefix).toBe('/assets/')
  })

  it('POSITIVE CONTROL: the deriver throws rather than guessing a prefix', () => {
    expect(() => deriveHashedAssetPrefix('export default { build: {} }')).toThrow(/assetsDir/)
  })

  it('the deriver honours a non-default base', () => {
    const cfg = "export default defineConfig({\n  base: '/app/',\n  build: { assetsDir: 'static' },\n})"
    expect(deriveHashedAssetPrefix(cfg)).toBe('/app/static/')
  })

  // ── the defect ────────────────────────────────────────────────────────────
  it('POSITIVE CONTROL: flags the pre-fix config, frozen at 07a807a3', () => {
    const defects = findAssetFallbackDefects(HISTORICAL_REDIRECTS_07A807A3, '/assets/')
    expect(defects).toHaveLength(1)
    expect(defects[0]).toMatch(/no rule of its own/)
  })

  it('NEGATIVE CONTROL: the fixed shape is clean', () => {
    const fixed = [
      '/assets/*      /404.html      404',
      '/poc           /poc.html      200',
      '/*             /index.html    200',
      '',
    ].join('\n')
    expect(findAssetFallbackDefects(fixed, '/assets/')).toEqual([])
  })

  it('PRECEDENCE CONTROL: a 404 rule BELOW the catch-all is still flagged', () => {
    // The mutant that a "does a 404 rule exist?" guard would wave through.
    const below = ['/*             /index.html    200', '/assets/*      /404.html      404', ''].join(
      '\n',
    )
    const defects = findAssetFallbackDefects(below, '/assets/')
    expect(defects).toHaveLength(1)
    expect(defects[0]).toMatch(/BELOW the SPA catch-all/)
  })

  it('FORCE CONTROL: a forced 404 rule is flagged — it would 404 assets that exist', () => {
    const forced = ['/assets/*      /404.html      404!', '/*   /index.html   200', ''].join('\n')
    const defects = findAssetFallbackDefects(forced, '/assets/')
    expect(defects).toHaveLength(1)
    expect(defects[0]).toMatch(/force flag/)
  })

  it('flags an asset rule declared with the wrong status', () => {
    const wrong = ['/assets/*      /index.html    200', '/*   /index.html   200', ''].join('\n')
    const defects = findAssetFallbackDefects(wrong, '/assets/')
    expect(defects).toHaveLength(1)
    expect(defects[0]).toMatch(/expected 404/)
  })

  it('NEGATIVE CONTROL: a prefix named only in a comment is not treated as declared', () => {
    const commented = ['# /assets/*   /404.html   404', '/*   /index.html   200', ''].join('\n')
    expect(findAssetFallbackDefects(commented, '/assets/')).toHaveLength(1)
  })

  it('derives the guarded prefix, so a changed assetsDir is caught rather than missed', () => {
    // Same file, different vite config: the /assets/* rule no longer guards the
    // prefix that is actually emitted, and that must be a defect.
    const fixedForAssets = ['/assets/*   /404.html   404', '/*   /index.html   200', ''].join('\n')
    expect(findAssetFallbackDefects(fixedForAssets, '/static/')).toHaveLength(1)
  })

  // ── the contrast arm: routing must survive ───────────────────────────────
  it('CONTRAST: a real SPA route is still served by the catch-all after the fix', () => {
    const fixed = ['/assets/*   /404.html   404', '/*   /index.html   200', ''].join('\n')
    expect(findSpaRouteDefects(fixed)).toEqual([])
  })

  it('CONTRAST CONTROL: deleting the catch-all is flagged', () => {
    expect(findSpaRouteDefects('/assets/*   /404.html   404\n')).toEqual([
      'the SPA catch-all `/*` is gone — every client route would 404',
    ])
  })

  it('CONTRAST CONTROL: a rule after the catch-all is flagged as unreachable', () => {
    const after = ['/*   /index.html   200', '/assets/*   /404.html   404', ''].join('\n')
    expect(findSpaRouteDefects(after)).toContain(
      'the SPA catch-all is not last — rules after it are unreachable',
    )
  })

  // ── the real config at HEAD ──────────────────────────────────────────────
  it('REAL: a missing hashed asset 404s in the repo config at HEAD', () => {
    const redirects = readFileSync(REDIRECTS_PATH, 'utf8')
    const prefix = deriveHashedAssetPrefix(readFileSync(VITE_CONFIG_PATH, 'utf8'))
    expect(findAssetFallbackDefects(redirects, prefix)).toEqual([])
  })

  it('REAL: the SPA catch-all still serves client routes in the repo config at HEAD', () => {
    expect(findSpaRouteDefects(readFileSync(REDIRECTS_PATH, 'utf8'))).toEqual([])
  })

  it('REAL: the 404 page can actually render under the site CSP', () => {
    // The `csp-nonce` edge function declares `/assets/*` in its excludedPath,
    // so when this page is served for a missing asset it gets NO nonce. An
    // inline <script> would be blocked by the site CSP and the page would
    // render blank at the one moment it has a job to do. Inline <style> is
    // fine — the CSP allows `style-src 'unsafe-inline'`.
    const rules = parseRedirects(readFileSync(REDIRECTS_PATH, 'utf8'))
    const assetRule = rules.find((r) => r.from === '/assets/*')
    expect(assetRule, 'no /assets/* rule to check').toBeDefined()

    const page = readFileSync(join(REPO_ROOT, 'public', assetRule!.to), 'utf8')
    // Strip HTML comments first, so the explanatory note in the page itself
    // (which names the tag it forbids) cannot satisfy or trip this check.
    const markup = page.replace(/<!--[\s\S]*?-->/g, '')
    expect(markup, 'the 404 page must carry no inline script').not.toMatch(/<script/i)
    // Positive control: the stripper must not have eaten the whole document.
    expect(markup).toMatch(/<body/i)
  })

  it('REAL: the 404 rule points at a file that exists', () => {
    // A rule whose target is absent is a rule that 404s with whatever Netlify
    // decides to render — not a claim we can make about the product.
    const rules = parseRedirects(readFileSync(REDIRECTS_PATH, 'utf8'))
    const assetRule = rules.find((r) => r.from === '/assets/*')
    expect(assetRule, 'no /assets/* rule to check').toBeDefined()
    expect(existsSync(join(REPO_ROOT, 'public', assetRule!.to))).toBe(true)
  })
})
