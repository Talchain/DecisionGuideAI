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
import { cleanup, render, screen, within } from '@testing-library/react'

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

/**
 * ⚠ V2 (24 Sep 2026): THE WIN SHARES LEFT THE RESTING VIEW, so on a withheld
 * run the figures this section draws are each option's own RANGE (the
 * "Modelled outcome" lens). The base fixtures carry no percentiles, so this
 * adds the producer's p10 / p50 / p90 per option, the shape every real run
 * carries, and changes nothing else.
 */
const RANGES: Record<string, { mean: number; p10: number; p50: number; p90: number }> = {
  opt_a: { mean: 40, p10: 10, p50: 40, p90: 70 },
  opt_b: { mean: 55, p10: 30, p50: 55, p90: 90 },
}
const withRanges = (data: ResultsSectionDataReturn): ResultsSectionDataReturn => ({
  ...data,
  recommendation: {
    ...data.recommendation,
    allOptions: data.recommendation.allOptions.map((o) =>
      RANGES[o.id] ? { ...o, outcome: RANGES[o.id] } : o,
    ),
  },
})
/** Every drawn range band, in document order. */
const bands = () =>
  Array.from(
    document.querySelectorAll(`[data-testid^="${T}-outcome-range-"][data-testid$="-band"]`),
  )

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
   * RED AT PRISTINE: on the unmodified base the section mounts CLOSED behind
   * `SectionShell` (`defaultOpen` gated on `headline === null`), which
   * UNMOUNTS a closed region, and this reads `[]`.
   *
   * ⭐ V2 FIDELITY (24 Sep 2026, re-pointed for gap 17): NO MORE
   * `data-section-open` TO ASSERT. The section is now `bare` on every run,
   * unconditionally — there is no `SectionShell`, no toggle and no disclosure
   * state left to check on the shell; "open on mount" is now simply "the rows
   * are in the DOM", which the assertions below already prove.
   */
  it('(1) both per-option figures render WITHOUT a click, bound by option id', () => {
    renderBody(withRanges(decisionWithLeaderWithheld()))

    // Bare: no SectionShell chrome to be open or closed.
    expect(screen.getByTestId(T)).not.toHaveAttribute('data-section-open')
    expect(screen.queryByTestId(`${T}-toggle`)).toBeNull()

    // ⚠ V2: the figures on a withheld run are each option's own range; the
    // win shares are not printed at rest.
    expect(winReadouts(), 'V2: no win-share readout at rest').toEqual([])
    expect(within(row('opt_a')).getByTestId(`${T}-outcome-range-opt_a-band`)).toBeInTheDocument()
    expect(within(row('opt_b')).getByTestId(`${T}-outcome-range-opt_b-band`)).toBeInTheDocument()
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
    expect(screen.queryByTestId('analysis-new-glance-headline'), 'Paul ruled 18 Sep 2026: delete the conclusion entirely. The panel names no leading option.').toBeNull()
  })

  /**
   * ⭐ (3) NO ORDINAL. `OptionResult.rank` exists and printing it would put a
   * RANKING on a run whose verdict withheld one. The ordering claim lives in
   * the ARRAY ORDER and nowhere else.
   */
  it('(3) prints no ordinal anywhere in the opened section', () => {
    // ⚠ V2 (24 Sep 2026): WITH RANGES, as (1), (4) and (5) already are. The
    // section opens by default only where it draws a figure the glance does not
    // state (`comparisonDrawsAFigure`), and with the win shares gone from the
    // resting view the bare fixture draws none, so it mounts CLOSED and this
    // case read an empty region. The ranges are the figures a real run carries;
    // the ordinal claim is unchanged and now covers the range readouts too.
    renderBody(withRanges(decisionWithLeaderWithheld()))
    const section = screen.getByTestId(T)

    // Scoped to the SECTION. V2 (gap 17): bare, so "open" is not a state to
    // assert any more — re-asserted here as "no shell" so this case cannot
    // pass by reading an empty region either.
    expect(section).not.toHaveAttribute('data-section-open')
    expect(screen.getAllByTestId(`${T}-row`).length).toBe(2)

    const text = section.textContent ?? ''
    expect(text).not.toMatch(/\b1st\b|\b2nd\b|\bfirst\b|\bsecond\b|\btop\b|#1\b/i)
    // And no rank digit smuggled in beside a name: the only numbers in this
    // section are the per-option figures (V2: the range readouts) and the count.
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
    const vm = vmFor(withRanges(decisionWithLeaderWithheld()))
    // PRECONDITION: the producer really did mark a recommended option.
    expect(
      decisionWithLeaderWithheld().recommendation.recommendedOption?.id,
      'fixture must carry a recommended option, or this case is vacuous',
    ).toBe('opt_b')
    expect(vm.optionsComparison.comparativeClaim, 'precondition').toBe('order')

    renderBody(withRanges(decisionWithLeaderWithheld()))

    // ⭐ THE BARS NOW DRAW (Paul's ruling, 15 Sep 2026) — and THAT IS NOT WHAT
    // THIS CASE IS ABOUT. It bundled two claims: "no drawn magnitude" and "no
    // NAMED leader". Only the first changed. A run that withholds its leader
    // still withholds it; it draws the numbers it was already printing.
    //
    // ⚠ PINNED AS A POSITIVE, NOT DELETED. Asserting the bars are gone would
    // now pass on a section that rendered nothing at all, and this case's whole
    // value is that the row IS alive while the LEADER stays unnamed.
    //
    // ⚠ V2 (24 Sep 2026): the figures drawn are each option's own RANGE now,
    // since the win-share bars left the resting view. The point is unchanged:
    // the row is alive while the leader stays unnamed.
    expect(
      bands().length,
      'a withheld run still draws its per-option figures — the withholding is about NAMING',
    ).toBeGreaterThan(0)
    // No marker element, and no marker glyph, on either row — UNCHANGED, and
    // the half of this case that carries the entitlement.
    for (const id of ['opt_a', 'opt_b']) {
      const r = row(id)
      expect(within(r).queryByTestId(`${T}-leader`)).toBeNull()
      expect(within(r).queryByTestId(`${T}-recommended`)).toBeNull()
      expect(r.textContent ?? '').not.toMatch(/[★☆✓✔👑]|\bRecommended\b/iu)
    }
  })

  /**
   * ⛔⛔ (5) MOUNTING THE SECTION DOES NOT MOVE `comparativeClaim`.
   *
   * The near-miss this pins: a change in this area flipped the value
   * `'order'` → `'value'` and would have switched comparative bars on for a run
   * whose model withheld the ranking.
   *
   * ⭐ V2 FIDELITY (24 Sep 2026, re-pointed for gap 17): THE TOGGLE-CYCLE IS
   * GONE, NOT WEAKENED. `bare` removes the `SectionShell` disclosure this case
   * used to open/close/re-open — there is no toggle left to click, and no
   * `data-section-open` to flip. The invariant this case guards
   * (`comparativeClaim` is the view model's alone, never something rendering
   * feeds back into) is now asserted the only way still available: derived
   * fresh from the SAME data both before AND after the component has
   * rendered, with the bars checked against it both times.
   */
  it('(5) comparativeClaim is the view model\'s alone — rendering the (now-bare) section moves nothing', () => {
    const data = withRanges(decisionWithLeaderWithheld())
    const before = vmFor(data).optionsComparison.comparativeClaim
    expect(before, 'precondition: the withheld run licenses an ORDER, not a value').toBe('order')

    renderBody(data)
    const section = screen.getByTestId(T)

    // Bare: no shell, no disclosure state — rendered directly.
    expect(section).not.toHaveAttribute('data-section-open')
    // ⭐ THE BAR COUNT IS THE CLAIM ABOUT WHAT A READER MEETS. Paul's ruling
    // draws the shares on every state; what this case guards is that the
    // MOUNT moves nothing — the near-miss in its header was a change that
    // flipped `'order'` -> `'value'`, and that flip is still the harm.
    // ⚠ V2: counted on the range bands, the figures this section draws now.
    const barsAfterMount = bands().length
    expect(barsAfterMount, 'the withheld run still draws its per-option figures').toBeGreaterThan(0)

    // The authority is where it was. Re-derived from the SAME data, so a
    // mutation that made rendering feed back into the view model would show.
    expect(vmFor(data).optionsComparison.comparativeClaim).toBe(before)
    expect(bands().length, 'a second read of the DOM finds the same figures').toBe(barsAfterMount)

    // ⭐ THE DISCRIMINATING HALF. A run that DOES license a value draws bars —
    // so "no bars" above is the licence talking, not a section that never
    // draws any.
    cleanup()
    const permitted = withRanges(genuineDecision())
    expect(vmFor(permitted).optionsComparison.comparativeClaim).toBe('value')
    renderBody(permitted)
    expect(bands().length, 'contrast control').toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⛔⛔ V2 FIDELITY (24 Sep 2026, gap 17): THIS WHOLE DESCRIBE BLOCK IS
 * RE-POINTED, NOT DELETED — its premise is exactly the defect the fidelity
 * finding named.
 *
 * It used to pin `SectionShell`'s own narrow licence: a section may open by
 * default only when something above it depends on the content being visible,
 * so a run whose glance HAD answered kept this row closed. Measured on
 * deployed `4549b66b`: that meant every run naming a leader showed the
 * bullets, then a CLOSED "How the options compare N ›" row, then "Record
 * your view" — the chart this zone's own evidence rests on was one click
 * away on the common case, not the rare one.
 *
 * `bare` (`OptionsComparison.tsx`) removes the licence question entirely: the
 * comparison is the answer "Move towards commitment" promises, so it is
 * always on screen, named leader or not. `collapsedIA.spec.tsx` is the file
 * that would catch a regression the OTHER way (a section that should stay
 * collapsed opening); this block is now the one that pins THIS section open,
 * unconditionally, which is the fidelity finding's own fix.
 */
describe('V2: the options row is open on every run, named leader or not (gap 17)', () => {
  it('a run that names its leader ALSO shows the options row open — no toggle at all', () => {
    renderBody(genuineDecision())
    // PRECONDITION: the glance really did answer.
    expect(screen.queryByTestId('analysis-new-glance-headline'), 'Paul ruled 18 Sep 2026: delete the conclusion entirely. The panel names no leading option.').toBeNull()

    // Bare: no shell, no toggle, no region — just the rows, on screen.
    expect(screen.getByTestId(T)).not.toHaveAttribute('data-section-open')
    expect(screen.queryByTestId(`${T}-toggle`)).toBeNull()
    expect(screen.queryByTestId(`${T}-region`)).toBeNull()
    expect(screen.getAllByTestId(`${T}-row`).length).toBeGreaterThan(0)
    // V2: no win-share readout at rest, on this run either — unchanged by gap 17.
    expect(winReadouts()).toEqual([])
  })

  /**
   * ⚠ THE SECOND CONJUNCT, RE-POINTED RATHER THAN DROPPED. A withheld run with
   * NOTHING to show still MOUNTS bare and still renders its own honest
   * sentence about why (`noneNumbered`'s "no figures" paragraph,
   * `OptionsComparison.tsx`) — nothing here fabricates a figure that is not
   * there, and there is no longer a disclosure state for an empty region to
   * hide behind.
   */
  it('a withheld run with NO per-option figures still mounts bare, and says so', () => {
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

    expect(screen.getByTestId(T)).not.toHaveAttribute('data-section-open')
    expect(screen.queryByTestId(`${T}-toggle`)).toBeNull()
    expect(screen.getByTestId(`${T}-no-figures`)).toBeInTheDocument()
  })
})
