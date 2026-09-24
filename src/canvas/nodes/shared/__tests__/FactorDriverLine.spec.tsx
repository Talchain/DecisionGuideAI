/**
 * FactorDriverLine — Paul's 23 Sep 2026 Canvas contract feedback, points 5 and
 * 9, as contract v3.1 restates them.
 *
 * Contract v3.1 pt 5 (supersedes the v3 "define the feed denominator" reading
 * this spec used to pin): "Driver N of M ranked in this run, where M is the
 * number of factors the run ranked … its hover and detail define the
 * denominator. A factor the run did not rank shows no rank … Stale form:
 * Last run · Driver N of M ranked". The line is now RANKED-ONLY (`rank` is
 * non-null by type); the unranked factor's statement is `FactorDriverNotRanked`.
 * The hover/description is the contract's definition: "This run ranked M
 * factors by relative sensitivity; each shows its own rank."
 *
 * Point 9 ("Do not invent new colours … make the driver bar neutral, so it does
 * not compete with attention"; v3.1 adds "thinner"): the bar's fill is the
 * design system's neutral muted token, never Info blue (the attention marker's
 * channel) and never a success/danger/warning channel.
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
  FactorDriverNotRanked,
  driverLineCaption,
  driverLineDenominatorNote,
  driverLineExplanation,
} from '../FactorDriverLine'

afterEach(() => cleanup())

const renderLine = (
  rank: { rank: number; setSize: number },
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

  it('contract v3.1 pt 9 — the track is thinner: the fixture’s 30 × 3px', () => {
    renderLine({ rank: 1, setSize: 3 })
    const track = screen.getByTestId('factor-driver-line-bar')
    expect(track.className).toContain('h-[3px]')
    expect(track.className).toContain('w-[30px]')
    expect(track.className).not.toContain('w-[54px]')
  })
})

describe('contract v3.1 pt 5 — "Driver N of M ranked in this run" defines its M; an unranked factor shows no rank', () => {
  it('the caption is the contract’s exact wording, M from rank.setSize', () => {
    renderLine({ rank: 2, setSize: 5 })
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Driver 2 of 5 ranked in this run')
    expect(driverLineCaption({ rank: 2, setSize: 5 })).toBe('Driver 2 of 5 ranked in this run')
    expect(driverLineCaption({ rank: 2, setSize: 5 }, true)).toBe('Driver 2 of 5 ranked')
  })

  it('a ranked line’s accessible description defines the denominator in the contract’s words', () => {
    renderLine({ rank: 2, setSize: 5 })
    const el = line()
    expect(el).toHaveAccessibleDescription(driverLineDenominatorNote({ rank: 2, setSize: 5 }))
    expect(el.getAttribute('aria-description')).toBe(
      'This run ranked 5 factors by relative sensitivity; each shows its own rank.',
    )
  })

  it('DISCRIMINATING — the denominator is read off the prop, not a constant (5 vs 7)', () => {
    renderLine({ rank: 1, setSize: 7 })
    const note = line().getAttribute('aria-description') ?? ''
    expect(note).toContain('ranked 7 factors')
    expect(note).not.toContain('ranked 5 factors')
  })

  it('a set of one is said in the singular', () => {
    expect(driverLineDenominatorNote({ rank: 1, setSize: 1 })).toBe('This run ranked 1 factor by relative sensitivity.')
  })

  it('the stale form: caption, name and description all speak of the LAST run', () => {
    renderLine({ rank: 2, setSize: 5 }, { fromLastRun: true })
    const el = line()
    const caption = screen.getByTestId('factor-driver-line-caption').textContent!
    expect(caption).toBe('Last run · Driver 2 of 5 ranked')
    // Label in Name (WCAG 2.5.3): the visible string opens the spoken one.
    expect(el.getAttribute('aria-label')!.startsWith(`${caption}. `)).toBe(true)
    expect(el.getAttribute('aria-description')).toBe(
      'The last run ranked 5 factors by relative sensitivity; each shows its own rank.',
    )
  })

  it('an unranked factor’s statement: "Not ranked in this run", stale "Last run · Not ranked", out of flow', () => {
    const { unmount } = render(<FactorDriverNotRanked />)
    const el = screen.getByTestId('factor-driver-not-ranked')
    expect(el.textContent).toBe('Not ranked in this run')
    expect(el.className).toContain('sr-only')
    // No rank, no denominator, no bar.
    expect(el.textContent).not.toMatch(/Driver|\d/)
    expect(screen.queryByTestId('factor-driver-line-bar')).toBeNull()
    unmount()
    render(<FactorDriverNotRanked fromLastRun />)
    expect(screen.getByTestId('factor-driver-not-ranked').textContent).toBe('Last run · Not ranked')
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

  it('the definition is a DESCRIPTION, so the name keeps no second copy of it', () => {
    renderLine({ rank: 2, setSize: 5 }, { fromLastRun: true })
    expect(line().getAttribute('aria-label')).not.toContain('by relative sensitivity; each shows')
  })

  it('the definition adds no visible text to the card face (tooltip and description only)', () => {
    renderLine({ rank: 2, setSize: 5 })
    expect(line().textContent).not.toContain('relative sensitivity')
    expect(line().textContent).not.toContain('each shows its own rank')
  })
})
