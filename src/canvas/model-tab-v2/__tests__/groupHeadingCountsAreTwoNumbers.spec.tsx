/**
 * ⭐⭐ THE OUTLINE'S GROUP HEADING RAN TWO COUNTS TOGETHER INTO ONE NUMBER.
 *
 * Measured on the DEPLOYED build `14276d5b` (guest, restored model, completed
 * run), reading the live accessible names off the real DOM:
 *
 *     "▸ Goal22 with no value yet"              ← 2 elements, 2 unset
 *     "▸ Factors53 with no value yet"           ← 5 elements, 3 unset
 *     "▸ Outcomes & risks55 with no value yet"  ← 5 elements, 5 unset
 *     "▸ Relationships13"                       ← a GENUINE 13
 *
 * The heading renders the total and the unset summary as two adjacent `<span>`s
 * with no text node between them, so accessible-name computation concatenates
 * them with nothing in between and a screen-reader user hears "fifty-three".
 *
 * ⚠⚠ THE SHARPEST PART IS THE LAST LINE. `Relationships13` is a real
 * two-digit count. A listener cannot tell it from a fabricated one, because
 * both are spelled the same way — so the defect does not corrupt one number, it
 * makes every number on the surface unreliable. That is the difference between
 * a wrong figure and an untrustworthy surface, and it is why this is worth a
 * pinned test rather than a tidy-up.
 *
 * ── AND THE VISUAL HALF, measured with `getComputedStyle` on the same build ──
 * Both spans rendered at `11px`, weight `600`, colour `rgb(110, 107, 107)`,
 * separated by exactly `8px` — the SAME gap that separates the title from the
 * first count. Byte-identical treatment for "how many there are" and "how many
 * are incomplete", with the boundary between them spaced like the boundary
 * inside them. `ModelStrip` on the Reasoning tab already renders this same fact
 * in `text-warning`; one fact, two tabs, two treatments.
 *
 * ⚠ WHAT THIS FILE DOES NOT CLAIM. jsdom performs no layout, so it asserts the
 * accessible NAME (computable from the DOM) and the CLASS that carries the
 * tone. It makes no claim about rendered pixels — the 8px and the colours above
 * are browser measurements, recorded here as the provenance of the fix, not
 * re-asserted by it.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../store', () => ({ useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes: [] }) }))

import { ModelOutline } from '../ModelOutline'
import type { ModelRow } from '../types'

/** A row that HAS a value — counted in the total, never in the unset summary. */
const set = (id: string, label: string): ModelRow => ({
  id,
  kind: 'factor',
  group: 'factors',
  label,
  primaryValue: '60,000',
  provenanceSource: 'user',
  attention: [],
  editable: true,
})

/** A row with nothing stated — `primaryValue === null` is the projection's own
 *  definition of "nothing is stated", and the summary reads that same field. */
const unset = (id: string, label: string): ModelRow => ({
  id,
  kind: 'factor',
  group: 'factors',
  label,
  primaryValue: null,
  // ⚠ NO PROVENANCE, DELIBERATELY. `unsetSummary` buckets an unset row with
  // USER provenance under "you set N" — a real clause, but a different one from
  // the "N with no value yet" the deployed heading showed. A fixture that
  // reached the wrong bucket would test a sentence the defect was not about.
  attention: ['no-value'],
  editable: true,
})

const renderOutline = (rows: ModelRow[]) =>
  render(<ModelOutline rows={rows} tier="plain" filter="" />)

const heading = (group: string) => screen.getByTestId(`model-group-v2-${group}-toggle`)

describe('THE FIXTURE REPRODUCES THE DEPLOYED SHAPE (precondition)', () => {
  /**
   * ⚠ PINNED IN-TEST. Every assertion below is about a heading carrying BOTH a
   * total and an unset summary. A fixture that produced only one of them would
   * make the whole file pass while measuring a state the defect cannot occur in
   * (trap 13b) — which is exactly how a mutant survived the sibling repair on
   * `ModelStrip` earlier tonight.
   */
  it('the group renders a total AND an unset summary', () => {
    renderOutline([set('f1', 'Annual cost'), unset('f2', 'Lead time'), unset('f3', 'Churn')])
    expect(heading('factors')).toHaveTextContent('Factors')
    expect(screen.getByTestId('model-group-v2-factors-unknown-summary')).toBeInTheDocument()
  })
})

describe('the accessible name keeps the two counts apart', () => {
  it('⭐ names the total and the unset count as separate figures', () => {
    renderOutline([set('f1', 'Annual cost'), unset('f2', 'Lead time'), unset('f3', 'Churn')])

    const name = heading('factors').getAttribute('aria-label') ?? ''
    // The deployed defect: "Factors53 with no value yet".
    expect(name).not.toMatch(/Factors\s*53/)
    // 3 elements, 2 of them unset — two figures a listener can tell apart.
    expect(name).toContain('3 elements')
    // Two separate figures in the name, and the second is the summary's own.
    const summary = screen.getByTestId('model-group-v2-factors-unknown-summary').textContent ?? ''
    expect(summary).toContain('2')
    expect(name).toContain(`, ${summary}`)
  })

  it('⭐ a genuine two-digit count is not spelled like a concatenation — the twin', () => {
    // The case that makes the defect corrosive rather than merely wrong: a real
    // 13 and a fabricated 13 read identically. With the total labelled, they
    // cannot be confused in either direction.
    const rows = Array.from({ length: 13 }, (_, i) => set(`f${i}`, `Factor ${i}`))
    renderOutline(rows)

    const name = heading('factors').getAttribute('aria-label') ?? ''
    expect(name).toContain('13 elements')
    expect(name).not.toContain('with no value yet')
  })

  it('keeps label-in-name: the visible title is inside the accessible name', () => {
    // WCAG 2.5.3 — a voice user must be able to say what they can see.
    renderOutline([unset('f1', 'Lead time')])
    expect(heading('factors').getAttribute('aria-label')).toContain('Factors')
  })

  it('singular for one element, because "1 elements" is its own small lie', () => {
    renderOutline([set('f1', 'Annual cost')])
    const name = heading('factors').getAttribute('aria-label') ?? ''
    expect(name).toContain('1 element')
    expect(name).not.toContain('1 elements')
  })

  it('⛔ says nothing about unset rows when there are none', () => {
    // A permanent "0 with no value yet" would be chrome that always renders and
    // states nothing — the rule `unsetSummary` already follows for the visible
    // span, applied to the name so the two cannot disagree.
    renderOutline([set('f1', 'Annual cost'), set('f2', 'Lead time')])
    const name = heading('factors').getAttribute('aria-label') ?? ''
    expect(name).toContain('2 elements')
    expect(name).not.toContain('no value yet')
    expect(screen.queryByTestId('model-group-v2-factors-unknown-summary')).toBeNull()
  })
})

describe('the name QUOTES the summary sentence rather than paraphrasing it', () => {
  it('⭐ the accessible name ends with exactly the rendered span text', () => {
    /**
     * ⚠ THE POINT OF THIS CASE. `unsetSummary`'s wording took four attempts to
     * make true — three earlier heads each characterised a heterogeneous
     * population with an adjective that was false for a class their corpus
     * excluded. A second phrasing composed here would be a fifth attempt,
     * unreviewed, and would drift from the span beside it. So the name must
     * carry the SPAN'S OWN STRING, and this asserts that rather than asserting
     * any particular words.
     */
    renderOutline([set('f1', 'Annual cost'), unset('f2', 'Lead time')])

    const rendered = screen.getByTestId('model-group-v2-factors-unknown-summary').textContent ?? ''
    expect(rendered.length).toBeGreaterThan(0)
    expect(heading('factors').getAttribute('aria-label')).toContain(rendered)
  })
})

describe('the two counts are visually distinguishable', () => {
  it('⭐ the unset summary carries the attention tone, the total does not', () => {
    /**
     * Measured on deployed `14276d5b`: both spans were `11px / 600 /
     * rgb(110,107,107)`, 8px apart. Identical treatment for two different
     * questions. `ModelStrip` renders this same count in `text-warning` on the
     * Reasoning tab — one fact, and now one treatment across both tabs.
     */
    renderOutline([set('f1', 'Annual cost'), unset('f2', 'Lead time')])

    const summary = screen.getByTestId('model-group-v2-factors-unknown-summary')
    expect(summary.className).toContain('text-warning')

    // The discriminating half: the TOTAL must NOT wear it, or the two are
    // identical again in the other direction.
    const total = [...heading('factors').querySelectorAll('span')].find(
      (el) => el !== summary && /^\d+$/.test((el.textContent ?? '').trim()),
    )
    expect(total).toBeTruthy()
    expect(total!.className).not.toContain('text-warning')
  })
})
