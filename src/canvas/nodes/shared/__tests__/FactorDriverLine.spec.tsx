/**
 * FactorDriverLine — Paul's 23 Sep 2026 Canvas contract feedback, points 5 and 9.
 *
 * Point 5 ("Fix Driver ranking consistency"): "If it says `1 of 3`, users must
 * understand what the 3 means … explicitly define the denominator … never imply
 * a missing rank is accidentally omitted." The line's hover/focus tooltip AND
 * its accessible description define the `of M` (the factors in the last
 * analysis, read off the SAME `rank.setSize` the caption prints — never a node
 * count) and say that ranks are named for at most `MAX_BADGED_RANK` factors,
 * only where their order is clear. An unranked line says the same, with no
 * rank and no denominator of its own.
 *
 * Point 9 ("Do not invent new colours … make the driver bar neutral, so it does
 * not compete with attention"): the bar's fill is the design system's neutral
 * muted token, never Info blue (the attention marker's channel) and never a
 * success/danger/warning channel.
 *
 * ⚠ IDENTITY, NOT A VALUE PREDICATE (trap: bind by identity). The denominator
 * pins run a discriminating pair (5 vs 7) so a hard-coded number, or a count
 * taken from anywhere but the prop, goes red.
 *
 * CLAIM SCOPE: jsdom proves classes, strings and accessible names/descriptions,
 * never pixels or rendered colour.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  FactorDriverLine,
  driverLineCaption,
  driverLineDenominatorNote,
  driverLineExplanation,
} from '../FactorDriverLine'
import { MAX_BADGED_RANK } from '../../../../components/results/driverDisplayModel'

afterEach(() => cleanup())

const renderLine = (
  rank: { rank: number; setSize: number } | null,
  extra: Partial<Parameters<typeof FactorDriverLine>[0]> = {},
) =>
  render(
    <FactorDriverLine
      nodeId="fac_price"
      rank={rank}
      value={0.62}
      provenance="normalised_elasticity"
      importanceBasis={null}
      {...extra}
    />,
  )

const line = () => screen.getByTestId('factor-driver-line')
const fill = () => screen.getByTestId('factor-driver-line-bar-fill')

describe('point 9 — the driver bar is neutral, so it never competes with the Info-blue attention marker', () => {
  it('fills with the neutral muted token, not Info blue or any semantic channel', () => {
    renderLine({ rank: 1, setSize: 4 })
    const cls = fill().className
    // Positive control first: the fill exists and carries a width.
    expect(fill().style.width).toBe('max(4px, 62%)')
    expect(cls).toContain('bg-text-light')
    for (const semantic of ['bg-info', 'bg-success', 'bg-danger', 'bg-warning', 'bg-primary']) {
      expect(cls, `driver bar must not use ${semantic}`).not.toContain(semantic)
    }
  })

  it('the unranked bar is neutral too (same fill, both arms)', () => {
    renderLine(null)
    expect(fill().className).toContain('bg-text-light')
    expect(fill().className).not.toContain('bg-info')
  })
})

describe('point 5 — "Driver N of M" defines its M and never implies an omitted rank', () => {
  it('a ranked line’s accessible description defines the denominator from rank.setSize', () => {
    renderLine({ rank: 2, setSize: 5 })
    const el = line()
    // The visible caption still names the rank and its set.
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe(
      driverLineCaption({ rank: 2, setSize: 5 }, 'normalised_elasticity'),
    )
    expect(el).toHaveAccessibleDescription(driverLineDenominatorNote({ rank: 2, setSize: 5 }))
    const note = el.getAttribute('aria-description') ?? ''
    expect(note).toContain('“of 5” counts the factors in the last analysis')
    expect(note).toContain(`at most ${MAX_BADGED_RANK}`)
    expect(note).toContain('only where their order is clear')
    expect(note).toContain('has not been left out')
  })

  it('DISCRIMINATING — the denominator is read off the prop, not a constant (5 vs 7)', () => {
    renderLine({ rank: 1, setSize: 7 })
    const note = line().getAttribute('aria-description') ?? ''
    expect(note).toContain('“of 7”')
    expect(note).not.toContain('“of 5”')
  })

  it('an unranked line says why it carries no rank, with no denominator and no "Driver N" claim', () => {
    renderLine(null)
    const note = line().getAttribute('aria-description') ?? ''
    expect(note).toMatch(/^No driver rank\. /)
    expect(note).toContain(`at most ${MAX_BADGED_RANK} factors in the last analysis`)
    expect(note).toContain('has not been left out')
    expect(note).not.toMatch(/“of \d+”/)
    expect(screen.getByTestId('factor-driver-line-caption').textContent).not.toContain('Driver')
  })

  it('the hover/focus tooltip shows the definition after the existing disclosure', async () => {
    renderLine({ rank: 2, setSize: 5 })
    fireEvent.mouseEnter(line())
    const tip = await screen.findByRole('tooltip')
    const disclosure = driverLineExplanation({
      rank: { rank: 2, setSize: 5 },
      value: 0.62,
      provenance: 'normalised_elasticity',
      importanceBasis: null,
    })
    expect(tip).toHaveTextContent(disclosure)
    expect(tip).toHaveTextContent(driverLineDenominatorNote({ rank: 2, setSize: 5 }))
  })

  it('the accessible NAME is unchanged and still opens with the visible caption (label in name)', () => {
    renderLine({ rank: 2, setSize: 5 }, { fromLastRun: true })
    const el = line()
    const caption = screen.getByTestId('factor-driver-line-caption').textContent!
    expect(caption.startsWith('Last run · ')).toBe(true)
    expect(el.getAttribute('aria-label')!.startsWith(caption)).toBe(true)
    // The definition is a DESCRIPTION, so the name keeps no second copy of it.
    expect(el.getAttribute('aria-label')).not.toContain('counts the factors')
  })

  it('the definition adds no visible text to the card face (tooltip and description only)', () => {
    renderLine({ rank: 2, setSize: 5 })
    expect(line().textContent).not.toContain('counts the factors')
    expect(line().textContent).not.toContain('left out')
  })
})
