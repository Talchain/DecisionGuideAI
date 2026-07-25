/**
 * F11 — no untrusted record may be spread into edge `data` carrying a
 * provenance marker.
 *
 * WHY A SOURCE SCAN AND NOT A UNIT TEST
 * -------------------------------------
 * The unit tests for `stripEdgeValueSourceKeys` prove the helper works. They
 * cannot prove the CALL SITE uses it — reverting the one-line change in
 * `DraftChat.tsx` leaves them all green, which would make the fix theatre
 * (trap 11). And a unit test on DraftChat would pin ONE site, when the actual
 * failure mode is a THIRTEENTH site next month: `DraftChat`'s own
 * hand-maintained strip-list carries the comment *"strip canvas-internal keys
 * from CEE passthrough to prevent collision with DEFAULT_EDGE_DATA values"*
 * and never learned `weightSource` / `beliefExistsSource` — the exact
 * hand-maintained-mirror defect (trap 12).
 *
 * So this guard is DERIVED from the source tree, not from a list of files.
 * It finds every place canvas source spreads a `…Rest`/`…rest` remainder — the
 * shape produced by destructuring an untrusted wire object — inside an edge
 * `data` literal, and requires the spread to be wrapped in
 * `stripEdgeValueSourceKeys(...)`. A new mapper that forgets is a RED test,
 * not a silent laundering of a UI default into a claim about its origin.
 *
 * The laundering it prevents is specific and subtle: `edgeValueSourcePatch`
 * OMITS a marker key it cannot justify, so a wire-supplied `weightSource`
 * survived the spread exactly when the wire sent NO strength — the marker
 * outliving the number it describes.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'

const CANVAS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

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
 * A spread of a destructured remainder whose name ends in `Rest`/`rest` —
 * `...edgeRest`, `...rest`, `...wireRest`. That naming convention IS the
 * signal: it is what TypeScript's rest-element idiom produces, and it is the
 * only shape that can carry keys nobody enumerated.
 *
 * `blankNonCode` (shared helper) blanks comments and string bodies first, so
 * this file's own prose above cannot read as a call site.
 */
const REST_SPREAD = /\.\.\.\s*(?:(stripEdgeValueSourceKeys)\s*\(\s*)?([A-Za-z_$][\w$]*[Rr]est)\b/g

/** The wrapper that makes such a spread safe for edge data. */
const STRIP_CALL = 'stripEdgeValueSourceKeys'

/**
 * True when the spread sits inside an edge `data:` object literal. Cheap,
 * deliberately over-inclusive heuristic: look back a bounded window for a
 * `data: {` opener with no intervening `}` at the same nesting depth is more
 * machinery than this needs, so we use the marker that actually matters —
 * `DEFAULT_EDGE_DATA` being spread nearby, which is what every edge-data
 * literal in this tree does and is precisely the collision the strip prevents.
 */
function isEdgeDataContext(code: string, index: number): boolean {
  const WINDOW = 800
  const before = code.slice(Math.max(0, index - WINDOW), index)
  const after = code.slice(index, index + WINDOW)
  return before.includes('DEFAULT_EDGE_DATA') || after.includes('DEFAULT_EDGE_DATA')
}

interface Finding {
  file: string
  identifier: string
  stripped: boolean
}

function scan(): Finding[] {
  const findings: Finding[] = []
  for (const file of sourceFiles(CANVAS_ROOT)) {
    const code = blankNonCode(readFileSync(file, 'utf8'))
    for (const match of code.matchAll(REST_SPREAD)) {
      const index = match.index ?? 0
      if (!isEdgeDataContext(code, index)) continue
      // Group 1 is the wrapper when present: `...stripEdgeValueSourceKeys(edgeRest)`.
      findings.push({
        file: relative(CANVAS_ROOT, file),
        identifier: match[2],
        stripped: match[1] === STRIP_CALL,
      })
    }
  }
  return findings
}

describe('edge provenance laundering — derived source guard (F11)', () => {
  const findings = scan()

  // POSITIVE CONTROL (trap 13). If the detector finds nothing, every assertion
  // below is vacuous — which is exactly how this defect survived in the first
  // place. `DraftChat.tsx` is the known site; the scan must SEE it.
  it('the detector can see a real edge-data rest-spread (non-vacuous)', () => {
    expect(findings.length).toBeGreaterThan(0)
    expect(findings.some(f => f.file.includes('DraftChat'))).toBe(true)
  })

  it('every edge-data rest-spread strips the provenance markers', () => {
    const unstripped = findings.filter(f => !f.stripped)
    expect(
      unstripped.map(f => `${f.file}: ...${f.identifier}`),
    ).toEqual([])
  })
})
