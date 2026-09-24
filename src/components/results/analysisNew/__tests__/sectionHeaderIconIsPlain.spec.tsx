/**
 * ⭐ V2 DESIGN SYSTEM — NO TINTS, AND THE SECTION ROW'S ICON WAS THE MOST
 * REPEATED ONE.
 *
 * Witnessed on the served build (24 Sep 2026, staging `4549b66b`): every
 * `SectionShell` row — "What moves the outcome", "Drivers and dynamics", "What
 * would change your mind", "Coaching and method", "Key insights", "How this was
 * worked out", "Uncertainty and gaps", "How the options compare" — drew its
 * icon inside a 24px `rounded-full bg-panel-hover` circle. The prototype
 * (`prototype-v2-reference.html`, `.section-title .ico{color:var(--text-light)}`)
 * draws a plain glyph: no fill, no circle.
 *
 * ⚠ ONE SHELL, SO ONE ASSERTION COVERS ALL EIGHT. They are all `SectionShell`
 * rows; a sweep of the directory found no second tinted icon container.
 *
 * ⚠ SIZE AND POSITION ARE PINNED TOO, so "plain" cannot be satisfied by
 * shrinking or moving the glyph: the icon stays at `icon('row')` inside the
 * same 24px slot, so no section title moves.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Star } from 'lucide-react'

import { SectionShell } from '../sections/SectionShell'
import { icon } from '../panelSurfaces'

const TID = 'shell-under-test'

function renderShell() {
  render(
    <SectionShell title="Key insights" icon={Star} count={2} testId={TID}>
      <p>body</p>
    </SectionShell>,
  )
  // The row icon is the toggle's FIRST svg (the chevron comes after the title).
  const glyph = screen.getByTestId(`${TID}-toggle`).querySelector('svg')
  const slot = glyph!.parentElement as HTMLElement
  return { slot, glyph }
}

describe('⭐ the section-row icon is a plain glyph — no tinted circle', () => {
  it('PRECONDITION: the probe finds the icon it is about to judge', () => {
    const { slot, glyph } = renderShell()
    expect(glyph, 'no svg in the toggle — the probe sees nothing').not.toBeNull()
    expect(glyph!.getAttribute('class') ?? '', 'the first svg must be the row icon, not the chevron').toContain(
      'lucide-star',
    )
    expect(slot.tagName).toBe('SPAN')
  })

  it('⛔ the slot carries no fill and no circle', () => {
    const { slot } = renderShell()
    const tokens = slot.className.split(/\s+/)
    expect(tokens.filter((t) => /^bg-/.test(t)), 'a background token is a tint').toEqual([])
    expect(tokens, 'a circle behind a glyph is a badge, and the DS draws none').not.toContain('rounded-full')
  })

  it('the glyph is text-light at the row icon size, in the same 24px slot', () => {
    const { slot, glyph } = renderShell()
    const cls = glyph!.getAttribute('class') ?? ''
    expect(cls).toContain('text-text-light')
    for (const t of icon('row').split(' ')) expect(cls).toContain(t)
    // The slot keeps the geometry the circle had, so no title moves.
    for (const t of ['w-6', 'h-6', 'flex', 'items-center', 'justify-center']) {
      expect(slot.className.split(/\s+/)).toContain(t)
    }
  })
})
