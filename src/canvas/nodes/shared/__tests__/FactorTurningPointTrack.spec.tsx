/**
 * The turning-point mini-visual — Paul 23 Sep contract feedback point 3.
 *
 *   (a) direction in words: "Below 6.5%, the current model comparison changes."
 *   (b) option scope where the producer names the option
 *   (c) the track states what its domain represents
 *   (d) "no turning point" is a first-class, quiet fallback — and it never
 *       promotes a probe that established nothing into an attested absence
 *   + units must be compatible, or the number and the track withhold.
 *
 * Bound by IDENTITY (test ids, exact sentences), never by a value predicate.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import { FactorTurningPointTrack, FactorTurningPointNone, FactorTurningPointSlot } from '../FactorTurningPointTrack'
import type { FactorTurningPointDetail } from '../factorTurningPoint'

afterEach(cleanup)

const FALLS: FactorTurningPointDetail = {
  currentValue: 8,
  flipValue: 6.5,
  unit: '%',
  displayScale: true,
  alternativeLabel: null,
}

const visible = (el: Element) => {
  const c = el.cloneNode(true) as HTMLElement
  c.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return c.textContent
}

describe('(a) direction in words', () => {
  it('a flip BELOW the run value says "Below 6.5%, the current model comparison changes."', () => {
    render(<FactorTurningPointTrack nodeId="f1" factorLabel="Trial conversion" turningPoint={FALLS} />)
    const tp = screen.getByTestId('factor-turning-point')
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Below 6.5%, the current model comparison changes.',
    )
    // Label in Name (WCAG 2.5.3): the visible sentence opens the spoken name.
    expect(tp.getAttribute('aria-label')!.startsWith('Below 6.5%, the current model comparison changes.')).toBe(true)
  })

  it('a flip ABOVE the run value says "Above …" — control for the side', () => {
    render(
      <FactorTurningPointTrack
        nodeId="f1"
        factorLabel="Seats"
        turningPoint={{ ...FALLS, currentValue: 10, flipValue: 12, unit: 'seats' }}
      />,
    )
    expect(screen.getByTestId('factor-turning-point-caption').textContent).toBe(
      'Above 12 seats, the current model comparison changes.',
    )
  })

  it('a KNOWN-changed model keeps the figure, labelled "Last run · ", and drops "current"', () => {
    render(<FactorTurningPointTrack nodeId="f1" factorLabel="Trial conversion" turningPoint={FALLS} fromLastRun />)
    const tp = screen.getByTestId('factor-turning-point')
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Last run · Below 6.5%, the model comparison changes.',
    )
    expect(within(tp).getByTestId('factor-turning-point-run-value').textContent).toBe('8% in last run')
    expect(tp.getAttribute('aria-label')!.startsWith('Last run · Below 6.5%')).toBe(true)
  })
})

describe('(b) option scope', () => {
  it('names the producer’s alternative in the withheld register — model-relative, no advice', () => {
    render(
      <FactorTurningPointTrack
        nodeId="f1"
        factorLabel="Trial conversion"
        turningPoint={{ ...FALLS, alternativeLabel: 'Two Developers' }}
      />,
    )
    const caption = screen.getByTestId('factor-turning-point-caption').textContent!
    expect(caption).toBe('Below 6.5%, the current model comparison shifts towards Two Developers.')
    expect(caption).not.toMatch(/should|best|recommend|leader|winner/i)
  })
})

describe('(c) the track states what its domain represents', () => {
  it('labels both ends: the turning point and the run’s own value; says spacing is not to scale', () => {
    render(<FactorTurningPointTrack nodeId="f1" factorLabel="Trial conversion" turningPoint={FALLS} />)
    const tp = screen.getByTestId('factor-turning-point')
    expect(within(tp).getByTestId('factor-turning-point-value').textContent).toBe('6.5%')
    expect(within(tp).getByTestId('factor-turning-point-run-value').textContent).toBe('8% in this run')
    expect(tp.getAttribute('aria-label')).toContain(
      'The track marks the turning point (6.5%) and 8% in this run, in order of value; spacing is not to scale and shows no uncertainty.',
    )
    // Low → high, left → right: the lower value (the flip) is drawn first.
    const track = within(tp).getByTestId('factor-turning-point-track')
    const flip = within(track).getByTestId('factor-turning-point-flip') as HTMLElement
    const current = within(track).getByTestId('factor-turning-point-current') as HTMLElement
    expect(parseFloat(flip.style.left)).toBeLessThan(parseFloat(current.style.left))
    // Paul 23 Sep point 9: Info blue is attention's; the track's marks are
    // neutral and told apart by SHAPE (rotated hollow square vs round dot).
    for (const mark of [flip, current]) expect(mark.className).not.toMatch(/\b(border|bg|text)-info\b/)
    expect(flip.className).toContain('rotate-45')
    expect(current.className).toContain('rounded-full')
  })

  it('⛔ a NORMALISED row prints no number and draws no track — and says why (ROADMAP 2.1371)', () => {
    render(
      <FactorTurningPointTrack
        nodeId="f1"
        factorLabel="Seat count"
        turningPoint={{ currentValue: 0.6, flipValue: 0.5, unit: undefined, displayScale: false, alternativeLabel: null }}
      />,
    )
    const tp = screen.getByTestId('factor-turning-point')
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Below a turning point, the current model comparison changes.',
    )
    expect(within(tp).queryByTestId('factor-turning-point-value')).toBeNull()
    expect(within(tp).queryByTestId('factor-turning-point-track')).toBeNull()
    expect(tp.getAttribute('aria-label')).toContain('internal scale')
    expect(tp.getAttribute('aria-label')).not.toMatch(/0\.5|0\.6/)
  })

  it('⛔ units must be compatible: a row in % on a factor in seats withholds number and track — control: % on % shows both', () => {
    render(
      <FactorTurningPointTrack nodeId="f1" factorLabel="Seat count" turningPoint={FALLS} factorUnit="seats" />,
    )
    const tp = screen.getByTestId('factor-turning-point')
    expect(within(tp).queryByTestId('factor-turning-point-value')).toBeNull()
    expect(within(tp).queryByTestId('factor-turning-point-track')).toBeNull()
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Below a turning point, the current model comparison changes.',
    )
    expect(tp.getAttribute('aria-label')).toContain('different unit')
    cleanup()
    render(
      <FactorTurningPointTrack nodeId="f1" factorLabel="Trial conversion" turningPoint={FALLS} factorUnit="percent" />,
    )
    expect(screen.getByTestId('factor-turning-point-value').textContent).toBe('6.5%')
    expect(screen.getByTestId('factor-turning-point-track')).toBeTruthy()
  })
})

describe('(d) "no turning point" is the normal, quiet fallback', () => {
  it('an ATTESTED no-flip says "No turning point in this run"', () => {
    render(<FactorTurningPointNone nodeId="f1" attested />)
    const none = screen.getByTestId('factor-turning-point-none')
    expect(visible(none)).toBe('No turning point in this run')
    expect(none.className).toContain('text-text-light')
    expect(none.textContent).toContain('did not change the model comparison')
  })

  it('⛔ a probe that established nothing says "available", never "in this run"', () => {
    render(<FactorTurningPointNone nodeId="f1" attested={false} />)
    const none = screen.getByTestId('factor-turning-point-none')
    expect(visible(none)).toBe('No turning point available')
    expect(none.textContent).not.toContain('did not change')
  })

  it('keeps the "Last run · " prefix only when the model is KNOWN to have changed', () => {
    render(<FactorTurningPointNone nodeId="f1" attested fromLastRun />)
    expect(visible(screen.getByTestId('factor-turning-point-none'))).toBe('Last run · No turning point in that run')
    cleanup()
    render(<FactorTurningPointNone nodeId="f1" attested={false} />)
    expect(screen.getByTestId('factor-turning-point-none').textContent).not.toContain('Last run')
  })

  it('the slot renders exactly one of the two — track for found, fallback otherwise', () => {
    render(
      <FactorTurningPointSlot nodeId="f1" factorLabel="Trial conversion" state={{ kind: 'found', turningPoint: FALLS }} />,
    )
    expect(screen.getByTestId('factor-turning-point')).toBeTruthy()
    expect(screen.queryByTestId('factor-turning-point-none')).toBeNull()
    cleanup()
    render(<FactorTurningPointSlot nodeId="f1" factorLabel="Trial conversion" state={{ kind: 'none', attested: false }} />)
    expect(screen.queryByTestId('factor-turning-point')).toBeNull()
    expect(visible(screen.getByTestId('factor-turning-point-none'))).toBe('No turning point available')
  })
})

/**
 * ⭐⭐ SUPERSEDED BY CONTRACT v3.1 POINT 3 (DESIGN-GAP-v31 #38, 26 Sep 2026).
 * v3.1's own fixture (`olumi-canvas-visual-contract-v31.html` `flipPlot`)
 * captions the RESTING track with the direction sentence itself — "Below 6.5%,
 * the current model comparison changes." — and the common brief rules that
 * v3.1 wins over the code's documented rulings. The block below records the
 * earlier ruling it replaces; the tests now pin v3.1: the sentence is the
 * visible caption at rest and in the full form alike, the number prints ONCE
 * (in the sentence, never again on the track at rest), the name opens with the
 * sentence and the tooltip is the domain note.
 *
 * (Earlier: AT REST — THE PROTOTYPE'S ONE-LINE CAPTION (Paul 25 Sep 2026: the canvas
 * matches the prototype; verifier FIX_NEEDED 1 on c5adac48: the 49-character
 * direction sentence on the resting card broke the brief's ~4-body-line limit).
 *
 * The prototype (`olumi-canvas-visual-contract.html` `flipPlot`) at rest:
 *
 *   Model comparison changes          6.5%     ← caption + the number, ONE line
 *   ────◆─────────●────  8% in this run        ← the track
 *
 * stale: `Last run · comparison changes`. The DIRECTION sentence (Paul 23 Sep
 * point 3(a)) is moved, not deleted: it follows the visible caption in the accessible name and opens the
 * tooltip. The number prints ONCE on the card (in the caption, not again on
 * the track), and never without its number: a row whose number may not print
 * keeps the full sentence (the caller does not put it at rest at all).
 */
describe('at rest — v3.1: the direction sentence IS the caption; the number prints once', () => {
  const rest = (props: Partial<Parameters<typeof FactorTurningPointTrack>[0]> = {}) =>
    render(
      <FactorTurningPointTrack nodeId="f1" factorLabel="Trial conversion" turningPoint={FALLS} atRest {...props} />,
    )

  it('fresh: the caption is "Below 6.5%, the current model comparison changes."; the name opens with it', () => {
    rest()
    const tp = screen.getByTestId('factor-turning-point')
    expect(visible(within(tp).getByTestId('factor-turning-point-caption'))).toBe('Below 6.5%, the current model comparison changes.')
    // The retired floated number beside a short caption is gone.
    expect(within(tp).queryByTestId('factor-turning-point-caption-value')).toBeNull()
    expect(tp.getAttribute('aria-label')!.startsWith('Below 6.5%, the current model comparison changes. ')).toBe(true)
    expect(visible(tp)).not.toContain('Model comparison changes')
    // The track and the run's own value stay; the number is printed ONCE.
    expect(within(tp).getByTestId('factor-turning-point-track')).toBeTruthy()
    expect(within(tp).getByTestId('factor-turning-point-run-value').textContent).toBe('8% in this run')
    expect(within(tp).queryByTestId('factor-turning-point-value')).toBeNull()
    expect(visible(tp)!.split('6.5%').length - 1).toBe(1)
  })

  it('stale: the caption is the Last-run sentence; the name opens with it', () => {
    rest({ fromLastRun: true })
    const tp = screen.getByTestId('factor-turning-point')
    expect(visible(within(tp).getByTestId('factor-turning-point-caption'))).toBe('Last run · Below 6.5%, the model comparison changes.')
    expect(tp.getAttribute('aria-label')!.startsWith('Last run · Below 6.5%, the model comparison changes. ')).toBe(true)
    expect(within(tp).getByTestId('factor-turning-point-run-value').textContent).toBe('8% in last run')
  })

  it('the option scope the producer names is kept in the name (Paul 23 Sep point 3(b))', () => {
    rest({ turningPoint: { ...FALLS, alternativeLabel: 'Two Developers' } })
    const tp = screen.getByTestId('factor-turning-point')
    // v3.1 point 3: "name them on the card or one click away" — on the card.
    expect(visible(within(tp).getByTestId('factor-turning-point-caption'))).toBe('Below 6.5%, the current model comparison shifts towards Two Developers.')
    expect(tp.getAttribute('aria-label')).toContain('Below 6.5%, the current model comparison shifts towards Two Developers.')
  })

  it('the tooltip is the domain note at rest — the sentence is already visible — and the same in the full form', async () => {
    rest()
    fireEvent.mouseEnter(screen.getByTestId('factor-turning-point'))
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent!.startsWith('The track marks')).toBe(true)
    cleanup()
    render(<FactorTurningPointTrack nodeId="f1" factorLabel="Trial conversion" turningPoint={FALLS} />)
    fireEvent.mouseEnter(screen.getByTestId('factor-turning-point'))
    const full = await screen.findByRole('tooltip')
    expect(full.textContent!.startsWith('The track marks')).toBe(true)
  })

  it('⛔ never a bare caption without its number: a NORMALISED row at rest keeps the full direction sentence', () => {
    rest({ turningPoint: { ...FALLS, displayScale: false } })
    const tp = screen.getByTestId('factor-turning-point')
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Below a turning point, the current model comparison changes.',
    )
    expect(within(tp).queryByTestId('factor-turning-point-caption-value')).toBeNull()
    expect(within(tp).queryByTestId('factor-turning-point-track')).toBeNull()
  })

  it('CONTRAST — without `atRest` the caption is the full sentence and the track labels the number', () => {
    render(<FactorTurningPointTrack nodeId="f1" factorLabel="Trial conversion" turningPoint={FALLS} />)
    const tp = screen.getByTestId('factor-turning-point')
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe(
      'Below 6.5%, the current model comparison changes.',
    )
    expect(within(tp).queryByTestId('factor-turning-point-caption-value')).toBeNull()
    expect(within(tp).getByTestId('factor-turning-point-value').textContent).toBe('6.5%')
  })

  it('the slot passes `atRest` through', () => {
    render(
      <FactorTurningPointSlot nodeId="f1" factorLabel="Trial conversion" state={{ kind: 'found', turningPoint: FALLS }} atRest />,
    )
    expect(visible(screen.getByTestId('factor-turning-point-caption'))).toBe('Below 6.5%, the current model comparison changes.')
    // …and `atRest` still takes the number off the track (printed once).
    expect(screen.queryByTestId('factor-turning-point-value')).toBeNull()
  })
})
