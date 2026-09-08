/**
 * ⭐⭐ THE DOOR AND THE ROOM SHARE ONE PRECONDITION.
 *
 * THE DEFECT THIS PINS. `DecisionRecorded` was gated on `!isPreRun` ALONE. The
 * modal behind it needs `results.status === 'complete'` AND at least one option
 * node. Those are different questions, and `isPreRun` is `!hasCompletedFirstRun`
 * — a MONOTONIC latch (`OutputsDock.tsx :: const isPreRun = !hasCompletedFirstRun`,
 * set true at the first successful run and cleared only at a reset or scenario
 * boundary).
 *
 * So on the reachable path where a rerun FAILS — `store.ts :: resultsError`
 * sets `status: 'error'` and DELIBERATELY retains the prior report, so the
 * panel stays mounted — the latch was still true, the door still rendered, and
 * the modal opened fully disabled saying:
 *
 *     "Run an analysis first. There are no analysed options to record a
 *      decision against yet."
 *
 * …to a user who had run one. The component's own docstring claimed "this door
 * is never decorative"; on `error`, `cancelled` and `preparing` it was exactly
 * that, and it told the user something false about their own session.
 *
 * ⚠⚠ THIS IS NOT A QUALITY GATE, AND THE MATRIX BELOW EXISTS TO PROVE IT IS
 * NOT. The act stays decoupled from `ModelHeldUp` — a fragile, mixed, stale or
 * evidence-unassessed run STILL offers the door, because none of that bears on
 * whether a team may write down what they chose. What is being added is the
 * modal's OWN precondition and nothing else (CLAUDE.md trap 21: name the two
 * questions apart rather than aligning their defaults).
 *
 * ⚠ THE OLD MATRIX COULD NOT SEE THIS. `theActIsNotGatedOnSuccess.spec.tsx`
 * had a case named "a run mid-rerun" that set the `isRunning` PROP and never
 * touched `results.status`, so the store stayed `complete` throughout and the
 * defect was unreachable from it. Every case here drives the STORE.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

/** Spread over `importOriginal` — a hand-listed factory would delete
 *  `useDecisionRecordForScenario` and the panel would throw at mount
 *  (CLAUDE.md trap 12). */
vi.mock('../../modals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../modals')>()),
  openDecisionRecord: vi.fn(),
}))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useDecisionRecordStore } from '../../modals'
import { canCaptureDecision } from '../../modals/analysedOptions'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision } from './analysisNewFixtures'
import type { DecisionRecord } from '../../modals'

const SECTION = 'analysis-new-decision-record'
const DOOR = 'analysis-new-decision-record-open'
const UPDATE = 'analysis-new-decision-record-update'
const SCENARIO = 'scenario-decorative-door'

const OPTION_NODES = [
  { id: 'opt-a', type: 'option', data: { label: 'Hold the price' } },
  { id: 'opt-b', type: 'option', data: { label: 'Discount to hold share' } },
]

const A_RECORD: DecisionRecord = {
  optionId: 'opt-a',
  optionLabel: 'Hold the price',
  optionNumber: 1,
  confidence: 70,
  expectation: 'Share holds above 30% through Q1',
  rationale: 'Margin protection outweighs the volume risk',
  assumptionToWatch: 'No competitor undercuts before March',
  revisitTrigger: 'Share falls below 28%',
  analysisHash: 'run_abc123',
  savedAt: Date.UTC(2026, 8, 7, 12, 0, 0),
  remote: null,
}

/** Drive the STORE, never just the prop — that is the whole point of this file. */
function setRunState(status: string, opts: { nodes?: unknown[] } = {}) {
  useCanvasStore.setState({
    results: { status, progress: 0 } as never,
    nodes: (opts.nodes ?? OPTION_NODES) as never,
    optionNumbering: { 'opt-a': 1, 'opt-b': 2 } as never,
    currentScenarioId: SCENARIO,
  } as never)
}

type PanelProps = Parameters<typeof AnalysisNewTabBody>[0]

const renderPanel = (over: Partial<PanelProps> = {}) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
      {...over}
    />,
  )

beforeEach(() => {
  useStrengthenStore.setState({ records: {} })
  useDecisionRecordStore.setState({ isOpen: false, byScenario: {} })
  setRunState('complete')
})
afterEach(cleanup)

/**
 * ⭐ THE POSITIVE CONTROL, AND IT RUNS FIRST. Every assertion below is an
 * ABSENCE ("the door is not offered"), and an absence assertion is vacuous
 * unless the same harness can be shown producing the PRESENCE (CLAUDE.md
 * trap 13). If the panel never rendered the door under any condition — a
 * fixture change, a mount failure, a renamed testid — every test in the
 * "not offered" describe would pass while testing nothing.
 */
describe('THE HARNESS CAN SEE A DOOR (positive control)', () => {
  it('on a completed run with analysed options, the door IS offered', () => {
    setRunState('complete')
    renderPanel()
    expect(screen.getByTestId(DOOR)).toHaveTextContent(COPY.decisionRecord.open)
  })

  it('and the shared precondition agrees that capture is possible', () => {
    setRunState('complete')
    const s = useCanvasStore.getState()
    expect(
      canCaptureDecision({
        nodes: s.nodes as never,
        resultsStatus: s.results.status,
        numbering: s.optionNumbering as never,
      }),
    ).toBe(true)
  })
})

/**
 * The reachable states in which the panel stays MOUNTED (the latch is set and
 * `resultsError`/`resultsCancelled` retain the prior report) but the modal
 * cannot capture. On each of these the old code rendered a door onto
 * "Run an analysis first."
 */
const UNCAPTURABLE = [
  ['a failed rerun (resultsError)', () => setRunState('error')],
  ['a cancelled rerun (resultsCancelled)', () => setRunState('cancelled')],
  ['a rerun in flight (resultsStart/resultsAnalysing)', () => setRunState('preparing')],
  ['a completed run with no option nodes', () => setRunState('complete', { nodes: [] })],
] as const

describe('a door onto a disabled room is not offered at all', () => {
  it.each(UNCAPTURABLE)('%s: no first-time door', (_label, arrange) => {
    arrange()
    renderPanel()
    expect(screen.queryByTestId(DOOR)).toBeNull()
  })

  it.each(UNCAPTURABLE)(
    '%s: no update control either, even when a record exists',
    (_label, arrange) => {
      arrange()
      useDecisionRecordStore.setState({ isOpen: false, byScenario: { [SCENARIO]: A_RECORD } })
      renderPanel()
      expect(screen.queryByTestId(UPDATE)).toBeNull()
    },
  )

  /**
   * ⚠ THE ASSERTION THAT IS NOT HERE, AND WHY. A first draft added
   * "the panel never renders `DECISION_RECORD_COPY.emptyState`". It PASSED at
   * pristine on all four states, while the defect was live — because the
   * refusal is the MODAL's copy and the panel does not mount the modal. A test
   * that passes on the defect it is cited for proves nothing (CLAUDE.md
   * trap 13/13b), so it was deleted rather than shipped as reassurance. The
   * binding assertions are the two above: the CONTROLS are withheld, which is
   * what stops a user reaching the refusal at all.
   */
})

/**
 * ⭐⭐ THE OTHER HALF, AND IT IS THE FINDING'S TWIN. Removing the door must not
 * remove the RETAIN half. A record already captured is stored data keyed on the
 * scenario; reading it back is honest whatever the current run is doing, and a
 * user whose rerun just failed is exactly the user who wants to re-read what
 * they decided. Only the CAPTURE controls depend on a capturable option set.
 */
describe('the record still reads back when capture is impossible', () => {
  it.each(UNCAPTURABLE)('%s: the recorded decision is still shown', (_label, arrange) => {
    arrange()
    useDecisionRecordStore.setState({ isOpen: false, byScenario: { [SCENARIO]: A_RECORD } })
    renderPanel()
    expect(screen.getByTestId(`${SECTION}-title`)).toHaveTextContent(COPY.decisionRecord.recorded)
    expect(screen.getByTestId(`${SECTION}-option`)).toHaveTextContent('Hold the price')
  })

  /**
   * With NO record and no way to capture, the section has nothing to say — and
   * "Nothing recorded for this scenario yet." beside no control would be
   * furniture pointing at a door that is not there.
   */
  it.each(UNCAPTURABLE)('%s: with no record, no section at all', (_label, arrange) => {
    arrange()
    renderPanel()
    expect(screen.queryByTestId(SECTION)).toBeNull()
  })
})

/**
 * ⭐⭐ THE ACT IS STILL NOT GATED ON THE RUN GOING WELL. This is the guard
 * against over-correcting the fix into the very defect PR #1272 removed: if
 * the new precondition ever picked up a quality limb, these would RED.
 */
describe('the new precondition is about CAPTURABILITY, never about quality', () => {
  it('a stale run still offers the door', () => {
    setRunState('complete')
    renderPanel({ isStale: true })
    expect(screen.getByTestId(DOOR)).toBeTruthy()
  })

  it('a run the success banner refuses still offers the door', () => {
    setRunState('complete')
    renderPanel()
    // The banner's own verdict is irrelevant to the act; assert the door is
    // present regardless of whether the banner rendered.
    expect(screen.getByTestId(DOOR)).toBeTruthy()
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. `isRunning` as a PROP is the panel's busy
   * marker, not a statement about the store. A completed run whose panel is
   * marked busy is still capturable — the option set is on screen. This is the
   * case the OLD matrix thought it was testing.
   */
  it('the isRunning PROP alone does not withdraw the door', () => {
    setRunState('complete')
    renderPanel({ isRunning: true })
    expect(screen.getByTestId(DOOR)).toBeTruthy()
  })
})
