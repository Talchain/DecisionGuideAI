/**
 * ⭐⭐ A RUN WHERE NOTHING SURVIVED TO BE RANKED, AND THE THREE THINGS THE PANEL
 * SAID ABOUT IT.
 *
 * `buildDrivers` partitions the producer's rows: `zeroReason != null` are
 * suppressed, `zeroReason == null` become `findings`. When EVERY row carries a
 * reason, `findings` is empty, `influenceRows` is empty — and
 * `AnalysisNewSection` renders its `emptyMessage` under a `caveat` that was
 * written for a ranking that exists.
 *
 * ⚠⚠ THE CLAIM THIS SPEC KILLS IS A FALSEHOOD ABOUT REAL PRODUCER DATA, NOT A
 * FIXTURE'S INVENTION. `conditional-winners-2026-08-17-probe-A.json`, a capture
 * already in this repo, carries at its top-level `factor_sensitivity`:
 *
 *   { influence_score: 1,      influence_rank: 1, sensitivity_score: 0, zero_reason: 'intervention_override' }
 *   { influence_score: 0.5555, influence_rank: 2, sensitivity_score: 0, zero_reason: 'intervention_override' }
 *
 * Two factors, ranks 1 and 2, influence 1.0 and 0.556 — and the panel told the
 * reader **"every factor came back at zero"**. They did not. They were set
 * aside because they are CONTROLLED BY THE USER'S OPTIONS, which is a different
 * fact, and the caveat one line above says so in the same breath — so the panel
 * contradicted itself on one screen.
 *
 * ⚠ THE THREE CODES DO NOT SHARE A MEANING, and `analysisNewCopy.ts` states the
 * rule at the very constant that broke it: "three reasons cannot share one
 * summary without one of them being described wrongly".
 *   `zero_outcome_diff`      "Doesn't change the outcome"   — genuinely zero
 *   `disconnected`           "No path to the goal"          — genuinely zero
 *   `intervention_override`  "Controlled by your options"   — NOT zero
 * `intervention_override` is the one described wrongly.
 *
 * Every case below has its opposite-direction twin: a run WITH survivors must
 * keep the basis sentence and the exclusion clause, both of which are true
 * there and are the disclosure #1228 was built to add.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { ZERO_REASON_BADGE_LABELS } from '../../influenceScaleCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { makeData, makeDriver } from './analysisNewFixtures'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

vi.mock('../../../../lib/flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
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

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })

const sectionText = () => screen.getByTestId('analysis-new-drivers').textContent ?? ''

/**
 * V2 RE-POINT (Reasoning V2, 24 Sep 2026). "What moves the outcome" moved from
 * the answer zone into the "Challenge the thinking" zone, post-run and closed as
 * before; "Drivers and dynamics" is still inside it. Both are opened here BY
 * TESTID, outer then inner, because `SectionShell` unmounts a closed region.
 * `openAllSections` cannot converge on the V2 tab: About's detail rows are a
 * one-at-a-time accordion, so opening every closed toggle re-closes a sibling.
 * ⚠ ASSERTED OPEN: most cases below assert a sentence is ABSENT, and an absence
 * read off an unmounted section would pass vacuously.
 */
const openDrivers = () => {
  const toggle = screen.getByTestId('analysis-new-what-moves-the-outcome-toggle')
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(toggle, 'analysis-new-what-moves-the-outcome must be open before it is read')
    .toHaveAttribute('aria-expanded', 'true')
  // TAIL-3 (design wave 2): "Drivers and dynamics" is now `bare` inside that
  // outer door — no second toggle to open, its rows are already on screen.
  expect(screen.queryByTestId('analysis-new-drivers-toggle')).toBeNull()
}

/** The capture above, reconstructed at the adapter's own input type. */
const pinnedFactorsOnly = () =>
  makeData({
    drivers: {
      driversStatus: 'computed',
      drivers: [
        makeDriver({ factorKey: 'f_1', factorLabel: 'Pinned rank-1', rank: 1,
                     displayInfluence: 1, zeroReason: 'intervention_override' }),
        makeDriver({ factorKey: 'f_2', factorLabel: 'Pinned rank-2', rank: 2,
                     displayInfluence: 0.5555555555555556, zeroReason: 'intervention_override' }),
      ],
    },
  })

/** The TWIN: survivors exist, so a ranking exists and every disclosure is true. */
const oneSuppressedAmongSurvivors = () =>
  makeData({
    drivers: {
      driversStatus: 'computed',
      drivers: [
        makeDriver({ factorKey: 'f_live', factorLabel: 'Live driver', rank: 1, displayInfluence: 0.9 }),
        makeDriver({ factorKey: 'f_zero', factorLabel: 'Zeroed', rank: 2,
                     displayInfluence: 0, zeroReason: 'zero_outcome_diff' }),
      ],
    },
  })

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('a run with nothing ranked says what happened, and claims no zero it did not measure', () => {
  /**
   * ⚠ PRECONDITION PINNED IN-TEST (trap 13b). Every assertion below is
   * worthless if the fixture stopped producing the state it names, and a
   * fixture that silently went partial would make the zero-ranked assertions
   * pass for the wrong reason.
   */
  it('PRECONDITION — nothing ranked, two suppressed, and BOTH carry a non-zero influence', () => {
    const vm = vmOf(pinnedFactorsOnly())
    expect(vm.drivers.findings).toHaveLength(0)
    expect(vm.drivers.influenceRows).toHaveLength(0)
    expect(vm.drivers.suppressedZeroCount).toBe(2)
    expect(vm.drivers.suppressedZeroReasons).toEqual(['intervention_override'])
    // The half that makes "came back at zero" a falsehood rather than a nuance.
    expect(pinnedFactorsOnly().drivers.drivers.every((d) => (d.displayInfluence ?? 0) > 0)).toBe(true)
  })

  it('PRECONDITION TWIN — the survivor fixture really does rank something', () => {
    const vm = vmOf(oneSuppressedAmongSurvivors())
    expect(vm.drivers.findings.length).toBeGreaterThan(0)
    expect(vm.drivers.influenceRows.length).toBeGreaterThan(0)
    expect(vm.drivers.suppressedZeroCount).toBe(1)
  })

  it('does NOT tell the reader that factors it ranked #1 and #2 came back at zero', () => {
    renderBody(pinnedFactorsOnly())
    openDrivers()
    expect(sectionText()).not.toContain('came back at zero')
  })

  it('names the producer\'s actual reason instead', () => {
    renderBody(pinnedFactorsOnly())
    openDrivers()
    /* ⚠ CASE-INSENSITIVE ON BOTH SIDES. The map holds BADGE labels, which open
       with a capital because a badge opens its own element. Spliced into a
       sentence by `empty.noneRanked` the first character is lowered
       (`clauseCase`), so a case-sensitive compare against the map constant
       asserts a casing the sentence deliberately does not use. Identity binding
       to the shared map is what this case is for and is unchanged; the casing
       is pinned with literals in `zeroReasonClauseJoin.spec.tsx`. */
    expect(sectionText().toLowerCase())
      .toContain(ZERO_REASON_BADGE_LABELS.intervention_override.toLowerCase())
  })

  it('says no basis sentence about a ranking that has no members', () => {
    renderBody(pinnedFactorsOnly())
    openDrivers()
    // Both arms of the basis branch are claims about ranked rows. There are none.
    expect(sectionText()).not.toContain(COPY.coverage.setRelativeInfluence)
    expect(sectionText()).not.toContain(COPY.coverage.structuralInfluence)
  })

  it('does not say factors are "not ranked here" when NOTHING is ranked', () => {
    renderBody(pinnedFactorsOnly())
    openDrivers()
    // "not ranked HERE" is defended in analysisNewCopy.ts as the narrow claim
    // that they are absent from a ranking. With no ranking it implies others
    // were ranked, and none were.
    expect(sectionText()).not.toContain('not ranked here')
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN, and the one that stops this fix becoming a
   * deletion. #1228 added the exclusion disclosure because a partial
   * suppression dropped rows silently — including, measured on staging
   * `acd3db4d`, the model's rank-1 factor. That disclosure is TRUE where a
   * ranking exists and must survive untouched.
   */
  it('TWIN — a run WITH survivors keeps both the basis sentence and the exclusion clause', () => {
    renderBody(oneSuppressedAmongSurvivors())
    openDrivers()
    const text = sectionText()
    expect(text).toContain(COPY.coverage.setRelativeInfluence)
    expect(text).toContain('not ranked here')
    /* Case-insensitive for the same reason as above: `coverage.notRanked`
       splices the badge label mid-sentence in clause case. */
    expect(text.toLowerCase()).toContain(ZERO_REASON_BADGE_LABELS.zero_outcome_diff.toLowerCase())
  })

  /**
   * ⚠ IDENTITY, NOT TEXT. Other sections render sentences from the same COPY
   * object; a bare `getByText` would let the uncertainty section satisfy a
   * drivers assertion.
   */
  it('binds to the DRIVERS section, not to whichever section carries the words', () => {
    renderBody(pinnedFactorsOnly())
    openDrivers()
    const drivers = screen.getByTestId('analysis-new-drivers')
    expect(within(drivers).getByTestId('analysis-new-drivers-empty')).toBeInTheDocument()
    expect(within(drivers).getByTestId('analysis-new-drivers-empty').textContent?.toLowerCase())
      .toContain(ZERO_REASON_BADGE_LABELS.intervention_override.toLowerCase())
  })
})
