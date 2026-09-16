/**
 * ⭐ THE BASIS OF THE INFLUENCE FIGURE MUST BE VISIBLE, NOT HOVERED.
 *
 * ## The defect, measured on the deployed build
 *
 * `olumi-debug-1dd2133d-20260916.json` (staging, UI `6497a251`). The board rendered
 * **"Influence 100%"** on *Tech Lead Presence*. That number is `influence_score`, which PLoT
 * max-normalises — `plot-lite-service/src/lib/factor-influence.ts:113` (*"0-1 for display
 * (relative to max |influence|)"*) and `:556` (`Math.abs(influence) / maxAbsInfluence`). **Exactly
 * one factor reads 100% on every board, by construction**, whether it explains most of the outcome
 * or very little of it.
 *
 * The correct sentence was already written and centralised
 * (`influenceScaleCopy.INFLUENCE_EXPLANATION_RELATIVE`) — and every canvas rendering of it was a
 * `<Tooltip>` or a `title` attribute. **On a shared board nobody hovers, and on touch there is no
 * hover at all.**
 *
 * ## The fix was already written too, and was never wired
 *
 * `influenceBasisNoun()` exists in the same module and returns **'Relative influence'** for both
 * stamped provenances. Its own docblock states this defect and names these call sites:
 *
 * > *"⭐ WHY THE BASIS MOVED INTO THE VISIBLE STRING … A bare percentage there is taken for an
 * > absolute share of the outcome — a deployed graph showed exactly that. The basis was disclosed
 * > only through `title` and `aria-label`: a pointer user never opens the first and a sighted user
 * > never hears the second."*
 *
 * Measured before this change: `influenceBasisNoun` had **ZERO** non-test consumers (its only other
 * reference is a comment in `analysisNewTypes.ts` saying *"`influenceBasisNoun` now rules"*), while
 * its siblings `influenceBarAriaLabel` and `influenceExplanation` had 3 and 6. **The rule was
 * declared and never applied.** Contrast controls recorded so the zero is not a blind sweep.
 *
 * ⚠ `NodeMetricRow`'s own header already forbids exactly what was happening:
 * *"THE CAPTION IS VISIBLE TEXT, NEVER A `title` … a `title` is unreachable by keyboard on a
 * non-focusable row and absent on touch, so hiding the anchor there serves neither input class."*
 * The rule was in the file; the influence basis was delivered past it.
 *
 * ⚠ FAIL-CLOSED IS PRESERVED. With no stamped provenance `influenceBasisNoun` returns the plain
 * noun, and both canvas sites already withhold the figure entirely in that state — so this asserts
 * nothing about a basis the pipeline did not stamp.
 */
import { describe, it, expect } from 'vitest'
import {
  influenceBasisNoun,
  INFLUENCE_EXPLANATION_RELATIVE,
} from '../../../components/results/influenceScaleCopy'

describe('the influence basis is visible, not hovered', () => {
  it('names the basis in the noun for both stamped provenances', () => {
    // PRECONDITION pinned in-test: both stamped bases are set-relative, so both
    // must take the relative noun. If a future basis is genuinely absolute this
    // REDs, which is the correct outcome — the copy would then be wrong.
    expect(influenceBasisNoun('influence_score')).toBe('Relative influence')
    expect(influenceBasisNoun('normalised_elasticity')).toBe('Relative influence')
  })

  it('FAIL-CLOSED: an unstamped provenance claims no basis', () => {
    expect(influenceBasisNoun(null)).toBe('Influence')
    expect(influenceBasisNoun(undefined)).toBe('Influence')
  })

  it('the visible noun and the hover sentence agree — one vocabulary, two channels', () => {
    const noun = influenceBasisNoun('influence_score')
    // NON-VACUITY: the two strings must actually differ, or this asserts nothing.
    expect(noun).not.toBe(INFLUENCE_EXPLANATION_RELATIVE)
    // The hover sentence explains the same word the card now shows.
    expect(INFLUENCE_EXPLANATION_RELATIVE.toLowerCase()).toContain('relative to the strongest')
    expect(noun.toLowerCase()).toContain('relative')
  })

  it('the noun a reader sees is NOT the bare word that invited the absolute reading', () => {
    // This is the whole point: "Influence 100%" was the misread. Under a stamped
    // basis the card must no longer say just "Influence".
    expect(influenceBasisNoun('influence_score')).not.toBe('Influence')
  })
})

/**
 * ⚠ WHAT THIS SPEC DELIBERATELY DOES NOT CLAIM. jsdom cannot prove visibility
 * (CLAUDE.md trap 3): these assertions prove the STRING the card is given, never
 * that it is legible on the board. The width change that accompanies this
 * (`w-14` fixed → `min-w-[3.5rem]` growable on the detailed row, matching
 * `NodeMetricRow`'s own column) is a LAYOUT claim and is measured in a real
 * browser on the deployed build, recorded on the PR — not here.
 */

/**
 * ⭐ THE LEGEND IS THE ONLY EXPLANATION THAT SURVIVES A SHARED LINK.
 *
 * Every other channel for the influence basis is a `<Tooltip>`, a native `title` or an
 * `aria-label`. On a board opened from a shared link nobody hovers, and on touch there is no hover
 * at all — so the canvas legend is the load-bearing surface. At `6497a251` its gloss was
 * `INFLUENCE_EXPLANATION_GENERIC` ("how much this factor affects the outcome"), an ABSOLUTE claim
 * about a max-normalised figure: **the exact falsehood the sibling constant one line away exists to
 * refute.** Shipping the card's basis-aware noun without this would leave a card whose own key
 * contradicts it.
 */
import { METRIC_LEGEND_ROWS, MAX_GLOSS_LENGTH } from '../shared/metricVocabulary'

describe('the canvas legend explains the basis, because nothing else survives a share', () => {
  const influenceRow = () =>
    METRIC_LEGEND_ROWS.find(r => r.noun.toLowerCase().includes('influence'))

  it('the legend has an influence row at all', () => {
    // Non-vacuity floor: every assertion below is vacuous without this.
    expect(influenceRow()).toBeDefined()
  })

  it('states the relative basis', () => {
    expect(influenceRow()!.gloss.toLowerCase()).toContain('relative to the strongest')
  })

  it('states that the top driver always shows 100%', () => {
    expect(influenceRow()!.gloss.toLowerCase()).toContain('top driver always shows 100%')
  })

  it('⛔ no longer makes the bare absolute claim on its own', () => {
    // The generic constant's whole text is "how much this factor affects the outcome".
    // The relative one CONTAINS that clause and then qualifies it, so asserting the
    // absence of the clause would be wrong. What must not survive is the clause
    // STANDING ALONE — i.e. ending there, with no qualification.
    const gloss = influenceRow()!.gloss.toLowerCase().trim()
    expect(gloss).not.toBe('how much this factor affects the outcome')
    expect(gloss.indexOf('relative')).toBeGreaterThan(gloss.indexOf('affects the outcome'))
  })

  it('⚠ still fits the legend popover — the longer sentence must not break the surface it lives on', () => {
    // `MAX_GLOSS_LENGTH` is this module's own constraint. Swapping GENERIC for
    // RELATIVE lengthens the gloss, and a disclosure that overflows its popover is
    // a disclosure the reader does not get. Derived, not hard-coded.
    expect(influenceRow()!.gloss.length).toBeLessThanOrEqual(MAX_GLOSS_LENGTH)
    // Non-vacuity: prove the bound is actually tight enough to be a real check.
    expect(influenceRow()!.gloss.length).toBeGreaterThan(60)
  })
})
