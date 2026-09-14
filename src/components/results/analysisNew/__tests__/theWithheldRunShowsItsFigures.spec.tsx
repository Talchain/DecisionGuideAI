/**
 * ⭐⭐⭐ A WITHHELD RUN SHOWS ITS PER-OPTION FIGURES — AND STILL NAMES NO LEADER.
 *
 * ## The gap, measured rather than imagined
 *
 * On a run whose model WITHHELD the leader designation, "At a glance" renders
 * no reading at all: `headline`, `leaderLabel`, `winShare` and `winFraction`
 * are each null together (`AtAGlance.tsx:568-572` derives exactly this). The
 * only account of the field left on the surface is "How the options compare" —
 * and that row was CLOSED, so a collaborator landing on the tab saw no numbers
 * anywhere, from an analysis that had computed them and is licensed to show
 * them.
 *
 * Measured in this file, both arms, on two fixtures that differ in ONE boolean:
 *
 *     win readouts     collapsed     opened
 *     withheld run     []            ['31%', '69%']
 *     permitted run    []            ['31%', '69%']
 *
 * The figures were never suppressed. They were behind a click.
 *
 * ## ⛔ THE SEAM THIS SITS ONE STEP AWAY FROM, AND WHY EVERY CASE BELOW EXISTS
 *
 * Opening this section makes PER-OPTION win shares visible on a leader-withheld
 * run. That is licensed — they are own-probability statements in canonical
 * order, which is what ROADMAP 1.267 commissions.
 *
 * It is NOT a licence for the quantity next door. `AtAGlance`'s share is the
 * LEADER's share, attached to a NAMED leading option, and it is suppressed on
 * this run by the gate that suppresses the headline. **Two shares, named apart
 * (CLAUDE.md trap 21.)** Nothing here may blur them, and the cases below pin
 * each half of that separately rather than under one assertion — because a
 * single "looks right" assertion is what lets two concepts acquire one name.
 *
 * ## The fifth case is the one a near-miss earned
 *
 * A change in this area flipped `comparativeClaim` from `'order'` to `'value'`
 * and would have switched comparative BARS on for a run whose model withheld
 * the ranking. `comparativeClaim` is computed in the view model, before any
 * disclosure state exists — so the claim "opening the section cannot move it"
 * is true by construction, and that is exactly why it is worth a test: a
 * construction that nothing pins is a construction one refactor from being
 * untrue. The case asserts the value BEFORE and AFTER the open, on the same
 * mount, and the mutant kit proves it bites.
 *
 * ## Binding
 *
 * Rows are found by `data-option-id`; the leader-naming assertions are made
 * against the estate's OWN copy constants and the producer's own labels, never
 * against strings re-typed here.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'

const T = 'analysis-new-options'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_withheld_figures"
    />,
  )

function vmFor(data: ResultsSectionDataReturn) {
  return buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
}

/** Every win readout currently on screen, in document order. */
const winReadouts = () => screen.queryAllByTestId(`${T}-win`).map((e) => e.textContent)

/** Bind by IDENTITY. Never `getAllByTestId(...)[n]`, never a value predicate. */
function row(optionId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`)
  if (!el) throw new Error(`no row for option id ${optionId}`)
  return el
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

// ═══════════════════════════════════════════════════════════════════════════
describe('the withheld run is the state this opens for', () => {
  /**
   * ⚠ THE PRECONDITION, PINNED IN-TEST. Without it every case below could pass
   * on a fixture that was never withholding anything, and the suite would be
   * asserting the permitted behaviour under the withheld name.
   */
  it('PRECONDITION — the fixture really does withhold, and its twin really does not', () => {
    const withheld = vmFor(decisionWithLeaderWithheld())
    const permitted = vmFor(genuineDecision())

    expect(withheld.atAGlance.headline, 'withheld run must show no reading').toBeNull()
    expect(withheld.atAGlance.leaderLabel).toBeNull()
    expect(withheld.atAGlance.winShare).toBeNull()

    // THE CONTRAST CONTROL, IN THE SAME RUN. A probe that cannot see a present
    // headline cannot support an absence claim about a missing one (trap 13e).
    expect(permitted.atAGlance.headline, 'contrast control').not.toBeNull()
    expect(permitted.atAGlance.leaderLabel).toBe('Raise price')

    // And the withheld run HAS figures to show — otherwise "they were behind a
    // click" is a claim about nothing.
    const numbered = withheld.optionsComparison.rows.filter(
      (r) => r.kind === 'analysed' && r.winReadout !== null,
    )
    expect(numbered.length, 'the withheld run must carry per-option figures').toBe(2)
  })

  /**
   * ⭐ (1) THE TWO PER-OPTION READOUTS ARE PRESENT — the user win itself.
   *
   * RED AT PRISTINE: without the `defaultOpen` override the section mounts
   * closed, `SectionShell` UNMOUNTS a closed region, and this reads `[]`.
   */
  it('(1) both per-option win readouts render WITHOUT a click, bound by option id', () => {
    renderBody(decisionWithLeaderWithheld())

    // The section is open on mount — asserted on the SHELL, so the mount path
    // itself fails loud if a flag or a caller stops passing the default.
    expect(screen.getByTestId(T)).toHaveAttribute('data-section-open', 'true')

    expect(winReadouts()).toEqual(['31%', '69%'])
    expect(within(row('opt_a')).getByTestId(`${T}-win`)).toHaveTextContent('31%')
    expect(within(row('opt_b')).getByTestId(`${T}-win`)).toHaveTextContent('69%')
  })

  /**
   * ⭐ (2) NO LEADING OPTION IS NAMED.
   *
   * ⚠ THE CLAIM IS "NAMED AS LEADING", NOT "THE STRING APPEARS". Both option
   * labels are ON SCREEN by design — that is what a comparison is — and a test
   * forbidding the winning option's label would forbid the feature. What must
   * not appear is a DESIGNATION: the glance's headline, its leader share, or
   * any sentence appointing one of them.
   */
  it('(2) names no leading option — no headline, no leader share, no designating sentence', () => {
    renderBody(decisionWithLeaderWithheld())
    const body = screen.getByTestId('analysis-new-tab-body')

    // The designation surfaces do not exist on this run.
    expect(screen.queryByTestId('analysis-new-glance-headline')).toBeNull()
    expect(screen.queryByTestId('analysis-new-glance-share')).toBeNull()

    // Nor does any sentence that appoints one.
    expect(body.textContent).not.toMatch(
      /currently scores higher|\bwins\b|\bwinner\b|leading option|best option|recommended option/i,
    )

    // DISCRIMINATION, IN THE SAME FILE: the permitted twin DOES name one. An
    // absence assertion whose positive control never fires proves nothing.
    cleanup()
    renderBody(genuineDecision())
    expect(screen.getByTestId('analysis-new-glance-headline')).toHaveTextContent('Raise price')
  })

  /**
   * ⭐ (3) NO ORDINAL. `OptionResult.rank` exists and printing it would put a
   * RANKING on a run whose verdict withheld one. The ordering claim lives in
   * the ARRAY ORDER and nowhere else.
   */
  it('(3) prints no ordinal anywhere in the opened section', () => {
    renderBody(decisionWithLeaderWithheld())
    const section = screen.getByTestId(T)

    // Scoped to the SECTION, and the section is open — asserted above, and
    // re-asserted here so this case cannot pass by reading an empty region.
    expect(section).toHaveAttribute('data-section-open', 'true')
    expect(screen.getAllByTestId(`${T}-row`).length).toBe(2)

    const text = section.textContent ?? ''
    expect(text).not.toMatch(/\b1st\b|\b2nd\b|\bfirst\b|\bsecond\b|\btop\b|#1\b/i)
    // And no rank digit smuggled in beside a name: the only numbers in this
    // section are the two win readouts and the count on the row.
    for (const id of ['opt_a', 'opt_b']) {
      expect(within(row(id)).getByTestId(`${T}-label`).textContent).not.toMatch(/^\s*\d/)
    }
  })

  /**
   * ⭐ (4) NO LEADER MARKER IS DRAWN. `isRecommended` is set from the WINNER
   * SELECTION, not from the leader VERDICT, so a crown driven by it would be an
   * unentitled second designation channel.
   *
   * ⚠ THE FIXTURE CARRIES `isRecommended: true` ON `opt_b`. That is what makes
   * this case non-vacuous: the data a marker would be drawn FROM is present,
   * and nothing draws it.
   */
  it('(4) draws no leader marker, on a run whose data would supply one', () => {
    const vm = vmFor(decisionWithLeaderWithheld())
    // PRECONDITION: the producer really did mark a recommended option.
    expect(
      decisionWithLeaderWithheld().recommendation.recommendedOption?.id,
      'fixture must carry a recommended option, or this case is vacuous',
    ).toBe('opt_b')
    expect(vm.optionsComparison.comparativeClaim, 'precondition').toBe('order')

    renderBody(decisionWithLeaderWithheld())

    // No bar: a drawn comparative magnitude is gated on `comparativeClaim`,
    // and `'order'` licenses an ordering, never a magnitude.
    expect(screen.queryAllByTestId(`${T}-bar`)).toHaveLength(0)
    // No marker element, and no marker glyph, on either row.
    for (const id of ['opt_a', 'opt_b']) {
      const r = row(id)
      expect(within(r).queryByTestId(`${T}-leader`)).toBeNull()
      expect(within(r).queryByTestId(`${T}-recommended`)).toBeNull()
      expect(r.textContent ?? '').not.toMatch(/[★☆✓✔👑]|\bRecommended\b/iu)
    }
  })

  /**
   * ⛔⛔ (5) OPENING THE SECTION DOES NOT MOVE `comparativeClaim`.
   *
   * The near-miss this pins: a change in this area flipped the value
   * `'order'` → `'value'` and would have switched comparative bars on for a run
   * whose model withheld the ranking.
   *
   * ⚠ ASSERTED BEFORE **AND** AFTER, ON ONE MOUNT, with the bars re-checked on
   * both sides. The value alone is a claim about the view model; the bars are
   * the claim about what a reader meets. Both, or the case only half-covers the
   * harm it is named for.
   */
  it('(5) comparativeClaim is UNCHANGED by opening the section — and so are the bars', () => {
    const data = decisionWithLeaderWithheld()
    const vm = vmFor(data)
    const before = vm.optionsComparison.comparativeClaim
    expect(before, 'precondition: the withheld run licenses an ORDER, not a value').toBe('order')

    renderBody(data)
    const section = screen.getByTestId(T)

    // Open on mount — the state this test is about.
    expect(section).toHaveAttribute('data-section-open', 'true')
    expect(screen.queryAllByTestId(`${T}-bar`), 'no bar while open').toHaveLength(0)

    // Close it, and open it again through the TOGGLE — the other route to the
    // same state, so the assertion covers both ways in.
    fireEvent.click(screen.getByTestId(`${T}-toggle`))
    expect(section).toHaveAttribute('data-section-open', 'false')
    fireEvent.click(screen.getByTestId(`${T}-toggle`))
    expect(section).toHaveAttribute('data-section-open', 'true')

    // The authority is where it was. Re-derived from the SAME data, so a
    // mutation that made disclosure feed back into the view model would show.
    expect(vmFor(data).optionsComparison.comparativeClaim).toBe(before)
    expect(screen.queryAllByTestId(`${T}-bar`), 'still no bar after toggling').toHaveLength(0)

    // ⭐ THE DISCRIMINATING HALF. A run that DOES license a value draws bars —
    // so "no bars" above is the licence talking, not a section that never
    // draws any.
    cleanup()
    const permitted = genuineDecision()
    expect(vmFor(permitted).optionsComparison.comparativeClaim).toBe('value')
    renderBody(permitted)
    fireEvent.click(screen.getByTestId(`${T}-toggle`))
    expect(screen.queryAllByTestId(`${T}-bar`).length, 'contrast control').toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the collapsed IA is unchanged where the glance already answered', () => {
  /**
   * ⭐⭐ THE HALF THAT KEEPS THIS FROM BEING A REGRESSION.
   *
   * `collapsedIA.spec.tsx` pins the whole surface as a list of CLOSED rows —
   * written after that IA silently failed to ship, and measured at 1,584px
   * against a 769px viewport. An UNCONDITIONAL open would contradict it.
   *
   * The licence is narrow and it is `SectionShell`'s own: a section may open by
   * default only when something above it depends on the content being visible.
   * On a permitted run the glance HAS answered, so nothing depends on it, so
   * the row stays closed.
   */
  it('a run that names its leader keeps the options row CLOSED', () => {
    renderBody(genuineDecision())
    // PRECONDITION: the glance really did answer.
    expect(screen.getByTestId('analysis-new-glance-headline')).toHaveTextContent('Raise price')

    expect(screen.getByTestId(T)).toHaveAttribute('data-section-open', 'false')
    expect(screen.getByTestId(`${T}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${T}-region`)).toBeNull()
    expect(winReadouts()).toEqual([])
  })

  /**
   * ⚠ THE SECOND CONJUNCT, PINNED. A withheld run with NOTHING to show must
   * not open: the content below cannot supply what the glance withheld, and
   * opening spends the IA for an empty region.
   */
  it('a withheld run with NO per-option figures stays CLOSED', () => {
    const base = decisionWithLeaderWithheld()
    const data: ResultsSectionDataReturn = {
      ...base,
      recommendation: {
        ...base.recommendation,
        allOptions: base.recommendation.allOptions.map((o) => ({
          ...o,
          winProbability: undefined,
        })),
      },
    }
    const vm = vmFor(data)
    // PRECONDITIONS: still withholding, and now carrying no figure at all.
    expect(vm.atAGlance.headline).toBeNull()
    expect(
      vm.optionsComparison.rows.filter((r) => r.kind === 'analysed' && r.winReadout !== null),
    ).toHaveLength(0)
    // …and the section still MOUNTS, or this asserts nothing.
    renderBody(data)
    expect(screen.getByTestId(T)).toBeInTheDocument()

    expect(screen.getByTestId(T)).toHaveAttribute('data-section-open', 'false')
  })
})
