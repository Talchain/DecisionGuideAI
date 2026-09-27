/**
 * FactorDriverLine — Paul's 23 Sep 2026 Canvas contract feedback, points 5 and
 * 9, as contract v3.1 restates them.
 *
 * NODE-ANATOMY v3.2 + contract v3.1 pt 5 (ACCEPTED by Paul): "`Driver N of M
 * ranked in this run`, where M is the number of factors the run ranked. Show
 * every one of the M ranks on its card; its hover and detail define the
 * denominator … Stale form: `Last run · Driver N of M ranked`." The line stays
 * RANKED-ONLY (`rank` is non-null by type); the unranked factor's statement is
 * `FactorDriverNotRanked`. The hover and description define M and say why a
 * factor may carry no rank.
 *
 * ⛔ RE-PINNED 27 Sep 2026 (side-by-side DIFF items 3, 4, 11). The previous pins
 * encoded ED #63 5806207128's `Driver N of M analysed`, M = every factor in the
 * feed: on Paul's MRR run that printed `Driver 1 of 5 analysed` beside three
 * silent cards (the omission pt 5 forbids), and its stale form truncated at
 * landing. The bar pins encoded "NN% of the strongest factor" on the displayed
 * influence basis, which drew Driver 1 at 81% of a factor the card calls
 * unranked. The bar is now relative sensitivity, rank 1 = 100%.
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

describe('NODE-ANATOMY v3.2 — "Driver N of M ranked in this run" defines its M (the ranked factors); an unranked factor shows no rank', () => {
  it('the caption is the contract’s exact wording, M from rank.setSize; the stale form drops "in this run"', () => {
    renderLine({ rank: 2, setSize: 3 })
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Driver 2 of 3 ranked in this run')
    expect(driverLineCaption({ rank: 2, setSize: 3 })).toBe('Driver 2 of 3 ranked in this run')
    expect(driverLineCaption({ rank: 2, setSize: 3 }, true)).toBe('Driver 2 of 3 ranked')
  })

  it('a ranked line’s accessible description defines the denominator as the factors the run ranked', () => {
    renderLine({ rank: 2, setSize: 3 })
    const el = line()
    expect(el).toHaveAccessibleDescription(driverLineDenominatorNote({ rank: 2, setSize: 3 }))
    const note = el.getAttribute('aria-description') ?? ''
    expect(note).toContain('This run ranked 3 factors by relative sensitivity; each shows its own rank.')
    expect(note).toContain(`at most ${MAX_BADGED_RANK}`)
    expect(note).toContain('only where their order is clear')
    expect(note).toContain('has not been left out')
    // Not the retired ED 5806207128 definition (every factor in the feed).
    expect(note).not.toContain('counts the factors in the last analysis')
  })

  it('DISCRIMINATING — the denominator is read off the prop, not a constant (2 vs 3)', () => {
    renderLine({ rank: 1, setSize: 2 })
    const note = line().getAttribute('aria-description') ?? ''
    expect(note).toContain('This run ranked 2 factors')
    expect(note).not.toContain('ranked 3 factors')
  })

  it('the stale form: the caption opens with `Last run · `, drops "in this run", and the name opens with the caption', () => {
    renderLine({ rank: 2, setSize: 3 }, { fromLastRun: true })
    const el = line()
    const caption = screen.getByTestId('factor-driver-line-caption').textContent!
    expect(caption).toBe('Last run · Driver 2 of 3 ranked')
    // Label in Name (WCAG 2.5.3): the visible string opens the spoken one.
    expect(el.getAttribute('aria-label')!.startsWith(`${caption}. `)).toBe(true)
    expect(el.getAttribute('aria-description')).toContain('The last run ranked 3 factors by relative sensitivity')
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
    renderLine({ rank: 2, setSize: 3 })
    fireEvent.mouseEnter(line())
    const tip = await screen.findByRole('tooltip')
    const disclosure = driverLineExplanation({ rank: { rank: 2, setSize: 3 }, value: 0.62 })
    expect(tip).toHaveTextContent(disclosure)
    expect(tip).toHaveTextContent(driverLineDenominatorNote({ rank: 2, setSize: 3 }))
  })

  it('the definition is a DESCRIPTION, so the name keeps no second copy of it', () => {
    renderLine({ rank: 2, setSize: 3 }, { fromLastRun: true })
    expect(line().getAttribute('aria-label')).not.toContain('each shows its own rank')
  })

  it('the definition adds no visible text to the card face (tooltip and description only)', () => {
    renderLine({ rank: 2, setSize: 3 })
    expect(line().textContent).not.toContain('each shows its own rank')
    expect(line().textContent).not.toContain('left out')
  })
})

describe('DIFF item 4 — the bar is relative sensitivity against the top-ranked driver', () => {
  it('the name says what the bar measures and what it is relative to', () => {
    renderLine({ rank: 2, setSize: 3 })
    const name = line().getAttribute('aria-label') ?? ''
    expect(name).toContain('Bar: relative sensitivity, 62% of the top-ranked driver.')
    expect(name).toContain('not a causal contribution percentage')
    // Not the retired influence-basis wording.
    expect(name).not.toContain('of the strongest factor')
  })

  it('no figure → the rank still shows, but no bar and no bar sentence', () => {
    renderLine({ rank: 2, setSize: 3 }, { value: null })
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Driver 2 of 3 ranked in this run')
    expect(screen.queryByTestId('factor-driver-line-bar')).toBeNull()
    expect(line().getAttribute('aria-label')).not.toContain('Bar:')
  })
})

describe('the in-slot line never clips mid-glyph (Paul, MRR model, 27 Sep 2026)', () => {
  it('the in-slot button spans its slot (w-full), so the row wraps at the slot edge — not at the card border', () => {
    renderLine({ rank: 1, setSize: 3 }, { inSlot: true, fromLastRun: true })
    const button = line().closest('button') ?? line()
    const tokens = (button.getAttribute('class') ?? '').split(/\s+/)
    // Served e8ba18e6: without `w-full` a <button> shrinks to fit its content,
    // and the slot cut the caption — "…Driver 1 of 6 analysec".
    expect(tokens).toContain('w-full')
    expect(tokens).toContain('min-w-0')
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Last run · Driver 1 of 3 ranked')
    // Whether the caption FITS at landing, and how the bar gives way, is a width
    // claim: `FactorDriverLine.landingFit.spec.tsx` (measured glyph advances,
    // with discriminating controls), not a class-token reading here.
  })

  it('CONTRAST: the free-flowing line (Detailed, not in a slot) is not forced to the slot width', () => {
    renderLine({ rank: 1, setSize: 6 })
    const button = line().closest('button') ?? line()
    expect((button.getAttribute('class') ?? '').split(/\s+/)).not.toContain('w-full')
  })
})
