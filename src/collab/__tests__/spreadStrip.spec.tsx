/**
 * COLLAB — THE SPREAD STRIP.
 *
 * ── WHAT THESE TESTS ARE FOR ──────────────────────────────────────────────
 * Two things, and only the second is about pixels.
 *
 * 1. THE STRIP MUST NOT DRAW A CLAIM NOBODY MADE. A picture is more persuasive
 *    than a sentence, so the "no aggregate" rule that governs this feature is
 *    STRICTER here. The guard is written against the SPEC ("only real answers
 *    and the model's own number are marked"), not against the shapes that
 *    happen to exist today — so a mean line, a midpoint tick or a shaded band
 *    added later goes red on arrival rather than on review.
 * 2. THE GEOMETRY MUST BIND TO THE RIGHT PERSON. `projectX` is pure and is
 *    tested directly; the dots are then asserted per participant BY ID, so a
 *    strip that drew the right number of dots in the right places with the
 *    wrong names attached still fails.
 *
 * ⚠ jsdom lays out nothing, so nothing here is a claim about how this LOOKS.
 * These tests pin the ATTRIBUTES and the ARITHMETIC — which is the half that
 * can be wrong silently. The visual half is a real-browser question (trap 3).
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SpreadStrip, SpreadSection, projectX } from '../SpreadStrip'
import type { DisagreementPosition } from '../collabService'

const TARGET = 'fac_churn_risk'
const GRACE = '55555555-5555-4555-8555-555555555555'
const ADA = '66666666-6666-4666-8666-666666666666'
const PRIYA = '77777777-7777-4777-8777-777777777777'

function position(
  id: string,
  label: string,
  value: number | null,
  pole: DisagreementPosition['pole'],
  kind = 'belief_submitted',
): DisagreementPosition {
  return {
    participant_id: id,
    display_label: label,
    value,
    stated_basis: null,
    confidence: null,
    kind,
    pole,
  }
}

const SPREAD = { low: 0.2, high: 0.85, width: 0.65 }
const SPLIT = [
  position(GRACE, 'Grace', 0.85, 'high'),
  position(ADA, 'Ada', 0.2, 'low'),
]

function dot(participantId: string): SVGCircleElement {
  const g = screen.getByTestId(`spread-strip-position-${participantId}`)
  const circle = g.querySelector('circle')
  if (circle === null) throw new Error(`no dot drawn for ${participantId}`)
  return circle as unknown as SVGCircleElement
}

function cx(participantId: string): number {
  return Number(dot(participantId).getAttribute('cx'))
}

describe('projectX places a value on the axis and never divides by zero', () => {
  it('maps the domain ends to the padded ends of the viewBox', () => {
    expect(projectX(0.2, 0.2, 0.85)).toBe(64)
    expect(projectX(0.85, 0.2, 0.85)).toBe(640 - 64)
  })

  it('is monotonic in the value', () => {
    const a = projectX(0.2, 0.2, 0.85)
    const b = projectX(0.5, 0.2, 0.85)
    const c = projectX(0.85, 0.2, 0.85)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })

  it('a degenerate domain collapses to the centre rather than to Infinity', () => {
    const x = projectX(0.4, 0.4, 0.4)
    expect(Number.isFinite(x)).toBe(true)
    expect(x).toBe(320)
  })
})

describe('the strip marks the people, and only the people', () => {
  it('draws one dot per answering participant, bound BY ID', () => {
    render(
      <SpreadStrip targetId={TARGET} spread={SPREAD} positions={SPLIT} modelValue={null} />,
    )

    // Ada is the low pole and Grace the high one, so Ada's dot is to the LEFT.
    // Asserted as a relation between two NAMED people — a strip that drew both
    // dots correctly but swapped the names would pass a count assertion.
    expect(cx(ADA)).toBeLessThan(cx(GRACE))
    expect(cx(ADA)).toBe(64)
    expect(cx(GRACE)).toBe(640 - 64)
  })

  it('`pole` decides which way a label runs, so an endpoint label stays on the strip', () => {
    render(
      <SpreadStrip
        targetId={TARGET}
        spread={SPREAD}
        positions={[
          ...SPLIT,
          position(PRIYA, 'Priya', 0.5, null),
        ]}
        modelValue={null}
      />,
    )

    const textAnchor = (id: string): string | null =>
      screen.getByTestId(`spread-strip-position-${id}`).querySelector('text')?.getAttribute('text-anchor') ?? null

    expect(textAnchor(ADA)).toBe('start')
    expect(textAnchor(GRACE)).toBe('end')
    // A middle position has no pole and is centred — the discrimination the
    // attribute exists to make.
    expect(textAnchor(PRIYA)).toBe('middle')
  })

  it('a declined participant gets no dot', () => {
    render(
      <SpreadStrip
        targetId={TARGET}
        spread={SPREAD}
        positions={[...SPLIT, position(PRIYA, 'Priya', null, null, 'declined')]}
        modelValue={null}
      />,
    )

    expect(screen.queryByTestId(`spread-strip-position-${PRIYA}`)).toBeNull()
    expect(screen.getByTestId(`spread-strip-position-${ADA}`)).toBeTruthy()
  })

  it('two people on the same number share a point — the picture does not invent a gap', () => {
    render(
      <SpreadStrip
        targetId={TARGET}
        spread={SPREAD}
        positions={[
          position(GRACE, 'Grace', 0.85, 'high'),
          position(ADA, 'Ada', 0.2, 'low'),
          position(PRIYA, 'Priya', 0.2, 'low'),
        ]}
        modelValue={null}
      />,
    )

    // Ada and Priya gave the SAME answer. Separating them would be a lie about
    // the data; they are told apart by their own rows instead.
    expect(cx(ADA)).toBe(cx(PRIYA))
    expect(cx(ADA)).not.toBe(cx(GRACE))
  })

  it('nobody answered: nothing is drawn at all', () => {
    const { container } = render(
      <SpreadStrip
        targetId={TARGET}
        spread={SPREAD}
        positions={[position(ADA, 'Ada', null, null, 'declined')]}
        modelValue={null}
      />,
    )

    expect(container.querySelector('svg')).toBeNull()
  })
})

describe("the model's own number is marked, and marked as the model's", () => {
  it('renders a model mark when there is a value, positioned by that value', () => {
    render(<SpreadStrip targetId={TARGET} spread={SPREAD} positions={SPLIT} modelValue={0.35} />)

    const model = screen.getByTestId(`spread-strip-model-${TARGET}`)
    const x = Number(model.querySelector('line')?.getAttribute('x1'))
    // Between the two people, because 0.2 < 0.35 < 0.85.
    expect(x).toBeGreaterThan(cx(ADA))
    expect(x).toBeLessThan(cx(GRACE))
    // Named, so it can never read as a silent extra panellist.
    expect(model.textContent).toContain('Model')
    // Rendered through the SAME formatter as the list below it — a second
    // formatting rule here would show one person's answer two ways.
    expect(model.textContent).toContain('35%')
  })

  it('⚠ ABSENT STAYS ABSENT: no model value, no mark and no invented zero', () => {
    render(<SpreadStrip targetId={TARGET} spread={SPREAD} positions={SPLIT} modelValue={null} />)

    expect(screen.queryByTestId(`spread-strip-model-${TARGET}`)).toBeNull()
    const svg = screen.getByTestId(`spread-strip-${TARGET}`)
    // The tell for a `?? 0` fallback: a mark that appeared anyway, at the axis
    // origin, claiming the model held zero.
    expect(svg.textContent).not.toContain('Model')
  })

  it('a model value OUTSIDE the answers widens the axis and is still drawn', () => {
    render(<SpreadStrip targetId={TARGET} spread={SPREAD} positions={SPLIT} modelValue={1.4} />)

    const model = screen.getByTestId(`spread-strip-model-${TARGET}`)
    const x = Number(model.querySelector('line')?.getAttribute('x1'))
    expect(Number.isFinite(x)).toBe(true)
    // Drawn to the right of every person, and inside the viewBox — not clipped
    // off the edge, which is what a domain fixed to [low, high] would do.
    expect(x).toBeGreaterThan(cx(GRACE))
    expect(x).toBeLessThanOrEqual(640)
    // ⭐ AND THE ENDPOINT LABELS STILL NAME THE ANSWERS, not the drawn extent:
    // a tick reading 1.4 would claim somebody answered 1.4.
    // ⭐ THE ENDPOINT TICKS STILL NAME THE ANSWERS, not the drawn extent.
    // Scoped to the AXIS group, deliberately: the model's own mark reads
    // "Model 1.4" and legitimately contains that number, so a whole-SVG
    // absence check would fail on the correct behaviour. What must not happen
    // is an axis TICK claiming somebody answered 1.4.
    const tickText = Array.from(
      screen.getByTestId(`spread-strip-${TARGET}`).querySelectorAll('g.text-text-light text'),
    ).map((t) => t.textContent)
    expect(tickText).toEqual(['20%', '85%'])
  })
})


describe('⭐ THE STANDING PROHIBITION: the picture may not draw an aggregate', () => {
  /**
   * Written against the SPEC, not against today's shapes. The strip is allowed
   * exactly three kinds of mark, so the guard enumerates what is DRAWN and
   * requires every one of them to be accounted for by a real datum. A mean
   * line, a midpoint tick or a shaded band added later fails this on arrival —
   * which is the whole point, because none of them would fail a test written
   * as "there is no element with class `mean-line`".
   */
  it('every circle drawn corresponds to a participant value; there are no extras', () => {
    render(
      <SpreadStrip
        targetId={TARGET}
        spread={SPREAD}
        positions={[
          ...SPLIT,
          position(PRIYA, 'Priya', 0.5, null),
        ]}
        modelValue={0.35}
      />,
    )

    const svg = screen.getByTestId(`spread-strip-${TARGET}`)
    const circles = Array.from(svg.querySelectorAll('circle'))
    // Three answers, three dots. A midpoint marker would make it four.
    expect(circles).toHaveLength(3)

    const drawnAt = circles.map((c) => Number(c.getAttribute('cx'))).sort((a, b) => a - b)
    const expectedAt = [0.2, 0.5, 0.85].map((v) => projectX(v, 0.2, 0.85)).sort((a, b) => a - b)
    expect(drawnAt).toEqual(expectedAt)
  })

  it('no filled region is drawn — a shaded band is an aggregate wearing a colour', () => {
    render(<SpreadStrip targetId={TARGET} spread={SPREAD} positions={SPLIT} modelValue={0.35} />)

    const svg = screen.getByTestId(`spread-strip-${TARGET}`)
    expect(svg.querySelectorAll('rect')).toHaveLength(0)
    expect(svg.querySelectorAll('path')).toHaveLength(0)
    expect(svg.querySelectorAll('polygon')).toHaveLength(0)
  })

  it('the midpoint of the range is not marked by anything', () => {
    render(<SpreadStrip targetId={TARGET} spread={SPREAD} positions={SPLIT} modelValue={null} />)

    const midpoint = projectX((0.2 + 0.85) / 2, 0.2, 0.85)
    const svg = screen.getByTestId(`spread-strip-${TARGET}`)
    const xs = Array.from(svg.querySelectorAll('circle, line')).flatMap((el) =>
      ['cx', 'x1'].map((a) => Number(el.getAttribute(a))).filter((n) => !Number.isNaN(n)),
    )
    expect(xs).not.toContain(midpoint)
    // And no arithmetic mean of the two answers on screen as text either —
    // in EITHER spelling the display rule can produce.
    expect(svg.textContent).not.toContain(String((0.2 + 0.85) / 2))
    expect(svg.textContent).not.toContain('52.5%')
  })
})

describe('the picture never ships without the words', () => {
  it('SpreadSection renders the sentence and the strip together', () => {
    render(
      <SpreadSection targetId={TARGET} spread={SPREAD} positions={SPLIT} modelValue={0.35} />,
    )

    expect(screen.getByTestId(`disagreement-spread-${TARGET}`).textContent).toBe(
      'The answers run from 20% to 85%.',
    )
    expect(screen.getByTestId(`spread-strip-${TARGET}`)).toBeTruthy()
  })

  it('the strip carries a text equivalent naming every datum it draws', () => {
    render(<SpreadStrip targetId={TARGET} spread={SPREAD} positions={SPLIT} modelValue={0.35} />)

    const label = screen.getByTestId(`spread-strip-${TARGET}`).getAttribute('aria-label') ?? ''
    expect(label).toContain('20%')
    expect(label).toContain('85%')
    expect(label).toContain('Grace')
    expect(label).toContain('Ada')
    expect(label).toContain('The model held 35%')
    expect(screen.getByTestId(`spread-strip-${TARGET}`).getAttribute('role')).toBe('img')
  })
})
