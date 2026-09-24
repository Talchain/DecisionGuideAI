/**
 * ⛔ AN OPTION ADDED AFTER THE RUN IS NOT "AN OPTION THE ANALYSIS RETURNED NOTHING FOR".
 *
 * The defect, adversarially verified at staging `25314672`: the user runs an
 * analysis over options A and B, then adds C and links it. The retained report
 * never saw C, `deriveNotAnalysedReason` classifies it `not_returned` (it HAS
 * values and an edge), and the Reasoning tab told the user — in the options row,
 * in the glance's excluded-list tooltip, and in the question its "What would
 * bring this in?" act sends — that *"The analysis returned no result for this
 * option"*. That asserts the run was ASKED about C. It was not.
 *
 * ⭐ THE CANVAS ALREADY REFUSES THE SENTENCE, AND THIS IS ITS RULE, NOT A NEW
 * ONE. `useOptionLeftOutOfRun.ts`: `if (reason === 'not_returned' &&
 * !resultsAreCurrent) return null` — "the one arm that blames the engine is
 * withheld unless we can vouch for the result". The currency authority is
 * `useAnalysisResultsAreCurrent`, which the Reasoning tab's hook already reads
 * (for Strengthen) and now threads to the builder as `analysisIdentityIsCurrent`.
 *
 * ⚠ WHAT IS WITHHELD IS THE SENTENCE AND THE ACT BUILT ON IT, NOT THE FACT. C is
 * still genuinely absent from the displayed result, so the "Not analysed" badge
 * stays: it names the state and claims nothing about why.
 *
 * ⚠ `no_interventions` IS NOT GATED — it reports the graph as it is now (nothing
 * set), needs no licence from the currency signal, and is the only arm carrying
 * an action. Its survival on a not-current run is the contrast control.
 *
 * ⭐ THE MUTANT PAIR: one fixture, twins differing ONLY in currency. The CURRENT
 * twin carries the sentence everywhere (positive control); the NOT-CURRENT twin
 * carries it nowhere. Deleting the gate REDs the second.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useCanvasStore } from '../../../../canvas/store'
import { NOT_ANALYSED_BADGE, notAnalysedReasonCopy } from '../../utils/notAnalysedCopy'
import { openAllSections } from './openNamedGroups'
import { genuineDecision, makeOption } from './analysisNewFixtures'
import type { NotAnalysedReason } from '../../utils/notAnalysedOptions'
import type { ComparisonOption } from '../analysisNewTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const ADDED = 'opt_c'
const ADDED_LABEL = 'License a vendor tool'
const ENGINE_BLAME = 'returned no result'

/** The run covered A and B; C sits beside them with the reason the derivation gives it. */
function runOverAAndBWithC(reason: NotAnalysedReason): ResultsSectionDataReturn {
  const base = genuineDecision()
  return {
    ...base,
    recommendation: {
      ...base.recommendation,
      allOptions: [
        ...(base.recommendation.allOptions ?? []),
        makeOption({ id: ADDED, label: ADDED_LABEL, notAnalysed: true, notAnalysedReason: reason }),
      ],
    },
  } as ResultsSectionDataReturn
}

const vmOf = (data: ResultsSectionDataReturn, analysisIdentityIsCurrent?: boolean) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    analysisIdentityIsCurrent,
  })

function addedRow(vm: ReturnType<typeof vmOf>): Extract<ComparisonOption, { kind: 'not_analysed' }> {
  const row = vm.optionsComparison.rows.find((r) => r.id === ADDED)
  expect(row, 'the added option has no row — every assertion below would be vacuous').toBeDefined()
  expect(row!.kind).toBe('not_analysed')
  return row as Extract<ComparisonOption, { kind: 'not_analysed' }>
}

function addedExcluded(vm: ReturnType<typeof vmOf>) {
  const scope = vm.atAGlance.comparisonScope
  expect(scope.kind, 'the glance must scope the share to A and B').toBe('partial')
  const entry = scope.kind === 'partial' ? scope.excluded.find((o) => o.id === ADDED) : undefined
  expect(entry, 'the added option is not in the excluded list').toBeDefined()
  return entry!
}

describe('the view model: the engine-blaming sentence needs a current result', () => {
  it('⭐ CURRENT: the row and the glance tooltip state the run’s own ground', () => {
    const vm = vmOf(runOverAAndBWithC('not_returned'), true)
    expect(addedRow(vm).reasonCopy).toBe(notAnalysedReasonCopy('not_returned'))
    expect(addedExcluded(vm).reasonCopy).toBe(notAnalysedReasonCopy('not_returned'))
  })

  it('⛔ NOT CURRENT: no reason is stated at either site; the row is still "not analysed"', () => {
    const vm = vmOf(runOverAAndBWithC('not_returned'), false)
    const row = addedRow(vm)
    expect(row.reasonCopy).toBeNull()
    expect(row.label).toBe(ADDED_LABEL)
    expect(addedExcluded(vm).reasonCopy).toBeNull()
  })

  it('⛔ ABSENT currency is not a licence: fail-closed, same as not current', () => {
    const vm = vmOf(runOverAAndBWithC('not_returned'))
    expect(addedRow(vm).reasonCopy).toBeNull()
    expect(addedExcluded(vm).reasonCopy).toBeNull()
  })

  it('⭐ CONTRAST: `no_interventions` describes the graph as it is and is never gated', () => {
    const vm = vmOf(runOverAAndBWithC('no_interventions'), false)
    expect(addedRow(vm).reasonCopy).toBe(notAnalysedReasonCopy('no_interventions'))
    expect(addedExcluded(vm).reasonCopy).toBe(notAnalysedReasonCopy('no_interventions'))
  })
})

/**
 * ⭐ THE DEPLOYED PATH: `AnalysisNewTabBody` → `useAnalysisNewViewModel` →
 * `useAnalysisResultsAreCurrent` → the store. Currency is set the way the
 * product sets it — a `fresh` verdict, then the dirty overlay an analytical
 * edit (adding C) raises — never handed to the builder directly.
 */
describe('mounted: the Reasoning tab after an option is added', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      importPendingServerRegistration: false,
    } as never)
  })

  function mountWithCurrency(current: boolean, onSendMessage = vi.fn()) {
    useCanvasStore.setState({
      analysisFreshness: { freshness: 'fresh' },
      // An analytical edit after the run — here, adding and linking C.
      analysisFreshnessDirty: !current,
      importPendingServerRegistration: false,
    } as never)
    const r = render(
      <AnalysisNewTabBody
        resultsSectionData={runOverAAndBWithC('not_returned')}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
        onSendMessage={onSendMessage}
      />,
    )
    openAllSections()
    return r
  }

  const optionsRow = () => {
    const row = screen
      .getAllByTestId('analysis-new-options-row')
      .find((el) => el.getAttribute('data-option-id') === ADDED)
    expect(row, 'the added option’s row is not on the opened tab').toBeDefined()
    return row!
  }
  const glanceEntry = () => {
    const li = screen
      .getAllByTestId('analysis-new-glance-excluded-option')
      .find((el) => el.getAttribute('data-option-id') === ADDED)
    expect(li, 'the glance does not list the added option').toBeDefined()
    return li!
  }
  const bringIn = () => screen.queryByTestId(`analysis-new-options-bring-in-${ADDED}`)

  it('⭐ CURRENT: the sentence is in the row and the tooltip, and the ask states the ground', () => {
    const send = vi.fn()
    mountWithCurrency(true, send)
    expect(within(optionsRow()).getByTestId('analysis-new-options-not-analysed-reason')).toHaveTextContent(
      notAnalysedReasonCopy('not_returned'),
    )
    expect(glanceEntry()).toHaveAttribute('title', notAnalysedReasonCopy('not_returned'))
    fireEvent.click(bringIn()!)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toContain(`The analysis returned no result for ${ADDED_LABEL}`)
  })

  it('⛔ NOT CURRENT: no "returned no result" in the row, the tooltip, the screen-reader text, or an ask', () => {
    const { container } = mountWithCurrency(false)
    // The state is still named: the badge survives at both sites.
    expect(within(optionsRow()).getByTestId('analysis-new-options-not-analysed-badge')).toHaveTextContent(
      NOT_ANALYSED_BADGE,
    )
    expect(glanceEntry()).toHaveTextContent(NOT_ANALYSED_BADGE)
    // The ground is not.
    expect(within(optionsRow()).queryByTestId('analysis-new-options-not-analysed-reason')).toBeNull()
    expect(glanceEntry()).not.toHaveAttribute('title')
    expect(bringIn(), 'the ask would send the false premise').toBeNull()
    expect(container.textContent ?? '').not.toContain(ENGINE_BLAME)
    const titled = Array.from(container.querySelectorAll('[title]')).map((el) => el.getAttribute('title') ?? '')
    expect(titled.filter((t) => t.includes(ENGINE_BLAME))).toEqual([])
  })
})
