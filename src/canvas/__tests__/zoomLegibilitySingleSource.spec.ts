/**
 * "At this zoom a label is legible" is ONE number. Enforced structurally.
 *
 * THE DEFECT THIS CLOSES: `LodSync.LOD_ZOOM_THRESHOLD = 0.5` and
 * `cameraComfort.MIN_READABLE_ZOOM = 0.5` were two hand-written literals in
 * two files, each commented as meaning "labels are/aren't readable here".
 * They agreed by luck, and nothing would have gone red when they stopped —
 * CLAUDE.md trap 12, the dominant defect class in this programme. A test
 * asserting `MIN_READABLE_ZOOM === LABEL_LEGIBLE_ZOOM` would be a TAUTOLOGY
 * once both derive from the one constant; it is the derivation that is the
 * guarantee, so what has to be guarded is that nobody restates the number.
 *
 * THE RULE: across non-test sources under `src/canvas`, exactly ONE zoom
 * constant may be initialised from a bare numeric literal, and it must be
 * `LABEL_LEGIBLE_ZOOM` in `utils/zoomLegibility.ts`. Every other zoom
 * constant must be initialised from an expression (i.e. derived).
 *
 * DERIVED, NOT MIRRORED: there is no allowlist of known-good files here — an
 * allowlist is the same hand-maintained mirror the rule exists to kill. The
 * expected set is computed from the sources themselves, so a THIRD literal
 * introduced under any new name (`READABLE_ZOOM`, `LABEL_ZOOM_MIN`, …) fails
 * this spec on the day it is written.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'

const CANVAS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

/** The one file allowed to state the number, and the one name it may use. */
const SINGLE_SOURCE_FILE = 'utils/zoomLegibility.ts'
const SINGLE_SOURCE_NAME = 'LABEL_LEGIBLE_ZOOM'

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
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
 * Every `const <NAME_WITH_ZOOM> = <bare number>` in `src`. Comments and string
 * bodies are blanked first (offset-preserving) so this file's own prose, and
 * the doc comments that quote the old literals, do not read as declarations.
 */
export function findLiteralZoomConstants(src: string): string[] {
  const code = blankNonCode(src)
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(-?\d+(?:\.\d+)?)\s*(?![\w.([])/g
  const found: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const name = m[1]!
    if (!/zoom/i.test(name)) continue
    found.push(`${name} = ${m[2]}`)
  }
  return found
}

describe('the scan itself bites (detector contract)', () => {
  it('catches a second hand-written legibility literal', () => {
    expect(findLiteralZoomConstants('export const MIN_READABLE_ZOOM = 0.5')).toEqual([
      'MIN_READABLE_ZOOM = 0.5',
    ])
    expect(findLiteralZoomConstants('const LOD_ZOOM_THRESHOLD = 0.5')).toEqual([
      'LOD_ZOOM_THRESHOLD = 0.5',
    ])
  })

  it('catches a literal introduced under a brand-new name', () => {
    expect(findLiteralZoomConstants('const readableZoomFloor = 0.45')).toEqual([
      'readableZoomFloor = 0.45',
    ])
  })

  it('catches a type-annotated literal', () => {
    expect(findLiteralZoomConstants('const LABEL_ZOOM: number = 0.5')).toEqual(['LABEL_ZOOM = 0.5'])
  })

  it('allows a DERIVED constant (an expression, not a literal)', () => {
    expect(findLiteralZoomConstants('const MIN_READABLE_ZOOM = LABEL_LEGIBLE_ZOOM')).toEqual([])
    expect(findLiteralZoomConstants('const LOD_ZOOM_THRESHOLD = LABEL_LEGIBLE_ZOOM * 1')).toEqual([])
    expect(findLiteralZoomConstants('const floor = readFloor(0.5)')).toEqual([])
  })

  it('ignores non-zoom constants and prose', () => {
    expect(findLiteralZoomConstants('const COMFORT_SLACK_PX = 8')).toEqual([])
    expect(findLiteralZoomConstants('// const MIN_READABLE_ZOOM = 0.5')).toEqual([])
    expect(findLiteralZoomConstants('const doc = "const MIN_READABLE_ZOOM = 0.5"')).toEqual([])
  })
})

describe('one legibility number under src/canvas', () => {
  it('no source but zoomLegibility.ts states a zoom threshold as a literal', () => {
    const violations: string[] = []
    let singleSourceDeclarations: string[] = []

    for (const file of sourceFiles(CANVAS_ROOT)) {
      const rel = relative(CANVAS_ROOT, file)
      const literals = findLiteralZoomConstants(readFileSync(file, 'utf8'))
      if (rel === SINGLE_SOURCE_FILE) {
        singleSourceDeclarations = literals
        continue
      }
      for (const decl of literals) violations.push(`${rel} → ${decl}`)
    }

    expect(violations).toEqual([])
    // …and the one permitted statement really is there, under the expected
    // name. Without this the rule would also be "satisfied" by deleting the
    // constant entirely.
    expect(singleSourceDeclarations).toHaveLength(1)
    expect(singleSourceDeclarations[0]).toMatch(new RegExp(`^${SINGLE_SOURCE_NAME} = `))
  })
})
