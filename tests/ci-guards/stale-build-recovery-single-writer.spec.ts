/**
 * CI guard: ONE module decides what the product says when the build moved.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * A failed dynamic import after a mid-session deploy can be caught by TWO
 * different React boundaries, and until this lane they disagreed:
 *
 *   · `CanvasErrorBoundary` (src/canvas/ErrorBoundary.tsx) knew about chunk
 *     errors, auto-reloaded once, and offered "Reload editor".
 *   · `BootErrorBoundary` (then inline in src/main.tsx, now src/BootErrorBoundary.tsx)
 *     — which catches the FIRST chunk that
 *     can fail, the top-level `AppPoC` lazy import — was chunk-BLIND. It
 *     rendered "Render Error ❌ / Something went wrong. Please refresh the page
 *     or contact support.": not true (nothing failed to render, the build
 *     moved), and no way forward.
 *
 * So the deploy race that most reliably breaks a loaded session was the one
 * case the recovery machinery never saw.
 *
 * The fix is CONVERGENCE, not a new notice family: one module owns the
 * detector, the copy, and the rate-limited reload; both boundaries consume it.
 * Nothing structural stops the next edit re-introducing a second regex or a
 * second sentence somewhere else, and that drift reads green — a boundary that
 * says the wrong thing fails no test. So the invariant is DERIVED from the
 * filesystem on every run rather than remembered.
 *
 * ⚠ THIS GUARD IS ABOUT SINGLE-WRITERSHIP, NOT ABOUT BEHAVIOUR. It cannot
 * prove either boundary renders anything. src/lib/__tests__/ and
 * src/__tests__/BootErrorBoundary.staleBuild.spec.tsx do that.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve as resolvePath } from 'node:path'

const REPO_ROOT = resolvePath(__dirname, '../..')
const SRC = join(REPO_ROOT, 'src')

/** The single writer. */
const OWNER = 'lib/staleBuildRecovery.ts'

/** The boundaries that must CONSUME it rather than re-derive it. */
const CONSUMERS = ['BootErrorBoundary.tsx', 'canvas/ErrorBoundary.tsx']

/**
 * A fragment of the browser-message detector. If this string appears in a
 * module, that module is deciding for itself what a chunk error looks like.
 */
const DETECTOR_FRAGMENT = 'Failed to fetch dynamically imported module'

/** The sessionStorage key that rate-limits the automatic reload. */
const GUARD_KEY_LITERAL = 'olumi-chunk-reload-at'

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

/** Production modules, read once. Comments are NOT stripped for the consumer
 *  checks, but ARE irrelevant there; the literal checks below are about code. */
const CORPUS: ReadonlyArray<readonly [string, string]> = walk(SRC).map((file) => {
  const rel = relative(SRC, file).split('\\').join('/')
  return [rel, readFileSync(file, 'utf8')] as const
})

function filesContaining(needle: string): string[] {
  return CORPUS.filter(([, code]) => code.includes(needle)).map(([rel]) => rel)
}

describe('stale-build recovery — one detector, one sentence, one reload guard', () => {
  it('POSITIVE CONTROL: the sweep sees the corpus at all (an empty sweep proves nothing)', () => {
    // If the walker breaks, every assertion below passes vacuously.
    expect(CORPUS.length).toBeGreaterThan(500)
    expect(CORPUS.map(([rel]) => rel)).toContain('BootErrorBoundary.tsx')
    expect(CORPUS.map(([rel]) => rel)).toContain('canvas/ErrorBoundary.tsx')
  })

  it('the owner module exists', () => {
    expect(CORPUS.map(([rel]) => rel)).toContain(OWNER)
  })

  it('exactly one module defines the chunk-error detector', () => {
    expect(filesContaining(DETECTOR_FRAGMENT)).toEqual([OWNER])
  })

  it('exactly one module names the reload-guard storage key', () => {
    expect(filesContaining(GUARD_KEY_LITERAL)).toEqual([OWNER])
  })

  it.each(CONSUMERS)('%s consumes the owner rather than re-deriving it', (consumer) => {
    const entry = CORPUS.find(([rel]) => rel === consumer)
    expect(entry, `${consumer} not found in corpus`).toBeDefined()
    const code = entry![1]
    expect(code, `${consumer} must import from staleBuildRecovery`).toMatch(
      /from\s+['"][^'"]*staleBuildRecovery['"]/,
    )
    expect(code, `${consumer} must use the shared detector`).toContain('isChunkLoadError')
  })

  it('the boot boundary offers a way forward, not just a diagnosis', () => {
    const boundary = CORPUS.find(([rel]) => rel === 'BootErrorBoundary.tsx')![1]
    // ⚠ THIS ASSERTION IS DELIBERATELY WEAK, AND SAYS SO. A mutant that made
    // the notice branch unreachable (`if (false)`) passed the earlier version
    // of this test, because the literals stayed in the file. Presence of copy
    // is not coverage of the branch that renders it — the load-bearing evidence
    // is src/__tests__/BootErrorBoundary.staleBuild.spec.tsx, which MOUNTS the
    // boundary and drives a real chunk error. This only pins provenance.
    expect(boundary).toContain('STALE_BUILD_ACTION_COPY')
    expect(boundary).toContain('STALE_BUILD_NOTICE_COPY')
  })

  it('no boundary claims the SERVER failed when the build simply moved', () => {
    // The forbidden framing, in the two modules that render a chunk failure.
    // A stale build is not a server error and must never be reported as one.
    for (const consumer of CONSUMERS) {
      const code = CORPUS.find(([rel]) => rel === consumer)![1]
      expect(code, `${consumer} must not blame the server`).not.toMatch(
        /server (error|failed|is down|problem)/i,
      )
    }
  })
})
