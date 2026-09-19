/**
 * `SignedStrengthSlider` — the DEFAULT must offer plain language, and the
 * precise figure must survive in the channel that needs it.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * A raw-float census (2026-09-19, SHA `bc1c3b89`) shortlisted this component
 * as *"v1 defaults technical detail ON (`techMode = true`) while v2's
 * `useTechToggle` defaults it OFF — flipping one default can fix a class."*
 *
 * ⚠⚠ THAT PREMISE IS REFUTED AT THE BYTES, AND THE DIRECTION IS INVERTED.
 * `techMode` in this component does not gate a FIGURE. Its only consumer is
 * the `{!techMode && …}` block that renders the three plain-language endpoint
 * captions. So `techMode = true` — the old default — SUPPRESSED the plain
 * language rather than revealing technical detail. The founder's complaint
 * ("technical data not hidden behind progressive disclosure") had a
 * mirror-image here: the plain-language help was hidden by a misnamed default.
 *
 * The flip is therefore not "hide the number"; it is "stop hiding the words".
 *
 * ── THE MEASURED BLAST RADIUS, WHICH IS WHY THE FLIP IS SAFE ──────────────
 * Every consumer of this component in `src/`, enumerated before the change:
 *
 *   · `inspector-v2/panels/EdgePanel.tsx:893`  LIVE   passes `techMode={techMode}`
 *                                                     EXPLICITLY → the default
 *                                                     cannot reach it. UNAFFECTED.
 *   · `components/model-tab/ContestedEdgeCard.tsx:396`  LIVE   omits the prop →
 *                                                     GAINS the three captions.
 *                                                     This is the whole
 *                                                     user-visible effect.
 *   · `ui/EdgeInspector.tsx:405`                DARK   see that file's header.
 *   · `SignedStrengthSlider.stories.tsx:22`     Storybook only.
 *
 * No caller depended on the old default to SHOW anything — the old default only
 * ever HID. That asymmetry is what makes this a gain rather than a trade.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES **NOT** ASSERT ───────────────────────
 * ⚠ jsdom cannot prove visibility or layout. Every assertion below is about
 * presence, exact count, accessible name, or an attribute's exact string. None
 * of them is evidence that a caption is legible, unclipped, or on screen, and
 * no such claim is made anywhere in this file or in the PR that carries it.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignedStrengthSlider } from '../SignedStrengthSlider'

/** The three captions, as the component spells them. */
const ENDPOINTS = ['Strong negative', 'No effect', 'Strong positive'] as const

/**
 * Pin the instrument before believing any absence below.
 *
 * ⚠ An `expect(...).not.toBeInTheDocument()` passes beautifully against a
 * component that rendered nothing at all — a failed render and a correctly
 * suppressed caption are indistinguishable from the assertion's point of view.
 * So every test that asserts an ABSENCE calls this first, and it asserts a
 * PRESENCE that must hold in both arms: the slider itself.
 */
function assertSliderRendered(): HTMLElement {
  const sliders = screen.getAllByRole('slider', { name: 'Effect on target' })
  // Exactly one, bound by accessible name — not "at least one", which a
  // duplicated render would also satisfy.
  expect(sliders).toHaveLength(1)
  return sliders[0]
}

describe('SignedStrengthSlider — plain language is the DEFAULT', () => {
  it('CONTROL — the probe discriminates: the slider is present, a fabricated caption is not', () => {
    render(<SignedStrengthSlider value={0.35} onChange={() => {}} />)

    assertSliderRendered()
    // Negative control. Without this, a query helper that matched everything
    // (or a text matcher accidentally matching the whole container) would make
    // every presence assertion below vacuous.
    expect(screen.queryByText('Strong sideways (fabricated)')).not.toBeInTheDocument()
  })

  it('⭐ RED-FIRST — with NO techMode prop, all three plain-language captions render exactly once', () => {
    render(<SignedStrengthSlider value={0.35} onChange={() => {}} />)

    assertSliderRendered()

    for (const caption of ENDPOINTS) {
      // `getAllByText` + an exact length, not `getByText`. `getByText` throws on
      // duplicates, which would report a DUPLICATION defect as a missing
      // caption — the wrong diagnosis for the wrong reason.
      expect(screen.getAllByText(caption)).toHaveLength(1)
    }
  })

  it('⭐ DISCRIMINATING TWIN — an explicit techMode still suppresses them (EdgePanel’s contract)', () => {
    // This is the other half of the pair. The test above alone would also pass
    // if the flip had simply DELETED the gate, which would silently duplicate
    // EdgePanel's own endpoint row (`EdgePanel.tsx:896-898` renders the same
    // three strings unconditionally). Only this twin proves the gate survived.
    render(<SignedStrengthSlider value={0.35} onChange={() => {}} techMode />)

    assertSliderRendered()

    for (const caption of ENDPOINTS) {
      expect(screen.queryByText(caption)).not.toBeInTheDocument()
    }
  })

  it('techMode={false} is explicit-equivalent to omitting it', () => {
    render(<SignedStrengthSlider value={0.35} onChange={() => {}} techMode={false} />)

    assertSliderRendered()
    for (const caption of ENDPOINTS) {
      expect(screen.getAllByText(caption)).toHaveLength(1)
    }
  })
})

describe('SignedStrengthSlider — aria-valuetext stays PRECISE (this is not a float to band)', () => {
  /**
   * ⛔ DO NOT "FIX" THE FIGURE IN `aria-valuetext` BY BANDING IT.
   *
   * This is the accessible value of an INTERACTIVE range input the user drags,
   * not a read-out of a model internal. A screen-reader user aiming for 0.35
   * cannot do it from the word "Moderate", which spans 0.20–0.40 on the canonical
   * table (`CANVAS_STRENGTH_BANDS`) — they could not distinguish 0.21 from 0.39.
   * Banding it would make the control unusable, i.e. an accessibility
   * REGRESSION dressed as a progressive-disclosure fix.
   *
   * ⚠ AND A BAND WORD HERE WOULD LIGHT A MEASURED CROSS-VOCABULARY COLLISION.
   * `ContestedEdgeCard` renders this slider AND labels the same number with
   * `model-tab/strengthBands.getDirectionalStrengthLabel`, whose cuts are
   * 0.6 / 0.25 / 0.05 against the canonical 0.70 / 0.40 / 0.20. At |0.5| the
   * card says "Moderate positive effect" while the canonical table says
   * "Strong" — one number under two words, on one card. That collision is
   * recorded as LATENT in `inspector/coachingText.ts`; banding this attribute
   * is one of the ways to light it.
   *
   * These tests exist so that change fails loudly instead of shipping as a
   * plausible-looking improvement.
   */
  it.each([
    [0.35, 'Positive: 0.35'],
    [-0.35, 'Negative: -0.35'],
    [0, 'No effect: 0.00'],
    [1, 'Positive: 1.00'],
  ])('value %s announces exactly "%s"', (value, expected) => {
    render(<SignedStrengthSlider value={value} onChange={() => {}} />)

    const slider = assertSliderRendered()
    // Exact string, not a substring: a band word APPENDED to the figure would
    // satisfy `toContain` while still changing what the user hears.
    expect(slider).toHaveAttribute('aria-valuetext', expected)
  })

  it('aria-valuenow carries the unrounded value, so the display rounding is not the semantic value', () => {
    render(<SignedStrengthSlider value={0.123456} onChange={() => {}} />)

    const slider = assertSliderRendered()
    expect(slider).toHaveAttribute('aria-valuenow', '0.123456')
    // Same element, same instant: the human-readable string rounds, the
    // machine-readable value does not. Asserting BOTH on one render is what
    // makes this a claim about independence rather than two separate claims.
    expect(slider).toHaveAttribute('aria-valuetext', 'Positive: 0.12')
  })
})

describe('SignedStrengthSlider — DISPLAY-ONLY: nothing written to the model changes', () => {
  /**
   * ⭐ THE LOAD-BEARING TEST OF THIS PR.
   *
   * The standing ruling is: never round a producer or stored value to solve a
   * display problem. The two tests below prove the write path is untouched, and
   * they prove it by EXECUTION rather than by assertion in a PR body.
   *
   * The value chosen (0.123456) has more precision than the slider's own
   * `step={0.01}` and more than `toFixed(2)` preserves. So if any display
   * rounding had leaked into the write path, `onChange` would receive 0.12 and
   * these tests would RED with a concrete number rather than a vague failure.
   */
  it('onChange receives the EXACT unrounded value the input reported', async () => {
    const onChange = vi.fn()
    render(<SignedStrengthSlider value={0} onChange={onChange} debounceMs={0} />)

    const slider = assertSliderRendered()
    fireEvent.change(slider, { target: { value: '0.123456' } })

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))

    // Bound by identity of the ARGUMENT, and asserted as a strict equality on a
    // number — `toBeCloseTo` would pass against the rounded 0.12 and is exactly
    // the wrong matcher for a no-rounding claim.
    expect(onChange).toHaveBeenCalledWith(0.123456)
    expect(onChange.mock.calls[0][0]).toBe(0.123456)
  })

  it('the caption default does not touch the write path — same payload with techMode on or off', async () => {
    // A twin over the flipped prop. If the default flip had reached the write
    // path at all, these two arms would differ; proving they do not is what
    // licenses the phrase "display-only" in the PR body.
    for (const techMode of [true, false]) {
      const onChange = vi.fn()
      const { unmount } = render(
        <SignedStrengthSlider value={0} onChange={onChange} debounceMs={0} techMode={techMode} />,
      )

      const slider = screen.getAllByRole('slider', { name: 'Effect on target' })
      expect(slider).toHaveLength(1)
      fireEvent.change(slider[0], { target: { value: '-0.987654' } })

      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
      expect(onChange.mock.calls[0][0]).toBe(-0.987654)

      unmount()
    }
  })
})
