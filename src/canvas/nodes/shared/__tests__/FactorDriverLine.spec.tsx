/**
 * FactorDriverLine — Paul's 23 Sep 2026 Canvas contract feedback, points 5 and
 * 9, as contract v3.1 restates them.
 *
 * ED #63 5806207128 ("Factor anatomy", 24 Sep; supersedes contract v3.1 pt 5's
 * "Driver N of M ranked in this run"): "If rank is published: use e.g. `Driver
 * 1 of 6 analysed` + a neutral thin relative bar. Denominator = eligible
 * analysed factors, not 'number of ranks we happen to render'." Stale form:
 * `Last run · Driver 1 of 6 ranked`. That restores the served wording and
 * the served definition of M (the factors in the last analysis) from before
 * the v3.1 change. The line stays RANKED-ONLY (`rank` is non-null by type);
 * the unranked factor's statement is `FactorDriverNotRanked`. The hover and
 * description define M and say why a factor may carry no rank.
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
import { MAX_BADGED_RANK } from '../../../../components/results/driverDisplayModel'

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

  it('contract v3.1 pt 9 — the track is thinner: the fixture’s 30 × 3px, counter-scaled with its caption', () => {
    renderLine({ rank: 1, setSize: 3 })
    const track = new Set(screen.getByTestId('factor-driver-line-bar').className.split(/\s+/))
    // Audit F3: the same `--canvas-label-scale` as the caption beside it, so at
    // the 0.65 landing zoom the bar keeps its proportion to the words.
    expect(track.has('h-[calc(3px*var(--canvas-label-scale,1))]')).toBe(true)
    expect(track.has('w-[calc(30px*var(--canvas-label-scale,1))]')).toBe(true)
    expect(track.has('w-[54px]')).toBe(false)
  })

  it('NODE-ANATOMY v3.2 — the rank is secondary: regular weight, beside its bar, fill at the fixture’s #908D8D', () => {
    renderLine({ rank: 1, setSize: 3 })
    const caption = new Set(screen.getByTestId('factor-driver-line-caption').className.split(/\s+/))
    expect(caption.has('font-medium')).toBe(false)
    const button = new Set(line().className.split(/\s+/))
    expect(button.has('justify-between')).toBe(false)
    expect(button.has('flex')).toBe(false)
    // Laid out as text: the bar follows the caption's last word, so a caption
    // that wraps at landing zoom does not push the bar onto a line of its own.
    const bar = new Set(screen.getByTestId('factor-driver-line-bar').className.split(/\s+/))
    expect(bar.has('inline-block')).toBe(true)
    expect(bar.has('align-middle')).toBe(true)
    expect(new Set(fill().className.split(/\s+/)).has('bg-text-light/75')).toBe(true)
  })
})

describe('ED 5806207128 — "Driver N of M analysed" defines its M (the analysed factors); an unranked factor shows no rank', () => {
  it('the caption is ED’s exact wording, M from rank.setSize', () => {
    renderLine({ rank: 2, setSize: 5 })
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Driver 2 of 5 ranked in this run')
    expect(driverLineCaption({ rank: 2, setSize: 5 })).toBe('Driver 2 of 5 ranked in this run')
  })

  it('a ranked line’s accessible description defines the denominator as the analysed factors', () => {
    renderLine({ rank: 2, setSize: 5 })
    const el = line()
    expect(el).toHaveAccessibleDescription(driverLineDenominatorNote({ rank: 2, setSize: 5 }))
    const note = el.getAttribute('aria-description') ?? ''
    expect(note).toContain('“of 5” counts the factors the run ranked')
    expect(note).toContain(`at most ${MAX_BADGED_RANK}`)
    expect(note).toContain('only where their order is clear')
    expect(note).toContain('has not been left out')
    // Not the retired v3.1 definition ("this run ranked M factors").
    expect(note).not.toContain('ranked 5 factors')
  })

  it('DISCRIMINATING — the denominator is read off the prop, not a constant (5 vs 7)', () => {
    renderLine({ rank: 1, setSize: 7 })
    const note = line().getAttribute('aria-description') ?? ''
    expect(note).toContain('“of 7”')
    expect(note).not.toContain('“of 5”')
  })

  it('the stale form: the caption opens with `Last run · ` and the name opens with the caption', () => {
    renderLine({ rank: 2, setSize: 5 }, { fromLastRun: true })
    const el = line()
    const caption = screen.getByTestId('factor-driver-line-caption').textContent!
    expect(caption).toBe('Last run · Driver 2 of 5 ranked')
    // Label in Name (WCAG 2.5.3): the visible string opens the spoken one.
    expect(el.getAttribute('aria-label')!.startsWith(`${caption}. `)).toBe(true)
    expect(el.getAttribute('aria-description')).toContain('“of 5” counts the factors the run ranked')
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
    expect(line().getAttribute('aria-label')).not.toContain('counts the factors')
  })

  it('the definition adds no visible text to the card face (tooltip and description only)', () => {
    renderLine({ rank: 2, setSize: 5 })
    expect(line().textContent).not.toContain('counts the factors')
    expect(line().textContent).not.toContain('left out')
  })
})
