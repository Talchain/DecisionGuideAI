/**
 * ⭐ DESIGN PICK A2 — CONTAINMENT BY FILL, WITHOUT LOSING THE DIVIDER.
 *
 * The first version of this traded a visible rule for an invisible fill: it
 * dropped `border-panel-border` and used `bg-panel-hover/40`, which composites
 * to `rgb(254, 252, 249.6)` over a `rgb(254, 254, 254)` panel — **1.015:1**,
 * measured by a reviewer against the deployed build's own tokens. The reader
 * lost a divider they could see and gained one they could not.
 *
 * ⚠ AND THE CODE COMMENT DEFENDING IT COMPARED AGAINST THE WRONG THING — the
 * 2px accent box, already removed from this panel. The live alternative was a
 * 1px rule, and it was never weighed.
 *
 * Measured after the fix, in a browser at 420px:
 *   · fill contrast 1.015 → **1.0381** (full-strength `bg-panel-hover`)
 *   · the 1px rule is RETAINED on both states (its own contrast: 1.229)
 *   · section title x: 25 → 25, width 361.5 → 361.5 — **shift 0**
 *
 * jsdom performs no layout, so these bind to the MECHANISMS the measurements
 * came from.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { SectionShell } from '../sections/SectionShell'

afterEach(() => cleanup())

const draw = (defaultOpen: boolean) =>
  render(
    <SectionShell title="Key insights" count={1} testId="sec" defaultOpen={defaultOpen}>
      <p>body</p>
    </SectionShell>,
  )

describe('an open section gains a fill without giving up its rule', () => {
  it('keeps the divider in BOTH states', () => {
    draw(false)
    expect(screen.getByTestId('sec').className).toContain('border-b')
    cleanup()
    draw(true)
    expect(
      screen.getByTestId('sec').className,
      'The open state dropped the 1px rule for a fill measured at 1.015:1 — a ' +
        'divider the reader could see, traded for one they could not.',
    ).toContain('border-b')
  })

  it('uses the fill at full strength, not a near-invisible alpha', () => {
    draw(true)
    const cls = screen.getByTestId('sec').className
    expect(cls).toContain('bg-panel-hover')
    // The PROPERTY that was wrong: an alpha modifier on the surface token.
    expect(
      /bg-panel-hover\/\d+/.test(cls),
      '`bg-panel-hover/40` composites to 1.015:1 against the panel — below the ' +
        'threshold at which a fill reads as containment at all.',
    ).toBe(false)
  })

  it('pins the content position so opening does not nudge its own heading', () => {
    draw(true)
    const cls = screen.getByTestId('sec').className
    // `px-2` alone moved the title 8px sideways (x 25→33, width 228→212),
    // witnessed by clicking. The negative margin lets the FILL reach the panel
    // edge while the CONTENT stays put, so the pair must travel together.
    expect(cls).toContain('px-2')
    expect(cls, '`px-2` without `-mx-2` shifts the heading on open').toContain('-mx-2')
  })

  it('applies none of it while closed — the twin that proves the branch', () => {
    draw(false)
    const cls = screen.getByTestId('sec').className
    expect(cls).not.toContain('bg-panel-hover')
    expect(cls).not.toContain('-mx-2')
  })

  it('toggling actually moves between the two states', () => {
    draw(false)
    const before = screen.getByTestId('sec').className
    fireEvent.click(screen.getByTestId('sec-toggle'))
    const after = screen.getByTestId('sec').className
    // PRECONDITION: without this the four assertions above could all be
    // describing one state that never changes.
    expect(after).not.toBe(before)
    expect(after).toContain('bg-panel-hover')
  })
})
