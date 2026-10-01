/**
 * ⭐ A FACTOR THE ENGINE SET ASIDE NEVER TAKES THE REASONING TAB DOWN (Paul's manual test, 1 Oct 2026).
 *
 * Paul's Reasoning tab showed "This section couldn't load … Cannot read properties of undefined (reading 'charAt')"
 * (PTL #85 5929011714: repeated in `noneRanked`, scenario 96c6f5f4). PLoT stamps two graph-path codes the UI had no
 * words for (`plot-lite-service` `src/lib/factor-influence.ts`: `no_path_to_goal`, `zero_net_influence`, "open
 * vocabulary"). `useResultsSectionData` CASTS the wire string to `ZeroReasonCode`, so the lookup into
 * `ZERO_REASON_BADGE_LABELS` gave `undefined` and `clauseCase(undefined)` threw inside the tab body.
 *
 * Rows below are the SERVED read of scenario 5cb272bd (R3 30 Sep, `output/r3-successor-996ec64d/cand2-2cd7823-1057Z/
 * ccalt/r0/10-cold-read.json`, `analysis_result.enrichment.factor_sensitivity`), which crashed the served UI 4a48dab4
 * in a 0-LLM replay. The third block pins the class: a code no consumer knows yet is not named, and never crashes.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildReasoningSignals } from '../reasoningSignals'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { makeData, makeDriver } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { DriverItem } from '../../types'

vi.mock('../../../../lib/flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
}))

/** The wire hands the UI whatever string the producer stamped; the cast is what this spec stops trusting. */
const wireCode = (code: string) => code as DriverItem['zeroReason']

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isBusy={false} isStale={false}
      onFocusNode={() => {}} onReanalyse={() => {}} onSendMessage={() => {}} />,
  )

const openDrivers = () => {
  const door = screen.getByTestId('analysis-new-signals-disclose')
  if (door.getAttribute('aria-expanded') !== 'true') fireEvent.click(door)
  for (const id of ['analysis-new-what-moves-the-outcome', 'analysis-new-drivers']) {
    const toggle = screen.getByTestId(`${id}-toggle`)
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    expect(screen.getByTestId(`${id}-toggle`)).toHaveAttribute('aria-expanded', 'true')
  }
}
const driversText = () => (screen.getByTestId('analysis-new-drivers').textContent ?? '').toLowerCase()

/** Served 5cb272bd: every row set aside, so the "no factor is ranked" sentence is built — the served crash. */
const served5cb272bd = () => makeData({
  drivers: {
    driversStatus: 'computed',
    drivers: [
      makeDriver({ factorKey: 'migration_preparedness', factorLabel: 'Migration preparedness', rank: 1, displayInfluence: 0, zeroReason: wireCode('no_path_to_goal') }),
      makeDriver({ factorKey: 'migration_downtime', factorLabel: 'Migration downtime', rank: 2, displayInfluence: 0, zeroReason: wireCode('no_path_to_goal') }),
      makeDriver({ factorKey: 'gcp_workload_share', factorLabel: 'GCP workload share', rank: 3, displayInfluence: 1, zeroReason: wireCode('intervention_override') }),
    ],
  },
})

/** A ranked survivor beside a connected factor whose paths net to zero: the "N factors are not ranked here" sentence. */
const survivorAndZeroNet = () => makeData({
  drivers: {
    driversStatus: 'computed',
    drivers: [
      makeDriver({ factorKey: 'f_live', factorLabel: 'Hours per week on angel outreach', rank: 1, displayInfluence: 0.8 }),
      makeDriver({ factorKey: 'f_net0', factorLabel: 'Fundraising distraction time', rank: 2, displayInfluence: 0, zeroReason: wireCode('zero_net_influence') }),
    ],
  },
})

/** A code no consumer has words for yet (the class, not the two instances). */
const futureCodeOnly = () => makeData({
  drivers: {
    driversStatus: 'computed',
    drivers: [makeDriver({ factorKey: 'f_new', factorLabel: 'New factor', rank: 1, displayInfluence: 0, zeroReason: wireCode('a_code_added_next_month') })],
  },
})

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })

beforeEach(() => { useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never) })
afterEach(() => cleanup())

describe('⭐ the engine\'s set-aside codes are named, and an unknown one never crashes the Reasoning tab', () => {
  it('PRECONDITION: the served rows rank nothing and set all three aside', () => {
    const vm = vmOf(served5cb272bd())
    expect(vm.drivers.findings).toHaveLength(0)
    expect(vm.drivers.suppressedZeroCount).toBe(3)
  })

  it('served 5cb272bd: the tab renders and names "no path to the goal" and "controlled by your options"', () => {
    renderBody(served5cb272bd())
    expect(screen.queryByText(/couldn.t load/i)).toBeNull()
    openDrivers()
    expect(driversText()).toContain('no path to the goal')
    expect(driversText()).toContain('controlled by your options')
    expect(driversText()).not.toContain('undefined')
  })

  it('a connected factor whose paths net to zero is named "doesn\'t change the outcome" beside a ranked one', () => {
    renderBody(survivorAndZeroNet())
    expect(screen.queryByText(/couldn.t load/i)).toBeNull()
    openDrivers()
    expect(driversText()).toContain("doesn't change the outcome")
    const signals = buildReasoningSignals(vmOf(survivorAndZeroNet()), null)
    expect(signals?.notRankedNote ?? '').toContain("doesn't change the outcome")
  })

  it('CLASS: a code with no words is left unnamed (count kept, no "undefined"), and the tab still renders', () => {
    const vm = vmOf(futureCodeOnly())
    expect(vm.drivers.suppressedZeroCount).toBe(1)
    expect(vm.drivers.suppressedZeroReasons).toEqual([])
    renderBody(futureCodeOnly())
    expect(screen.queryByText(/couldn.t load/i)).toBeNull()
    openDrivers()
    expect(driversText()).not.toContain('undefined')
    expect(driversText()).not.toContain('a_code_added_next_month')
  })
})
