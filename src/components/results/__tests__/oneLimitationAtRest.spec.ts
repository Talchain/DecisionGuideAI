/**
 * ONE LIMITATION AT REST, AND THE REST DISCLOSED — not six sentences about one
 * problem at the top of the panel.
 *
 * ## Measured on Paul's run `1dd2133d`
 *
 * Seven producer warnings. `isStripEntry` already held four back on severity,
 * so the strip showed THREE, and all three say one thing:
 *
 *   · "This factor's success target can't be evaluated reliably"
 *   · "One of your success targets couldn't be compared with where its factor
 *      stands today ... State that factor's current level."
 *   · "Which unknowns most affect each option's chance of hitting your goal
 *      wasn't computed ..."
 *
 * and three of the four in the detail row repeat it again ("Add its current
 * value." three times). One cause, six sentences.
 *
 * ## Why a cap and not a grouping
 *
 * ⛔ GROUPING IS THE BETTER FIX AND THE PRODUCER CANNOT SUPPORT IT TODAY.
 * Measured on the same payload: `affected_nodes` and `affected_labels` are
 * UNDEFINED on all seven, and `field` is absent on the one warning that names a
 * real factor in prose. There is no structured key to group on, and a map of
 * which codes share a remedy would be the hand-maintained mirror this module
 * exists to avoid. Raised with Core rather than guessed here.
 *
 * ## The invariant that must not break
 *
 * The strip and the detail row are complements OF THE SAME PASS. Before the
 * cap, the detail row was `!isStripEntry`; if it had stayed that way, the
 * held-back entries would render in NEITHER place — a silent truncation, which
 * is worse than the crowding it was meant to fix. Both are asserted here.
 */
import { describe, it, expect } from 'vitest'

import { INFERENCE_WARNINGS_1DD2133D } from '../__fixtures__/inferenceWarnings.1dd2133d'
import {
  heldBackStripCount,
  isStripEntry,
  selectRestingStripEntries,
  selectHumanisedInferenceWarningsOutsideStrip,
} from '../utils/humaniseInferenceWarning'

type W = { code: string; message?: string; severity?: string; field?: string }

/**
 * The real array — a COMMITTED capture, not a retyped approximation and not a
 * read off the author's disk.
 *
 * ⛔ THE FIRST VERSION DID `readFileSync('/Users/paulslee/Downloads/…json')` AT
 * MODULE LOAD. It passed here and could not even COLLECT on a clean checkout:
 * hosted CI failed `ENOENT` and took a whole shard with it. A fixture that
 * resolves only on one machine is evidence about that machine.
 */
const REAL = INFERENCE_WARNINGS_1DD2133D as unknown as W[]

describe('one limitation at rest', () => {
  it('pins the corpus: seven producer warnings, three of them warning-severity', () => {
    // The positive control. Without it every assertion below could hold on an
    // empty array and prove nothing (trap 13).
    expect(REAL).toHaveLength(7)
    expect(REAL.filter(isStripEntry)).toHaveLength(3)
  })

  it('shows one at rest', () => {
    expect(selectRestingStripEntries(REAL)).toHaveLength(1)
  })

  it('states how many were held back', () => {
    expect(heldBackStripCount(REAL)).toBe(2)
  })

  it('renders every held-back entry in the detail row, so nothing is lost', () => {
    const detail = selectHumanisedInferenceWarningsOutsideStrip(REAL)
    const shownCode = selectRestingStripEntries(REAL)[0]!.code
    // Six of seven: everything except the one on screen.
    expect(detail).toHaveLength(6)
    expect(detail.map((d) => d.code)).not.toContain(shownCode)
    for (const w of REAL) {
      if (w.code === shownCode) continue
      expect(detail.map((d) => d.code)).toContain(w.code)
    }
  })

  it('never repeats: the strip entry and the detail set are disjoint', () => {
    const strip = selectRestingStripEntries(REAL).map((w) => w.code)
    const detail = selectHumanisedInferenceWarningsOutsideStrip(REAL).map((d) => d.code)
    for (const c of strip) expect(detail).not.toContain(c)
  })

  it('keeps the producer’s order, which is the only ordering evidence there is', () => {
    const first = REAL.find(isStripEntry)!
    expect(selectRestingStripEntries(REAL)[0]!.code).toBe(first.code)
  })

  it('holds nothing back when the producer sent only one', () => {
    const one = REAL.filter(isStripEntry).slice(0, 1)
    expect(selectRestingStripEntries(one)).toHaveLength(1)
    expect(heldBackStripCount(one)).toBe(0)
  })

  /**
   * ⭐⭐ THE TWO SIDES SEE DIFFERENT INPUTS, AND THEY MUST STILL PICK THE SAME
   * ENTRY — found by self-review after the cap shipped, not by a failure.
   *
   * `AnalysisNewTabBody:1337` hands the strip `vm.deeper.caveats`, which
   * `buildAnalysisNewViewModel:1754` has ALREADY filtered to `isStripEntry`.
   * The detail row calls `selectHumanisedInferenceWarningsOutsideStrip` on the
   * FULL producer array. So the cap is computed twice, over a 3-entry list and
   * over a 7-entry one.
   *
   * They agree today because both take "the first `isStripEntry` in producer
   * order" and filtering preserves order. That agreement is INCIDENTAL, not
   * structural: it would break the day anything re-ordered or partially
   * filtered either input, and the failure would be silent in both directions —
   * one warning on screen twice, or one in neither place.
   *
   * ⚠ This PINS the agreement rather than removing the duplication. Removing it
   * means changing what the view model hands the strip, which is a change to a
   * shared contract and belongs in its own increment. Recorded as such rather
   * than left as an unstated assumption.
   */
  it('picks the SAME entry whether it sees the full array or the pre-filtered one', () => {
    const preFiltered = REAL.filter(isStripEntry)
    expect(preFiltered.length, 'precondition: the two inputs really do differ').toBeLessThan(
      REAL.length,
    )

    const fromFull = selectRestingStripEntries(REAL)
    const fromFiltered = selectRestingStripEntries(preFiltered)

    expect(fromFull).toHaveLength(1)
    expect(fromFiltered).toHaveLength(1)
    // By identity, not by code: two entries can share a code.
    expect(fromFiltered[0]).toBe(fromFull[0])

    // And the counts a reader is shown must match too.
    expect(heldBackStripCount(preFiltered)).toBe(heldBackStripCount(REAL))
  })

  it('is empty and silent when the producer sent none', () => {
    expect(selectRestingStripEntries([])).toEqual([])
    expect(heldBackStripCount(undefined)).toBe(0)
    expect(selectHumanisedInferenceWarningsOutsideStrip(undefined)).toEqual([])
  })
})
