/**
 * PLoT proxy path allowlist — DERIVED FROM THE CALL SITES, NOT HAND-MAINTAINED.
 *
 * WHAT THIS GUARDS
 * ----------------
 * `netlify/edge-functions/plot-proxy.ts` injects PLoT's bearer server-side and now
 * bounds the routes it will do that for (`ALLOWED_TARGETS`). That list has to be a
 * literal inside the edge function — it runs standalone in Deno and cannot import
 * from `src/` — which makes it exactly the artefact this estate keeps paying for: a
 * hand-maintained mirror of something that moves, whose drift always reads as green.
 *
 * So the LIST lives in the edge function and the DERIVATION lives here. Every CI
 * run re-derives the browser→PLoT call sites from `src/` and compares.
 *
 * BOTH DIRECTIONS, DELIBERATELY
 * -----------------------------
 *   · allowlist ⊇ derived — a new PLoT call site nobody allowed fails CI LOUDLY,
 *     instead of 404-ing users at our own edge and being misread as PLoT being down.
 *   · derived ⊇ allowlist — an entry whose caller has been deleted fails CI too, so
 *     the seam narrows again when the UI narrows.
 *
 * The second direction is the one that is easy to skip and the one trap 12d is
 * about: a guard that only checks the first proves the two copies AGREE and can
 * never notice the list is too WIDE. Agreement is not correctness.
 *
 * UNRESOLVED CALL SITES ARE A FAILURE, NOT A GAP
 * ----------------------------------------------
 * A scanner that silently skips an argument shape it cannot read is an absence
 * probe with no positive control — it returns the same clean output whether it
 * looked and found nothing or could not look at all. Any `plotFetch(` whose target
 * path this file cannot resolve is therefore listed and RED. Resolve it, or state
 * it in EXPECTED_UNRESOLVED with a reason and a hand-derived path.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve as resolvePath, relative } from 'node:path'
import { stripComments } from '../helpers/stripSourceComments'

const REPO = resolvePath(__dirname, '../..')
const SRC = resolvePath(REPO, 'src')
const PROXY = resolvePath(REPO, 'netlify/edge-functions/plot-proxy.ts')

/** The mount prefixes the edge function serves, longest first (mirrors MOUNTS). */
const MOUNT_PREFIXES = ['/bff/engine', '/engine']

/**
 * Identifiers known to hold a PLoT proxy base. Each is a `VITE_x || '/bff/engine'`
 * binding or the shared `plotProxyBase` export — verified at the sites below. A
 * template whose head is one of these has a PLoT path as its tail.
 */
const BASE_IDENTIFIERS = new Set([
  'base',
  'resolvedBase',
  'resolvedBaseUrl',
  'BFF_BASE_URL',
  'proxyBase',
  'plotProxyBase',
  'draftBase',
])

/**
 * The concrete segment substituted for a `${…}` interpolation inside a path, so a
 * dynamic route can be tested against the anchored regexes. Deliberately contains
 * no slash: a dynamic segment must not be able to cross a path boundary, and if the
 * allowlist ever admits one that can, this sample will not be what reveals it —
 * the traversal cases in `plot-proxy-allowlist.spec.ts` are.
 */
const DYNAMIC_SAMPLE = 'SAMPLE'

/**
 * `plotFetch` call sites whose first argument is not statically resolvable here,
 * with the path derived BY HAND and the reason. Kept explicit so the set can only
 * grow by a deliberate edit — an empty-by-default skip list would hide drift.
 */
const EXPECTED_UNRESOLVED: Record<string, string> = {
  // `for (const u of urls)` — a loop variable over an array literal one line above
  // (`const urls = [`${proxyBase}/v1/health`]`). Resolving loop bindings would need
  // a real parser; the array element itself IS collected by the literal scan below,
  // so the path is covered and only the argument identifier is unresolved.
  'src/poc/SafeMode.tsx': '/v1/health',
}

interface CallSite {
  file: string
  line: number
  raw: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(full) && !/\.(spec|test)\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

/**
 * Extract the FIRST argument of a call starting at `open` (the index of `(`),
 * respecting nesting and template literals.
 *
 * ⚠ A `[^,)]+` REGEX IS NOT ENOUGH HERE, and getting this wrong is silent. It
 * truncates `` `${base}/v1/templates/${encodeURIComponent(id)}/graph` `` at the
 * paren inside `encodeURIComponent(`, yielding an unparseable fragment that then
 * fails to resolve — which reads identically to "this route has no caller" and
 * would have deleted a live entry from the allowlist.
 */
function firstArgument(code: string, open: number): string {
  let depth = 0
  let i = open
  let inTemplate = false
  for (; i < code.length; i++) {
    const c = code[i]
    if (c === '`') inTemplate = !inTemplate
    else if (!inTemplate && (c === '(' || c === '[' || c === '{')) depth++
    else if (!inTemplate && (c === ')' || c === ']' || c === '}')) {
      depth--
      if (depth === 0) break
    } else if (!inTemplate && c === ',' && depth === 1) break
    // A `${` inside a template opens a nesting level the template flag hides;
    // tracked implicitly because we only break on depth-1 commas outside one.
  }
  return code.slice(open + 1, i).trim()
}

/** Every `plotFetch(<arg>` in src/, with its first argument text. */
function collectCallSites(): CallSite[] {
  const sites: CallSite[] = []
  for (const file of walk(SRC)) {
    if (file.endsWith('lib/plotFetch.ts')) continue // the wrapper itself
    const code = stripComments(readFileSync(file, 'utf8'), file)
    if (!code.includes('plotFetch(')) continue
    const re = /(?<![\w.$])plotFetch\s*\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(code)) !== null) {
      const open = m.index + m[0].length - 1
      sites.push({
        file: relative(REPO, file),
        line: code.slice(0, m.index).split('\n').length,
        raw: firstArgument(code, open),
      })
    }
  }
  return sites
}

/** Strip a mount prefix if present; return null if the path is not PLoT-mounted. */
function stripMount(path: string): string | null {
  for (const mount of MOUNT_PREFIXES) {
    if (path === mount) return ''
    if (path.startsWith(`${mount}/`)) return path.slice(mount.length)
  }
  return null
}

/**
 * Resolve one argument expression to a target path, using in-file bindings.
 * Returns null when it cannot be resolved.
 *
 * `atLine` is the call site's line, and it is load-bearing: an identifier binding
 * must be resolved to the NEAREST PRECEDING one, never the first in the file.
 * `http.ts` binds `const endpoint = …` three times — `/v1/run`, `/v1/validate`,
 * `/v1/run_bundle` — so a first-match resolver reported all three call sites as
 * `/v1/run` and then declared the other two allowlist entries orphaned. It would
 * have removed two live routes while every assertion stayed green about the third.
 */
function resolveArg(arg: string, fileCode: string, atLine: number): string | null {
  // `'/bff/engine/v1/diff'` — a plain literal.
  const literal = /^['"`]([^'"`$]+)['"`]$/.exec(arg)
  if (literal) return stripMount(literal[1]) ?? (literal[1].startsWith('/') ? literal[1] : null)

  // `` `${base}/v1/limits` `` — a template whose head is a known base identifier.
  const tmpl = /^`\$\{([^}]+)\}([\s\S]*)`$/.exec(arg)
  if (tmpl) {
    const head = tmpl[1].trim()
    const tail = tmpl[2]
    if (!BASE_IDENTIFIERS.has(head)) return null
    return tail.replace(/\$\{[^}]*\}/g, DYNAMIC_SAMPLE)
  }

  // A bare identifier — follow the nearest binding ABOVE the call site.
  if (/^[A-Za-z_$][\w$]*$/.test(arg)) {
    const re = new RegExp(`\\b(?:const|let|var)\\s+${arg}\\s*=\\s*([^\\n]+)`, 'g')
    let best: string | null = null
    let m: RegExpExecArray | null
    while ((m = re.exec(fileCode)) !== null) {
      const line = fileCode.slice(0, m.index).split('\n').length
      if (line <= atLine) best = m[1].trim().replace(/[,;]\s*$/, '')
      else break
    }
    if (best !== null && best !== arg) return resolveArg(best, fileCode, atLine)
  }
  return null
}

/** Read `ALLOWED_TARGETS` out of the edge function as live regexes. */
function readAllowlist(): RegExp[] {
  const code = readFileSync(PROXY, 'utf8')
  // ⚠ TERMINATED ON A LINE-START `]`, NOT THE FIRST `]`. A non-greedy `[\s\S]*?\]`
  // stops inside `[^/]+` — the character class in the dynamic-segment entries — and
  // silently returns a TRUNCATED list. That read as "these routes are not allowed"
  // and failed the coverage assertions for the right-looking wrong reason.
  const block = /const ALLOWED_TARGETS:[^=]*=\s*\[\n([\s\S]*?)\n\]/.exec(code)
  if (!block) throw new Error('ALLOWED_TARGETS not found in plot-proxy.ts')
  const entries = block[1].match(/\/\^[^\n,]*\$\//g) ?? []
  return entries.map((src) => {
    const body = src.slice(1, -1)
    return new RegExp(body)
  })
}

describe('plot-proxy allowlist is derived from the browser→PLoT call sites', () => {
  const fileCache = new Map<string, string>()
  const readCode = (rel: string) => {
    if (!fileCache.has(rel)) {
      const abs = resolvePath(REPO, rel)
      fileCache.set(rel, stripComments(readFileSync(abs, 'utf8'), abs))
    }
    return fileCache.get(rel)!
  }

  const sites = collectCallSites()
  const allowlist = readAllowlist()

  const resolved: { site: CallSite; path: string }[] = []
  const unresolved: CallSite[] = []
  for (const site of sites) {
    const path = resolveArg(site.raw, readCode(site.file), site.line)
    if (path === null) unresolved.push(site)
    else resolved.push({ site, path })
  }

  // The CEE draft seam composes its base and endpoint separately, so it is not a
  // `plotFetch` template. Derived from client.ts by identity on both halves.
  const CEE_CLIENT = 'src/adapters/cee/client.ts'
  const ceeCode = readCode(CEE_CLIENT)

  it('CONTROL: the scanner sees a plausible number of call sites', () => {
    // trap 13e — a positive control must be checked for MAGNITUDE, not just sign.
    // A scanner that found two call sites would satisfy every assertion below while
    // being blind to the rest of the surface.
    expect(sites.length).toBeGreaterThanOrEqual(18)
    expect(resolved.length).toBeGreaterThanOrEqual(17)
  })

  it('CONTROL: the allowlist was actually parsed out of the edge function', () => {
    expect(allowlist.length).toBeGreaterThanOrEqual(15)
    // Bound by identity to a route that must always be there, so a parse returning
    // junk regexes cannot pass.
    expect(allowlist.some((re) => re.test('/v2/run'))).toBe(true)
  })

  it('every plotFetch call site resolves to a target path', () => {
    const shown = unresolved
      .filter((s) => EXPECTED_UNRESOLVED[s.file] === undefined)
      .map((s) => `${s.file}:${s.line} → ${s.raw}`)
    expect(shown).toEqual([])
  })

  it('ALLOWLIST ⊇ DERIVED: no browser→PLoT call site is blocked at our own edge', () => {
    const blocked = resolved
      .filter(({ path }) => !allowlist.some((re) => re.test(path)))
      .map(({ site, path }) => `${path}  (${site.file}:${site.line})`)

    // Plus the hand-derived paths for the unresolved sites.
    for (const [file, path] of Object.entries(EXPECTED_UNRESOLVED)) {
      if (!allowlist.some((re) => re.test(path))) blocked.push(`${path}  (${file}, hand-derived)`)
    }

    expect(blocked).toEqual([])
  })

  it('DERIVED ⊇ ALLOWLIST: no allowlist entry outlives its caller', () => {
    const derivedPaths = [...resolved.map((r) => r.path), ...Object.values(EXPECTED_UNRESOLVED)]
    // The CEE draft route, composed rather than fetched through a template.
    derivedPaths.push('/v1/cee/draft-graph')

    const orphaned = allowlist
      .filter((re) => !derivedPaths.some((p) => re.test(p)))
      .map((re) => re.source)

    expect(orphaned).toEqual([])
  })

  it('the CEE draft seam still composes to the allowed same-origin route', () => {
    // Identity-bound to both halves in client.ts, so this cannot pass on some other
    // constant that happens to look similar.
    expect(ceeCode).toContain("const CEE_DRAFT_ENGINE_BASE = '/bff/engine/v1/cee'")
    expect(ceeCode).toContain("const endpoint = '/draft-graph?schema=v3'")

    // The composed URL, minus its query, is on the list.
    const composed = '/bff/engine/v1/cee' + '/draft-graph'
    const target = stripMount(composed)
    expect(target).toBe('/v1/cee/draft-graph')
    expect(allowlist.some((re) => re.test(target!))).toBe(true)
  })

  it('CONTRAST CONTROL: routes the UI does not call are NOT on the list', () => {
    // Proves the list is a bound and not a rubber stamp. If any of these ever
    // passes, the allowlist has acquired a wildcard and stopped narrowing anything
    // — the exact failure isl-proxy.ts:81-89 records making.
    for (const off of [
      '/v1/admin/secrets',
      '/v1/run/../../admin',
      '/v2/run/extra',
      '/v1/templates/abc/graph/extra',
      '/',
      '/v1',
    ]) {
      expect(allowlist.some((re) => re.test(off))).toBe(false)
    }
  })
})
