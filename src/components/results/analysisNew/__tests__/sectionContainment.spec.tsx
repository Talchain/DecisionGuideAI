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

/**
 * ⭐ V2 (Paul + ChatGPT brief, 23 Sep 2026) REPLACES "an open section gains a
 * fill": no tinted cards, no nested boxes. What survives is the rule and the
 * disclosure state, which is what actually tells the reader where they are.
 */
describe('V2: an open section is told apart by its disclosure, never a tinted card', () => {
  it('keeps the full-width divider in BOTH states', () => {
    draw(false)
    expect(screen.getByTestId('sec').className).toContain('border-b')
    cleanup()
    draw(true)
    expect(screen.getByTestId('sec').className).toContain('border-b')
  })

  it('draws no fill, radius or gutter shift when open', () => {
    draw(true)
    const cls = screen.getByTestId('sec').className
    expect(cls).not.toMatch(/\bbg-/)
    expect(cls).not.toMatch(/\brounded/)
    expect(cls).not.toContain('-mx-2')
  })

  it('toggling moves the disclosure state, not the chrome', () => {
    draw(false)
    const before = screen.getByTestId('sec').getAttribute('data-section-open')
    fireEvent.click(screen.getByTestId('sec-toggle'))
    const after = screen.getByTestId('sec').getAttribute('data-section-open')
    // PRECONDITION-style contrast: the state really changed.
    expect(before).toBe('false')
    expect(after).toBe('true')
    expect(screen.getByTestId('sec-toggle').getAttribute('aria-expanded')).toBe('true')
  })
})
