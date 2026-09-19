/**
 * StrengthBandButtons — progressive disclosure of the band midpoint.
 *
 * ⚠ READ THIS BEFORE "SIMPLIFYING" ANY TEST BELOW. This component's header
 * requires that *"each button discloses the exact midpoint it will write; a
 * categorical label must not silently become an exact number attributed to the
 * user"*, and that requirement is LOAD-BEARING: clicking a pill WRITES the
 * midpoint into the model and stamps it as the user's own stated strength.
 *
 * So the change these tests pin is DISCLOSURE-CHANNEL, not disclosure-removal:
 *   · the FACE carries the word only (`Slight`), which is what an onboarding
 *     reader is entitled to;
 *   · the FIGURE stays disclosed UNCONDITIONALLY and EXACTLY, in the button's
 *     accessible name (`aria-label`, byte-unchanged) and its tooltip (`title`).
 *
 * ⛔ WHY NOT `techMode`. `useTechToggle` defaults technical detail OFF
 * (`useTechToggle.ts:9`), so gating the figure behind it would make the figure
 * ABSENT for every default user — precisely the state the header forbids. The
 * gate answers "is the face cluttered?" and the header answers "does the
 * clicker know what they are authoring?" — two different questions, named
 * apart rather than aligned (CLAUDE.md trap 21). `title` answers the first
 * without conceding the second, and needs no prop from any file this lane does
 * not own.
 *
 * ⚠ jsdom CANNOT PROVE VISIBILITY OR LAYOUT. Nothing here claims the figure is
 * visually hidden, that the word is legible, or that a tooltip appears on
 * hover. These are assertions about DOM text, attributes, identity and counts
 * only.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { StrengthBandButtons } from '../StrengthBandButtons'
import { CANVAS_STRENGTH_BANDS } from '../../../../domain/vocabulary'

/** The testid this component stamps, derived the same way the component does. */
function testidFor(label: string): string {
  return `strength-band-${label.toLowerCase().replace(/\s+/g, '-')}`
}

/**
 * Find a band button BY IDENTITY, and pin the precondition that identity
 * binding silently assumes — that the id resolves to exactly ONE element.
 * Binding by text or by a value predicate would let a different button satisfy
 * the assertion (CLAUDE.md trap 19).
 */
function bandButton(container: HTMLElement, label: string): Element {
  const testid = testidFor(label)
  const matches = container.querySelectorAll(`[data-testid="${testid}"]`)
  expect(
    matches.length,
    `identity binding is only sound if "${testid}" is unique — found ${matches.length}`,
  ).toBe(1)
  return matches[0]
}

describe('StrengthBandButtons — the face carries the word, not the float', () => {
  it('⭐ every button\'s visible text is EXACTLY its band word, with no raw midpoint', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    for (const band of CANVAS_STRENGTH_BANDS) {
      const btn = bandButton(container, band.label)
      expect(
        btn.textContent,
        `"${band.label}" must not print its midpoint on the face`,
      ).toBe(band.label)
    }
  })

  it('⭐ no button\'s visible text contains a decimal figure', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    for (const band of CANVAS_STRENGTH_BANDS) {
      const btn = bandButton(container, band.label)
      expect(btn.textContent ?? '').not.toMatch(/\d*\.\d/)
    }
  })
})

describe('StrengthBandButtons — the figure stays disclosed, exactly and unconditionally', () => {
  it('⭐ discloses the exact midpoint in BOTH the accessible name and the tooltip', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    for (const band of CANVAS_STRENGTH_BANDS) {
      const btn = bandButton(container, band.label)
      // Derived from the canonical table, so a cut/midpoint change cannot pass
      // by agreeing with a literal typed here.
      const expected = `${band.label}: set strength to ${band.midpoint.toFixed(2)}`
      expect(btn.getAttribute('aria-label'), `${band.label} accessible name`).toBe(expected)
      expect(btn.getAttribute('title'), `${band.label} tooltip`).toBe(expected)
    }
  })

  it('discloses it identically in both channels (one source, so they cannot drift)', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    for (const band of CANVAS_STRENGTH_BANDS) {
      const btn = bandButton(container, band.label)
      const name = btn.getAttribute('aria-label')
      expect(name, `${band.label} must have an accessible name`).toBeTruthy()
      expect(btn.getAttribute('title')).toBe(name)
    }
  })

  /**
   * Hand-written corpus beside the derived assertion above. A derived guard
   * proves the channels AGREE WITH THE TABLE; it can never notice that the
   * table — or my derivation of the expected string — is wrong. Both ship
   * (CLAUDE.md trap 12d).
   */
  it('spot-check against a literal: Strong discloses "Strong: set strength to 0.55"', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    const btn = bandButton(container, 'Strong')
    expect(btn.getAttribute('aria-label')).toBe('Strong: set strength to 0.55')
    expect(btn.getAttribute('title')).toBe('Strong: set strength to 0.55')
  })

  it('discloses the figure with NO tech toggle, flag or prop — it is unconditional', () => {
    // Rendered with the minimum props only. If a future change gates the
    // figure, this REDs — which is the point: the header forbids a default
    // state in which the clicker cannot see what they will author.
    const { container } = render(<StrengthBandButtons value={0} onChange={() => {}} />)
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(bandButton(container, band.label).getAttribute('title')).toContain(
        band.midpoint.toFixed(2),
      )
    }
    const { container: unsetContainer } = render(
      <StrengthBandButtons value={0} onChange={() => {}} unset />,
    )
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(bandButton(unsetContainer, band.label).getAttribute('title')).toContain(
        band.midpoint.toFixed(2),
      )
    }
  })

  /**
   * The standing ruling is that a producer/stored value is never rounded to
   * solve a display problem. `toFixed(2)` is LOSSLESS for every midpoint in the
   * canonical table today; this asserts that rather than promising it, so
   * adding a 3-dp midpoint REDs here instead of silently disclosing a rounded
   * figure for a number the component would still write in full.
   */
  it('⭐ 2-dp disclosure is LOSSLESS for every canonical midpoint (no silent rounding)', () => {
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(
        Number(band.midpoint.toFixed(2)),
        `"${band.label}" writes ${band.midpoint}, which 2-dp disclosure would round`,
      ).toBe(band.midpoint)
    }
  })
})

describe('StrengthBandButtons — the WRITTEN value is untouched by the display change', () => {
  it('⭐ clicking a band still writes that band\'s exact canonical midpoint', () => {
    for (const band of CANVAS_STRENGTH_BANDS) {
      const onChange = vi.fn()
      const { container } = render(<StrengthBandButtons value={0.5} onChange={onChange} />)
      fireEvent.click(bandButton(container, band.label))
      expect(onChange, `clicking "${band.label}" must write exactly once`).toHaveBeenCalledTimes(1)
      expect(
        onChange.mock.calls[0][0],
        `clicking "${band.label}" must write ${band.midpoint}, untouched by any display formatting`,
      ).toBe(band.midpoint)
    }
  })

  it('⭐ writes the FULL-PRECISION value, not the 2-dp figure it displays', () => {
    // The distinguishing case: if a refactor ever fed the displayed string back
    // into the write path, this is where it would show. `Object.is` so a
    // `-0`/`0` swap cannot pass.
    for (const band of CANVAS_STRENGTH_BANDS) {
      const onChange = vi.fn()
      const { container } = render(<StrengthBandButtons value={0.5} onChange={onChange} />)
      fireEvent.click(bandButton(container, band.label))
      const written = onChange.mock.calls[0][0]
      expect(typeof written, 'the write must be a number, never a formatted string').toBe('number')
      expect(Object.is(written, band.midpoint)).toBe(true)
    }
  })

  it('still preserves a negative sign on every band', () => {
    for (const band of CANVAS_STRENGTH_BANDS) {
      const onChange = vi.fn()
      const { container } = render(<StrengthBandButtons value={-0.5} onChange={onChange} />)
      fireEvent.click(bandButton(container, band.label))
      expect(onChange.mock.calls[0][0]).toBe(-band.midpoint)
    }
  })
})

describe('the identity-binding instrument itself discriminates', () => {
  it('a fabricated testid resolves to ZERO elements (the selector is not matching everything)', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    expect(
      container.querySelectorAll('[data-testid="strength-band-zzz-not-a-band"]').length,
    ).toBe(0)
    // contrast: a real one resolves to exactly one
    expect(container.querySelectorAll('[data-testid="strength-band-strong"]').length).toBe(1)
  })

  it('the uniqueness precondition can itself fail', () => {
    // Two instances on one page means the testid is no longer unique, so
    // `bandButton`'s precondition must RED rather than silently taking [0].
    const { container } = render(
      <div>
        <StrengthBandButtons value={0.5} onChange={() => {}} />
        <StrengthBandButtons value={0.5} onChange={() => {}} />
      </div>,
    )
    expect(() => bandButton(container, 'Strong')).toThrow()
  })
})
