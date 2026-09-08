/**
 * ⭐⭐ THE ACT IS OFFERED ON EVERY RUN, NOT ONLY THE ONES THAT WENT WELL.
 *
 * THE DEFECT THIS PINS. "Record what you decided" shipped as an optional
 * `onRecord` prop on `ModelHeldUp` — a component whose predicate is a five-limb
 * conjunction over robustness, evidence assessment, gap count, staleness and
 * completeness. So the ACT inherited the BANNER's answer: on a mixed,
 * sensitive, stale, provisional or evidence-unassessed run, `ModelHeldUp`
 * returns null and the only door to recording a decision went with it.
 *
 * That is backwards. A fragile result is when writing down your reasoning
 * matters MOST — it is the run whose assumptions you will want to re-read in
 * three months. Two different questions under one predicate (CLAUDE.md
 * trap 21): "did this model hold up?" and "may I write down what we chose?".
 *
 * ⚠⚠ THIS FILE BINDS AT `AnalysisNewTabBody`, NOT AT THE COMPONENT, AND THAT IS
 * THE POINT. A component-level suite proves `DecisionRecorded` renders when it
 * is handed `isPreRun: false`; it is structurally incapable of noticing that
 * the panel never mounts it, or mounts it inside the banner's branch. The
 * defect being fixed lives in the MOUNT, so the guard has to live there too
 * (CLAUDE.md trap 3b — a green suite is not evidence about a component the
 * surface does not render).
 *
 * ⚠ AND THE MATRIX ALONE WOULD BE VACUOUS. "The door renders in every post-run
 * state" is satisfied trivially if every state in the corpus is a state where
 * the banner ALSO renders. `THE CORPUS CAN SEE THE DEFECT` below is the
 * positive control that the corpus really does contain banner-refusing states,
 * and it fails loud if a fixture change ever makes them all succeed.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

/**
 * ⚠ SPREAD OVER `importOriginal`, NEVER A HAND-LISTED FACTORY. A bare
 * `vi.mock('../../modals', () => ({ openDecisionRecord: vi.fn() }))` REPLACES
 * the module, so `useDecisionRecordForScenario` — which this panel now calls on
 * every render — would vanish and the panel would throw at mount. That is
 * CLAUDE.md trap 12 in its most common form, and it has killed 51 tests in this
 * repo before.
 */
vi.mock('../../modals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../modals')>()),
  openDecisionRecord: vi.fn(),
}))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ModelHeldUp } from '../sections/ModelHeldUp'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { openDecisionRecord, useDecisionRecordStore } from '../../modals'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision, highUncertainty, openStrategicChallenge } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const DOOR = 'analysis-new-decision-record-open'
const SECTION = 'analysis-new-decision-record'
const BANNER = 'analysis-new-held-up'

const renderPanel = (
  data: ResultsSectionDataReturn,
  over: Partial<Parameters<typeof AnalysisNewTabBody>[0]> = {},
) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
      {...over}
    />,
  )

/**
 * Post-run states the panel can be in. Each is a state in which a team may
 * legitimately want to record what they decided — including, especially, the
 * ones the banner refuses.
 */
const POST_RUN_STATES = [
  { name: 'a clean current run', over: {} },
  { name: 'a stale run', over: { isStale: true } },
  { name: 'a run mid-rerun', over: { isRunning: true } },
] as const

const FIXTURES = [
  ['openStrategicChallenge', openStrategicChallenge],
  ['genuineDecision', genuineDecision],
  ['highUncertainty', highUncertainty],
] as const

/**
 * ⚠⚠ THE STORE IS PUT INTO A REAL POST-RUN STATE, AND IT WAS NOT BEFORE.
 *
 * This harness used to set only `currentScenarioId`, leaving `results.status`
 * at its initial `'idle'` and the canvas with no option nodes. Every case below
 * is named for a POST-RUN state, and none of them was one in the store — which
 * is why the case called "a run mid-rerun" could set the `isRunning` PROP and
 * never notice that the capture modal behind the door was, on a real rerun,
 * fully disabled. A fixture whose name and whose state disagree is the reason
 * the gate defect shipped past a green matrix (CLAUDE.md trap 16-inverse: a
 * fixture you wrote yourself is not evidence about the producer).
 *
 * The genuinely uncapturable states — `error`, `cancelled`, `preparing`, and a
 * completed run with no options — are driven in
 * `theDoorIsNeverDecorative.spec.tsx`, which exists because this file could not
 * see them.
 */
beforeEach(() => {
  useStrengthenStore.setState({ records: {} })
  useDecisionRecordStore.setState({ isOpen: false, byScenario: {} })
  useCanvasStore.setState({
    currentScenarioId: 'scenario-act-spec',
    results: { status: 'complete', progress: 1 },
    nodes: [
      { id: 'opt-a', type: 'option', data: { label: 'Phase the rollout' } },
      { id: 'opt-b', type: 'option', data: { label: 'Hold the price' } },
    ],
    optionNumbering: { 'opt-a': 1, 'opt-b': 2 },
  } as never)
  vi.mocked(openDecisionRecord).mockClear()
})
afterEach(cleanup)

describe('THE CORPUS CAN SEE THE DEFECT (positive control)', () => {
  /**
   * ⭐ THE LOAD-BEARING TEST IN THIS FILE. Without it, "the door renders in
   * every post-run state" could pass on a corpus where the banner renders in
   * every post-run state too — i.e. on a corpus in which the defect is
   * unreachable. This asserts the matrix below really does exercise at least
   * one state where the OLD door would have been absent.
   *
   * It fails loud if a fixture change ever makes every case a success case,
   * which is exactly when the matrix would quietly stop testing anything.
   */
  it('at least one matrix case is a run the success banner REFUSES', () => {
    const refusing: string[] = []
    for (const [fixtureName, fixture] of FIXTURES) {
      for (const state of POST_RUN_STATES) {
        renderPanel(fixture(), state.over)
        if (screen.queryByTestId(BANNER) === null) refusing.push(`${fixtureName} / ${state.name}`)
        cleanup()
      }
    }
    expect(
      refusing.length,
      'every case in the matrix is a success case — the matrix cannot see the defect it exists for',
    ).toBeGreaterThan(0)
  })
})

describe('the door is offered on every post-run state', () => {
  it.each(
    FIXTURES.flatMap(([fixtureName, fixture]) =>
      POST_RUN_STATES.map(
        (state) => [`${fixtureName} — ${state.name}`, fixture, state.over] as const,
      ),
    ),
  )('%s offers the door', (_label, fixture, over) => {
    renderPanel(fixture(), over)
    expect(screen.getByTestId(DOOR)).toHaveTextContent(COPY.decisionRecord.open)
  })
})

describe('the door and the success banner are decoupled', () => {
  /**
   * ⚠ THE PAIR IS THE CLAIM, AND THE HALVES FAIL ON DIFFERENT ASSERTIONS. The
   * first proves the door survives the banner's absence — the defect. The
   * second proves the fix did not simply INVERT the gate, which would be the
   * same bug pointing the other way: a door that appears only when the model
   * did NOT hold up would be just as wrong, and the matrix above cannot tell
   * the two apart on its own.
   */
  it('renders the door on a run where the banner refuses', () => {
    renderPanel(highUncertainty(), { isStale: true })
    expect(screen.queryByTestId(BANNER), 'fixture no longer refuses — pick another').toBeNull()
    expect(screen.getByTestId(DOOR)).toBeInTheDocument()
  })

  it('…and still renders it on a run where the banner is present — the twin', () => {
    const shown: boolean[] = []
    for (const [, fixture] of FIXTURES) {
      renderPanel(fixture())
      if (screen.queryByTestId(BANNER) !== null) shown.push(screen.queryByTestId(DOOR) !== null)
      cleanup()
    }
    expect(shown.length, 'no fixture renders the banner — the twin proves nothing').toBeGreaterThan(
      0,
    )
    expect(shown.every(Boolean)).toBe(true)
  })
})

describe('the banner no longer carries the act', () => {
  /**
   * ⚠ A GUARD AGAINST RE-MERGE, NOT A RESTATEMENT OF THE ABOVE. The two
   * questions can be pulled back under one predicate by a single well-meaning
   * prop, and nothing else in the suite would notice: the door would still
   * render from its own section, and this file's matrix would still be green.
   * What this pins is that the BANNER has no record affordance of its own.
   */
  /**
   * ⚠⚠ ASSERTED AT THE MOUNT, AND THE FIRST DRAFT OF THIS TEST WAS VACUOUS.
   * It rendered `<ModelHeldUp>` directly with no `onRecord` prop and asserted
   * no button — which PASSED AT PRISTINE, because the shipped defect was the
   * CALL SITE passing the prop, not the component defaulting to it. A guard
   * that cannot fail on the defect it is cited for proves nothing (CLAUDE.md
   * trap 13), so it now drives the panel and looks inside the banner the panel
   * actually renders. Measured: RED at pristine, GREEN after.
   */
  it('the banner the PANEL renders carries no control of its own', () => {
    const banners: HTMLElement[] = []
    for (const [, fixture] of FIXTURES) {
      renderPanel(fixture())
      const banner = screen.queryByTestId(BANNER)
      if (banner) {
        banners.push(banner)
        expect(banner.querySelector('button'), 'the banner is carrying the act again').toBeNull()
        expect(screen.queryByTestId(`${BANNER}-record`)).toBeNull()
      }
      cleanup()
    }
    expect(
      banners.length,
      'no fixture rendered the banner — this guard proves nothing',
    ).toBeGreaterThan(0)
  })

  /**
   * The type-level half: the prop is gone, so the call site cannot reinstate it
   * by accident. `@ts-expect-error` REDs the typecheck gate if `onRecord` is
   * ever added back to `ModelHeldUpProps` — a failure mode no render test sees.
   */
  it('the prop itself is gone from the component contract', () => {
    render(
      <ModelHeldUp
        verdictTone="stable"
        evidenceAssessed
        gapCount={0}
        isStale={false}
        isPreRun={false}
        isProvisional={false}
        // @ts-expect-error `onRecord` was removed with the act — see ModelHeldUpProps.
        onRecord={vi.fn()}
        testId="held-contract"
      />,
    )
    expect(screen.getByTestId('held-contract')).toBeInTheDocument()
  })
})

describe('pre-run there is nothing to record', () => {
  it('renders no section at all before a run', () => {
    renderPanel(genuineDecision(), { isPreRun: true })
    expect(screen.queryByTestId(SECTION)).toBeNull()
    expect(screen.queryByTestId(DOOR)).toBeNull()
  })
})

describe('the door does the thing', () => {
  it('opens the decision-record modal, once', async () => {
    renderPanel(genuineDecision())
    await userEvent.click(screen.getByTestId(DOOR))
    expect(openDecisionRecord).toHaveBeenCalledTimes(1)
  })
})

describe('the panel reads a saved record back', () => {
  /**
   * ⭐⭐ THE CAPABILITY, ASSERTED THROUGH THE MOUNT. `DecisionRecorded`'s own
   * suite drives the render from props; only this can prove the panel resolves
   * `currentScenarioId`, hands it to `useDecisionRecordForScenario`, and puts
   * the result on screen — which is the whole of "returning to this scenario
   * and reading it back".
   */
  it('shows the recorded decision for the CURRENT scenario', () => {
    useDecisionRecordStore.setState({
      byScenario: {
        'scenario-act-spec': {
          optionId: 'opt-a',
          optionLabel: 'Phase the rollout by segment',
          optionNumber: 2,
          confidence: 65,
          expectation: 'churn stays under 4% through Q1',
          rationale: 'It keeps the renewal cohort intact.',
          assumptionToWatch: 'Enterprise accounts accept usage pricing.',
          revisitTrigger: 'churn crosses 4%',
          analysisHash: 'run_abc123',
          savedAt: Date.UTC(2026, 8, 7, 9, 0, 0),
          remote: null,
        },
      },
    })
    renderPanel(genuineDecision())
    expect(screen.getByTestId(`${SECTION}-option`)).toHaveTextContent(
      'Option 2 — Phase the rollout by segment',
    )
    expect(screen.queryByTestId(DOOR), 'the door is replaced by the read-back').toBeNull()
  })

  /**
   * ⚠ THE DISCRIMINATION. Without this, the test above passes on a panel that
   * ignores the scenario key entirely and renders whatever single record the
   * store happens to hold — which is a read-back that lies by one scenario the
   * moment a user has two.
   */
  it('does NOT show a record belonging to a different scenario', () => {
    useDecisionRecordStore.setState({
      byScenario: {
        'some-other-scenario': {
          optionId: 'opt-z',
          optionLabel: 'Do nothing for now',
          optionNumber: null,
          confidence: 10,
          rationale: 'r',
          assumptionToWatch: 'a',
          revisitTrigger: 't',
          analysisHash: null,
          savedAt: Date.UTC(2026, 8, 7, 9, 0, 0),
          remote: null,
        },
      },
    })
    renderPanel(genuineDecision())
    expect(screen.queryByTestId(`${SECTION}-option`)).toBeNull()
    expect(screen.getByTestId(DOOR)).toBeInTheDocument()
  })
})
