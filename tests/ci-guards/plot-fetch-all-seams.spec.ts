/**
 * plotFetch SEAM guard — the tenth-seam preventer.
 *
 * THE DEFECT CLASS. PLoT's staging auth flip Bearer-gates the plain Netlify
 * pass-through `/bff/engine/*` (netlify.toml: `/bff/engine/*` →
 * plot-lite-service-staging, no header injection). Any browser `fetch` that hits
 * a PLoT base without the token starts 401-ing the instant the flip lands. PR
 * #428 wired the Bearer into the two CEE-family seams; this change routes every
 * OTHER PLoT-direct seam through `src/lib/plotFetch.ts`, which merges
 * `plotAuthHeaders()` for all of them at once. The residual risk is the ELEVENTH
 * hand: a new hook, copy-pasted from `useRecommendation` / `usePareto` /
 * `useEdgeFunctionSuggestion`, that writes `fetch('/bff/engine/v1/…')` or
 * `fetch(\`${BFF_BASE_URL}/…\`)` and silently sends no header again. Nothing in
 * TypeScript or ESLint objects. This guard does.
 *
 * WHAT IT FLAGS. A bare `fetch(` (not `plotFetch(`, not `.fetch(`, not
 * `deduplicatedFetch(`) in src/ whose FIRST argument — the URL — references a
 * PLoT base:
 *   · a literal PLoT path/host  (`/bff/engine`, `plot-lite-service`), or
 *   · a PLoT base env token      (`VITE_PLOT_PROXY_BASE`, `VITE_BFF_BASE`), or
 *   · an identifier bound to one of those in the same file (`BFF_BASE_URL`,
 *     `proxyBase`, `PARETO_ENDPOINT = '/bff/engine/…'`), or the shared
 *     `plotProxyBase` export from lib/config.
 * It deliberately does NOT flag other-service seams (`/bff/cee`, `/bff/assist`,
 * `/bff/isl`, `/bff/orchestrate`), Supabase `/functions/v1/*`, the POC edge
 * gateway, or static-asset fetches — those are not PLoT and the flip does not
 * touch them. The URL check is on the FIRST argument only, so a `/bff/engine`
 * string sitting in a request BODY does not trip it.
 *
 * WHY A SOURCE SCAN, AND WHY COMMENT-STRIPPED. The seam is a coding convention
 * ("reach PLoT only through plotFetch"), and a convention is enforced by reading
 * the source. Comments are stripped FIRST, via the shared literal-aware
 * `stripComments` (tests/helpers/stripSourceComments) — the same stripper the
 * alpha-emission guard uses — because this repo's dominant guard footgun (#385,
 * #386) is a source-scanning guard reddening CI over a token that lives only in
 * a comment or a documentation example. A `fetch('/bff/engine/…')` written in a
 * JSDoc block ships nothing and must not fail CI; the comment-strip control at
 * the foot of this file pins that, and it is the guard's own mutation check that
 * the stripper is actually wired in.
 *
 * CONTROLS (run every CI pass, not once by hand):
 *   · POSITIVE — an injected bare `fetch('/bff/engine/…')` and a
 *     `fetch(\`${BASE}/…\`)` (BASE bound to a PLoT token) in a scratch file MUST
 *     be flagged, proving the scanner can see a violation at all.
 *   · NEGATIVE — the SAME calls rewritten as `plotFetch(…)`, a genuinely
 *     non-PLoT `fetch('/bff/assist/…')`, and a `fetch('/version.json')` must NOT
 *     be flagged, proving the scanner is PLoT-scoped and plotFetch-aware rather
 *     than a blunt "no fetch anywhere" rule.
 *   · COMMENT — a `fetch('/bff/engine/…')` that exists ONLY inside a `//` and a
 *     `/* *\/` comment must NOT be flagged (the #385/#386 footgun).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { tmpdir } from 'node:os'
import { stripComments } from '../helpers/stripSourceComments'

const SRC = resolvePath(__dirname, '../../src')

/** The one sanctioned bare-`fetch` seam — the wrapper itself. */
const WRAPPER = resolvePath(SRC, 'lib/plotFetch.ts')

/** Literal PLoT base markers that may appear directly in a fetch URL argument. */
const PLOT_LITERAL = /\/bff\/engine|plot-lite-service|VITE_PLOT_PROXY_BASE|VITE_BFF_BASE/

/** The shared PLoT base export from lib/config — always a base identifier. */
const KNOWN_BASE_NAMES = ['plotProxyBase']

/** A bare `fetch(` — not `.fetch(`, `refetch(`, `plotFetch(`, `deduplicatedFetch(`. */
const BARE_FETCH = /(?<![\w.$])fetch\s*\(/g

/** `const|let|var NAME = <initialiser up to end-of-line>` — for base discovery. */
const BINDING = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n]*)/g

interface Violation {
  file: string
  line: number
  snippet: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(p) && !/\.(spec|test)\.tsx?$/.test(p) && !/\.d\.ts$/.test(p)) {
      out.push(p)
    }
  }
  return out
}

/**
 * The first-argument expression of a `fetch(` call, extracted by balancing
 * `()[]{}` and skipping `'`/`"`/`` ` `` literals (template `${…}` interpolations
 * are followed so a comma inside one does not end the argument). `open` points at
 * the `(` immediately after `fetch`.
 */
function firstArg(src: string, open: number): string {
  let i = open + 1
  const start = i
  let depth = 1
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === "'" || c === '"') {
      const quote = c
      i++
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (c === '`') {
      i++
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === '$' && src[i + 1] === '{') {
          let braces = 1
          i += 2
          while (i < n && braces > 0) {
            if (src[i] === '{') braces++
            else if (src[i] === '}') braces--
            i++
          }
          continue
        }
        i++
      }
      i++
      continue
    }
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue }
    if (c === ')' || c === ']' || c === '}') {
      depth--
      if (depth === 0) return src.slice(start, i)
      i++
      continue
    }
    if (c === ',' && depth === 1) return src.slice(start, i)
    i++
  }
  return src.slice(start, i)
}

/** Every PLoT-direct bare `fetch(` in `root` that does NOT go through plotFetch. */
function plotViolations(root: string = SRC): Violation[] {
  const violations: Violation[] = []
  for (const file of walk(root)) {
    if (resolvePath(file) === WRAPPER) continue
    const raw = readFileSync(file, 'utf8')
    const text = stripComments(raw, file)

    // Base identifiers bound to a PLoT token IN THIS FILE, plus the shared export.
    const bases = new Set<string>(KNOWN_BASE_NAMES)
    for (const m of text.matchAll(BINDING)) {
      if (PLOT_LITERAL.test(m[2])) bases.add(m[1])
    }
    const basePattern = bases.size
      ? new RegExp(`\\b(?:${[...bases].map((b) => b.replace(/[$]/g, '\\$&')).join('|')})\\b`)
      : null

    for (const m of text.matchAll(BARE_FETCH)) {
      const arg = firstArg(text, m.index! + m[0].length - 1)
      const hitsLiteral = PLOT_LITERAL.test(arg)
      const hitsBase = basePattern ? basePattern.test(arg) : false
      if (hitsLiteral || hitsBase) {
        const line = text.slice(0, m.index!).split('\n').length
        violations.push({
          file: file.slice(root.length + 1),
          line,
          snippet: raw.split('\n')[line - 1]?.trim() ?? '',
        })
      }
    }
  }
  return violations
}

describe('every PLoT-direct fetch seam goes through plotFetch', () => {
  it('src/ contains no bare fetch() to a PLoT base outside the plotFetch wrapper', () => {
    const violations = plotViolations()
    expect(
      violations,
      violations.length
        ? `these bare fetch() calls hit a PLoT base (/bff/engine, VITE_PLOT_PROXY_BASE, ` +
            `VITE_BFF_BASE, plot-lite-service) without the env-injected Bearer, so they will ` +
            `401 the moment PLoT's auth flip lands. Route each through src/lib/plotFetch.ts ` +
            `(a mechanical fetch( → plotFetch( rename plus the import):\n` +
            violations.map((v) => `  ${v.file}:${v.line}  ${v.snippet}`).join('\n')
        : '',
    ).toEqual([])
  })

  it('POSITIVE + NEGATIVE controls: the scanner sees a real violation and clears a migrated one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plot-fetch-guard-'))
    try {
      // POSITIVE — a literal PLoT path and a base-bound template, both un-migrated.
      writeFileSync(
        join(dir, 'offender-literal.ts'),
        `export const go = () => fetch('/bff/engine/v1/analysis/new-thing', { method: 'POST' })\n`,
      )
      writeFileSync(
        join(dir, 'offender-base.ts'),
        `const BFF_BASE_URL = import.meta.env.VITE_BFF_BASE || '/bff/engine'\n` +
          `export const go = () => fetch(\`\${BFF_BASE_URL}/v1/x\`, { method: 'POST' })\n`,
      )
      writeFileSync(
        join(dir, 'offender-shared-base.ts'),
        `import { plotProxyBase } from '../../../lib/config'\n` +
          `export const go = () => fetch(\`\${plotProxyBase}/v1/x\`)\n`,
      )
      // NEGATIVE — migrated (plotFetch), and genuinely non-PLoT fetches.
      writeFileSync(
        join(dir, 'migrated.ts'),
        `import { plotFetch } from '../../../lib/plotFetch'\n` +
          `export const go = () => plotFetch('/bff/engine/v1/analysis/new-thing', { method: 'POST' })\n`,
      )
      writeFileSync(
        join(dir, 'other-service.ts'),
        `export const a = () => fetch('/bff/assist/suggest-options', { method: 'POST' })\n` +
          `export const b = () => fetch('/bff/cee/graph-readiness')\n` +
          `export const c = () => fetch('/version.json')\n`,
      )

      const v = plotViolations(dir)
      const files = v.map((x) => x.file).sort()
      expect(files, 'the three un-migrated PLoT seams must be flagged').toEqual([
        'offender-base.ts',
        'offender-literal.ts',
        'offender-shared-base.ts',
      ])
      // And nothing else — plotFetch and non-PLoT fetches are clean.
      expect(v.some((x) => x.file === 'migrated.ts')).toBe(false)
      expect(v.some((x) => x.file === 'other-service.ts')).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('COMMENT control: a PLoT fetch that lives only in a comment is not flagged (#385/#386)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plot-fetch-guard-cmt-'))
    try {
      writeFileSync(
        join(dir, 'documented.ts'),
        `// never write fetch('/bff/engine/v1/x') directly — use plotFetch\n` +
          `/* example of the anti-pattern: fetch('/bff/engine/v1/y') */\n` +
          `import { plotFetch } from '../../../lib/plotFetch'\n` +
          `export const go = () => plotFetch('/bff/engine/v1/real')\n`,
      )
      expect(
        plotViolations(dir),
        'a fetch() quoted only in a comment ships nothing and must not fail CI',
      ).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
