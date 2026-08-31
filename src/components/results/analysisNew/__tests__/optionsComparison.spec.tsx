/**
 * "HOW THE OPTIONS COMPARE" — THE OTHER OPTIONS WERE A TOTAL LOSS.
 *
 * ## The defect, measured — not imagined
 *
 * On a real completed staging run the Analysis (New) tab rendered the leading
 * option and one win percentage and NOTHING AT ALL about the other options. The
 * run carried FOUR (Segment 89%, RudderStack 6%, Snowflake 5%, Status Quo <1%);
 * the surface showed Segment. The existing Analysis tab carried the full
 * comparison on the same run. For a decision tool that is the largest content
 * gap on the surface — a reader who cannot see the field cannot tell a runaway
 * leader from a coin flip.
 *
 * ## What this corpus establishes, and what it cannot (trap 22)
 *
 * The option records are typed as `OptionResult`, so their SHAPE is the
 * producer's, enforced by the compiler rather than by my memory of it. Every
 * sentence asserted below is produced by calling the estate's OWN sanctioned
 * function (`NOT_ANALYSED_BADGE`, `notAnalysedReasonCopy`,
 * `formatProbabilityWithResolution`) rather than by re-typing its output, so a
 * copy or format change in the owning module cannot leave this file green
 * against stale wording.
 *
 * It does NOT establish that the IA is right — that is what Paul's side-by-side
 * comparison answers — and it does not establish that the producer emits these
 * combinations. The latter is bounded by `useResultsSectionData.notAnalysed
 * .spec.ts`, which drives the real V2 mapper, and by the live captures under
 * `src/v5/__tests__/fixtures/` (`story_headlines` appears in 8 of them,
 * `win_probability` in 17; the contrast control `NO_SUCH_FIELD_CONTROL` in 0).
 *
 * ## Every assertion binds by IDENTITY
 *
 * Rows are found by `data-option-id`, never by a value predicate another option
 * could satisfy — the defect that let an entire extractor be deleted under
 * 23,832 green tests (trap 19). The fixtures deliberately give two options the
 * SAME win probability so that a value-predicate lookup could not disambiguate
 * them, and the four-option fixture reproduces the measured shape.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison } from '../sections/OptionsComparison'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import { NOT_ANALYSED_BADGE, notAnalysedReasonCopy } from '../../utils/notAnalysedCopy'
import { formatProbabilityWithResolution } from '../../../../utils/formatPercent'
import type { OptionResult } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeData, makeOption } from './analysisNewFixtures'

afterEach(() => cleanup())

const TESTID = 'analysis-new-options'

/**
 * THE MEASURED RUN. Four options, one clear leader, a long tail, and a
 * status-quo option below the simulation resolution — the exact shape the
 * surface lost. `nValidSamples` is 10,000 as measured on a live staging run,
 * which is what makes the tail render "<0.01%" rather than "0%".
 */
function fourOptionRun(overrides: Partial<OptionResult>[] = []): OptionResult[] {
  const base: OptionResult[] = [
    makeOption({ id: 'opt_segment', label: 'Segment', winProbability: 0.89, nValidSamples: 10000, isRecommended: true }),
    makeOption({ id: 'opt_rudderstack', label: 'RudderStack', winProbability: 0.06, nValidSamples: 10000 }),
    makeOption({ id: 'opt_snowflake', label: 'Snowflake', winProbability: 0.05, nValidSamples: 10000 }),
    makeOption({ id: 'opt_status_quo', label: 'Status Quo', winProbability: 0, nValidSamples: 10000 }),
  ]
  return base.map((o, i) => ({ ...o, ...(overrides[i] ?? {}) }))
}

function dataWith(
  allOptions: OptionResult[],
  extra: Partial<ResultsSectionDataReturn['recommendation']> = {},
): ResultsSectionDataReturn {
  return makeData({
    recommendation: {
      allOptions,
      recommendedOption: allOptions.find((o) => o.isRecommended) ?? null,
      ...extra,
    },
  })
}

/** Mount the section for a run. Sections open on click — that is the idiom. */
function renderSection(data: ResultsSectionDataReturn, { isPreRun = false } = {}) {
  const vm = buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun,
    isRunning: false,
    isStale: false,
  })
  const utils = render(<OptionsComparison options={vm.optionsComparison} />)
  return { vm, ...utils }
}

function open() {
  fireEvent.click(screen.getByTestId(`${TESTID}-toggle`))
}

/** Bind by IDENTITY. Never `getAllByTestId(...)[n]`, never a value predicate. */
function row(optionId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`)
  if (!el) throw new Error(`no row for option id ${optionId}`)
  return el
}

// ═══════════════════════════════════════════════════════════════════════════
describe('the measured gap: every option reaches the surface', () => {
  it('names ALL FOUR options — the defect showed one', () => {
    renderSection(dataWith(fourOptionRun()))
    open()

    // POSITIVE CONTROL FIRST: a section that rendered nothing would satisfy a
    // loop of `not.toBeNull()` checks vacuously.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(4)

    for (const [id, label] of [
      ['opt_segment', 'Segment'],
      ['opt_rudderstack', 'RudderStack'],
      ['opt_snowflake', 'Snowflake'],
      ['opt_status_quo', 'Status Quo'],
    ] as const) {
      expect(within(row(id)).getByTestId(`${TESTID}-label`)).toHaveTextContent(label)
    }
  })

  it('each option carries ITS OWN win readout, bound by id', () => {
    renderSection(dataWith(fourOptionRun()))
    open()

    // Asserted by CALLING the estate's formatter, never by re-typing "89%" —
    // a precision change in the owning module must RED this file, not pass it.
    for (const [id, p] of [
      ['opt_segment', 0.89],
      ['opt_rudderstack', 0.06],
      ['opt_snowflake', 0.05],
      ['opt_status_quo', 0],
    ] as const) {
      expect(within(row(id)).getByTestId(`${TESTID}-win`)).toHaveTextContent(
        formatProbabilityWithResolution(p, 10000),
      )
    }
  })

  it('the collapsed row promises the FULL count', () => {
    renderSection(dataWith(fourOptionRun()))
    expect(screen.getByTestId(`${TESTID}-count`)).toHaveTextContent('4')
  })

  /**
   * ⭐ THE DISCRIMINATING CASE. Two options with the SAME win probability: a
   * lookup that found a row by its value could match either, so this is the
   * case a value-predicate implementation cannot fake (trap 19).
   */
  it('two options sharing one win probability keep their own identities', () => {
    renderSection(
      dataWith([
        makeOption({ id: 'opt_a', label: 'Alpha', winProbability: 0.4, nValidSamples: 10000 }),
        makeOption({ id: 'opt_b', label: 'Bravo', winProbability: 0.4, nValidSamples: 10000 }),
      ]),
    )
    open()
    expect(within(row('opt_a')).getByTestId(`${TESTID}-label`)).toHaveTextContent('Alpha')
    expect(within(row('opt_b')).getByTestId(`${TESTID}-label`)).toHaveTextContent('Bravo')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ABSENCE IS NOT ZERO', () => {
  /**
   * ⭐⭐ THE LOAD-BEARING BEHAVIOUR OF THIS WHOLE CHANGE, AND THE ONE THE
   * MUTATION CHECK BREAKS. An option the run never analysed has no rank and no
   * probability. Rendering it at 0% — or with an empty bar, which reads as a
   * measured zero — states a result nobody measured.
   */
  it('an unanalysed option renders NO number and NO bar', () => {
    renderSection(
      dataWith([
        makeOption({ id: 'opt_segment', label: 'Segment', winProbability: 0.89, nValidSamples: 10000 }),
        makeOption({
          id: 'opt_hybrid',
          label: 'Hybrid: in-house core with 3PL overflow',
          notAnalysed: true,
          notAnalysedReason: 'no_interventions',
        }),
      ]),
    )
    open()

    const unanalysed = row('opt_hybrid')
    expect(unanalysed).toHaveAttribute('data-option-kind', 'not_analysed')
    expect(within(unanalysed).queryByTestId(`${TESTID}-win`)).toBeNull()
    expect(within(unanalysed).queryByTestId(`${TESTID}-bar`)).toBeNull()
    // And nothing anywhere in that row reads as a percentage.
    expect(unanalysed.textContent ?? '').not.toMatch(/\d\s*%/)

    // POSITIVE CONTROL: the analysed sibling in the SAME render DOES have both,
    // so this is a discrimination the section is making and not a blind pass.
    expect(within(row('opt_segment')).getByTestId(`${TESTID}-win`)).toBeInTheDocument()
    expect(within(row('opt_segment')).getByTestId(`${TESTID}-bar`)).toBeInTheDocument()
  })

  it('an unanalysed option carries the SANCTIONED badge and reason, verbatim', () => {
    renderSection(
      dataWith([
        makeOption({ id: 'opt_a', label: 'Alpha', winProbability: 0.6, nValidSamples: 10000 }),
        makeOption({ id: 'opt_x', label: 'Xray', notAnalysed: true, notAnalysedReason: 'no_interventions' }),
        makeOption({ id: 'opt_y', label: 'Yankee', notAnalysed: true, notAnalysedReason: 'not_returned' }),
      ]),
    )
    open()

    expect(within(row('opt_x')).getByTestId(`${TESTID}-not-analysed-badge`)).toHaveTextContent(
      NOT_ANALYSED_BADGE,
    )

    // ⭐ THE TWO REASONS ARE DIFFERENT SENTENCES AND MUST NOT COLLAPSE INTO ONE.
    // Asserted by calling the owner, so a reword there REDs here.
    expect(within(row('opt_x')).getByTestId(`${TESTID}-not-analysed-reason`)).toHaveTextContent(
      notAnalysedReasonCopy('no_interventions'),
    )
    expect(within(row('opt_y')).getByTestId(`${TESTID}-not-analysed-reason`)).toHaveTextContent(
      notAnalysedReasonCopy('not_returned'),
    )
    // The discrimination is real only if the two strings actually differ.
    expect(notAnalysedReasonCopy('no_interventions')).not.toEqual(
      notAnalysedReasonCopy('not_returned'),
    )
  })

  it('an ANALYSED option whose producer sent no win probability shows no number and no bar', () => {
    renderSection(
      dataWith([
        makeOption({ id: 'opt_a', label: 'Alpha', winProbability: 0.6, nValidSamples: 10000 }),
        // In the analysis, but the producer returned no comparative figure.
        makeOption({ id: 'opt_b', label: 'Bravo' }),
      ]),
    )
    open()

    expect(row('opt_b')).toHaveAttribute('data-option-kind', 'analysed')
    expect(within(row('opt_b')).queryByTestId(`${TESTID}-win`)).toBeNull()
    expect(within(row('opt_b')).queryByTestId(`${TESTID}-bar`)).toBeNull()
    // Contrast control in the same render.
    expect(within(row('opt_a')).getByTestId(`${TESTID}-win`)).toBeInTheDocument()
  })

  /**
   * A MEASURED near-zero is NOT an absence, and the two must not look alike.
   * `pctOrNull` would print this as "0%"; the display-honesty authority prints
   * "<0.01%". That difference only shows up on the long tail of a real run —
   * i.e. on exactly the options this section was built to surface.
   */
  it('a measured sub-resolution share renders the resolution floor, never 0%', () => {
    renderSection(
      dataWith([
        makeOption({ id: 'opt_lead', label: 'Lead', winProbability: 0.99, nValidSamples: 10000 }),
        makeOption({ id: 'opt_tail', label: 'Tail', winProbability: 0.00001, nValidSamples: 10000 }),
      ]),
    )
    open()

    const readout = within(row('opt_tail')).getByTestId(`${TESTID}-win`)
    expect(readout).toHaveTextContent(formatProbabilityWithResolution(0.00001, 10000))
    // The instrument would be vacuous if the formatter itself returned '0%'.
    expect(formatProbabilityWithResolution(0.00001, 10000)).toMatch(/^</)
    expect(readout.textContent).not.toBe('0%')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('nothing is authored by the UI', () => {
  /**
   * ⭐ THE PRODUCER'S OWN SENTENCE, PER OPTION — including for the options that
   * did NOT lead, which is the material the surface was missing entirely.
   */
  it("renders story_headlines VERBATIM, joined by option id", () => {
    const why = {
      opt_segment: 'Segment leads, with its impact tied to how strongly integration effort holds.',
      opt_status_quo: 'Status Quo could come out ahead if migration slips or retention drops.',
    }
    renderSection(dataWith(fourOptionRun(), { storyHeadlines: why }))
    open()

    expect(within(row('opt_segment')).getByTestId(`${TESTID}-why`)).toHaveTextContent(why.opt_segment)
    // The NON-leading option gets its own sentence — the point of the field.
    expect(within(row('opt_status_quo')).getByTestId(`${TESTID}-why`)).toHaveTextContent(
      why.opt_status_quo,
    )
    // An option the producer said nothing about gets NO sentence — not a
    // default, not a template, not the leader's sentence reused.
    expect(within(row('opt_rudderstack')).queryByTestId(`${TESTID}-why`)).toBeNull()
  })

  it('an empty producer string is absence, not an empty line', () => {
    // `useResultsSectionData` sanitises a non-string value to ''.
    renderSection(dataWith(fourOptionRun(), { storyHeadlines: { opt_segment: '   ' } }))
    open()
    expect(within(row('opt_segment')).queryByTestId(`${TESTID}-why`)).toBeNull()
  })

  /**
   * ⭐⭐ THE RETIRED QUANTITY STAYS RETIRED. "Behind by N percentage points" was
   * withdrawn 2026-08-10 — a difference of two Monte Carlo estimates carries
   * more uncertainty than either, and printed bare it reads as the most precise
   * number on the panel while being the least reliable. This section computes
   * no gap and must print none.
   */
  it('states no gap, delta or difference between options', () => {
    renderSection(dataWith(fourOptionRun()))
    open()
    const text = screen.getByTestId(TESTID).textContent ?? ''
    expect(text.toLowerCase()).not.toMatch(/behind by|percentage points?|points behind|gap of/)
  })

  /**
   * ⚠ NO ORDINAL. `OptionResult.rank` is NEVER SET by `useResultsSectionData`
   * (it has no producer on the results path at all), and an ordinal derived
   * here would be a SECOND designation channel — one that does not carry the
   * `designationsWithheld` gate `sortOptionsForDisplay` applies upstream.
   */
  it('prints no rank ordinal beside any option', () => {
    renderSection(dataWith(fourOptionRun()))
    open()
    for (const id of ['opt_segment', 'opt_rudderstack', 'opt_snowflake', 'opt_status_quo']) {
      expect(within(row(id)).getByTestId(`${TESTID}-label`).textContent ?? '').not.toMatch(
        /^\s*#?\d+[.)]/,
      )
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('order is inherited, never re-derived', () => {
  /**
   * ⭐⭐ THE ORDER IS A DESIGNATION (ROADMAP 1.267) AND IT IS AUTHORED ONCE,
   * UPSTREAM. `sortOptionsForDisplay` returns the caller's canonical order
   * untouched on a run whose verdict withholds the leader claim. This section
   * must render `allOptions` AS GIVEN — a local sort would re-impose the
   * designation past the gate that withheld it.
   *
   * The fixture is deliberately in a NON-probability-descending order, so an
   * implementation that sorted would produce a different sequence and RED.
   */
  it('renders allOptions in the order the hook produced, not by win probability', () => {
    renderSection(
      dataWith([
        makeOption({ id: 'opt_low', label: 'Low', winProbability: 0.1, nValidSamples: 10000 }),
        makeOption({ id: 'opt_high', label: 'High', winProbability: 0.7, nValidSamples: 10000 }),
        makeOption({ id: 'opt_mid', label: 'Mid', winProbability: 0.2, nValidSamples: 10000 }),
      ]),
    )
    open()
    const ids = screen
      .getAllByTestId(`${TESTID}-row`)
      .map((el) => el.getAttribute('data-option-id'))
    expect(ids).toEqual(['opt_low', 'opt_high', 'opt_mid'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the section adds up, and disappears when it has nothing', () => {
  it('an option with no usable name is COUNTED rather than invented or dropped', () => {
    // A label that is merely the node's own id is an id, not a name.
    renderSection(
      dataWith([
        makeOption({ id: 'opt_a', label: 'Alpha', winProbability: 0.6, nValidSamples: 10000 }),
        makeOption({ id: 'opt_bare', label: 'opt_bare', winProbability: 0.4, nValidSamples: 10000 }),
      ]),
    )
    // The promise counts BOTH.
    expect(screen.getByTestId(`${TESTID}-count`)).toHaveTextContent('2')
    open()
    // The body names one and discloses the other.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(1)
    expect(screen.getByTestId(`${TESTID}-unnamed`)).toHaveTextContent(
      ANALYSIS_NEW_COPY.disclosure.unnamedOptions(1),
    )
  })

  it('renders NOTHING at all pre-run — a heading is a claim there is something under it', () => {
    renderSection(dataWith(fourOptionRun()), { isPreRun: true })
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('renders NOTHING when the model has no options', () => {
    renderSection(dataWith([]))
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('opens closed, like every other section on this surface', () => {
    renderSection(dataWith(fourOptionRun()))
    expect(screen.getByTestId(TESTID)).toHaveAttribute('data-section-open', 'false')
    expect(screen.getByTestId(`${TESTID}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${TESTID}-region`)).toBeNull()
  })

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * ⭐⭐ THE BAR AND THE READOUT ARE ONE CLAIM (F1 — shipped, browser-witnessed)
   * ─────────────────────────────────────────────────────────────────────────
   *
   * `Math.round(winFraction * 100)` rendered a MEASURED share as a 0px fill.
   * On deployed `ce32426c`, guest, real 4-option run, the Status Quo row read
   * "< 1%" beside a 371px track whose fill measured 0px — the readout floored
   * by the display-honesty authority, the geometry not.
   *
   * ⚠ jsdom CANNOT SEE THIS. It computes no layout, so a width assertion here
   * proves only what the style says, never what a user sees. That is why these
   * tests assert the STYLE STRING — the thing the component controls — and the
   * live proof stays in the PR body where it belongs. Do not upgrade these into
   * a claim about pixels (trap 3).
   */
  describe('the bar cannot contradict the number beside it', () => {
    /** The style the component put on the fill, for a row bound by identity. */
    function fillStyle(optionId: string): CSSStyleDeclaration {
      const fill = row(optionId).querySelector<HTMLElement>('.bg-info')
      if (!fill) throw new Error(`no bar fill for ${optionId}`)
      return fill.style
    }

    it('gives a measured-but-tiny share a visible width, not a zero one', () => {
      // Below the 0.005 rounding cliff, and ABOVE zero: the exact class the
      // shipped code collapsed. The readout for this row is floored, so the
      // bar must be too.
      renderSection(
        dataWith(fourOptionRun([{}, {}, {}, { winProbability: 0.0004, nValidSamples: 10000 }])),
      )
      open()

      const style = fillStyle('opt_status_quo')
      expect(style.minWidth).toBe('2px')
      expect(style.width).not.toBe('0%')
      // And the readout it must agree with is itself non-zero.
      expect(row('opt_status_quo')).toHaveTextContent(
        formatProbabilityWithResolution(0.0004, 10000),
      )
    })

    /**
     * ⭐ THE OTHER DIRECTION, AND WITHOUT IT THE FIX IS A NEW FALSEHOOD.
     * A genuine measured zero MUST render an empty track: "came out ahead in
     * 0% of simulated scenarios" is TRUE, and the floor exists to stop a
     * NON-zero value reading as zero, never to stop zero reading as zero
     * (`formatPercent.ts:103-107`, in terms). A `minWidth` applied here would
     * draw a share that was measured not to exist.
     */
    it('leaves a genuine measured zero with no fill at all', () => {
      renderSection(
        dataWith(fourOptionRun([{}, {}, {}, { winProbability: 0, nValidSamples: 10000 }])),
      )
      open()

      const style = fillStyle('opt_status_quo')
      expect(style.width).toBe('0%')
      expect(style.minWidth).toBe('')
    })

    it('does not round a small share up to a neighbour\'s width', () => {
      renderSection(
        dataWith(fourOptionRun([{}, {}, {}, { winProbability: 0.004, nValidSamples: 10000 }])),
      )
      open()
      // 0.4%, not rounded to 0% and not inflated to 1%.
      expect(fillStyle('opt_status_quo').width).toBe('0.4%')
    })
  })

  /**
   * ⭐ A COMPARISON NEEDS SOMETHING TO COMPARE WITH (F3).
   * One option rendered "How the options compare … >99.99%" — a near-certainty
   * that is an artefact of having nothing to lose to. Two estate gates already
   * said this (`ResultsBody.tsx:522`, and this file's own leader headline at
   * `:968`) and neither was applied here.
   */
  describe('a single option is not a comparison', () => {
    it('renders nothing when the producer says the model has one option', () => {
      const one = [makeOption({ id: 'opt_only', label: 'Only', winProbability: 1, nValidSamples: 10000 })]
      renderSection(dataWith(one, { isSingleOption: true }))
      expect(screen.queryByTestId(TESTID)).toBeNull()
    })

    it('renders nothing on a one-option list even when the flag is absent', () => {
      const one = [makeOption({ id: 'opt_only', label: 'Only', winProbability: 1, nValidSamples: 10000 })]
      renderSection(dataWith(one))
      expect(screen.queryByTestId(TESTID)).toBeNull()
    })

    /**
     * ⭐ THE DISCRIMINATING CASE. Without it the gate could have suppressed the
     * section entirely and both tests above would still pass.
     */
    it('still renders the real multi-option run', () => {
      renderSection(dataWith(fourOptionRun()))
      expect(screen.getByTestId(TESTID)).toBeInTheDocument()
    })
  })
})
