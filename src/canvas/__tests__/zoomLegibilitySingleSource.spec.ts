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
 *
 * ⭐⭐ EXTENDED 31 Aug 2026 — ONE NUMBER WAS NEVER THE WHOLE RULE, AND THE HALF
 * THIS FILE DID NOT COVER IS THE ONE THAT SHIPPED A DEFECT (#1051). Nothing here
 * cared WHO a fit belonged to. `zoomLegibility.ts` stated in prose that explicit
 * user gestures "stay unfloored by design" and named the two call sites; both of
 * them passed `minZoom: LABEL_LEGIBLE_ZOOM` — legally, since they imported the
 * one constant rather than restating it. So "Fit to view" and the palette's
 * "Zoom to Fit" could not show the whole of any model whose fit sits below 0.5,
 * a doctrine paragraph and its implementation disagreed for weeks, and this
 * guard was green throughout. It was watching the number and not the rule.
 *
 * The second half below therefore pins the CLASSES: the legibility bounds may
 * only reach a `fitView` through `fitBoundsFor(initiator)`, and the sites that
 * fit as `'user'` must be exactly the sites that claim the camera for the user
 * (`utils/userCameraClaim.ts`). Two lists derived from the same tree, asserted
 * equal — so a fit cannot belong to one class for the floor and the other for
 * the camera.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'

const CANVAS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

/** The one file allowed to state a zoom number, and the names it may use.
 *
 * ⚠ `AUTO_FIT_MAX_ZOOM` JOINED THIS SET DELIBERATELY, 26 Aug 2026. It first
 * shipped as `labelCounterScale(1)`, which READ as derived and was not: the
 * expression evaluates to 1 for every input, so it was a bare `1` wearing a
 * derivation — and it slipped past the check below because this regex matches a
 * numeric literal and cannot see a call expression. Naming it here makes it
 * visible to the guard instead of hidden from it.
 *
 * The rule this file enforces is NOT "one number" — it is "no SECOND copy of a
 * number that already has a home". These two are different quantities: a
 * legibility floor and a magnification ceiling. What must never appear is a
 * third file restating either. */
const SINGLE_SOURCE_FILE = 'utils/zoomLegibility.ts'
const SINGLE_SOURCE_NAMES = ['LABEL_LEGIBLE_ZOOM', 'AUTO_FIT_MAX_ZOOM']

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

  /**
   * ⭐ ADDED 2 Sep 2026, WITH THE LADDER'S THIRD ZOOM CONSTANT.
   *
   * `ICON_LEGIBLE_ZOOM` is the first zoom constant to live in `zoomLegibility.ts`
   * WITHOUT being one of the two names permitted above. It passes the scan only
   * because it is genuinely derived — `CANVAS_TEXT_FLOOR_PX / CANVAS_BADGE_ICON_PX`
   * — and nothing pinned that. The realistic rot is an author "simplifying" the
   * quotient to `0.714`, which would both restate a number and lose its
   * derivation. These cases pin that the scan bites that spelling.
   */
  it('would catch a bare-literal ICON_LEGIBLE_ZOOM — the ladder constant, spelled wrong', () => {
    expect(findLiteralZoomConstants('export const ICON_LEGIBLE_ZOOM = 0.714')).toEqual([
      'ICON_LEGIBLE_ZOOM = 0.714',
    ])
  })

  it('does NOT catch the derived spelling actually shipped, nor the PX sizes it derives from', () => {
    expect(
      findLiteralZoomConstants(
        'export const ICON_LEGIBLE_ZOOM = CANVAS_TEXT_FLOOR_PX / CANVAS_BADGE_ICON_PX',
      ),
    ).toEqual([])
    // The two pixel sizes are out of scope by NAME, not by luck — the scan
    // filters on /zoom/i. Pinned because the exact-count assertion below depends
    // on them staying invisible to it.
    expect(findLiteralZoomConstants('export const CANVAS_TEXT_FLOOR_PX = 10')).toEqual([])
    expect(findLiteralZoomConstants('export const CANVAS_BADGE_ICON_PX = 14')).toEqual([])
  })

  it('KNOWN BLIND SPOT, pinned as exactly itself: a TRAILING literal escapes the scan', () => {
    // ⚠ AN HONEST GAP, RECORDED RATHER THAN LEFT INVISIBLE (CLAUDE.md trap 22f:
    // pin a known gap as an explicit set, so the suite is green for the right
    // reason and REDs if the set grows OR shrinks).
    //
    // The regex matches `const NAME = <number>`, so it sees a LEADING literal
    // and is blind to a trailing one. `LABEL_LEGIBLE_ZOOM * 1.4286` is a
    // hand-written number wearing a derivation — the same shape as
    // `AUTO_FIT_MAX_ZOOM = labelCounterScale(1)`, which is why that constant had
    // to be NAMED above rather than caught.
    //
    // Not fixed here on purpose: widening this regex changes a guard that runs
    // over every file under `src/canvas`, and it deserves its own change with
    // its own mutants rather than riding along with a ladder PR.
    expect(
      findLiteralZoomConstants('const ICON_LEGIBLE_ZOOM = LABEL_LEGIBLE_ZOOM * 1.4286'),
    ).toEqual([])
    // The contrast that proves the scan is not simply blind to this NAME: swap
    // the operands and it is caught. Without this the case above would pass just
    // as well against a detector that had stopped working entirely.
    expect(
      findLiteralZoomConstants('const ICON_LEGIBLE_ZOOM = 1.4286 * LABEL_LEGIBLE_ZOOM'),
    ).toEqual(['ICON_LEGIBLE_ZOOM = 1.4286'])
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
    // Both permitted constants must really be there, under their expected
    // names. Without this the rule would also be "satisfied" by deleting one.
    expect(singleSourceDeclarations).toHaveLength(SINGLE_SOURCE_NAMES.length)
    const declaredNames = singleSourceDeclarations.map((d) => d.split(' = ')[0]).sort()
    expect(declaredNames).toEqual([...SINGLE_SOURCE_NAMES].sort())
  })
})

/* ── the two fit classes ───────────────────────────────────────────────────── */

/** The module that DECLARES the camera claim; it is not a call site. */
const CLAIM_MODULE = 'utils/userCameraClaim.ts'

/** The legibility constants, as a fit would name them. */
const LEGIBILITY_CONSTANTS = ['LABEL_LEGIBLE_ZOOM', 'AUTO_FIT_MAX_ZOOM'] as const

/**
 * Every `minZoom:` / `maxZoom:` FIELD set directly from a legibility constant.
 *
 * A FIELD, not any mention: `topAnchoredViewportWhenClamped(bounds, w, h, insets,
 * LABEL_LEGIBLE_ZOOM)` passes the same constant positionally and is not a fit
 * bound, and `useFocusCamera`'s `maxZoom: 1.2` is a different quantity entirely.
 * Matching the field assignment is what separates "a fit declared its own
 * legibility band" from every other use of the number.
 */
export function findHandSetLegibilityBounds(src: string): string[] {
  const code = blankNonCode(src)
  const re = /\b(minZoom|maxZoom)\s*:\s*([A-Za-z_$][\w$]*)/g
  const found: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const value = m[2]!
    if (!(LEGIBILITY_CONSTANTS as readonly string[]).includes(value)) continue
    found.push(`${m[1]}: ${value}`)
  }
  return found
}

/**
 * Which initiators a file names when it asks for fit bounds.
 *
 * ⚠ THE ARGUMENT IS A STRING LITERAL, AND `blankNonCode` BLANKS STRING BODIES —
 * so scanning the blanked source alone finds `fitBoundsFor('    ')` and reads
 * every call as unclassified. Caught by this file's own positive control, which
 * is the only reason it did not ship as a guard that matched nothing. The
 * blanking IS still needed, to keep prose and code samples out; it is
 * offset-preserving, so the call sites are located in the blanked source and the
 * initiator is then read from the RAW source at the same offset.
 */
export function findFitBoundsInitiators(src: string): string[] {
  const code = blankNonCode(src)
  const re = /\bfitBoundsFor\s*\(/g
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const arg = /^\s*'(user|product)'/.exec(src.slice(m.index + m[0].length))
    if (arg) found.add(arg[1]!)
  }
  return [...found].sort()
}

describe('the class scan itself bites (detector contract)', () => {
  it('catches a fit that sets a legibility bound by hand — the #1051 shape', () => {
    expect(findHandSetLegibilityBounds('fitView({ padding, minZoom: LABEL_LEGIBLE_ZOOM })')).toEqual([
      'minZoom: LABEL_LEGIBLE_ZOOM',
    ])
    expect(findHandSetLegibilityBounds('fitView({ maxZoom: AUTO_FIT_MAX_ZOOM })')).toEqual([
      'maxZoom: AUTO_FIT_MAX_ZOOM',
    ])
  })

  it('does NOT catch the same constant used for something that is not a fit bound', () => {
    // The contrast that proves the scan discriminates rather than matching the
    // constant's name wherever it appears.
    expect(findHandSetLegibilityBounds('topAnchoredViewportWhenClamped(b, w, h, i, LABEL_LEGIBLE_ZOOM)')).toEqual([])
    expect(findHandSetLegibilityBounds('setViewport({ zoom: LABEL_LEGIBLE_ZOOM })')).toEqual([])
    expect(findHandSetLegibilityBounds('fitView({ maxZoom: 1.2 })')).toEqual([])
    expect(findHandSetLegibilityBounds('// minZoom: LABEL_LEGIBLE_ZOOM')).toEqual([])
  })

  it('reads the initiator a fit names', () => {
    expect(findFitBoundsInitiators("fitView({ ...fitBoundsFor('user') })")).toEqual(['user'])
    expect(findFitBoundsInitiators("fitView({ ...fitBoundsFor('product') })")).toEqual(['product'])
    expect(findFitBoundsInitiators('fitView({})')).toEqual([])
  })
})

describe('a fit belongs to ONE class, for the floor and for the camera alike', () => {
  it('no fit under src/canvas sets a legibility bound by hand', () => {
    const violations: string[] = []
    for (const file of sourceFiles(CANVAS_ROOT)) {
      const rel = relative(CANVAS_ROOT, file)
      // The module that OWNS the bounds is where they are allowed to be named.
      if (rel === SINGLE_SOURCE_FILE) continue
      for (const hit of findHandSetLegibilityBounds(readFileSync(file, 'utf8'))) {
        violations.push(`${rel} → ${hit}`)
      }
    }
    expect(
      violations,
      'a fit declared its own legibility band instead of naming its class — this is exactly how ' +
        '"Fit to view" ended up floored while the doctrine said it was not (#1051)',
    ).toEqual([])
  })

  it('the USER-bounded fits are exactly the fits that claim the camera for the user', () => {
    const userBounded: string[] = []
    const claiming: string[] = []
    for (const file of sourceFiles(CANVAS_ROOT)) {
      const rel = relative(CANVAS_ROOT, file)
      // The module that DECLARES the claim is not a call site — its
      // `export function claimCameraForUser()` matches a call-shaped regex.
      if (rel === CLAIM_MODULE) continue
      const src = readFileSync(file, 'utf8')
      const code = blankNonCode(src)
      if (findFitBoundsInitiators(src).includes('user')) userBounded.push(rel)
      if (/\bclaimCameraForUser\s*\(/.test(code)) claiming.push(rel)
    }

    // POSITIVE CONTROL: an empty-vs-empty comparison would pass while proving
    // nothing (CLAUDE.md trap 13).
    expect(userBounded.length, 'the scan found no user-bounded fit at all').toBeGreaterThan(0)
    expect(
      userBounded.sort(),
      'a fit is bounded as the user\'s but does not claim the camera for them, or the reverse — ' +
        'the two halves of one rule have drifted apart',
    ).toEqual(claiming.sort())
  })
})
