/**
 * Netlify CEE/BFF route-configuration guard — ROADMAP 2.317.
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
 * ── SCOPE: THE ORIGINAL DEFECT HAD TWO HALVES, AND THIS GUARD COVERS BOTH ───
 * The shipped rules were wrong twice over, and an earlier revision of this file
 * caught only the first half — a review found two mutants that stayed GREEN
 * against it. Both are now controls below.
 *
 *   HALF 1 — PRECEDENCE. A proxy path must be served by a mechanism that
 *   OUTRANKS the `_redirects` catch-all: declared in `public/_redirects` ABOVE
 *   the catch-all, or bound to an `[[edge_functions]]` path. Enforced for
 *   `/bff/*` AND `/v1/cee/*` — the dead `/v1/cee/*` rule was the second of the
 *   two shipped rules and must not be re-addable unnoticed.
 *
 *   HALF 2 — TARGET. Both dead rules also named
 *   `olumi-assistants-service.onrender.com` (version 1.11.1 / `50fea04`) rather
 *   than CEE staging (1.12.0 / `7f57602`, the exact tip of the CEE `staging`
 *   branch). So a rule can be perfectly reachable and still wrong. Every
 *   CEE-family redirect must target `https://cee-staging.onrender.com`.
 *   This is an ALLOW-list (must equal the one correct host), not a deny-list of
 *   known-bad hosts — a deny-list is a hand-maintained mirror and would go
 *   stale the first time someone invents a new wrong host.
 *
 * IT ALSO PINS THE CREDENTIAL BOUNDARY. `_redirects` cannot inject request
 * headers, so a seam needing an auth header must be an edge function, never a
 * redirect — otherwise the key ends up in a file the browser can fetch. The
 * credential tests assert no key VALUE appears anywhere under `public/`, and
 * that `cee-proxy` enforces the same method set it advertises (it injects a
 * credential on every forwarded request).
 *
 * WHAT IT DOES NOT COVER, STATED SO NOBODY OVER-READS IT: it is a static read
 * of two config files plus one source file. It cannot prove the deployed host
 * actually answers, that `/assist/v1` is the prefix CEE expects, or that
 * `ASSIST_API_KEY` is provisioned. Those need the live post-merge probe in the
 * PR body.
 *
 * CONTROLS (run every CI pass, not once by hand):
 *   · POSITIVE — the ACTUAL pre-fix configuration, frozen below as a fixture,
 *     MUST be flagged, on BOTH halves and BOTH rules. It is pinned to the
 *     historical artefact at commit cb957c8c and MUST NOT be updated to track
 *     the current files: a control whose reference is "whatever is deployed
 *     now" decays into a tautology the first time "now" changes. If this
 *     fixture ever stops being flagged, the detector has been hollowed out.
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
const CEE_PROXY_PATH = join(REPO_ROOT, 'netlify/edge-functions/cee-proxy.ts')

/** Path families that are same-origin proxy seams we must keep reachable. */
const PROXY_PATH_PREFIXES = ['/bff/', '/v1/cee']

/** Path families that must reach CEE, and nothing else. */
const CEE_PATH_PREFIXES = ['/bff/cee', '/v1/cee']

/** The one correct CEE origin. Allow-list, deliberately not a deny-list. */
const CEE_STAGING_ORIGIN = 'https://cee-staging.onrender.com'

const isProxyPath = (p: string) => PROXY_PATH_PREFIXES.some((pre) => p.startsWith(pre))
const isCeePath = (p: string) => CEE_PATH_PREFIXES.some((pre) => p.startsWith(pre))

interface RedirectRule {
  from: string
  to: string
}

interface ParsedConfig {
  /** Rules in public/_redirects, in file order. */
  redirectRules: RedirectRule[]
  /** Index of the SPA catch-all in `redirectRules`; -1 if absent. */
  catchAllIndex: number
  /** netlify.toml [[redirects]] blocks. */
  tomlRedirects: RedirectRule[]
  /** `path` values of netlify.toml [[edge_functions]] blocks. */
  edgeFunctionPaths: string[]
}

/**
 * Parse both config files. Deliberately literal: comments are skipped, so a
 * path mentioned only in prose (as several now are, by design) is not treated
 * as a declaration.
 */
export function parseNetlifyConfig(redirectsText: string, tomlText: string): ParsedConfig {
  const redirectRules: RedirectRule[] = []
  for (const rawLine of redirectsText.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const parts = line.split(/\s+/)
    if (parts[0]) redirectRules.push({ from: parts[0], to: parts[1] ?? '' })
  }
  const catchAllIndex = redirectRules.findIndex((r) => r.from === '/*')

  // TOML: walk block headers so a `from`/`to`/`path` key is attributed to the
  // block it belongs to, rather than grepped globally.
  const tomlRedirects: RedirectRule[] = []
  const edgeFunctionPaths: string[] = []
  let block: 'redirects' | 'edge_functions' | 'other' = 'other'
  let pending: Partial<RedirectRule> = {}
  const flush = () => {
    if (pending.from !== undefined) tomlRedirects.push({ from: pending.from, to: pending.to ?? '' })
    pending = {}
  }
  for (const rawLine of tomlText.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith('#')) continue
    if (line.startsWith('[[') || line.startsWith('[')) {
      flush()
      if (line.startsWith('[[redirects]]')) block = 'redirects'
      else if (line.startsWith('[[edge_functions]]')) block = 'edge_functions'
      else block = 'other'
      continue
    }
    const kv = line.match(/^(from|to|path)\s*=\s*"([^"]+)"/)
    if (!kv) continue
    if (block === 'redirects' && kv[1] === 'from') pending.from = kv[2]
    if (block === 'redirects' && kv[1] === 'to') pending.to = kv[2]
    if (block === 'edge_functions' && kv[1] === 'path') edgeFunctionPaths.push(kv[2])
  }
  flush()

  return { redirectRules, catchAllIndex, tomlRedirects, edgeFunctionPaths }
}

/**
 * HALF 1 — every proxy path the SPA catch-all outranks.
 * Empty array = every proxy seam is reachable.
 */
export function findUnreachableProxyPaths(redirectsText: string, tomlText: string): string[] {
  const { redirectRules, catchAllIndex, tomlRedirects, edgeFunctionPaths } = parseNetlifyConfig(
    redirectsText,
    tomlText,
  )

  // No catch-all ⇒ nothing is outranked by it.
  if (catchAllIndex === -1) return []

  const servedAboveCatchAll = new Set(redirectRules.slice(0, catchAllIndex).map((r) => r.from))
  const servedByEdgeFunction = new Set(edgeFunctionPaths)

  const isReachable = (p: string) => servedAboveCatchAll.has(p) || servedByEdgeFunction.has(p)

  const unreachable: string[] = []

  // A netlify.toml redirect for a proxy path is unreachable unless the same
  // path is also declared above the catch-all or bound to an edge function.
  for (const { from } of tomlRedirects) {
    if (isProxyPath(from) && !isReachable(from)) unreachable.push(from)
  }

  // A proxy rule sitting BELOW the catch-all in _redirects is equally dead.
  for (const { from } of redirectRules.slice(catchAllIndex + 1)) {
    if (isProxyPath(from) && !servedByEdgeFunction.has(from)) unreachable.push(from)
  }

  return [...new Set(unreachable)]
}

/**
 * HALF 2 — every CEE-family redirect whose target is not CEE staging.
 * A reachable rule pointed at the wrong host is still a defect.
 */
export function findWrongHostCeeRules(redirectsText: string, tomlText: string): string[] {
  const { redirectRules, tomlRedirects } = parseNetlifyConfig(redirectsText, tomlText)
  const offenders: string[] = []
  for (const { from, to } of [...redirectRules, ...tomlRedirects]) {
    if (!isCeePath(from)) continue
    // A relative target (e.g. an internal rewrite) is not a host claim.
    if (!/^https?:\/\//.test(to)) continue
    if (!to.startsWith(CEE_STAGING_ORIGIN + '/') && to !== CEE_STAGING_ORIGIN) {
      offenders.push(`${from} -> ${to}`)
    }
  }
  return offenders
}

/** Both halves, for the real-config assertion. */
export function findProxyConfigDefects(redirectsText: string, tomlText: string): string[] {
  return [
    ...findUnreachableProxyPaths(redirectsText, tomlText),
    ...findWrongHostCeeRules(redirectsText, tomlText),
  ]
}

// ── FROZEN HISTORICAL FIXTURE ────────────────────────────────────────────────
// The real configuration at commit cb957c8c, immediately before the 2.317 fix,
// including BOTH shipped CEE rules. PINNED — never regenerate this from the
// current files. Its whole job is to keep proving the detector can still see
// the defect that actually shipped.
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

# CEE (Assistants) Service - graph-readiness endpoint
[[redirects]]
  from = "/bff/cee/*"
  to = "https://olumi-assistants-service.onrender.com/assist/v1/:splat"
  status = 200
  force = true
  headers = {X-Olumi-Assist-Key = "\${ASSIST_API_KEY}"}

# CEE fallback route for /v1/cee/* path pattern
[[redirects]]
  from = "/v1/cee/*"
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

describe('Netlify CEE/BFF route configuration', () => {
  it('POSITIVE CONTROL: flags BOTH historical CEE rules as unreachable (frozen at cb957c8c)', () => {
    const unreachable = findUnreachableProxyPaths(
      HISTORICAL_REDIRECTS_CB957C8C,
      HISTORICAL_TOML_CB957C8C,
    )
    expect(unreachable).toContain('/bff/cee/*')
    // The second shipped rule — a review mutant proved an earlier revision of
    // this guard let it back in unnoticed.
    expect(unreachable).toContain('/v1/cee/*')
  })

  it('POSITIVE CONTROL: flags BOTH historical CEE rules as wrong-host (frozen at cb957c8c)', () => {
    const wrongHost = findWrongHostCeeRules(
      HISTORICAL_REDIRECTS_CB957C8C,
      HISTORICAL_TOML_CB957C8C,
    )
    expect(wrongHost).toHaveLength(2)
    expect(wrongHost.join('\n')).toContain('olumi-assistants-service.onrender.com')
  })

  it('POSITIVE CONTROL: a REACHABLE CEE redirect pointed at the wrong host is still flagged', () => {
    // The review mutant that stayed green against the precedence-only guard:
    // correct precedence, wrong target.
    const redirects = [
      '/bff/cee/*  https://olumi-assistants-service.onrender.com/assist/v1/:splat  200!',
      '/*          /index.html                                                     200',
      '',
    ].join('\n')
    expect(findUnreachableProxyPaths(redirects, '')).toEqual([])
    expect(findWrongHostCeeRules(redirects, '')).toEqual([
      '/bff/cee/* -> https://olumi-assistants-service.onrender.com/assist/v1/:splat',
    ])
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

  it('NEGATIVE CONTROL: a non-CEE seam is not subject to the CEE host rule', () => {
    // PLoT is a different service; its host must not be forced to CEE staging.
    const wrongHost = findWrongHostCeeRules(
      HISTORICAL_REDIRECTS_CB957C8C,
      HISTORICAL_TOML_CB957C8C,
    )
    expect(wrongHost.join('\n')).not.toContain('/bff/engine/*')
    expect(wrongHost.join('\n')).not.toContain('plot-lite-service-staging')
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
    expect(findProxyConfigDefects(redirects, toml)).toEqual([])
  })

  it('flags a proxy rule that sits BELOW the catch-all', () => {
    const redirects = '/*  /index.html  200\n/bff/late/*  https://example.invalid/:splat  200!\n'
    expect(findUnreachableProxyPaths(redirects, '')).toContain('/bff/late/*')
  })

  it('REAL CONFIG: no proxy seam at HEAD is unreachable or wrongly targeted', () => {
    const redirectsText = readFileSync(REDIRECTS_PATH, 'utf8')
    const tomlText = readFileSync(TOML_PATH, 'utf8')
    expect(findProxyConfigDefects(redirectsText, tomlText)).toEqual([])
  })

  it('REAL CONFIG: /bff/cee/* is served by the cee-proxy edge function, targeting CEE staging', () => {
    const tomlText = readFileSync(TOML_PATH, 'utf8')
    const { edgeFunctionPaths } = parseNetlifyConfig('', tomlText)
    expect(edgeFunctionPaths).toContain('/bff/cee/*')

    const fn = readFileSync(CEE_PROXY_PATH, 'utf8')
    // The seam must point at CEE staging, not at the differently-built host the
    // dead netlify.toml rules named.
    expect(fn).toContain(`const CEE_TARGET = '${CEE_STAGING_ORIGIN}'`)
    expect(fn).not.toContain('olumi-assistants-service.onrender.com/assist')
  })

  it('REAL CONFIG: cee-proxy enforces the same method set it advertises', () => {
    // It injects a caller-auth credential on every forwarded request, so an
    // unrestricted verb set would hand an authenticated PUT/DELETE to CEE.
    // isl-proxy has exactly that gap; this pins that cee-proxy does not.
    const fn = readFileSync(CEE_PROXY_PATH, 'utf8')
    expect(fn).toContain("const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'] as const")
    // Enforced…
    expect(fn).toMatch(/ALLOWED_METHODS as readonly string\[\]\)\.includes\(request\.method\)/)
    expect(fn).toContain('status: 405')
    // …and advertised from the SAME constant, so the two cannot drift apart.
    expect(fn).toContain("'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', ')")
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
