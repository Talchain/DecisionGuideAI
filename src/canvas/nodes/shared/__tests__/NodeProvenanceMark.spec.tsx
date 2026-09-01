/**
 * The card says WHO put this element here, before it says any number.
 *
 * ⭐ THE DEFECT, from driving deployed staging: every element on a canvas card
 * was a conclusion. Six type sizes on one card and all of them results; the only
 * provenance signal was `est.` at 7px. A user could not tell their own model
 * from Olumi's guesses at a glance, which is the difference between a diagram of
 * a brief and a surface you can review.
 *
 * ⛔ WHAT THIS FILE ACTUALLY GUARDS is not "a pill renders" but **that the
 * canvas never invents an attribution**. Every assertion below is really about
 * one of two failure modes:
 *   1. claiming provenance the producer did not send (the fail-closed cases), and
 *   2. spelling the same provenance differently from the rest of the product
 *      (the copy-ownership case).
 * Both are lies about authorship, which is the one thing a review surface may
 * not get wrong.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import { VALUE_PROVENANCE_LABEL } from '../../../domain/valueProvenance'

const mark = () => screen.queryByTestId('node-provenance-mark')

describe('it names the author, in the product’s own words', () => {
  it.each([
    ['user_set', 'human'],
    ['from_brief', 'brief'],
    ['ai_inferred', 'ai'],
  ])('%s → the %s label the rest of the product already uses', (literal, kind) => {
    render(<NodeProvenanceMark provenance={literal} />)
    const el = mark()
    expect(el).not.toBeNull()
    expect(el!.getAttribute('data-provenance-kind')).toBe(kind)
    // ⚠ Asserted against the SHARED constant, never a string typed here. A
    // literal in this file would pass while the canvas and the Reasoning tab
    // called the same thing two different names — which is the drift the shared
    // module exists to prevent, reproduced inside its own guard.
    //
    // ⚠⚠ READ FROM THE ACCESSIBLE NAME, NOT `textContent`, SINCE 1 Sep 2026.
    // The mark became an ICON (the founder, on a real deployed model: nine of
    // fourteen cards read "AI estimate"), so the canonical words moved from
    // rendered text to `aria-label`. THE GUARD IS UNCHANGED IN WHAT IT
    // PROTECTS — copy OWNERSHIP, i.e. that this surface cannot spell an
    // authorship claim differently from the rest of the product. Only the
    // carrier moved, and re-pointing the assertion at the new carrier is what
    // stops it going vacuous. The glyph itself, the a11y contract and the
    // ABSENCE of rendered words are pinned separately in
    // `NodeProvenanceMark.iconography.spec.tsx`.
    expect(el!.getAttribute('aria-label')).toBe(
      VALUE_PROVENANCE_LABEL[kind as keyof typeof VALUE_PROVENANCE_LABEL],
    )
  })

  it('carries the raw producer literal for anyone debugging what actually arrived', () => {
    render(<NodeProvenanceMark provenance="ai_inferred" />)
    expect(mark()!.getAttribute('title')).toContain('ai_inferred')
  })
})

describe('⛔ it never invents an attribution', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a literal no producer writes', 'somebody_elses_guess'],
    ['a non-string', 42],
  ])('renders NOTHING for %s', (_label, value) => {
    render(<NodeProvenanceMark provenance={value as unknown} />)
    expect(mark()).toBeNull()
  })

  /*
   * THE DISCRIMINATING PAIR. An unrecognised literal and a recognised one, on
   * the same component. If the fallback were a default rather than silence,
   * BOTH would render; if the component were simply broken, NEITHER would. One
   * of each is the only outcome that shows the gate is live — and the harm it
   * guards is specific: a mark defaulting to "AI estimate" would attribute the
   * user's own work to Olumi.
   */
  it('and the same component DOES render for a literal it recognises', () => {
    const { unmount } = render(<NodeProvenanceMark provenance="not_a_real_provenance" />)
    expect(mark()).toBeNull()
    unmount()
    render(<NodeProvenanceMark provenance="from_brief" />)
    expect(mark()).not.toBeNull()
  })
})
