/**
 * G1 — THE DELETED 280px ANALYSIS-STATE CLAMP CANNOT RETURN.
 *
 * Mandatory guard 1 of `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md` §6.1.
 *
 * WHAT WAS DELETED AND WHY (17 Aug 2026, recorded in `OutputsDock.tsx`'s header
 * at :346-366): until an analysis result existed, the dock was clamped to
 * `dockWidthBounds().min` — 280px. Three things were wrong with it:
 *
 *  1. **It bought nothing.** The clamp existed to close the graph's legibility
 *     clamp. The drafted 17-node graph needs 1008px at the 0.50 floor and the
 *     fit box reaches only 896px even at a 280px dock (760 / 843 / 896 for dock
 *     416 / 333 / 280). The post-draft fit clamped at the floor at EVERY dock
 *     width, so the trade was one-sided from the day it shipped.
 *  2. **The floor is an unconditional constant**, so `Math.min(full, min)`
 *     returned 280px at 1280, at 1920 and at 3840 alike — a per-input rule
 *     returning the same answer for every input (CLAUDE.md trap 20) while the
 *     panel's content budget fell 390px → 254px, a 35% cut, at all of them.
 *     ⚠ At the 300px ceiling ruled on 14 Sep 2026 that budget is 274px.
 *  3. **Its input did not persist**, so every page reload re-narrowed the dock
 *     for a user who had run analyses all day.
 *
 * ⚠ THIS GUARD IS A REGRESSION PIN, NOT A FIX, and the distinction is stated so
 * nobody reads it as evidence of work done: the clamp is ALREADY absent at this
 * tip, so these assertions PASS at pristine. Their value is entirely in the
 * mutant — reintroduce the clamp and every one of them REDs. That mutant is run
 * and recorded in this lane's PR rather than asserted here.
 *
 * The reason it needs a guard at all: the workspace-composition change splits the
 * dock into two regions, and "the panel is short of room, narrow it" is exactly
 * the reasoning that produced the clamp the first time.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DOCK_MIN_WIDTH,
  DOCK_RESPONSIVE_MAX_WIDTH,
  DOCK_VIEWPORT_RATIO,
  resolveDockWidth,
  responsiveDockWidth,
  DOCK_REFERENCE_VIEWPORT,
} from '../dockWidth'

/**
 * Every viewport ≥1280 the product is driven at, plus the two the deleted clamp
 * proved indifferent to. Named individually rather than generated, so a width
 * that stops being covered is a visible edit (trap 2b in miniature).
 */
const WIDE_VIEWPORTS = [1280, 1366, 1440, 1512, 1600, 1920, 2560, 3840] as const

describe('G1 — the analysis-state clamp cannot return', () => {
  it('the default width is DOCK_RESPONSIVE_MAX_WIDTH at every viewport ≥1280', () => {
    // `null` is the "user has never dragged it" signal, i.e. the state the
    // deleted clamp acted on. Under the clamp every one of these read 280.
    for (const vw of WIDE_VIEWPORTS) {
      expect(resolveDockWidth(vw, null), `viewport ${vw}`).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
      expect(responsiveDockWidth(vw), `viewport ${vw} (responsive)`).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
    }
    // PIN THE PRECONDITION (trap 13b): the ceiling and the floor must be
    // DIFFERENT numbers, or the sweep above would be satisfied by the very
    // clamp it exists to forbid.
    //
    // ⚠ AND THAT PRECONDITION GOT WEAKER ON 14 Sep 2026, WHICH IS WORTH SAYING
    // OUT LOUD. The founder ruled the ceiling 416 -> 300 and the floor is
    // unchanged at 280, so these two numbers are now 20px apart rather than
    // 136px. The guard still discriminates — 300 is not 280 — but the margin it
    // discriminates by is much smaller, so a future change that lowers the
    // ceiling any further should treat this arm as close to vacuous.
    expect(DOCK_RESPONSIVE_MAX_WIDTH).not.toBe(DOCK_MIN_WIDTH)
    expect(DOCK_RESPONSIVE_MAX_WIDTH).toBe(300)
    expect(DOCK_MIN_WIDTH).toBe(280)
  })

  it('the width is a function of the VIEWPORT and of the stored value — of nothing else', () => {
    // `resolveDockWidth`'s whole signature is (viewportWidth, storedWidth). A
    // reintroduced analysis-state clamp needs a third input, so the pin is that
    // repeated calls with identical arguments are identical — asserted across a
    // sweep so a hidden module-level flag flipping between calls would show.
    for (const vw of WIDE_VIEWPORTS) {
      const first = resolveDockWidth(vw, null)
      expect(resolveDockWidth(vw, null)).toBe(first)
      expect(resolveDockWidth(vw, 480)).toBe(resolveDockWidth(vw, 480))
    }
  })

  it('SOURCE-LEVEL: dockWidth.ts contains no analysis-state branch', () => {
    // The behavioural sweep above cannot see a clamp that is present but dormant
    // (e.g. behind a flag defaulting off), and the decision asks for both. Read
    // with `readFileSync` and searched case-insensitively — `grep` without `-a`
    // is blind to a NUL-bearing source file (CLAUDE.md trap 17), and a
    // case-sensitive mint-check has produced a false "absent" in this estate
    // before.
    const path = resolve(__dirname, '../dockWidth.ts')
    const src = readFileSync(path, 'utf8')

    // POSITIVE CONTROL FIRST: an absence claim from an unproven reader is
    // vacuous. These three symbols are known to be present.
    for (const present of ['DOCK_MIN_WIDTH', 'resolveDockWidth', 'DOCK_VIEWPORT_RATIO']) {
      expect(src.toLowerCase(), `positive control: ${present}`).toContain(present.toLowerCase())
    }
    // And a magnitude check on the control (trap 13e): the file is real, not a
    // truncated read that would make every absence below trivially true.
    expect(src.length).toBeGreaterThan(2000)

    const FORBIDDEN = [
      'hasAnalysisResult',
      'hasCompletedFirstRun',
      'hasGraphContent',
      'analysisState',
      'resultsStatus',
      'isFirstUse',
    ]
    for (const symbol of FORBIDDEN) {
      expect(src.toLowerCase(), `dockWidth.ts must not read ${symbol}`).not.toContain(
        symbol.toLowerCase(),
      )
    }
  })

  it('the ratio still lands 1280 exactly ON the ceiling — the derivation, not a coincidence', () => {
    // ⭐⭐ THE DERIVATION IS NOW STRUCTURAL, AND THIS ARM IS WHAT NOTICED.
    //
    // This asserted `DOCK_VIEWPORT_RATIO === 0.325` beside a comment saying
    // "416 / 1280 = 0.325 exactly". Both were true and NEITHER WAS DERIVED — the
    // ratio was a hand-typed number that happened to equal the division, so when
    // the founder ruled the ceiling to 300 the relationship broke silently and
    // only this literal went red.
    //
    // `DOCK_VIEWPORT_RATIO` is now literally
    // `DOCK_RESPONSIVE_MAX_WIDTH / DOCK_REFERENCE_VIEWPORT`, so the first
    // assertion below can never fail and is deliberately DROPPED rather than
    // re-pinned at 0.234375 — a tautology dressed as a guard is worse than no
    // guard, because it reads as coverage.
    //
    // What survives is the CLAIM the block is actually about: the reference
    // laptop lands exactly on the ceiling. That still holds for any future
    // ceiling, and it still REDs if someone reintroduces a hand-set ratio.
    expect(Math.round(DOCK_REFERENCE_VIEWPORT * DOCK_VIEWPORT_RATIO)).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
    // …and the reference viewport is the one the module documents, not any
    // number that happens to satisfy the division.
    expect(DOCK_REFERENCE_VIEWPORT).toBe(1280)
  })
})
