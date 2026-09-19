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
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE PRE-WRITE DISCLOSURE (added 19 Sep 2026, answering a P1 review)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ THE TESTS ABOVE ARE NOT SUFFICIENT AND THE REVIEW WAS RIGHT TO SAY SO.
 * Every assertion above reads an ATTRIBUTE. `title` is not a focus channel and
 * it is not a touch channel, so *"the figure is disclosed"* was true of the DOM
 * and false of the person: a sighted keyboard user could Tab to Strong and press
 * Space having seen nothing, and a finger has no hover to disclose with. The
 * requirement in the component header is about the user who is ABOUT TO COMMIT,
 * by the route they are using — attribute presence does not satisfy it.
 *
 * ⭐ SO THE LOAD-BEARING PROPERTY HERE IS A STATE TRANSITION, NOT A PRESENCE.
 * The reveal is driven by REACT STATE rather than by a Tailwind `group-hover:`
 * variant, and that is a deliberate testability decision as much as a design
 * one: jsdom applies no CSS, so a class-based reveal would put the figure in the
 * DOM at rest and every "revealed on focus" assertion below would pass BEFORE
 * the focus — the same vacuity one channel along (CLAUDE.md trap 13). The
 * at-rest test is therefore paired with every reveal test on purpose: it is what
 * proves the reveal test is measuring a change.
 *
 * ⚠ jsdom STILL CANNOT PROVE VISIBILITY, LAYOUT, PAINT OR TOOLTIP BEHAVIOUR.
 * What is proven below: the consequence text is ABSENT from the DOM at rest,
 * PRESENT after a real `Tab` has moved `document.activeElement` onto the button,
 * PRESENT after a mouse enters, PRESENT at rest when the browser reports no
 * hover channel, and byte-identical to the accessible name. What is NOT proven:
 * that it is legible, correctly positioned, unclipped, or that it paints before
 * the user acts. Those need a real browser.
 */

/** The one element that carries the revealed consequence, bound by identity. */
function consequence(container: HTMLElement): Element {
  const matches = container.querySelectorAll('[data-testid="strength-preset-consequence"]')
  expect(
    matches.length,
    `identity binding is only sound if the consequence slot is unique — found ${matches.length}`,
  ).toBe(1)
  return matches[0]
}

/** Text of the consequence slot, normalised. Empty string when nothing is revealed. */
function revealed(container: HTMLElement): string {
  return (consequence(container).textContent ?? '').trim()
}

/**
 * Tell the component whether a hover channel exists, the way a browser would.
 *
 * ⚠ THIS REWRITES A GLOBAL THAT NOTHING ELSE RESTORES. `tests/setup/rtl.ts`
 * installs `window.matchMedia` ONCE, as a plain function precisely so vitest's
 * `mockReset` cannot strip it — which also means `vi.clearAllMocks()` cannot put
 * it back. Without the `afterEach` below, the first touch test would leave every
 * later test in this file running on a touch device, and the CONTRAST CONTROL
 * that follows it would fail for a reason that has nothing to do with the
 * component. Restoring it is what keeps the two touch tests independent.
 */
function setHoverChannel(present: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: present ? false : query.includes('hover: none'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  })
}

/** A touch device: no hover channel at all. */
function withNoHoverChannel(): void {
  setHoverChannel(false)
}

afterEach(() => {
  setHoverChannel(true)
})

describe('StrengthBandButtons — a KEYBOARD user reaches the figure BEFORE committing', () => {
  it('⭐ nothing is revealed at rest (so every reveal test below measures a change)', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    expect(
      revealed(container),
      'the consequence must be ABSENT at rest, or the focus assertions are vacuous',
    ).toBe('')
  })

  it('⭐⭐ Tab to "Strong" discloses 0.55 with NO write — the P1 case, verbatim', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = render(<StrengthBandButtons value={0.5} onChange={onChange} />)

    // A REAL keyboard route: three Tabs, and the assertion that focus landed
    // where we think it did. `fireEvent.focus` would prove nothing about the
    // tab order a keyboard user actually walks.
    await user.tab()
    await user.tab()
    await user.tab()
    const strong = bandButton(container, 'Strong')
    expect(document.activeElement, 'Tab must reach the Strong pill').toBe(strong)

    expect(
      revealed(container),
      'a sighted keyboard user must see the consequence before pressing Space',
    ).toContain('0.55')
    expect(onChange, 'focus must not write — this is the PRE-commit disclosure').not.toHaveBeenCalled()
  })

  it('⭐ the revealed string is BYTE-IDENTICAL to the accessible name (one source, three channels)', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    for (const band of CANVAS_STRENGTH_BANDS) {
      const btn = bandButton(container, band.label)
      fireEvent.focus(btn)
      const name = btn.getAttribute('aria-label')
      expect(name, `${band.label} must have an accessible name`).toBeTruthy()
      expect(revealed(container), `${band.label} revealed text`).toBe(name)
      expect(btn.getAttribute('title'), `${band.label} tooltip`).toBe(name)
      fireEvent.blur(btn)
    }
  })

  it('⭐ the reveal is bound to the FOCUSED band, not to any band (discriminating)', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    fireEvent.focus(bandButton(container, 'Slight'))
    const onSlight = revealed(container)
    expect(onSlight).toContain('0.10')
    expect(
      onSlight,
      'focusing Slight must not disclose Strong’s midpoint — that would be a value-predicate binding',
    ).not.toContain('0.55')
  })

  it('blur withdraws it, so the slot is not a one-way latch', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    const strong = bandButton(container, 'Strong')
    fireEvent.focus(strong)
    expect(revealed(container)).toContain('0.55')
    fireEvent.blur(strong)
    expect(revealed(container)).toBe('')
  })

  it('a MOUSE user gets the same disclosure on hover (WCAG 1.4.13 parity, both directions)', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    const strong = bandButton(container, 'Strong')
    expect(revealed(container)).toBe('')
    fireEvent.mouseEnter(strong)
    expect(revealed(container)).toContain('0.55')
    fireEvent.mouseLeave(strong)
    expect(revealed(container)).toBe('')
  })
})

describe('StrengthBandButtons — a TOUCH user reaches the figure BEFORE committing', () => {
  /**
   * A tap both focuses and activates, so on a device with no hover channel there
   * is NO pre-commit interaction to hang a reveal on. The disclosure therefore
   * has to be PRESENT — and it is present ONCE for the group rather than four
   * times on four faces, which is what keeps the face word-only. This is the
   * same reasoning `NodeQuickActions.tsx` records for its `(pointer: coarse)`
   * arm being MANDATORY, and it detects the device the way `usePopoverHover.ts`
   * does, with `matchMedia('(hover: none)')`.
   */
  it('⭐⭐ with NO hover channel, every signed figure is disclosed at rest', () => {
    withNoHoverChannel()
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    const text = revealed(container)
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(text, `a finger must be able to read ${band.label}’s consequence`).toContain(
        band.midpoint.toFixed(2),
      )
    }
  })

  it('⭐ CONTRAST CONTROL: with a hover channel present, that at-rest line is NOT there', () => {
    // Without this the test above would pass on a component that simply always
    // prints all four figures — i.e. on the pre-PR cluttered face.
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    expect(
      revealed(container),
      'the clean word-only face must survive wherever a reveal channel exists',
    ).toBe('')
  })

  it('the touch disclosure does NOT move the figures back onto the pill faces', () => {
    withNoHoverChannel()
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(
        bandButton(container, band.label).textContent,
        `${band.label}’s face must still carry the word alone`,
      ).toBe(band.label)
    }
  })
})

describe('StrengthBandButtons — the disclosure states the SIGNED value that will be written', () => {
  /**
   * The carry-forward from the same review: the write preserved the minus sign
   * while every disclosure channel printed the positive magnitude, so a pill
   * offered `0.55` and committed `-0.55`. Resolved by DERIVING the sentence from
   * the very value passed to `onChange`, not by restating it — so the two cannot
   * disagree, and the test below is what asserts they cannot.
   */
  it('⭐⭐ at a negative value, the disclosed figure IS the number written (all channels)', () => {
    for (const band of CANVAS_STRENGTH_BANDS) {
      const onChange = vi.fn()
      const { container } = render(<StrengthBandButtons value={-0.5} onChange={onChange} />)
      const btn = bandButton(container, band.label)
      const expected = `${band.label}: set strength to ${(-band.midpoint).toFixed(2)}`

      expect(btn.getAttribute('aria-label'), `${band.label} accessible name`).toBe(expected)
      expect(btn.getAttribute('title'), `${band.label} tooltip`).toBe(expected)
      fireEvent.focus(btn)
      expect(revealed(container), `${band.label} revealed text`).toBe(expected)

      fireEvent.click(btn)
      const written = onChange.mock.calls[0][0]
      expect(Object.is(written, -band.midpoint), `${band.label} must write -${band.midpoint}`).toBe(true)
    }
  })

  it('⭐ the figure parsed back out of the disclosure EQUALS the number written', () => {
    // The anti-drift assertion. A disclosure that says one thing and a write
    // that does another is the defect one level down from the P1; this closes
    // it by execution rather than by inspection, and on both signs.
    for (const value of [0.5, -0.5]) {
      for (const band of CANVAS_STRENGTH_BANDS) {
        const onChange = vi.fn()
        const { container } = render(<StrengthBandButtons value={value} onChange={onChange} />)
        const btn = bandButton(container, band.label)
        fireEvent.focus(btn)
        const match = /set strength to (-?\d+\.\d+)/.exec(revealed(container))
        expect(match, `${band.label} at ${value} must disclose a parseable figure`).not.toBeNull()
        fireEvent.click(btn)
        const written = onChange.mock.calls[0][0]
        expect(
          Number(match![1]),
          `${band.label} at ${value}: disclosed ${match![1]} but wrote ${written}`,
        ).toBe(written)
      }
    }
  })

  it('a POSITIVE value still discloses the unsigned figure (no gratuitous "+")', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    expect(bandButton(container, 'Strong').getAttribute('aria-label')).toBe(
      'Strong: set strength to 0.55',
    )
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ MIXED INPUT: THE SLOT MUST DESCRIBE THE CONTROL THE NEXT KEYPRESS COMMITS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ THE TESTS ABOVE STILL DID NOT COVER A USER WITH BOTH HANDS ON THE MACHINE.
 * Every reveal test above drives ONE channel at a time — a Tab, or a hover, never
 * both — and the component held ONE `engagedIndex` for both, so whichever fired
 * last won. The review's reproduction, verbatim: *Tab to Strong (focus stays on
 * Strong, disclosure `0.55`) → move the mouse over Slight without clicking
 * (`onMouseEnter` replaces `engagedIndex` with Slight, disclosure `0.10`) →
 * press Space. Native keyboard activation still targets focused Strong and
 * writes `0.55`, although the visible consequence slot says `0.10`.*
 *
 * That is the ORIGINAL defect's own class one route along: a disclosure that
 * does not describe the write. It is not a display nicety here, because these
 * pills stamp what they write as the user's OWN STATED strength.
 *
 * ⭐ SO THE PROPERTY IS A CONSISTENCY, NOT TWO PRESENCES. The test below reads
 * the figure OUT of the slot and asserts it EQUALS the figure `onChange` then
 * receives, in the same test and in the same interaction. Two separate
 * assertions — "the slot shows something" and "the write is 0.55" — are exactly
 * what let this through: both were true while they described different pills.
 */
describe('StrengthBandButtons — focus and hover are separate claims, and focus owns the keypress', () => {
  it('⭐⭐ MIXED INPUT: Tab to Strong, hover Slight, press Space — the disclosed figure IS the written one', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container } = render(<StrengthBandButtons value={0.5} onChange={onChange} />)

    // A REAL keyboard route to Strong, with the landing asserted.
    await user.tab()
    await user.tab()
    await user.tab()
    const strong = bandButton(container, 'Strong')
    expect(document.activeElement, 'Tab must reach the Strong pill').toBe(strong)
    expect(revealed(container), 'precondition: focus alone discloses Strong').toContain('0.55')

    // The mouse now wanders over a DIFFERENT pill without clicking. Focus has
    // not moved, so Space still targets Strong.
    fireEvent.mouseEnter(bandButton(container, 'Slight'))
    expect(document.activeElement, 'a hover must not move focus').toBe(strong)

    // Read what the user can SEE at the instant before they commit.
    const disclosedAtKeypress = revealed(container)
    const match = /set strength to (-?\d+\.\d+)/.exec(disclosedAtKeypress)
    expect(match, `the slot must state a parseable consequence — saw "${disclosedAtKeypress}"`).not.toBeNull()

    // Native activation of the FOCUSED control.
    await user.keyboard(' ')
    expect(onChange, 'Space on a focused button must write exactly once').toHaveBeenCalledTimes(1)
    const written = onChange.mock.calls[0][0]

    // ⭐ THE LOAD-BEARING LINE: what the screen said and what the control
    // committed are ONE number, not two that happen to be checked separately.
    expect(
      Number(match![1]),
      `the slot disclosed ${match![1]} but Space wrote ${written} — the screen states one number and the control commits another`,
    ).toBe(written)
  })

  it('⭐ hover-OUT over a pill that still holds FOCUS must not blank its disclosure', () => {
    // The second half of the same root cause: one variable for two channels, so
    // `onMouseLeave` clears an index that FOCUS still owns. The user has not
    // moved focus and has not stopped being able to press Space — withdrawing
    // the consequence leaves them about to commit a number nothing states.
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    const strong = bandButton(container, 'Strong')

    fireEvent.focus(strong)
    fireEvent.mouseEnter(strong)
    expect(revealed(container), 'precondition: focused AND hovered discloses Strong').toContain('0.55')

    fireEvent.mouseLeave(strong)
    expect(
      revealed(container),
      'focus still owns Strong, so the consequence of pressing Space must still be on screen',
    ).toContain('0.55')

    // ⭐ THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b). Independence has two
    // faces and one assertion only watches one door: a surviving mutant that
    // cleared the HOVER claim on blur passed the check above untouched. Tab
    // away while the pointer stays on the pill and a click still commits 0.55,
    // so the hover claim must outlive the focus one just as it did the reverse.
    fireEvent.mouseEnter(strong)
    fireEvent.blur(strong)
    expect(
      revealed(container),
      'the pointer still rests on Strong, so a click still commits 0.55 and must still be disclosed',
    ).toContain('0.55')
  })
})
