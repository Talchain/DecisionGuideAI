/**
 * CI guard: every FULL-PAGE lazy boundary bounds its wait.
 *
 * ── THE DEFECT THIS KEEPS CLOSED ────────────────────────────────────────────
 * A lazy route chunk that FAILS rejects and reaches an error boundary. One that
 * STALLS never settles, so no boundary is ever involved and React holds the
 * Suspense fallback — measured on staging as "Loading Canvas..." alone on the
 * page after 60 s with zero console output (Core E2E runs 33556631726,
 * 33578060840, 33581772301, 33546491489). `lazyWithStallBound` converts that
 * silence into the error the boundary already knows how to render.
 *
 * ⚠ NOTHING STRUCTURAL STOPS THE NEXT ROUTE BEING ADDED WITH BARE `lazy(`, and
 * that regression is INVISIBLE: the route works perfectly in every test, in
 * every review, and on every healthy network. It only shows up as a user
 * staring at a spinner. So the invariant is DERIVED from the filesystem on every
 * run rather than remembered (CLAUDE.md trap 12).
 *
 * ── WHY IT IS A SEPARATE FILE FROM THE SINGLE-WRITER GUARD ──────────────────
 * `stale-build-recovery-single-writer.spec.ts` answers "is there ONE writer for
 * what the product says when a chunk does not arrive?". This answers "does every
 * full-page lazy BOUND its wait?". Two questions, named apart rather than
 * folded together (CLAUDE.md trap 21).
 *
 * ── HOW IT CANNOT SILENTLY GROW (two mechanisms, opposite directions) ────────
 *   1. The POPULATION is derived: EVERY `const X = <callee>(() => import(` in
 *      `src/`, whatever the callee. It is deliberately not a list of blessed
 *      callees — an unrecognised one is BARE, never unclassified. The first
 *      version matched a fixed alternation on a single line, so `React.lazy(`
 *      (dotted) and any prettier-wrapped declaration fell through the `if (m)`
 *      with no `else` and were SILENTLY ABSENT from the offender list. Nine
 *      real sites were invisible. An unmatched declaration must be an error,
 *      never a skip.
 *   1b. And the census cannot SHRINK silently: a coarse `=> import(` count over
 *      the same corpus must equal the classified sites plus a named allowlist
 *      of non-declaration dynamic imports. A site that stops being classified
 *      REDs even if nothing else changes.
 *   2. ADMISSION to the exemption list is by hand, BY NAME, and BIDIRECTIONAL —
 *      an exemption naming a site that no longer exists REDs just as loudly as
 *      an unbounded new one. So the list cannot rot into a green lie.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve as resolvePath } from 'node:path'

const REPO_ROOT = resolvePath(__dirname, '../..')
const SRC = join(REPO_ROOT, 'src')

/** The bounded wrapper every full-page lazy must go through. */
const WRAPPER = 'lazyWithStallBound'

/**
 * ⭐ THE EXEMPTIONS — IN-PAGE PANELS, NOT PAGES.
 *
 * These mount INSIDE an already-loaded surface, behind a small local Suspense
 * fallback. A stall in one of them leaves the rest of the app usable, and
 * bounding them would be actively WORSE: rejecting would unwind to
 * `CanvasErrorBoundary` and destroy a working canvas because a side panel was
 * slow. The harm class this guard exists for is the FULL-PAGE dead end.
 *
 * Keyed by `file` + `symbol`, so a rename fails loud rather than silently
 * un-exempting or silently over-exempting.
 */
const EXEMPT: ReadonlyArray<{ file: string; symbol: string; why: string }> = [
  {
    file: 'poc/AppPoC.tsx',
    symbol: 'DebugPanel',
    why:
      'Diagnostics surface, mounted only under ?diag, with `<Suspense fallback={null}>` — a ' +
      'stall shows NOTHING rather than a misleading spinner, so there is no silent-wait harm ' +
      'to bound, and failing it into the canvas boundary would destroy a working session over ' +
      'a debug panel.',
  },
  {
    file: 'routes/CanvasMVP.tsx',
    symbol: 'TemplatesPanel',
    why: 'In-page panel inside a loaded canvas; a stall costs the panel, not the page.',
  },
  {
    file: 'routes/CanvasMVP.tsx',
    symbol: 'VersionsPanelHost',
    why: 'In-page panel inside a loaded canvas; a stall costs the panel, not the page.',
  },
  {
    file: 'canvas/ReactFlowGraph.tsx',
    symbol: 'IssuesPanel',
    why: 'In-page panel inside a loaded canvas; a stall costs the panel, not the page.',
  },
  {
    file: 'canvas/ReactFlowGraph.tsx',
    symbol: 'AIClarifierChat',
    why: 'In-page panel inside a loaded canvas; a stall costs the panel, not the page.',
  },
  {
    file: 'canvas/components/OutputsDock.tsx',
    symbol: 'PreAnalysisPanelV3',
    why: 'In-page dock panel inside a loaded canvas; a stall costs the panel, not the page.',
  },

  {
    file: 'lib/PoCShell.tsx',
    symbol: 'Sandbox',
    why:
      'In-page sandbox panel inside a shell that already rendered, behind its own ErrorBoundary ' +
      'and Suspense, so a stall costs the panel and not the page. Newly VISIBLE to this guard ' +
      'rather than newly added: it is written `React.lazy(`, which the old single-line ' +
      'alternation could not match. `PoCShell` also has zero importers at this tip — rowed as ' +
      'dead code rather than resolved here, because deleting it is a separate claim.',
  },
  {
    file: 'routes/PlotShowcase.tsx',
    symbol: 'GraphCanvas',
    why:
      'Dev-only route, behind DevRoutesGuard and off in deployed builds. `lazySafe` catches a ' +
      'REJECTED loader and renders a fallback card, but it does NOT bound a STALL — a loader ' +
      'that never settles holds the Suspense fallback exactly as a bare `lazy` would. Exempted ' +
      'because no deployed user can reach it, NOT because the wait is bounded.',
  },
  {
    file: 'routes/PlotShowcase.tsx',
    symbol: 'RunReportDrawer',
    why:
      'Dev-only route, behind DevRoutesGuard and off in deployed builds. `lazySafe` catches a ' +
      'REJECTED loader and renders a fallback card, but it does NOT bound a STALL — a loader ' +
      'that never settles holds the Suspense fallback exactly as a bare `lazy` would. Exempted ' +
      'because no deployed user can reach it, NOT because the wait is bounded.',
  },
  {
    file: 'routes/PlotShowcase.tsx',
    symbol: 'ConfigDrawer',
    why:
      'Dev-only route, behind DevRoutesGuard and off in deployed builds. `lazySafe` catches a ' +
      'REJECTED loader and renders a fallback card, but it does NOT bound a STALL — a loader ' +
      'that never settles holds the Suspense fallback exactly as a bare `lazy` would. Exempted ' +
      'because no deployed user can reach it, NOT because the wait is bounded.',
  },
  {
    file: 'routes/PlotShowcase.tsx',
    symbol: 'ScenarioDrawer',
    why:
      'Dev-only route, behind DevRoutesGuard and off in deployed builds. `lazySafe` catches a ' +
      'REJECTED loader and renders a fallback card, but it does NOT bound a STALL — a loader ' +
      'that never settles holds the Suspense fallback exactly as a bare `lazy` would. Exempted ' +
      'because no deployed user can reach it, NOT because the wait is bounded.',
  },
  {
    file: 'routes/SandboxV1.tsx',
    symbol: 'GraphCanvas',
    why:
      'Dev-only route, behind DevRoutesGuard and off in deployed builds. `lazySafe` catches a ' +
      'REJECTED loader and renders a fallback card, but it does NOT bound a STALL — a loader ' +
      'that never settles holds the Suspense fallback exactly as a bare `lazy` would. Exempted ' +
      'because no deployed user can reach it, NOT because the wait is bounded.',
  },
  {
    file: 'routes/SandboxV1.tsx',
    symbol: 'RunReportDrawer',
    why:
      'Dev-only route, behind DevRoutesGuard and off in deployed builds. `lazySafe` catches a ' +
      'REJECTED loader and renders a fallback card, but it does NOT bound a STALL — a loader ' +
      'that never settles holds the Suspense fallback exactly as a bare `lazy` would. Exempted ' +
      'because no deployed user can reach it, NOT because the wait is bounded.',
  },
  {
    file: 'routes/SandboxV1.tsx',
    symbol: 'ConfigDrawer',
    why:
      'Dev-only route, behind DevRoutesGuard and off in deployed builds. `lazySafe` catches a ' +
      'REJECTED loader and renders a fallback card, but it does NOT bound a STALL — a loader ' +
      'that never settles holds the Suspense fallback exactly as a bare `lazy` would. Exempted ' +
      'because no deployed user can reach it, NOT because the wait is bounded.',
  },
  {
    file: 'routes/SandboxV1.tsx',
    symbol: 'ScenarioDrawer',
    why:
      'Dev-only route, behind DevRoutesGuard and off in deployed builds. `lazySafe` catches a ' +
      'REJECTED loader and renders a fallback card, but it does NOT bound a STALL — a loader ' +
      'that never settles holds the Suspense fallback exactly as a bare `lazy` would. Exempted ' +
      'because no deployed user can reach it, NOT because the wait is bounded.',
  },
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === 'tests') continue
      walk(full, out)
    } else if (/\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const FILES = walk(SRC)

interface Site {
  file: string
  symbol: string
  line: number
  bounded: boolean
}

/**
 * A `/` opens a REGEX LITERAL only where a value is expected; after an operand it
 * is division. The preceding non-space character is the standard discriminator —
 * imperfect in the general case, deliberately biased here toward TREATING IT AS
 * A REGEX, because the failure that costs something is blanking real code.
 */
function isRegexStart(src: string, slash: number): boolean {
  let k = slash - 1
  while (k >= 0 && /\s/.test(src[k])) k -= 1
  if (k < 0) return true
  const prev = src[k]
  if ('(,=:[!&|?{};+-*%^~<>'.includes(prev)) return true
  const word = /[A-Za-z0-9_$]/.test(prev) ? (src.slice(0, k + 1).match(/[A-Za-z0-9_$]+$/) ?? [''])[0] : ''
  return ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await'].includes(word)
}

/**
 * ⚠ COMMENTS ARE BLANKED BY A STATE MACHINE, NOT BY TWO REGEXES.
 *
 * Blanking is needed because `lazyWithStallBound.ts` documents itself as a
 * "Drop-in for `lazy(() => import('...'))`", and a guard that counted prose
 * would demand its own docstring be exempted.
 *
 * The first version used `/\*[\s\S]*?\*\/` then `(?<!:)\/\/[^\n]*`, and a review
 * found it CORRUPTS LIVE CODE: a line comment containing `/*` — an ordinary
 * route glob like `/bff/cee/*` — opened a false block comment and blanked 80
 * lines of `src/adapters/cee/client.ts`, including a live `fetch` and its error
 * handling. 12 files carry that shape. A single pass that knows whether it is
 * inside a comment, a string or a template literal cannot make that mistake.
 *
 * Characters are replaced with spaces rather than removed, so match offsets
 * still map to real line numbers.
 */
function blankComments(src: string): string {
  const out = src.split('')
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template' | 'regex' | 'regexClass'
  let state: State = 'code'
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const d = src[i + 1]
    if (state === 'code') {
      // ⚠ A REGEX LITERAL CAN CONTAIN `//`, AND MISSING THAT LOSES REAL CODE.
      // `/https?:\/\//` holds an escaped pair that reads as a line comment to a
      // scanner without a regex state — everything after it on the line is
      // blanked, so a route declared on that line disappears from BOTH the
      // classifier and the census, which then agree with each other about
      // nothing. A review found exactly that: a bare route beside such a regex
      // was 8/8 green, and the twin with the slashes removed REDs.
      //
      // A regex literal only begins where a VALUE is expected, so the preceding
      // non-space character discriminates it from division.
      if (c === '/' && isRegexStart(src, i)) { state = 'regex'; i += 1; continue }
      if (c === '/' && d === '/') { state = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue }
      if (c === '/' && d === '*') { state = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue }
      if (c === "'") state = 'single'
      else if (c === '"') state = 'double'
      else if (c === '`') state = 'template'
      i += 1
      continue
    }
    if (state === 'regex') {
      if (c === '\\') { i += 2; continue }
      if (c === '[') { state = 'regexClass'; i += 1; continue }
      if (c === '/' || c === '\n') { state = 'code' }
      i += 1
      continue
    }
    if (state === 'regexClass') {
      if (c === '\\') { i += 2; continue }
      if (c === ']') { state = 'regex' }
      i += 1
      continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; i += 1; continue }
      out[i] = ' '; i += 1; continue
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { out[i] = ' '; out[i + 1] = ' '; state = 'code'; i += 2; continue }
      if (c !== '\n') out[i] = ' '
      i += 1; continue
    }
    if (c === '\\') { i += 2; continue }
    if ((state === 'single' && c === "'") || (state === 'double' && c === '"') || (state === 'template' && c === '`')) {
      state = 'code'
    }
    i += 1
  }
  return out.join('')
}

/**
 * ⭐ THE SHRINK ALARM, and its scope is stated rather than implied.
 *
 * A DIFFERENT, dumber matcher: every zero-argument arrow loader — `() =>` or
 * `async () =>` — with a dynamic import in its body. It is keyed on the ARROW,
 * where the classifier is keyed on the DECLARATION, so the two can genuinely
 * disagree. That matters, because the first version of this census matched
 * `=>\s*import\(`, which was the classifier's OWN assumption: the "independent"
 * counter shared the classifier's blind spot and could not see the thing it
 * existed to see. A review proved it — three bare unbounded full-page routes
 * written as `() => { return import(...) }`, `async () => await import(...)`,
 * and the canonical named-export idiom
 * `async () => ({ default: (await import(...)).default })` all survived at 8/8
 * green. A control must be sensitive to the specific way THIS instrument fails.
 *
 * ⚠⚠ ROWED, NOT CLOSED — THE SCOPE IS 8 FILES OF 1,658, AND THAT IS A REAL LIMIT.
 * A review measured it: `findDeclarations` misses six declaration forms (a TYPED
 * const among them), and while a route-hosting file catches every one through
 * this census, a file that hosts NO existing route declaration is not looked at
 * at all. The attribution pair is exact — an identical typed-const declaration
 * REDs in `poc/AppPoC.tsx` and is 8/8 GREEN in `routes/PlotWorkspace.tsx`, while
 * the ORDINARY form REDs in that same non-hosting file, so location alone is not
 * the cause.
 *
 * ⚠ AND A NEW ROUTE NATURALLY LANDS IN A NEW FILE, which is this guard's own
 * stated purpose — so the gap points at the case it exists for. The fix is to
 * widen the CLASSIFIER (those six forms), not the census; widening the census
 * needs a ~26-file subtraction list and would reintroduce the mirror this guard
 * removes. Recorded beside the thing that has the limitation, rather than in a
 * row nobody reads.
 *
 * ⚠ SCOPE, precisely: this reconciles only over files that ALREADY HOST at least
 * one classified route declaration. It is not a census of every dynamic import
 * in `src/` — there are 71 of those and most are ordinary `await import(...)`
 * calls inside functions, which no Suspense boundary is involved in. Reconciling
 * against all of them would need a ~26-file subtraction list, and a list that
 * large IS the hand-maintained mirror this guard exists to avoid. What this does
 * catch is the case that matters: a loader going invisible IN A FILE THAT HOSTS
 * ROUTES.
 */
const ZERO_ARG_ARROW = /(?:async\s+)?\(\s*\)\s*=>/g

/**
 * Zero-arg arrow loaders in a route-hosting file that are NOT route declarations.
 * The COUNT is asserted, because a stale subtraction hides a real site
 * one-for-one.
 */
const NON_DECLARATION_LOADERS: ReadonlyArray<{ file: string; count: number; why: string }> = [
  {
    file: 'poc/AppPoC.tsx',
    count: 1,
    why:
      'A `;(async () => { ... })()` IIFE that probes for optional components with guarded ' +
      'dynamic imports. It declares no component and mounts behind no Suspense boundary, so ' +
      'there is no silent wait to bound.',
  },
]

function countArrowLoaders(code: string): number {
  let n = 0
  for (const m of code.matchAll(ZERO_ARG_ARROW)) {
    if (countDynamicImports(code.slice(m.index ?? 0, (m.index ?? 0) + 300)) > 0) n += 1
  }
  return n
}

const ANY_IMPORT_CALL = /\bimport\s*\(/g

/**
 * ⚠ TYPESCRIPT'S IMPORT *TYPE* SYNTAX IS NOT A DYNAMIC IMPORT, and it is common
 * here: `Map<string, import('../lib/types').MappedFragileEdge>` is a type
 * annotation that never loads anything at runtime. Counting it produced four
 * false offenders on the first run of the broadened matcher, two of them whole
 * component bodies that merely CONTAINED such an annotation.
 *
 * The discriminator is what follows the closing paren: a type import is
 * dereferenced to a TYPE NAME (`.MappedFragileEdge`, capitalised) or a generic.
 * A dynamic import is followed by nothing, or by a lowercase member like
 * `.then(`. Narrow on purpose — over-excluding here would blind the census.
 */
function isTypePositionImport(code: string, importIndex: number): boolean {
  let depth = 0
  let k = code.indexOf('(', importIndex)
  for (; k < code.length; k += 1) {
    if (code[k] === '(') depth += 1
    else if (code[k] === ')') { depth -= 1; if (depth === 0) break }
  }
  const after = code.slice(k + 1, k + 40)
  return /^\s*(?:\.\s*[A-Z]|<)/.test(after)
}

function countDynamicImports(code: string): number {
  let n = 0
  for (const m of code.matchAll(ANY_IMPORT_CALL)) {
    if (!isTypePositionImport(code, m.index ?? 0)) n += 1
  }
  return n
}

/**
 * `const X = <anything>(...)` where the call contains a dynamic import ANYWHERE
 * in its argument list.
 *
 * Balanced-paren scanning rather than a regex for the body, because the body can
 * be an arrow expression, a block with a `return`, an `async` arrow with `await`,
 * or an object-spread of a named export — and enumerating those is how the first
 * version came to have a silent third class. The callee is CAPTURED, never
 * enumerated, so an unrecognised one is BARE rather than invisible.
 */
interface Declaration {
  symbol: string
  callee: string
  index: number
}

function findDeclarations(code: string): Declaration[] {
  const HEAD = /(?:^|[\s;{}(])(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*([A-Za-z0-9_$.]+)\s*\(/g
  const found: Declaration[] = []
  for (const m of code.matchAll(HEAD)) {
    const open = (m.index ?? 0) + m[0].length - 1
    let depth = 0
    let k = open
    for (; k < code.length; k += 1) {
      if (code[k] === '(') depth += 1
      else if (code[k] === ')') { depth -= 1; if (depth === 0) break }
    }
    if (countDynamicImports(code.slice(open, k + 1)) > 0) {
      found.push({ symbol: m[1], callee: m[2], index: m.index ?? 0 })
    }
  }
  return found
}

const SITES: Site[] = []
const arrowLoadersPerFile = new Map<string, number>()
for (const full of FILES) {
  const rel = relative(SRC, full).split('\\').join('/')
  const raw = readFileSync(full, 'utf8')
  const code = blankComments(raw)

  // Runs on the COMMENT-BLANKED copy, so prose does not inflate it.
  arrowLoadersPerFile.set(rel, countArrowLoaders(code))

  for (const d of findDeclarations(code)) {
    SITES.push({
      file: rel,
      symbol: d.symbol,
      line: code.slice(0, d.index).split('\n').length,
      bounded: d.callee === WRAPPER,
    })
  }
}

const key = (s: { file: string; symbol: string }) => `${s.file}::${s.symbol}`
const EXEMPT_KEYS = new Set(EXEMPT.map(key))

describe('every full-page lazy boundary bounds its wait', () => {
  it('POSITIVE CONTROL: the sweep sees the corpus and finds real lazy sites', () => {
    // ⚠ If the walker or the regex breaks, every assertion below passes
    // vacuously — an absence probe with no positive control proves nothing
    // (CLAUDE.md trap 13). Both halves are asserted: the corpus is big, AND the
    // matcher actually matched.
    expect(FILES.length).toBeGreaterThan(500)
    expect(SITES.length).toBeGreaterThan(10)
  })

  it('CONTRAST CONTROL: the matcher discriminates bounded from bare', () => {
    // A matcher that classified everything as bounded would make this guard
    // permanently green; one that classified everything as bare would make it
    // permanently red. Both classes must be non-empty for the run to mean
    // anything (CLAUDE.md trap 13e).
    expect(SITES.filter((s) => s.bounded).length, 'no BOUNDED site found').toBeGreaterThan(0)
    expect(SITES.filter((s) => !s.bounded).length, 'no BARE site found').toBeGreaterThan(0)
  })

  it('CENSUS RECONCILES in every route-hosting file — a loader cannot go invisible', () => {
    // For each file that hosts at least one classified route declaration, the
    // number of zero-arg arrow loaders must equal the number of classified sites
    // plus whatever is NAMED below. Exact, not a floor: a floor admits silent
    // shrinkage, which is the defect.
    //
    // If this REDs, either a loader stopped being classified (fix the classifier)
    // or it is genuinely not a declaration — in which case NAME it, with a reason.
    // Do not adjust a number to make this pass.
    const declaredFor = (file: string) =>
      NON_DECLARATION_LOADERS.filter((e) => e.file === file).reduce((n, e) => n + e.count, 0)

    const routeHosting = [...new Set(SITES.map((s) => s.file))].sort()
    expect(routeHosting.length, 'no route-hosting file found — the sweep is broken').toBeGreaterThan(3)

    const mismatches = routeHosting
      .map((file) => ({
        file,
        loaders: arrowLoadersPerFile.get(file) ?? 0,
        classified: SITES.filter((s) => s.file === file).length,
        declared: declaredFor(file),
      }))
      .filter((r) => r.loaders !== r.classified + r.declared)
      .map(
        (r) =>
          `${r.file}: ${r.loaders} arrow loader(s) but ${r.classified} classified + ${r.declared} declared`,
      )
    expect(mismatches, 'a loader in a route-hosting file is invisible to the classifier').toEqual([])
  })

  it('every declared non-declaration loader still names a real, route-hosting file', () => {
    // Bidirectional, exactly as the exemption list is: an entry naming a file
    // that no longer hosts routes is a stale subtraction, and a stale subtraction
    // hides a real site one-for-one.
    const routeHosting = new Set(SITES.map((s) => s.file))
    const stale = NON_DECLARATION_LOADERS.map((e) => e.file).filter((f) => !routeHosting.has(f))
    expect(stale, 'stale non-declaration loader entr(ies)').toEqual([])
  })

  it('the routed lazies this fix was written for are bounded, BY NAME', () => {
    // Bound by identity, not by a count another site could satisfy
    // (CLAUDE.md trap 19). `CanvasMVP` is the one the staging evidence names.
    const bounded = new Set(SITES.filter((s) => s.bounded).map(key))
    for (const k of [
      'poc/AppPoC.tsx::CanvasMVP',
      'poc/AppPoC.tsx::ScenarioListPage',
      'poc/AppPoC.tsx::AuthGuard',
      'poc/AppPoC.tsx::LoginPage',
      'main.tsx::AppPoC',
    ]) {
      expect(bounded, `${k} must go through ${WRAPPER}`).toContain(k)
    }
  })

  it('no unbounded lazy exists outside the exemption list', () => {
    const offenders = SITES.filter((s) => !s.bounded && !EXEMPT_KEYS.has(key(s)))
    expect(
      offenders.map((s) => `${s.file}:${s.line} ${s.symbol}`),
      `Unbounded lazy import(s). A route-level lazy must use ${WRAPPER} — a stalled chunk ` +
        `otherwise leaves a permanent spinner no boundary can see. If this is an IN-PAGE panel ` +
        `rather than a page, add it to EXEMPT in this file with the reason.`,
    ).toEqual([])
  })

  it('BIDIRECTIONAL: every exemption still names a real site', () => {
    // Without this the list rots: a renamed or deleted panel leaves an exemption
    // that silently covers nothing, and the next reader believes it is load-bearing.
    const present = new Set(SITES.map(key))
    const stale = EXEMPT.map(key).filter((k) => !present.has(k))
    expect(stale, 'stale exemption(s) — the site was renamed or removed').toEqual([])
  })

  it('every exemption carries a reason, not just a name', () => {
    for (const e of EXEMPT) {
      expect(e.why.length, `${key(e)} needs a stated reason`).toBeGreaterThan(40)
    }
  })
})
