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

/**
 * ⚠ COMMENTS ARE BLANKED, NOT DELETED — every character becomes a space and
 * newlines survive, so a match offset still maps to its real line number.
 * Blanking is needed at all because `lazyWithStallBound.ts` documents itself as
 * a "Drop-in for `lazy(() => import('...'))`", and a guard that counted prose
 * would demand its own docstring be exempted.
 *
 * `(?<!:)` keeps `https://` out of the line-comment rule. Any residual blanking
 * error can only HIDE a site — and the census assertion below is what notices,
 * because it counts on the RAW source while classification runs on the blanked
 * copy. Eat a declaration and the two stop reconciling. (Counting both sides on
 * the blanked copy would have made the control blind to exactly the failure it
 * is here to catch.)
 */
function blankComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(?<!:)\/\/[^\n]*/g, blank)
}

/**
 * `const X = <anything>(() => import(`, ACROSS LINES.
 *
 * The callee is captured, never enumerated: `bounded` is then a question about
 * the captured string. That is what removes the silent third class — with an
 * alternation, an unrecognised callee matched nothing and vanished; here it
 * matches and is BARE. `\s*` spans newlines, so a declaration prettier wrapped
 * at `printWidth: 120` is still one site (`poc/AppPoC.tsx:99` is 122 chars, and
 * a single `npx prettier --write` would otherwise have removed a real public
 * route from the census with the guard still green).
 */
const DECL = /const\s+([A-Za-z0-9_$]+)\s*=\s*([A-Za-z0-9_$.]+)\s*\(\s*\(\s*\)\s*=>\s*import\(/g

/** Any `=> import(`, for the coarse census below. Runs on RAW source. */
const ANY_DYNAMIC_IMPORT = /=>\s*import\(/g

/**
 * Dynamic imports that are NOT component declarations, named so the census can
 * reconcile exactly. These reach no Suspense boundary, so there is no wait to
 * bound — but they must be DECLARED rather than silently subtracted.
 */
const NON_DECLARATION_DYNAMIC_IMPORTS: ReadonlyArray<{ file: string; count: number; why: string }> = [
  {
    file: 'canvas/starters/loadStarter.ts',
    count: 5,
    why:
      'A record of starter-data loaders (JSON), not component declarations. No Suspense ' +
      'boundary is involved, so there is no silent wait to bound.',
  },
  {
    file: 'lib/lazyWithStallBound.ts',
    count: 1,
    why: 'Prose: the module documents itself as a drop-in for `lazy(() => import(...))`.',
  },
  {
    file: 'canvas/components/coaching-panel/index.ts',
    count: 1,
    why: 'Prose: a comment describing what a later mount PR could do.',
  },
]

const SITES: Site[] = []
let coarseCount = 0
for (const full of FILES) {
  const rel = relative(SRC, full).split('\\').join('/')
  const raw = readFileSync(full, 'utf8')
  const code = blankComments(raw)

  for (const _ of raw.matchAll(ANY_DYNAMIC_IMPORT)) coarseCount += 1

  for (const m of code.matchAll(DECL)) {
    const line = code.slice(0, m.index ?? 0).split('\n').length
    SITES.push({ file: rel, symbol: m[1], line, bounded: m[2] === WRAPPER })
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

  it('CENSUS RECONCILES: every `=> import(` is classified or declared', () => {
    // ⭐ THE SHRINK ALARM, and it is the half the first version lacked.
    //
    // The classifier can only prove that what it SAW is right. It cannot notice
    // what it stopped seeing — and that is precisely how nine sites were absent
    // while six assertions stayed green. So a deliberately dumb matcher counts
    // `=> import(` over the RAW corpus, and the total must reconcile exactly.
    //
    // Exact, not a floor: a floor admits silent shrinkage, which is the defect.
    // If this REDs, either a new dynamic import needs classifying (fix the
    // callee it uses) or it is genuinely not a component declaration — in which
    // case NAME it in NON_DECLARATION_DYNAMIC_IMPORTS with a reason. Do not
    // adjust a number to make this pass.
    const declared = NON_DECLARATION_DYNAMIC_IMPORTS.reduce((n, e) => n + e.count, 0)
    expect(
      SITES.length + declared,
      `census mismatch: ${coarseCount} dynamic import(s) in src/, but ${SITES.length} classified ` +
        `+ ${declared} declared non-declarations. A site is invisible to the classifier.`,
    ).toBe(coarseCount)
  })

  it('every declared non-declaration still names a real file', () => {
    // Bidirectional, exactly as the exemption list is: an entry describing a
    // file that no longer holds those imports is a stale subtraction, and a
    // stale subtraction hides a real site one-for-one.
    const files = new Set(FILES.map((f) => relative(SRC, f).split('\\').join('/')))
    const stale = NON_DECLARATION_DYNAMIC_IMPORTS.map((e) => e.file).filter((f) => !files.has(f))
    expect(stale, 'stale non-declaration entr(ies)').toEqual([])
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
