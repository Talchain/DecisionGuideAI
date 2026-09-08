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
import { act, cleanup, render, screen } from '@testing-library/react'
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
 * ⭐ THE ANALYSED OPTION SET THE CAPTURE MODAL POPULATES FROM. Without this in
 * the store there is no option set on screen, and the modal fails closed —
 * so a spec that omitted it would be asserting the door renders in a state
 * where clicking it opens a disabled form.
 */
const OPTION_NODES = [
  { id: 'opt-a', type: 'option', data: { label: 'Phase the rollout by segment' } },
  { id: 'opt-b', type: 'option', data: { label: 'Hold and re-price' } },
]

/**
 * ⚠⚠ THE STORE IS SET, NOT JUST THE PROPS — AND THIS IS THE REPAIR. The first
 * version of this file drove "a run mid-rerun" by setting the `isRunning`
 * PROP and nothing else, while leaving `results.status` at its default. That
 * made the matrix structurally unable to see the defect it was written for:
 * the panel's gate and the modal's gate read DIFFERENT state, and only one of
 * them is a prop.
 */
function setCanvas(
  over: { status?: string; nodes?: unknown[]; scenarioId?: string | null } = {},
): void {
  const s = useCanvasStore.getState()
  useCanvasStore.setState({
    currentScenarioId: over.scenarioId === undefined ? 'scenario-act-spec' : over.scenarioId,
    nodes: (over.nodes ?? OPTION_NODES) as never,
    optionNumbering: {},
    results: { ...s.results, status: (over.status ?? 'complete') as never },
  } as never)
}

/**
 * Post-run states in which a capture is genuinely available. Each is a state in
 * which a team may legitimately want to record what they decided — including,
 * especially, the ones the success banner refuses.
 *
 * ⚠ "A RUN MID-RERUN" HAS MOVED OUT OF THIS LIST, DELIBERATELY. It sat here
 * asserting that the door renders — but a real mid-rerun sets
 * `results.status = 'preparing'`, on which the capture modal fails closed, so
 * the case was only passing because it never touched the store. It is now
 * exercised for real in "THE DOOR IS NOT OFFERED WHERE THE CAPTURE WOULD BE
 * REFUSED" below, with the opposite expectation, which is the honest one.
 */
const POST_RUN_STATES = [
  { name: 'a clean current run', over: {} },
  { name: 'a stale run', over: { isStale: true } },
] as const

const FIXTURES = [
  ['openStrategicChallenge', openStrategicChallenge],
  ['genuineDecision', genuineDecision],
  ['highUncertainty', highUncertainty],
] as const

beforeEach(() => {
  useStrengthenStore.setState({ records: {} })
  // This isolated panel does not mount AuthProvider. Establish its resolved
  // guest boundary through the real reset seam; do not bypass account checks.
  useDecisionRecordStore.getState()._reset()
  setCanvas()
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

/**
 * ⭐⭐⭐ THE DOOR IS NOT OFFERED WHERE THE CAPTURE WOULD BE REFUSED.
 *
 * The section's gate was `!isPreRun` alone. `isPreRun` is
 * `!hasCompletedFirstRun` — MONOTONIC, set once in `resultsComplete` and never
 * unset. The capture modal fails CLOSED on `results.status !== 'complete'`.
 * And `resultsStart` sets `status: 'preparing'` while DELIBERATELY preserving
 * the previous report so the panel does not flash empty.
 *
 * Those three facts compose into a reachable dead door: on every rerun, error
 * and cancellation after the first successful run, the panel stayed mounted
 * with the prior report, offered "Record what you decided, and why", and the
 * modal behind it opened fully disabled saying "Run an analysis first. There
 * are no analysed options to record a decision against yet." — to a user who
 * had just run one. It falsified the component's own contract, "this door is
 * never decorative".
 *
 * ⚠ THE STATES BELOW ARE THE PRODUCER'S OWN, NOT INVENTED. `ResultsStatus` is
 * `'idle' | 'preparing' | 'connecting' | 'streaming' | 'complete' | 'error' |
 * 'cancelled'` (`canvas/store.ts:244`), and every member except `'complete'`
 * is a state in which the modal refuses. Deriving the list from the producer
 * rather than from the symptom is what stops this closing one status and
 * leaving its siblings open (CLAUDE.md trap 13c).
 */
describe('THE DOOR IS NOT OFFERED WHERE THE CAPTURE WOULD BE REFUSED', () => {
  const REFUSING_STATUSES = [
    'preparing',
    'connecting',
    'streaming',
    'error',
    'cancelled',
    'idle',
  ] as const

  it.each(REFUSING_STATUSES)(
    'results.status=%s — the panel is still mounted, and the door is withheld',
    (status) => {
      setCanvas({ status })
      renderPanel(genuineDecision())
      /**
       * ⚠⚠ THE PRECONDITION IS PINNED IN-TEST, AND WITHOUT IT THIS ASSERTS
       * NOTHING. "The door is absent" passes identically when the whole panel
       * failed to render — a guard agreeing with itself (CLAUDE.md trap 13b).
       * The defect being closed is specifically that the panel STAYS MOUNTED
       * with the prior report while the modal has gone fail-closed, so the
       * panel's own presence is the condition that makes the absence mean
       * something.
       */
      expect(
        screen.getByTestId('analysis-new-tab-body'),
        'precondition: the panel must still be mounted for the absence of the door to mean anything',
      ).toBeInTheDocument()
      // The section collapses entirely: an empty box whose only control opens a
      // disabled modal is worse than no box.
      expect(screen.queryByTestId(SECTION)).toBeNull()
      expect(screen.queryByTestId(DOOR)).toBeNull()
    },
  )

  /**
   * ⚠ THE POSITIVE CONTROL, AND IT IS THE LOAD-BEARING HALF. Every assertion
   * above is an ABSENCE, and an absence assertion is vacuous until the same
   * harness has been shown to produce a PRESENCE (CLAUDE.md trap 13). This is
   * the same fixture, the same render, one field different.
   */
  it('…while results.status=complete with option nodes DOES offer it (control)', () => {
    setCanvas({ status: 'complete' })
    renderPanel(genuineDecision())
    expect(screen.getByTestId(DOOR)).toHaveTextContent(COPY.decisionRecord.open)
  })

  /**
   * ⚠ THE SECOND LIMB OF THE MODAL'S PREDICATE, AND ITS OWN DISCRIMINATING
   * TWIN. A completed run with NO option nodes refuses just as hard — the
   * modal's `options` is empty either way. Testing only the status limb would
   * leave a gate that agrees with the modal on one of its two conditions.
   */
  it('a completed run with no option nodes withholds the door too', () => {
    setCanvas({ status: 'complete', nodes: [] })
    renderPanel(genuineDecision())
    expect(screen.queryByTestId(DOOR)).toBeNull()
  })

  it('…and a completed run whose nodes are not options withholds it (twin)', () => {
    setCanvas({
      status: 'complete',
      nodes: [{ id: 'f-1', type: 'factor', data: { label: 'Churn' } }],
    })
    renderPanel(genuineDecision())
    expect(screen.queryByTestId(DOOR)).toBeNull()
  })

  /**
   * ⭐⭐⭐ A NULL `results` DOES NOT TAKE THE PANEL DOWN — a regression guard for
   * a crash this very gate caused, found by CI and reproduced locally.
   *
   * `results` is typed non-nullable on the canvas store, so reading
   * `state.results.status` looks safe and the capture modal does exactly that.
   * It is not safe HERE: this panel is rendered against store states where
   * `results` is genuinely `null`, and an unguarded read throws inside React's
   * render phase — which does not degrade the section, it unmounts the WHOLE
   * PANEL. The first version of the gate did this and broke 11 tests in
   * `successTargetSurfacesAgree.spec.tsx` with
   * `TypeError: Cannot read properties of null (reading 'status')`.
   *
   * ⚠ THE ASSERTION IS THAT THE PANEL SURVIVES, NOT MERELY THAT THE DOOR IS
   * ABSENT. "No door" is exactly what a crashed panel also looks like, so an
   * absence assertion alone would have passed on the broken build (trap 13b).
   */
  it('a null results does not throw — the panel survives and simply offers no door', () => {
    useCanvasStore.setState({ results: null } as never)
    expect(() => renderPanel(genuineDecision())).not.toThrow()
    expect(screen.getByTestId('analysis-new-tab-body')).toBeInTheDocument()
    expect(screen.queryByTestId(DOOR)).toBeNull()
  })

  /**
   * ⭐⭐ THE READ-BACK IS NOT GATED ON ANY OF IT, AND THIS IS THE ASSERTION
   * THAT KEEPS THE FIX FROM OVERSHOOTING. Hiding an already-captured record
   * mid-rerun would delete the user's own writing from the screen at exactly
   * the moment they are re-running to test it — a worse defect than the one
   * being repaired, and the obvious way to get this wrong.
   */
  it('a record already captured still reads back mid-rerun, with no update control', () => {
    useDecisionRecordStore.setState({
      isOpen: false,
      byScenario: {
        'scenario-act-spec': {
          optionId: 'opt-a',
          optionLabel: 'Phase the rollout by segment',
          optionNumber: null,
          confidence: 65,
          rationale: 'It keeps the renewal cohort intact.',
          assumptionToWatch: 'Enterprise accounts accept usage pricing.',
          revisitTrigger: 'churn crosses 4%',
          analysisHash: 'run_abc123',
          savedAt: Date.UTC(2026, 8, 7, 9, 0, 0),
          remote: null,
        },
      },
    })
    setCanvas({ status: 'preparing' })
    renderPanel(genuineDecision())
    // The record itself: present, and bound to its own value.
    expect(screen.getByTestId(`${SECTION}-option`)).toHaveTextContent(
      /^Phase the rollout by segment$/,
    )
    // The controls that would open a modal the product will refuse: absent.
    expect(screen.queryByTestId(`${SECTION}-update`)).toBeNull()
    expect(screen.queryByTestId(DOOR)).toBeNull()
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

/**
 * ⭐⭐⭐ THE READ-BACK IS REACTIVE, AND UNTIL NOW NOTHING COULD OBSERVE THAT.
 *
 * `AnalysisNewTabBody` subscribes through `useDecisionRecordForScenario` and
 * carries a docblock explaining why it must — a one-shot `getState()` would
 * render whichever scenario's record was current AT MOUNT. An independent
 * review measured the gap directly: swapping the hook for `getState()` left
 * every test in this file green, so the docblock was defending a property the
 * suite could not see.
 *
 * ⚠ BOTH DIRECTIONS ARE PINNED, because they fail differently. A record
 * arriving must appear WITHOUT a remount (the capture modal saves and closes
 * over a mounted panel); and the scenario changing must SWAP the record, which
 * is the case a `getState()` at mount gets wrong even though the first case
 * might scrape through on an unrelated re-render.
 */
describe('THE READ-BACK IS SUBSCRIBED, NOT SAMPLED AT MOUNT', () => {
  const rec = (over: Record<string, unknown> = {}) => ({
    optionId: 'opt-a',
    optionLabel: 'Phase the rollout by segment',
    optionNumber: null,
    confidence: 65,
    rationale: 'It keeps the renewal cohort intact.',
    assumptionToWatch: 'Enterprise accounts accept usage pricing.',
    revisitTrigger: 'churn crosses 4%',
    analysisHash: 'run_abc123',
    savedAt: Date.UTC(2026, 8, 7, 9, 0, 0),
    remote: null,
    ...over,
  })

  const OPTION = `${SECTION}-option`

  it('a record saved while the panel is mounted appears without a remount', () => {
    renderPanel(genuineDecision())
    // Precondition, pinned in-test: the panel starts with no record, so the
    // appearance below is the subscription's doing and not the fixture's.
    expect(screen.queryByTestId(OPTION)).toBeNull()
    expect(screen.getByTestId(DOOR)).toBeInTheDocument()

    act(() => {
      useDecisionRecordStore
        .getState()
        .saveRecord('scenario-act-spec', rec() as never)
    })

    expect(screen.getByTestId(OPTION)).toHaveTextContent(/^Phase the rollout by segment$/)
  })

  it('changing scenario swaps the record that is read back', () => {
    act(() => {
      const s = useDecisionRecordStore.getState()
      s.saveRecord('scenario-act-spec', rec({ optionLabel: 'Phase the rollout by segment' }) as never)
      s.saveRecord('scenario-other', rec({ optionLabel: 'Hold and re-price' }) as never)
    })
    renderPanel(genuineDecision())
    expect(screen.getByTestId(OPTION)).toHaveTextContent(/^Phase the rollout by segment$/)

    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'scenario-other' })
    })

    expect(screen.getByTestId(OPTION)).toHaveTextContent(/^Hold and re-price$/)
  })
})
