/**
 * Netlify BFF route-precedence guard — ROADMAP 2.317.
 *
 * THE DEFECT CLASS. Netlify resolves `public/_redirects` BEFORE `netlify.toml`
 * `[[redirects]]`. `public/_redirects` ends in the SPA catch-all
 * `/*  /index.html  200`. So a proxy path declared ONLY in netlify.toml
 * `[[redirects]]` is dead on arrival: the catch-all answers it with the SPA
 * index (HTTP 200 `text/html`) and the request never leaves Netlify.
 *
 * That is not hypothetical. `/bff/cee/*` lived only in netlify.toml for
 * months. `GET https://staging--olumi.netlify.app/bff/cee/health` returned
 * HTTP 200 `text/html` — 4,883 bytes of SPA index — while the control
 * `/bff/engine/health` (declared in `_redirects`, above the catch-all)
 * returned live PLoT JSON from the same host. Nothing in the build, in
 * TypeScript, in ESLint or in CI objected. Worse, `_redirects` carried the
 * comment "Note: /bff/cee/* handled by netlify.toml redirect with header
 * injection" — an assertion the line immediately below it defeated. A comment
 * is not a guarantee; this guard derives the guarantee instead.
 *
 * WHAT IT ENFORCES. Every `/bff/*` proxy path declared anywhere in the Netlify
 * configuration must be served by a mechanism that OUTRANKS the `_redirects`
 * catch-all — that is, it must either
 *   · appear in `public/_redirects` at a line ABOVE the catch-all, or
 *   · be bound to an `[[edge_functions]]` path in netlify.toml.
 * A `/bff/*` path that satisfies neither is unreachable and fails this test.
 *
 * IT ALSO PINS THE CREDENTIAL BOUNDARY. `_redirects` cannot inject request
 * headers, so a seam needing an auth header must be an edge function, never a
 * redirect — otherwise the key ends up in a file the browser can fetch. The
 * final test asserts no API-key token appears anywhere under `public/`.
 *
 * CONTROLS (run every CI pass, not once by hand):
 *   · POSITIVE — the ACTUAL pre-fix configuration, frozen below as a fixture,
 *     MUST be flagged. It is pinned to the historical artefact at commit
 *     cb957c8c and MUST NOT be updated to track the current files: a control
 *     whose reference is "whatever is deployed now" decays into a tautology
 *     the first time "now" changes. If this fixture ever stops being flagged,
 *     the detector has been hollowed out.
 *   · NEGATIVE — a redirect declared above the catch-all, and a path bound to
 *     an edge function, must NOT be flagged, proving the rule is about
 *     precedence rather than "no netlify.toml redirects ever".
 *   · REAL — the repo's actual config at HEAD must be clean.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'

const REPO_ROOT = resolvePath(__dirname, '../..')
const REDIRECTS_PATH = join(REPO_ROOT, 'public/_redirects')
const TOML_PATH = join(REPO_ROOT, 'netlify.toml')

/** Any path under this prefix is a same-origin proxy seam we must keep reachable. */
const PROXY_PREFIX = '/bff/'

interface ParsedConfig {
  /** `from` paths in public/_redirects, in file order. */
  redirectRules: string[]
  /** Index of the SPA catch-all in `redirectRules`; -1 if absent. */
  catchAllIndex: number
  /** `from` paths of netlify.toml [[redirects]] blocks. */
  tomlRedirects: string[]
  /** `path` values of netlify.toml [[edge_functions]] blocks. */
  edgeFunctionPaths: string[]
}

/**
 * Parse both config files. Deliberately literal: comments are skipped, so a
 * path mentioned only in prose (as several now are, by design) is not treated
 * as a declaration.
 */
export function parseNetlifyConfig(redirectsText: string, tomlText: string): ParsedConfig {
  const redirectRules: string[] = []
  for (const rawLine of redirectsText.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const from = line.split(/\s+/)[0]
    if (from) redirectRules.push(from)
  }
  const catchAllIndex = redirectRules.indexOf('/*')

  // TOML: walk block headers so a `from`/`path` key is attributed to the block
  // it belongs to, rather than grepped globally.
  const tomlRedirects: string[] = []
  const edgeFunctionPaths: string[] = []
  let block: 'redirects' | 'edge_functions' | 'other' = 'other'
  for (const rawLine of tomlText.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith('#')) continue
    if (line.startsWith('[[') || line.startsWith('[')) {
      if (line.startsWith('[[redirects]]')) block = 'redirects'
      else if (line.startsWith('[[edge_functions]]')) block = 'edge_functions'
      else block = 'other'
      continue
    }
    const kv = line.match(/^(from|path)\s*=\s*"([^"]+)"/)
    if (!kv) continue
    if (block === 'redirects' && kv[1] === 'from') tomlRedirects.push(kv[2])
    if (block === 'edge_functions' && kv[1] === 'path') edgeFunctionPaths.push(kv[2])
  }

  return { redirectRules, catchAllIndex, tomlRedirects, edgeFunctionPaths }
}

/**
 * Return every `/bff/*` proxy path that the SPA catch-all outranks.
 * Empty array = every proxy seam is reachable.
 */
export function findUnreachableProxyPaths(redirectsText: string, tomlText: string): string[] {
  const { redirectRules, catchAllIndex, tomlRedirects, edgeFunctionPaths } = parseNetlifyConfig(
    redirectsText,
    tomlText,
  )

  // No catch-all ⇒ nothing is outranked by it.
  if (catchAllIndex === -1) return []

  const servedAboveCatchAll = new Set(redirectRules.slice(0, catchAllIndex))
  const servedByEdgeFunction = new Set(edgeFunctionPaths)

  const isReachable = (p: string) => servedAboveCatchAll.has(p) || servedByEdgeFunction.has(p)

  const unreachable: string[] = []

  // A netlify.toml redirect for a proxy path is unreachable unless the same
  // path is also declared above the catch-all or bound to an edge function.
  for (const p of tomlRedirects) {
    if (p.startsWith(PROXY_PREFIX) && !isReachable(p)) unreachable.push(p)
  }

  // A proxy rule sitting BELOW the catch-all in _redirects is equally dead.
  for (const p of redirectRules.slice(catchAllIndex + 1)) {
    if (p.startsWith(PROXY_PREFIX) && !servedByEdgeFunction.has(p)) unreachable.push(p)
  }

  return [...new Set(unreachable)]
}

// ── FROZEN HISTORICAL FIXTURE ────────────────────────────────────────────────
// The real configuration at commit cb957c8c, immediately before the 2.317 fix.
// PINNED — never regenerate this from the current files. Its whole job is to
// keep proving the detector can still see the defect that actually shipped.
const HISTORICAL_REDIRECTS_CB957C8C = `# BFF proxies (must come BEFORE SPA catch-all)
# Note: /bff/isl/* handled by edge function (isl-proxy.ts) for auth header injection
# Note: /bff/cee/* handled by netlify.toml redirect with header injection
/bff/engine/*  https://plot-lite-service-staging.onrender.com/:splat  200!

# Legacy engine proxy (VITE_EDGE_GATEWAY_URL=/engine uses this)
/engine/*      https://plot-lite-service-staging.onrender.com/:splat  200!

# Static routes
/poc           /poc.html                                               200
/fixtures/*    /fixtures/:splat                                        200

# SPA catch-all (MUST BE LAST - catches all unmatched routes)
/*             /index.html                                             200
`

const HISTORICAL_TOML_CB957C8C = `[[redirects]]
  from = "/bff/engine/*"
  to = "https://plot-lite-service-staging.onrender.com/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/bff/cee/*"
  to = "https://olumi-assistants-service.onrender.com/assist/v1/:splat"
  status = 200
  force = true
  headers = {X-Olumi-Assist-Key = "\${ASSIST_API_KEY}"}

[[edge_functions]]
  function = "csp-nonce"
  path = "/*"

[[edge_functions]]
  function = "isl-proxy"
  path = "/bff/isl/*"

[[edge_functions]]
  function = "orchestrator-proxy"
  path = "/bff/orchestrate/*"
`

describe('Netlify BFF route precedence', () => {
  it('POSITIVE CONTROL: flags the historical /bff/cee/* defect (frozen at cb957c8c)', () => {
    const unreachable = findUnreachableProxyPaths(
      HISTORICAL_REDIRECTS_CB957C8C,
      HISTORICAL_TOML_CB957C8C,
    )
    expect(unreachable).toContain('/bff/cee/*')
  })

  it('NEGATIVE CONTROL: a redirect above the catch-all is reachable', () => {
    // /bff/engine/* is declared above the catch-all in the historical file and
    // must NOT be flagged — the rule is about precedence, not about redirects.
    const unreachable = findUnreachableProxyPaths(
      HISTORICAL_REDIRECTS_CB957C8C,
      HISTORICAL_TOML_CB957C8C,
    )
    expect(unreachable).not.toContain('/bff/engine/*')
  })

  it('NEGATIVE CONTROL: a path bound to an edge function is reachable', () => {
    const redirects = '/*  /index.html  200\n'
    const toml = [
      '[[redirects]]',
      '  from = "/bff/thing/*"',
      '  to = "https://example.invalid/:splat"',
      '',
      '[[edge_functions]]',
      '  function = "thing-proxy"',
      '  path = "/bff/thing/*"',
      '',
    ].join('\n')
    expect(findUnreachableProxyPaths(redirects, toml)).toEqual([])
  })

  it('NEGATIVE CONTROL: a path named only in a comment is not treated as declared', () => {
    const redirects = '# /bff/ghost/* is discussed here but not declared\n/*  /index.html  200\n'
    const toml = '# [[redirects]]\n#   from = "/bff/ghost/*"\n'
    expect(findUnreachableProxyPaths(redirects, toml)).toEqual([])
  })

  it('flags a proxy rule that sits BELOW the catch-all', () => {
    const redirects = '/*  /index.html  200\n/bff/late/*  https://example.invalid/:splat  200!\n'
    expect(findUnreachableProxyPaths(redirects, '')).toContain('/bff/late/*')
  })

  it('REAL CONFIG: every /bff/* proxy seam at HEAD is reachable', () => {
    const redirectsText = readFileSync(REDIRECTS_PATH, 'utf8')
    const tomlText = readFileSync(TOML_PATH, 'utf8')
    expect(findUnreachableProxyPaths(redirectsText, tomlText)).toEqual([])
  })

  it('REAL CONFIG: /bff/cee/* is served by the cee-proxy edge function, targeting CEE staging', () => {
    const tomlText = readFileSync(TOML_PATH, 'utf8')
    const { edgeFunctionPaths } = parseNetlifyConfig('', tomlText)
    expect(edgeFunctionPaths).toContain('/bff/cee/*')

    const fn = readFileSync(join(REPO_ROOT, 'netlify/edge-functions/cee-proxy.ts'), 'utf8')
    // The seam must point at CEE staging, not at the differently-built host the
    // dead netlify.toml rules named.
    expect(fn).toContain("const CEE_TARGET = 'https://cee-staging.onrender.com'")
    expect(fn).not.toContain('olumi-assistants-service.onrender.com/assist')
  })

  it('CREDENTIAL BOUNDARY: no key VALUE is placed in anything served from public/', () => {
    // `_redirects` cannot inject request headers, so any seam needing a key
    // must be an edge function. If a key ever lands under public/ it is, by
    // construction, browser-fetchable.
    //
    // What counts as an offence is a key VALUE arriving — a Netlify
    // `${…_API_KEY}` interpolation (exactly the mechanism the dead netlify.toml
    // rules used) or a literal auth-header assignment. A bare MENTION of a var
    // name in a comment is not an offence: this repo has twice reddened CI over
    // a token that existed only in a comment (#385, #386), and the `_redirects`
    // header block deliberately names these vars in prose to say where the keys
    // do live. Comments are therefore stripped before scanning.
    const KEY_VALUE_PATTERNS = [
      /\$\{[A-Z0-9_]*API_KEY\}/,          // ${ASSIST_API_KEY} interpolation
      /X-Olumi-Assist-Key\s*[=:]/i,       // header assignment
      /\bx-api-key\s*[=:]/i,
      /\bAuthorization\s*[=:]\s*["']?Bearer\s+\S/i,
    ]
    const stripHashComments = (text: string) =>
      text
        .split('\n')
        .filter((l) => !l.trim().startsWith('#'))
        .join('\n')

    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        // Only text-ish config/markup files; skip binaries and bundles.
        if (!/\.(txt|json|toml|html|js|ts|md)$/.test(name) && name !== '_redirects') continue
        const text = stripHashComments(readFileSync(full, 'utf8'))
        if (KEY_VALUE_PATTERNS.some((re) => re.test(text))) {
          offenders.push(full.replace(REPO_ROOT + '/', ''))
        }
      }
    }
    walk(join(REPO_ROOT, 'public'))
    expect(offenders).toEqual([])
  })

  it('CREDENTIAL BOUNDARY control: the detector sees a key placed in a _redirects rule', () => {
    // Positive control for the assertion above — without it, "no key under
    // public/" could pass by testing nothing.
    const rule = '/bff/cee/*  https://cee-staging.onrender.com/assist/v1/:splat  200!  X-Olumi-Assist-Key=${ASSIST_API_KEY}'
    expect(/\$\{[A-Z0-9_]*API_KEY\}/.test(rule)).toBe(true)
    // …and that a comment-only mention does NOT trip it.
    const commentOnly = '# the key lives in ASSIST_API_KEY, injected by cee-proxy.ts'
    const stripped = commentOnly
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n')
    expect(/\$\{[A-Z0-9_]*API_KEY\}/.test(stripped)).toBe(false)
  })
})
