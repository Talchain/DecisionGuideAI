/**
 * ⭐⭐ THE BARS CARRY A SIDE, NEVER A VERDICT.
 *
 * The chart drew `bg-warning` for a driver that lowers the outcome and
 * `bg-success` for one that raises it — the panel's STATUS palette painted
 * onto a DIRECTION. Everywhere else on this surface amber means "this needs
 * your attention" and green means "this is holding up", so the chart was
 * asserting a good/bad valence the producer never supplied. `row.direction`
 * is `'positive' | 'negative' | null`: a side, not a judgement.
 *
 * Direction survives the change because it was always carried twice over —
 * the side of the zero line, and the sentence in the row. Colour was the
 * third encoding and the only one that added a claim.
 *
 * ⚠ EVERY CASE HERE PAIRS AN ABSENCE WITH A CONTRAST IN THE SAME RUN
 * (CLAUDE.md trap 13e). A test that only asserts "no status hue" passes
 * identically when it is reading an empty className, a missing element, or a
 * renamed testid — so each one also asserts what the bar DOES carry. Target
 * zero with a dead contrast reports nothing.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DriverInfluenceChart } from '../sections/DriverInfluenceChart'
import type { DriverInfluenceRow } from '../analysisNewTypes'

vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    proposeFactorValue: vi.fn(() => 'dispatched'),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

const TID = 'chart'
afterEach(cleanup)

/** The panel's status palette. A bar must never be painted from it. */
const STATUS_HUE = /\b(bg|text|border|ring)-(success|warning|danger)\b/

const row = (over: Partial<DriverInfluenceRow>): DriverInfluenceRow => ({
  id: 'f1',
  label: 'Factor one',
  fraction: 0.8,
  direction: 'positive',
  targetId: 'f1',
  ...over,
})

function draw(rows: DriverInfluenceRow[]) {
  render(<DriverInfluenceChart rows={rows} onCommitOutcome={vi.fn()} testId={TID} />)
}

const barClass = (which: 'lowers' | 'raises'): string => {
  const el = screen.getByTestId(`${TID}-bar-${which}`)
  const cls = el.className
  // The contrast that makes every absence below meaningful: a real element
  // with a real, non-empty class string was read.
  expect(cls.trim().length).toBeGreaterThan(0)
  return cls
}

describe('a driver bar states a side, not a verdict', () => {
  it('the LOWERS bar is ink, not a warning', () => {
    draw([row({ id: 'cost', label: 'Unit cost', direction: 'negative' })])
    const cls = barClass('lowers')
    expect(cls).not.toMatch(STATUS_HUE) // the absence
    expect(cls).toMatch(/text-header/) // the contrast, same run
  })

  it('the RAISES bar is ink, not a success', () => {
    draw([row({ id: 'cap', label: 'Sales capacity', direction: 'positive' })])
    const cls = barClass('raises')
    expect(cls).not.toMatch(STATUS_HUE)
    expect(cls).toMatch(/text-header/)
  })

  /**
   * ⭐ THE ONE THAT ACTUALLY PINS THE RULE. Either case above still passes if
   * someone re-tints ONE side — swapping amber for a different non-status
   * accent would keep both green while restoring exactly the asymmetry this
   * change removed. The rule is ONE ink, so the two must be identical.
   */
  it('both sides use the SAME ink — one hue, or the asymmetry is back', () => {
    draw([
      row({ id: 'cost', label: 'Unit cost', direction: 'negative' }),
      row({ id: 'cap', label: 'Sales capacity', direction: 'positive' }),
    ])
    const lowers = barClass('lowers')
    const raises = barClass('raises')
    const inkOf = (cls: string) => cls.split(/\s+/).filter((c) => c.startsWith('bg-')).join(' ')
    expect(inkOf(lowers)).toBe(inkOf(raises))
    expect(inkOf(lowers)).not.toBe('') // contrast: an ink was actually found
  })

  /**
   * ⚠ THE BAR MUST NOT BECOME THE ZERO LINE. The line is the reference the
   * whole chart depends on — a bar's side and length mean nothing without it —
   * so the ink chosen here has to stay distinguishable from it. This is the
   * legibility half of the change, pinned rather than reasoned about.
   */
  it('the bar ink is not the zero line ink', () => {
    draw([row({ id: 'cost', label: 'Unit cost', direction: 'negative' })])
    const cls = barClass('lowers')
    expect(cls).not.toMatch(/bg-text-light\b/)
    expect(cls).toMatch(/bg-text-header/) // contrast: it does carry an ink
  })
})
