/**
 * ⭐ THE CONVERTED GLYPHS DO NOT REGRESS TO A NATIVE `title=`.
 *
 * This lane converted TWO node glyphs — `BriefIcon` and `NodeProvenanceMark` —
 * from a bare `title=` attribute to the shared `Tooltip`. This file guards that
 * conversion PER COMPONENT, by name.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ WHAT THIS FILE USED TO DO, AND WHY IT WAS A LANDMINE FOR OTHER LANES
 * ─────────────────────────────────────────────────────────────────────────────
 * It pinned `title=` at **exactly 44** and `<Tooltip>` at **exactly 3** across
 * the whole of `src/canvas/nodes`, with `toBe` and a comment arguing that a
 * ceiling would be dishonest. The ceiling argument was right. The SCOPE was not.
 *
 * A whole-directory equality pin is a guard whose trigger is *"anybody touched
 * any file near me"*. Any concurrent canvas PR that adds or removes a single
 * `title=` anywhere under `src/canvas/nodes` — 44 production files — turns
 * staging RED once both merge, **with neither author having erred**. It also
 * punishes exactly the follow-on work this lane exists to invite: a sibling
 * converting a fourth glyph to `<Tooltip>` correctly would red the
 * `exactly 3, in exactly these files` claim for doing the right thing. A guard
 * that reds on correct work in someone else's PR does not get obeyed; it gets
 * deleted, and the real property goes with it.
 *
 * It was also, on its own terms, non-discriminating. Reverting this lane's
 * `OlumiSparkle` change (see below) moved `title=` 44 → 45 while `<Tooltip>`
 * files stayed at **exactly 3** — because the third file is now the
 * *unconverted* one. The count read identically for two opposite states of the
 * tree. **A directory total cannot tell a conversion from a coincidence.**
 *
 * The property actually worth guarding is per-component and cannot be broken by
 * an unrelated file: *these named glyphs carry no native `title=`, and each one
 * routes its hover through the shared `Tooltip`.* That is what is asserted
 * below.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 📋 THE DIRECTORY CENSUS — A DATED MEASUREMENT, DELIBERATELY NOT A GUARD
 * ─────────────────────────────────────────────────────────────────────────────
 * The remaining conversion work is real and worth sizing, so it is RECORDED
 * here as frozen evidence rather than enforced. Measured 7 Sep 2026 at this
 * lane's head, over `src/canvas/nodes` production files (`__tests__` excluded),
 * comments stripped, by the same `stripComments` + `countMatches` functions
 * this file exports:
 *
 *   | production files          | 44 |
 *   | native `title=` sites     | 45 |
 *   | `<Tooltip>` sites         |  3 |
 *
 * ⚠ These numbers are a snapshot, not a contract. Nothing asserts them, so they
 * WILL go stale — read them as "roughly this much remains", re-derive before
 * relying, and do not convert them back into a pin. Two of the three `<Tooltip>`
 * sites are this lane's; the third is `OlumiSparkle`, which is dead code (see
 * below) and was left exactly as it was found.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ THE COUNT IGNORES COMMENTS, AND THAT IS NOT A DETAIL
 * ─────────────────────────────────────────────────────────────────────────────
 * The naive sweep returned **48 after a change that REMOVED three**, because the
 * doc comments written to explain the removal each contain the literal
 * `` `title=` `` as prose. A tooltip inventory that counts prose ABOUT tooltips
 * measures the documentation, not the product, and it moves in the WRONG
 * DIRECTION when someone documents a fix. Comments are stripped before counting,
 * and `strips a comment-only occurrence` below is the control that proves the
 * stripper actually discriminates rather than being decoration.
 *
 * ⚠ AND WHAT NONE OF THIS CLAIMS. It counts SITES IN SOURCE. It is not a claim
 * that any of them is user-reachable (`ActionIcons` renders `null`
 * unconditionally at this tip — `canvasFactorConfirmation` is `'disabled'` — so
 * its `title` reaches nobody), and it is not a claim about what a browser paints.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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

/**
 * ⚠ THE PER-FILE PATTERNS CARRY NO `g` FLAG, AND THAT IS LOAD-BEARING, NOT
 * TIDINESS. `RegExp.prototype.test` on a GLOBAL regex advances `lastIndex` and
 * resumes from it on the next call, so one shared `/g` literal reused across
 * `it.each` cases returns true, then false, then true — a guard that alternates
 * with the order of the table and passes for whichever file happens to land on
 * an even index. `countMatches` needs `g` (it counts), so the counting pattern
 * is kept separate from the testing ones rather than shared.
 */
const NATIVE_TITLE = /\btitle=/
const TOOLTIP_ELEMENT = /<Tooltip[\s>]/
/** Present in essentially every node file — the contrast control's pattern. */
const CONTRAST = /className=/g

/**
 * Converted by this lane. Pinned BY NAME, and the name is the point: a count
 * cannot see a swap, and a directory total cannot see WHICH file changed.
 *
 * ⛔ `OlumiSparkle` IS DELIBERATELY ABSENT, AND ITS ABSENCE IS THE FINDING.
 * An earlier revision of this lane converted it too. Derived at this tip, with
 * `BriefIcon` and `NodeProvenanceMark` as contrast controls firing in the same
 * sweep: `OlumiSparkle` has **zero production render sites** — no JSX call site,
 * no importer outside its own barrel re-export, no dynamic import, no registry
 * indirection. Its last `<OlumiSparkle />` died on 30 Mar 2026. Wiring a hover
 * affordance onto a component no user can reach is the build-more-than-we-plug-in
 * failure, which this lane had already refused once (it reverted `ActionIcons`
 * on exactly that ground) and then committed on the third glyph. The file is
 * left in the state it was found in; deleting dead code that predates this lane
 * by five months is a separate change with a separate justification.
 *
 * ⚠ The sparkle a user actually sees on a canvas card is NOT this component —
 * it is `NodeProvenanceMark` rendering `VALUE_PROVENANCE_ICON.ai` (`Sparkles`),
 * which IS converted here. Two components, one glyph, different names: nothing
 * user-visible is lost by leaving `OlumiSparkle` alone.
 */
const ADOPTERS: string[] = ['shared/BriefIcon.tsx', 'shared/NodeProvenanceMark.tsx']

describe('node-surface tooltip inventory', () => {
  const files = productionFiles()

  describe('the probe can see — controls first', () => {
    /**
     * ⛔ AN ABSENCE PROBE POINTED AT NOTHING RETURNS ZERO AND LOOKS LIKE GOOD
     * NEWS. If `NODES_ROOT` ever resolves wrong, every read below finds nothing
     * and only this assertion notices.
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
     * read 0 alongside the real claims; a blind instrument can fake agreement
     * but cannot fake a discrimination it is not making.
     */
    it('reads a plausible non-zero count for a symbol known to be present', () => {
      expect(countMatches(files, CONTRAST)).toBeGreaterThan(200)
    })

    /**
     * ⭐ THE STRIPPER DISCRIMINATES. Without this the stripper could return its
     * input unchanged and every claim below would still look reasonable — while
     * reading prose about a conversion as the conversion itself.
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

    /**
     * ⛔ THE ADOPTER PATHS RESOLVE. Every per-component claim below reads a file
     * by path; a renamed or moved adopter would otherwise throw ENOENT in one
     * case and be silently skipped in another. Named here so a move is a clear
     * red with an obvious cause.
     */
    it.each(ADOPTERS)('%s exists where the guards look for it', (rel) => {
      expect(existsSync(join(NODES_ROOT, rel))).toBe(true)
    })
  })

  describe('the converted glyphs, per component', () => {
    /**
     * ⭐ THE PROPERTY, PER FILE — unbreakable by an unrelated author. The three
     * cases that used to live here were a directory-wide `title=` total, a
     * directory-wide `<Tooltip>` total, and a directory-wide file-list equality.
     * All three red when a sibling lane touches a file this lane never saw.
     */
    it.each(ADOPTERS)('%s carries no native title=', (rel) => {
      const code = stripComments(readFileSync(join(NODES_ROOT, rel), 'utf8'))
      expect(NATIVE_TITLE.test(code)).toBe(false)
    })

    /**
     * ⚠ THE POSITIVE HALF. `carries no native title=` is satisfied by a file
     * with no hover affordance AT ALL — deleting the glyph would pass it. This
     * asserts the hover went somewhere rather than away. The DOM-level twin,
     * which proves the bubble actually mounts and says the right sentence, is
     * `nodeIconHoverAffordance.spec.tsx`; this is the source-level claim that
     * keeps a silent revert visible in the inventory.
     */
    it.each(ADOPTERS)('%s routes its hover through the shared Tooltip', (rel) => {
      const code = stripComments(readFileSync(join(NODES_ROOT, rel), 'utf8'))
      expect(TOOLTIP_ELEMENT.test(code)).toBe(true)
    })

    /**
     * ⚠ AND THE DELAY IS THE SHARED SYMBOL, NOT A LITERAL. A repeated `300` at
     * each call site is the hand-maintained mirror this estate keeps paying for:
     * it agrees on the day it is written and drifts the first time one site is
     * edited. The RESOLVED-VALUE twin of this claim — every adopter passing the
     * same delay at runtime — is `nodeTooltipDelayParity.spec.tsx`.
     */
    it.each(ADOPTERS)('%s passes NODE_TOOLTIP_DELAY_MS, not a numeric literal', (rel) => {
      const code = stripComments(readFileSync(join(NODES_ROOT, rel), 'utf8'))
      const delays = code.match(/delay=\{[^}]*\}/g) ?? []
      expect(delays.length, `${rel} passes no delay at all`).toBeGreaterThan(0)
      for (const d of delays) expect(d).toBe('delay={NODE_TOOLTIP_DELAY_MS}')
    })
  })
})
