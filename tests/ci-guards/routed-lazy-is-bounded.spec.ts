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
 *   1. The POPULATION is derived: every `lazy(() => import(` in `src/`.
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
 * ⚠ COMMENT LINES ARE SKIPPED, and this is not cosmetic: `lazyWithStallBound.ts`
 * documents itself as a "Drop-in for `lazy(() => import('...'))`", and a guard
 * that counted prose would demand its own docstring be exempted.
 */
function isCommentLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')
}

interface Site {
  file: string
  symbol: string
  line: number
  bounded: boolean
}

/** `const X = lazy(...)` / `const X = lazyWithStallBound(...)`, with `import(` on the same line. */
const DECL = /const\s+([A-Za-z0-9_$]+)\s*=\s*(lazyWithStallBound|(?<![A-Za-z0-9_.])lazy)\s*\(\s*\(\s*\)\s*=>\s*import\(/

const SITES: Site[] = []
for (const full of FILES) {
  const rel = relative(SRC, full).split('\\').join('/')
  const lines = readFileSync(full, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (isCommentLine(line)) return
    const m = DECL.exec(line)
    if (m) SITES.push({ file: rel, symbol: m[1], line: i + 1, bounded: m[2] === WRAPPER })
  })
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
