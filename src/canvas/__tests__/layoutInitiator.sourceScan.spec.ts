/**
 * "WHO ASKED FOR THIS LAYOUT" — enforced structurally, at every call site.
 *
 * `applyLayout`'s `initiatedBy` option is one half of the layout trigger's
 * camera guard (`useFitViewOnLayoutVersion.ts` — `layoutWasAutomatic &&
 * userOwnsCameraFor(currentModelKey())`). It defaults to `'user'`, so the
 * fail-safe direction is the old always-re-fit behaviour, and an AUTOMATIC call
 * site that forgets to say `'product'` silently re-frames a camera the user
 * framed — the defect `#1096` was written to close.
 *
 * ⚠ WHY THIS EXISTS RATHER THAN MORE UNIT ASSERTIONS. The four `'product'` call
 * sites were previously pinned only by four `requestId: 1` assertions in
 * `useMeasureThenLayout`'s spec — and `requestId` binds to only TWO of them
 * (`useMeasureThenLayout.ts:176` and `:210`). Dropping `initiatedBy: 'product'`
 * at `:129` or `:158` left the suite fully GREEN, so half the sites had no
 * guard at all. That is CLAUDE.md trap 19 in its usual form: the assertion bound
 * to its object by a VALUE PREDICATE (`requestId: 1`) that a different object
 * also satisfies, instead of by identity. This scan binds by identity — the call
 * site itself — and derives the set rather than mirroring a count.
 *
 * ⚠ AND IT PROVES ONE THING ONLY (CLAUDE.md trap 12d): that the call sites in
 * the tree and the declaration below AGREE. It cannot prove the declaration is
 * RIGHT — whether a given site is genuinely automatic is a review judgement, and
 * it is named here so a reviewer has something to judge. What it prevents is a
 * fifth site appearing, or an existing one losing its initiator, with nobody
 * making that judgement at all.
 *
 * Scope searched: every non-test `.ts`/`.tsx` under `src/`, with COMMENTS
 * stripped so prose about the option cannot read as a call site. String literals
 * are deliberately KEPT as code — the initiator's VALUE is the thing under test,
 * and `blankNonCode` (used by the sibling claim scan, which only needs a symbol
 * name) empties string bodies, which made this scan read a flat zero. Its own
 * positive control is what caught that.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from '../../../tests/helpers/stripSourceComments'

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

/**
 * THE ONE AUTOMATIC LAYOUT DRIVER. Every `applyLayout` call it makes is the
 * product deciding to re-lay out a model the user did not ask to re-arrange:
 * the fallback-height correction, the post-analysis growth correction, and the
 * two measurement-gated passes.
 */
const AUTOMATIC_LAYOUT_DRIVER = 'canvas/hooks/useMeasureThenLayout.ts'

/** The module that DECLARES `applyLayout`; it does not call itself. */
const LAYOUT_OWNER = 'canvas/store.ts'

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry)) out.push(...sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    out.push(full)
  }
  return out
}

/**
 * The ARGUMENT TEXT of every `applyLayout(...)` call in `code`, by balanced-paren
 * scan. Deliberately not a line regex: the calls span lines, and a per-line match
 * would silently miss the multi-line ones — which is how a count-based guard goes
 * quietly short.
 */
function applyLayoutCallArgs(code: string): string[] {
  const out: string[] = []
  const re = /\bapplyLayout\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < code.length && depth > 0) {
      const ch = code[i]
      if (ch === '(') depth += 1
      else if (ch === ')') depth -= 1
      i += 1
    }
    out.push(code.slice(start, i - 1))
  }
  return out
}

type Site = { file: string; args: string }

function allApplyLayoutCalls(): Site[] {
  const out: Site[] = []
  for (const file of sourceFiles(SRC_ROOT)) {
    const rel = relative(SRC_ROOT, file).split('\\').join('/')
    if (rel === LAYOUT_OWNER) continue
    const code = stripComments(readFileSync(file, 'utf8'), file)
    for (const args of applyLayoutCallArgs(code)) out.push({ file: rel, args })
  }
  return out
}

const declaresProduct = (args: string) => /initiatedBy\s*:\s*'product'/.test(args)

describe('who asked for a layout — the initiator, at every call site', () => {
  it('the positive control: the scan can see call sites, and a fictional symbol reads as absent', () => {
    // Without this, every assertion below passes just as happily on a scanner
    // that extracts nothing (CLAUDE.md trap 13 — an absence probe needs to be
    // shown able to see a presence first).
    expect(allApplyLayoutCalls().length).toBeGreaterThan(0)
    expect(applyLayoutCallArgs('const x = applyLayoutNeverDefined(1)')).toEqual([])
    // ...and the balanced-paren scanner must actually capture nested parens,
    // or a call whose args contain a call would be truncated and read as bare.
    expect(applyLayoutCallArgs('applyLayout({ requestId: id(1), initiatedBy: 2 })')).toEqual([
      '{ requestId: id(1), initiatedBy: 2 }',
    ])
  })

  it('EVERY applyLayout call in the automatic driver declares initiatedBy: product', () => {
    const driverCalls = allApplyLayoutCalls().filter((s) => s.file === AUTOMATIC_LAYOUT_DRIVER)
    // Pin the precondition: if the driver stopped calling applyLayout, an
    // `every()` over an empty list would pass vacuously.
    expect(driverCalls.length, 'the automatic driver makes no applyLayout calls — this guard would be vacuous').toBeGreaterThan(0)
    const missing = driverCalls.filter((s) => !declaresProduct(s.args)).map((s) => s.args.trim())
    expect(missing, 'an automatic layout would re-frame a camera the user framed').toEqual([])
  })

  it("initiatedBy: 'product' is declared ONLY by the automatic driver", () => {
    // The opposite direction (CLAUDE.md trap 22b): the guard above stops an
    // automatic site losing its initiator; this one stops a USER control
    // acquiring one, which would suppress the re-frame the user just asked for
    // — the harm `#1097` was written to close.
    const productFiles = [...new Set(allApplyLayoutCalls().filter((s) => declaresProduct(s.args)).map((s) => s.file))]
    expect(productFiles.sort()).toEqual([AUTOMATIC_LAYOUT_DRIVER])
  })
})
