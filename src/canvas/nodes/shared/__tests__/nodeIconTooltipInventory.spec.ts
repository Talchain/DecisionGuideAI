/**
 * ⭐ THE REMAINING WORK IS COUNTED, SO IT CANNOT SILENTLY DRIFT.
 *
 * This lane converted THREE node glyphs from a native `title=` to the shared
 * `Tooltip`. It did not convert the other forty-four sites, and the honest way to
 * ship a partial conversion is to make the remainder VISIBLE and PINNED rather
 * than to leave a nine-implementation estate that nobody can size.
 *
 * Measured at `80bacf36` and again after the change, over
 * `src/canvas/nodes` production files (tests excluded):
 *
 *   |                    | pristine | after |
 *   |--------------------|----------|-------|
 *   | native `title=`    |       47 |    44 |
 *   | `<Tooltip>`        |        1 |     3 |
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ THE COUNT IGNORES COMMENTS, AND THAT IS NOT A DETAIL — IT IS THE REASON
 *    THE FIRST VERSION OF THIS SPEC WAS WRONG
 * ─────────────────────────────────────────────────────────────────────────────
 * The naive sweep returned **48 after a change that REMOVED three**, because the
 * doc comments written to explain the removal each contain the literal
 * `` `title=` `` as prose. A tooltip inventory that counts prose ABOUT tooltips
 * measures the documentation, not the product, and it moves in the WRONG
 * DIRECTION when someone documents a fix. Comments are stripped before counting,
 * and `strips a comment-only occurrence` below is the control that proves the
 * stripper actually discriminates rather than being decoration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ FAILS LOUD IN BOTH DIRECTIONS, NEVER ASSUME-GOOD
 * ─────────────────────────────────────────────────────────────────────────────
 * The pins are `toBe`, not `toBeLessThanOrEqual`. A ceiling would silently bless
 * a conversion that never happened AND silently absorb a new bare `title=` added
 * under the ceiling. Going UP means a regression landed; going DOWN means real
 * progress that must be RECORDED here in the same commit. Either way a human
 * reads the number and moves it deliberately — which is the whole point of a
 * derived guard over a hand-maintained document.
 *
 * ⚠ AND WHAT IT DOES **NOT** CLAIM. This counts SITES IN SOURCE. It is not a
 * claim that 44 icons are user-reachable (`ActionIcons` renders `null`
 * unconditionally at this tip — `canvasFactorConfirmation` is `'disabled'` — so
 * its `title` reaches nobody), and it is not a claim about what a browser paints.
 * It is a source-inventory guard and says so.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * `src/canvas/nodes`, resolved from the runner's cwd.
 *
 * ⚠ `import.meta.url` is NOT available here: under the `jsdom` environment it is
 * not a `file:` URL, and `fileURLToPath` throws `ERR_INVALID_URL_SCHEME` at
 * collect time. That failure is loud (the file collects 0 tests and the run
 * REDs), but a cwd is a moving part, so it is asserted rather than assumed —
 * `is pointed at a non-empty set of production files` checks the directory
 * exists and holds what it should before any count is believed.
 */
const NODES_ROOT = join(process.cwd(), 'src', 'canvas', 'nodes')

/**
 * Remove `/* *\/` and `//` runs so prose about tooltips never counts as one.
 *
 * Deliberately a small scanner and not a parser: it is exercised by a control
 * with a known answer below, which is the only thing that makes it trustworthy.
 */
export function stripComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end < 0 ? source.length : end + 2
      continue
    }
    if (source[i] === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i)
      i = end < 0 ? source.length : end
      continue
    }
    out += source[i]
    i += 1
  }
  return out
}

/** Production `.ts`/`.tsx` under `src/canvas/nodes`; `__tests__` excluded. */
function productionFiles(dir = NODES_ROOT, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') productionFiles(full, acc)
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc.sort()
}

/**
 * ⭐ THE ONE PROBE. Every claim below — and the contrast control — calls THIS
 * function with a different pattern.
 *
 * ⚠ That is the whole design. A control implemented as a separate sweep proves
 * only that the CONTROL's code path works; it shares no failure mode with the
 * real probe, so it would report healthy while the real probe read a stale path,
 * an empty file list, or a regex that matches nothing. Parameterising one
 * function is what makes the control evidence about the probe that produced the
 * numbers.
 */
function countMatches(files: string[], pattern: RegExp): number {
  return files.reduce((total, file) => {
    const code = stripComments(readFileSync(file, 'utf8'))
    return total + (code.match(pattern)?.length ?? 0)
  }, 0)
}

function filesMatching(files: string[], pattern: RegExp): string[] {
  return files
    .filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
    .map((file) => relative(NODES_ROOT, file))
}

const NATIVE_TITLE = /\btitle=/g
const TOOLTIP_ELEMENT = /<Tooltip[\s>]/g
/** Present in essentially every node file — the contrast control's pattern. */
const CONTRAST = /className=/g

/** Converted by this lane. Pinned BY NAME: a bare count cannot see a swap. */
const ADOPTERS = ['shared/BriefIcon.tsx', 'shared/NodeProvenanceMark.tsx', 'shared/OlumiSparkle.tsx']

const NATIVE_TITLE_SITES = 44
const TOOLTIP_SITES = 3

describe('node-surface tooltip inventory', () => {
  const files = productionFiles()

  describe('the probe can see — controls first', () => {
    /**
     * ⛔ AN ABSENCE PROBE POINTED AT NOTHING RETURNS ZERO AND LOOKS LIKE GOOD
     * NEWS. If `NODES_ROOT` ever resolves wrong, every count below reads 0 and
     * only this assertion notices.
     */
    it('is pointed at a non-empty set of production files', () => {
      // The cwd really is this repo's root, and the directory really is there.
      expect(existsSync(join(process.cwd(), 'package.json'))).toBe(true)
      expect(existsSync(NODES_ROOT)).toBe(true)
      expect(existsSync(join(NODES_ROOT, 'BaseNode.tsx'))).toBe(true)
      expect(files.length).toBeGreaterThanOrEqual(40)
      expect(files.every((f) => readFileSync(f, 'utf8').length > 0)).toBe(true)
      expect(files.some((f) => f.includes('__tests__'))).toBe(false)
    })

    /**
     * ⭐ CONTRAST CONTROL — SAME FUNCTION, SAME COMMAND SHAPE, DIFFERENT PATTERN.
     * A symbol expected PRESENT in quantity. If the probe were blind, this would
     * read 0 alongside the real numbers; a blind instrument can fake agreement
     * but cannot fake a discrimination it is not making.
     */
    it('reads a plausible non-zero count for a symbol known to be present', () => {
      expect(countMatches(files, CONTRAST)).toBeGreaterThan(200)
    })

    /**
     * ⭐ THE STRIPPER DISCRIMINATES. Without this the stripper could return its
     * input unchanged and every number would still look reasonable — while
     * moving the wrong way each time somebody documents a conversion.
     */
    it('strips a comment-only occurrence, and keeps a real one', () => {
      const fixture = [
        '/** doc: replaces the native title= attribute */',
        '// inline: another title= mention',
        'const el = <span title="real" />',
      ].join('\n')
      expect((fixture.match(/\btitle=/g) ?? []).length).toBe(3)
      expect((stripComments(fixture).match(/\btitle=/g) ?? []).length).toBe(1)
    })
  })

  describe('the inventory', () => {
    it(`has exactly ${TOOLTIP_SITES} <Tooltip> sites, in exactly the named files`, () => {
      expect(filesMatching(files, TOOLTIP_ELEMENT)).toEqual(ADOPTERS)
      expect(countMatches(files, TOOLTIP_ELEMENT)).toBe(TOOLTIP_SITES)
    })

    it(`has exactly ${NATIVE_TITLE_SITES} remaining native title= sites`, () => {
      const actual = countMatches(files, NATIVE_TITLE)
      expect(
        actual,
        actual > NATIVE_TITLE_SITES
          ? `A native title= was ADDED (${actual} > ${NATIVE_TITLE_SITES}). Native title gives no ` +
            'visible hover state and ~1s of OS dwell — the defect this lane exists to close. ' +
            'Prefer the shared Tooltip; if this one is deliberate, move the pin and say why.'
          : `Native title= sites went DOWN (${actual} < ${NATIVE_TITLE_SITES}) — good news that must ` +
            'be recorded. Update the pin and the table at the top of this file in the same commit.',
      ).toBe(NATIVE_TITLE_SITES)
    })

    /**
     * ⚠ The three converted glyphs must carry NO `title=`, or they paint two
     * tooltips. Asserted on the SOURCE here and on the rendered DOM in
     * `nodeIconHoverAffordance.spec.tsx` — the source claim is what keeps a
     * re-added attribute visible in this inventory.
     */
    it('no converted file still carries a native title=', () => {
      const regressed = ADOPTERS.filter((rel) =>
        /\btitle=/.test(stripComments(readFileSync(join(NODES_ROOT, rel), 'utf8'))),
      )
      expect(regressed).toEqual([])
    })
  })
})
