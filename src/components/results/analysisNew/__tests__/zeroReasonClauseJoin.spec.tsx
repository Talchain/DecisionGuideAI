/**
 * ⭐⭐ A PRODUCER REASON IS A BADGE LABEL AND A MID-SENTENCE CLAUSE, AND THOSE
 * ARE TWO CASINGS OF ONE STRING.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `b93904c9`, 11 Sep 2026) ───────────
 * "Drivers and dynamics", under "What moves the outcome, and through what",
 * rendered:
 *
 *     Influence is relative to the other factors in this run, not a share of
 *     the outcome. 4 factors are not ranked here: Controlled by your options.
 *
 * `ZERO_REASON_BADGE_LABELS` is a map of BADGE labels, so every value opens
 * with a capital. Spliced after a colon by `coverage.notRanked` the capital
 * turns the clause into a sentence fragment, and the reader meets what looks
 * like a second, truncated sentence.
 *
 * ── THE SIBLING COMPOSER HAS THE SAME JOIN, FROM THE SAME MAP ──────────────
 * `empty.noneRanked` splices the same labels after the same colon:
 *
 *     No factor is ranked in this run. 1 factor was returned and set aside:
 *     Controlled by your options.
 *
 * Both are fed by `AnalysisNewTabBody`'s two `reasons.map((code) =>
 * ZERO_REASON_BADGE_LABELS[code])` calls. Fixing one and not the other is the
 * defect `goalAnchorCopy.ts:283-291` already records: "two call sites were
 * doing [the surgery] inline, and one of them did NOT, shipping 'Option A
 * Supported in 71% of simulated scenarios' with a capital mid-sentence."
 *
 * ── WHY THE CASING LIVES IN THE REGISTER ───────────────────────────────────
 * `goalAnchorCopy.ts:276` states the rule this file follows: "The register owns
 * casing; call sites never do it." So `clauseCase` sits beside `sentenceCase`
 * in `analysisNewCopy.ts` — its exact inverse — and both composers call it.
 * `ZERO_REASON_BADGE_LABELS` is NOT touched: the badge is correct as written
 * and `DriversSection.leverBadge.spec.tsx` pins it.
 *
 * ── WHY THE EXISTING SPECS COULD NOT SEE THIS ──────────────────────────────
 * Every assertion on these reasons compares rendered text against the SAME map
 * constant the code emits (`toContain(ZERO_REASON_BADGE_LABELS.x)`), so both
 * sides of the comparison move together and no casing is observed at all —
 * CLAUDE.md trap 13b, a guard agreeing with itself. `DriversSection.leverBadge`
 * asserts `/controlled by your options/i`, which is case-BLIND by construction.
 * So the assertions below are LITERAL rendered sentences, typed here, and the
 * badge case is asserted case-SENSITIVELY.
 *
 * ── THE DISCRIMINATING PAIR ────────────────────────────────────────────────
 * Two mutants, opposite directions, different assertions:
 *   · remove the badge's capital  → `the badge keeps its capital` REDs,
 *                                   the clause cases stay GREEN;
 *   · restore the clause's capital → the clause cases RED,
 *                                   `the badge keeps its capital` stays GREEN.
 * Neither mutant alone shows binding; the pair does.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { ZERO_REASON_BADGE_LABELS } from '../../influenceScaleCopy'
import { DriversSection } from '../../DriversSection'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { makeData, makeDriver } from './analysisNewFixtures'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { DriversSectionData, DriverItem } from '../../types'

vi.mock('../../../../lib/flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
}))

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
}))

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isBusy={false}
      isStale={false}
      onFocusNode={() => {}}
      onReanalyse={() => {}}
      onSendMessage={() => {}}
    />,
  )

const openAllSections = () => {
  for (const t of Array.from(document.querySelectorAll<HTMLElement>('[data-testid$="-toggle"]'))) {
    if (t.getAttribute('aria-expanded') !== 'true') fireEvent.click(t)
  }
}

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })

/** Survivors plus one suppressed row: the state that renders the CAVEAT. */
const oneSuppressedAmongSurvivors = () =>
  makeData({
    drivers: {
      driversStatus: 'computed',
      drivers: [
        makeDriver({ factorKey: 'f_live', factorLabel: 'Live driver', rank: 1, displayInfluence: 0.9 }),
        makeDriver({
          factorKey: 'f_zero', factorLabel: 'Pinned', rank: 2,
          displayInfluence: 0, zeroReason: 'intervention_override',
        }),
      ],
    },
  })

/** Every row suppressed: the state that renders the EMPTY message. */
const allSuppressed = () =>
  makeData({
    drivers: {
      driversStatus: 'computed',
      drivers: [
        makeDriver({
          factorKey: 'f_1', factorLabel: 'Pinned rank-1', rank: 1,
          displayInfluence: 1, zeroReason: 'intervention_override',
        }),
      ],
    },
  })

function makeBadgeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'f1',
    factorLabel: 'Marketing Spend',
    rawElasticity: 0.8,
    normalisedInfluence: 0.8,
    influenceScore: 0.8,
    displayInfluence: 0.8,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'n1',
    confidence: 0.6,
    ...overrides,
  }
}

const badgeData = (drivers: DriverItem[]): DriversSectionData => ({
  drivers,
  topDrivers: drivers.slice(0, 3),
  driversStatus: 'computed',
  totalCount: drivers.length,
  hasMagnitudeData: true,
})

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('a producer reason reads as a clause mid-sentence and as a badge on a row', () => {
  /**
   * ⚠ CONTROL FIRST. Every literal below would also pass against a composer
   * reduced to a constant, or against a map that had gone empty. This case
   * fails in both of those worlds, so the assertions after it are about the
   * composer rather than about nothing.
   */
  it('CONTROL: the map is non-empty and the composers still name the count and the reason', () => {
    const labels = Object.values(ZERO_REASON_BADGE_LABELS)
    expect(labels.length, 'the reason map must not be empty').toBeGreaterThan(0)
    for (const label of labels) {
      expect(label, 'every badge label opens with a capital, which is why the clause form exists')
        .toMatch(/^[A-Z]/)
    }
    const s = COPY.coverage.notRanked(4, ['controlled by your options'])
    expect(s, 'the count must still reach the sentence').toContain('4')
    expect(s, 'the reason must still reach the sentence').toContain('controlled by your options')
  })

  /**
   * ⭐ THE WITNESSED SENTENCE, TYPED OUT. Not `COPY.coverage.notRanked(...)`
   * compared against itself, and not `toContain(ZERO_REASON_BADGE_LABELS.x)`:
   * both of those follow the code wherever it goes. This is the string a
   * reader met on `b93904c9`, with the one character that was wrong.
   */
  it('notRanked: the clause after the colon is lower case', () => {
    expect(COPY.coverage.notRanked(4, [ZERO_REASON_BADGE_LABELS.intervention_override]))
      .toBe('4 factors are not ranked here: controlled by your options.')
  })

  it('notRanked: every reason in a multi-reason join is lower case, not just the first', () => {
    expect(
      COPY.coverage.notRanked(2, [
        ZERO_REASON_BADGE_LABELS.intervention_override,
        ZERO_REASON_BADGE_LABELS.disconnected,
      ]),
    ).toBe('2 factors are not ranked here: controlled by your options; no path to the goal.')
  })

  it('notRanked: the singular arity reads as English too', () => {
    expect(COPY.coverage.notRanked(1, [ZERO_REASON_BADGE_LABELS.zero_outcome_diff]))
      .toBe("1 factor is not ranked here: doesn't change the outcome.")
  })

  /**
   * ⭐ THE SIBLING. Same map, same colon, same defect — and the reason this fix
   * is not half a fix.
   */
  it('noneRanked: the clause after the colon is lower case', () => {
    expect(COPY.empty.noneRanked(1, [ZERO_REASON_BADGE_LABELS.intervention_override]))
      .toBe('No factor is ranked in this run. 1 factor was returned and set aside: controlled by your options.')
  })

  it('noneRanked: the plural arity lowercases every reason', () => {
    expect(
      COPY.empty.noneRanked(2, [
        ZERO_REASON_BADGE_LABELS.disconnected,
        ZERO_REASON_BADGE_LABELS.zero_outcome_diff,
      ]),
    ).toBe(
      "No factor is ranked in this run. 2 factors were returned and set aside: no path to the goal; doesn't change the outcome.",
    )
  })

  /**
   * ⚠ DERIVED HALF (CLAUDE.md trap 12d — ship both). The literals above are the
   * corpus and cannot see a FOURTH code added to `ZeroReasonCode`. This case
   * iterates the map, so a new code is policed without anyone remembering to
   * extend the literals. It asserts the PROPERTY (nothing capitalised is
   * spliced after the colon) rather than recomputing the expected string the
   * way the code does, so it is not the composer agreeing with itself.
   */
  it('DERIVED: no reason in the map reaches either sentence with a capital after the colon', () => {
    /* ⚠ THE PROPERTY IS "NO CAPITAL AFTER THE COLON", NOT "NOT THE BADGE
       STRING". An earlier form of this case asserted `not.toContain(\`: \${label}\`)`,
       which conflates two different worlds: the composer splicing the badge
       form (the defect) and the LABEL ITSELF having lost its capital (a
       different defect, in the other direction, which the badge case below
       owns). Measured — a mutant lowering the map's own capital RED-ed this
       case for the wrong reason. Asserting the character class is independent
       of how the label is cased, so each case now fails for its own defect. */
    for (const label of Object.values(ZERO_REASON_BADGE_LABELS)) {
      const caveat = COPY.coverage.notRanked(1, [label])
      const empty = COPY.empty.noneRanked(1, [label])
      expect(caveat, `notRanked put a capital after the colon: "${caveat}"`)
        .toMatch(/not ranked here: [^A-Z]/)
      expect(empty, `noneRanked put a capital after the colon: "${empty}"`)
        .toMatch(/set aside: [^A-Z]/)
      // …and the reason is still THERE, so this is a casing pin and not a
      // "the reason was dropped" pass.
      expect(caveat.toLowerCase()).toContain(label.toLowerCase())
      expect(empty.toLowerCase()).toContain(label.toLowerCase())
    }
  })

  /**
   * ⚠ BOUND BY TEST ID, NOT BY TEXT. Other sections on this tab render
   * sentences from the same COPY object; a bare `getByText` would let the
   * uncertainty section satisfy a drivers assertion (trap 19).
   */
  it('RENDERED: the drivers caveat carries the clause form on the deployed path', () => {
    const vm = vmOf(oneSuppressedAmongSurvivors())
    expect(vm.drivers.influenceRows.length, 'PRECONDITION: a ranking exists').toBeGreaterThan(0)
    expect(vm.drivers.suppressedZeroCount, 'PRECONDITION: a row was suppressed').toBe(1)

    renderBody(oneSuppressedAmongSurvivors())
    openAllSections()
    const caveat = screen.getByTestId('analysis-new-drivers-caveat').textContent ?? ''
    expect(caveat).toContain('1 factor is not ranked here: controlled by your options.')
    expect(caveat, 'the badge form must not reach a mid-sentence position')
      .not.toContain(': Controlled by your options')
  })

  it('RENDERED: the all-suppressed empty message carries the clause form too', () => {
    const vm = vmOf(allSuppressed())
    expect(vm.drivers.influenceRows, 'PRECONDITION: no ranking').toHaveLength(0)
    expect(vm.drivers.suppressedZeroCount, 'PRECONDITION: a row was suppressed').toBe(1)

    renderBody(allSuppressed())
    openAllSections()
    const empty = screen.getByTestId('analysis-new-drivers-empty').textContent ?? ''
    expect(empty).toContain('returned and set aside: controlled by your options.')
    expect(empty, 'the badge form must not reach a mid-sentence position')
      .not.toContain(': Controlled by your options')
  })

  /**
   * ⭐⭐ THE OPPOSITE-DIRECTION TWIN, and the half that stops this fix becoming
   * a lowercasing of the badge. The badge OPENS its own element, so its capital
   * is correct and must survive untouched. Asserted case-SENSITIVELY and by
   * exact equality: `DriversSection.leverBadge.spec.tsx` uses
   * `/controlled by your options/i`, which cannot see a casing change at all.
   */
  it('the badge keeps its capital, and this assertion can see the difference', () => {
    render(
      <DriversSection
        data={badgeData([makeBadgeDriver({ zeroReason: 'intervention_override' })])}
      />,
    )
    const badge = screen.getByTestId('driver-lever-badge-f1')
    expect(badge.textContent?.trim()).toBe('Controlled by your options')
  })
})
