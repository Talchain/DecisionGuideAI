/**
 * "What I estimated" states an invitation — and now offers the means of
 * accepting it.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Measured on the served build: the register renders ~1,200 characters and
 * EXACTLY ONE interactive element (its own disclosure toggle). Under "What I
 * estimated" it says *"The numbers behind these are mine, not yours. If you
 * have better ones, tell me and I'll use them."* over a list of factors the
 * product invented values for — with no way to tell it. A surface that states
 * an invitation and offers no means of accepting it is prose about reasoning,
 * not an instrument for it.
 *
 * ── WHY THIS IS NOT THE THING THE COMPONENT'S HEADER FORBIDS ───────────────
 * That header says, deliberately: *"Where no real action exists — everything
 * in 'what I estimated' — none is offered"*, and `COPY.addAction` records 15
 * arms over 5 rounds against the live CEE router in which EVERY add phrasing
 * was refused (`ORPHAN_NODE`, `NO_PATH_TO_GOAL`, `PIPELINE_OWNED_FIELD`).
 *
 * That ruling is about ADDING a factor and it still stands — which is why the
 * "I also considered these and left them out" list stays inert, pinned below.
 *
 * It does not govern THIS list, and the distinguishing fact is the one the
 * ruling itself names as its own working CONTROL: *"the estate's proven edit
 * grammar ('Change X to Y.', target derived from THIS run's graph by
 * identity) → applied."* An estimated factor is ALREADY A NODE IN THE GRAPH.
 * Setting its value is a value edit on an identified node — the control, not
 * the refused arm. Nothing is guessed: CEE supplies `node_id` itself
 * (`InferredFactor.nodeId`), so the panel is not inventing causality on the
 * user's behalf, which is the specific harm the ruling exists to prevent.
 *
 * ── ⚠ THE PREMISE THAT DID **NOT** HOLD, AND WHAT IT CHANGED ───────────────
 * The brief's premise was that these factors "already exist in the graph".
 * As an INVARIANT that is FALSE, derived at this tip. `inferredFactors` is a
 * COLD-READ SNAPSHOT written by `serverGraphHydration` (`:238`) BEFORE the
 * server graph is merged onto the canvas (`:371`), and the hook "attempts ONCE
 * PER SCENARIO ID, so it never self-corrects". Three reachable schedules leave
 * the manifest describing nodes the canvas does not hold, ALL of them WITHIN
 * one scenario, so the component's existing scenario-identity gate cannot see
 * any of them:
 *
 *   1. a refused merge (`mergeRefused` — `zeroOverlap`, whose own guard proves
 *      the two node-id sets are DISJOINT) leaves the manifest written and the
 *      canvas untouched;
 *   2. `deleteNodeById` and its siblings filter `nodes` and never rewrite the
 *      manifest, so a deleted factor stays listed for the rest of the session;
 *   3. the `unchanged` short-circuit writes nothing to the canvas, so a local
 *      edit leaves the manifest describing the pre-edit server graph.
 *
 * ⭐ THE BINDING IS STILL SAFE, AND THE REASON IS THE SHAPE OF THE LOOKUP, NOT
 * THE RELIABILITY OF THE ID. `proposeFactorValue` resolves by EXACT id
 * (`nodes.find(n => n.id === activeNodeId)`) and returns `not_encodable` when
 * it misses. There is no fuzzy match, so a divergent id CANNOT address a
 * different node — the failure mode is "nothing happens", never "the wrong
 * factor was edited". What it would produce is a button that does nothing,
 * which this component forbids outright.
 *
 * So the control is gated on a POSITIVE node resolution, exactly as the
 * section itself is gated on a POSITIVE scenario match, and for the same
 * reason. Pinned below as a reachable state, not as defensive decoration.
 *
 * ── WHAT IS DELIBERATELY NOT REUSED ────────────────────────────────────────
 * Nothing here mints a second writer, a second validation or a second policy.
 * The control calls `useFactorValueCommit` — the SAME hook the Reasoning tab's
 * model strip uses — which calls `useModelEditAuthority.proposeFactorValue`.
 * The scale contract, the optimistic write and the undo all stay where they
 * are. This spec therefore runs the REAL chain and asserts the REAL wire
 * event; only the conversation transport is stubbed, so the payload under
 * assertion is the one `buildFactorValueEditEvent` actually produces.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

/**
 * ⚠ ONLY THE TRANSPORT IS STUBBED. `useModelEditAuthority`,
 * `useFactorValueCommit` and `buildFactorValueEditEvent` all run for real, so
 * `sentEvents` holds the bytes the product would put on the wire. A spec that
 * mocked the authority would prove the mock's argument and say nothing about
 * `target_id`.
 */
const sentEvents: unknown[] = []
let conversation: { sendSystemEvent: (e: unknown, o?: unknown) => Promise<unknown> } | null = null

vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => conversation,
  useConversationContext: () => conversation,
  ConversationProvider: ({ children }: { children: unknown }) => children,
}))

const showToast = vi.fn()
vi.mock('../../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => showToast,
  ToastProvider: ({ children }: { children: unknown }) => children,
}))

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

import { WhatIWasGivenSection } from '../WhatIWasGivenSection'
import { AnalysisNewTabBody } from '../../analysisNew/AnalysisNewTabBody'
import { genuineDecision } from '../../analysisNew/__tests__/analysisNewFixtures'
import { useCanvasStore } from '@/canvas/store'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'
import { ANALYSIS_NEW_COPY } from '../../analysisNew/analysisNewCopy'
import b1Fixture from './fixtures/b1-cold-read.not-modelled.json'

const TID = 'what-i-was-given-estimated'
const LIVE_SCENARIO_ID = '11111111-1111-4111-8111-111111111111'

/**
 * ── IDENTITY ANCHORS, HAND-PINNED ──────────────────────────────────────────
 * Read from the fixture by hand, never derived at runtime: a value read from
 * the fixture inside the test is an oracle agreeing with itself. These are
 * `not_modelled.inferred_factors[]` entries of `b1-cold-read`.
 */
const TARGET_NODE_ID = 'fac_cash_runway'
const TARGET_LABEL = 'Cash Runway'
/** A second estimated factor, present in the graph — the GREEN half of the
 *  discriminating pair lives on this row. */
const OTHER_NODE_ID = 'fac_nrr'
/** An estimated factor the MANIFEST lists and the CANVAS does not hold — the
 *  divergence measured above, staged as the reachable state it is. */
const ORPHAN_NODE_ID = 'fac_bafin_complexity'

/**
 * ⚠ THE CAP IS THE POINT OF THIS FIXTURE. A bare factor would make
 * `value` and `raw_value` the same number, and the assertion could not tell a
 * control that honours the scale contract from one that ignores it. With
 * `cap: 20`, typing 12 must reach the wire as `value: 0.6` (model scale,
 * `normaliseRawFactorValue(12, 20)` — derived at the producer, not assumed)
 * AND `raw_value: 12` (the user-unit magnitude).
 */
const CANVAS_NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Protect the runway' } },
  {
    id: TARGET_NODE_ID,
    type: 'factor',
    data: {
      label: TARGET_LABEL,
      observedState: { value: 0.4, raw_value: 8, cap: 20, unit: 'months', source: 'cee_inference' },
    },
  },
  {
    id: OTHER_NODE_ID,
    type: 'factor',
    data: {
      label: 'Net Revenue Retention',
      observedState: { value: 1.12, raw_value: 112, cap: 200, unit: '%', source: 'cee_inference' },
    },
  },
]

const seed = () => {
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId: LIVE_SCENARIO_ID,
    briefText: (b1Fixture as { brief_text: string }).brief_text,
    // ⚠ THROUGH THE REAL BOUNDARY PARSER, never a hand-built manifest — the
    // register's own suite's rule. A hand-built object encodes my model of the
    // manifest rather than the manifest.
    manifest: parseNotModelled((b1Fixture as { not_modelled: unknown }).not_modelled),
  })
}

beforeEach(() => {
  sentEvents.length = 0
  showToast.mockReset()
  conversation = {
    sendSystemEvent: (e: unknown) => {
      sentEvents.push(e)
      return Promise.resolve(undefined)
    },
  }
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: LIVE_SCENARIO_ID, nodes: CANVAS_NODES } as never)
  seed()
})

afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
  cleanup()
})

/**
 * Open the disclosure. The whole register is behind it.
 *
 * ⚠ THE OPT-IN IS PASSED EXPLICITLY, because it is `false` by default: the
 * PARKED Analysis tab mounts this same component and may not acquire a writer.
 * The `offers nothing by default` case below pins that default, and the mount
 * case at the end pins that the Reasoning tab really does opt in — between
 * them, neither a silently-off flag nor a silently-on one can survive.
 */
const open = () => {
  render(<WhatIWasGivenSection offerEstimatedValueControl={true} />)
  fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
}

/**
 * Find a control BY THE ROW'S NODE ID, never by position or label text.
 * `getAllByTestId(...)[1]` would pass on whichever row happened to sort second
 * — a test bound by a predicate another object satisfies (CLAUDE.md trap 19).
 */
const controlFor = (testId: string, nodeId: string): HTMLElement | undefined =>
  screen.queryAllByTestId(testId).find((el) => el.getAttribute('data-node-id') === nodeId)

/** Type a value into one row's control and save it. */
const setValueOn = (nodeId: string, typed: string) => {
  const trigger = controlFor(`${TID}-value-edit`, nodeId)
  if (!trigger) throw new Error(`no value control on row ${nodeId}`)
  fireEvent.click(trigger)
  const input = controlFor(`${TID}-value-input`, nodeId)
  if (!input) throw new Error(`no value input on row ${nodeId}`)
  fireEvent.change(input, { target: { value: typed } })
  const save = controlFor(`${TID}-value-save`, nodeId)
  if (!save) throw new Error(`no save control on row ${nodeId}`)
  fireEvent.click(save)
}

describe('an estimated factor can be corrected where it is stated', () => {
  /**
   * ⭐ RED-FIRST SIGNATURE 1 — at pristine there is NO control on any estimated
   * row, so this fails on the `toBeInTheDocument` assertion below.
   */
  it('offers a value control on an estimated factor whose node the graph holds', () => {
    open()
    const trigger = controlFor(`${TID}-value-edit`, TARGET_NODE_ID)
    expect(trigger).toBeInTheDocument()
    // The label is the sanctioned one, reused from the model strip rather than
    // re-voiced here — a second vocabulary for one act is how twins are born.
    expect(trigger).toHaveTextContent(ANALYSIS_NEW_COPY.modelStrip.changeValue)
  })

  /**
   * ⭐⭐ RED-FIRST SIGNATURE 2, AND THE WHOLE POINT OF THE LANE — the dispatch
   * must carry THIS ROW'S OWN `nodeId`.
   *
   * The assertion is on the REAL wire event, so it pins `target_id` (identity),
   * `value` (model scale) and `raw_value` (user units) together. A control that
   * dispatched the right number against the wrong factor would silently
   * overwrite a different part of the user's model — the worst available
   * outcome on a surface whose entire claim is "these numbers are mine, tell me
   * better ones".
   */
  it("dispatches factor_value_edit carrying the row's OWN nodeId, at the right scale", () => {
    open()
    setValueOn(TARGET_NODE_ID, '12')
    expect(sentEvents).toHaveLength(1)
    expect(sentEvents[0]).toEqual({
      type: 'factor_value_edit',
      payload: {
        target_id: TARGET_NODE_ID,
        // 12 months against `cap: 20` — `normaliseRawFactorValue(12, 20)`.
        value: 0.6,
        field: 'value',
        raw_value: 12,
        unit: 'months',
      },
    })
  })

  /**
   * ⭐ THE GREEN HALF OF THE DISCRIMINATING PAIR.
   *
   * Editing an UNRELATED row must leave the target row's claim untouched. A
   * single biting mutant proves sensitivity to SOMETHING; only the pair proves
   * sensitivity to the NAMED OBJECT. Without this case, a mutant that rewired
   * every row to one id would RED the case above and look like a working
   * guard.
   */
  it('an edit on a different estimated row names that row, and not the target', () => {
    open()
    setValueOn(OTHER_NODE_ID, '150')
    expect(sentEvents).toHaveLength(1)
    expect((sentEvents[0] as { payload: { target_id: string } }).payload.target_id).toBe(
      OTHER_NODE_ID,
    )
  })

  /**
   * The three outcomes are never flattened to "saved". `proposeFactorValue`
   * answers `dispatched | local_only | not_encodable` precisely so a caller
   * cannot claim a server acceptance it did not observe.
   */
  it('reports that Olumi was asked, and does not claim the model changed', () => {
    open()
    setValueOn(TARGET_NODE_ID, '12')
    expect(showToast).toHaveBeenCalledWith(ANALYSIS_NEW_COPY.modelStrip.valueDispatched)
  })

  /**
   * ⚠ THE EDITOR STAYS OPEN ON A REFUSAL. Nothing was written anywhere, so
   * closing it would look like a success. `''` is the canonical case:
   * `Number('')` is 0, not NaN.
   */
  it('keeps the editor open and claims nothing when the value cannot be applied', () => {
    open()
    setValueOn(TARGET_NODE_ID, '')
    expect(sentEvents).toHaveLength(0)
    expect(showToast).toHaveBeenCalledWith(ANALYSIS_NEW_COPY.modelStrip.valueNotEncodable)
    expect(controlFor(`${TID}-value-input`, TARGET_NODE_ID)).toBeInTheDocument()
  })
})

describe('the control is offered only where it would do something', () => {
  /**
   * ⭐ THE REFUTED PREMISE, PINNED AS THE REACHABLE STATE IT IS. The manifest
   * lists `fac_bafin_complexity`; this canvas does not hold it — the shape a
   * refused merge, a structural delete or a stale one-shot manifest produces
   * WITHIN one scenario, where the scenario-identity gate passes.
   *
   * The row still renders — the estimate WAS made and hiding it would be the
   * dishonest half — it simply carries no control.
   */
  it('renders the row but no control when the graph does not hold that node', () => {
    open()
    const row = screen
      .queryAllByTestId(`${TID}-row`)
      .find((el) => el.getAttribute('data-node-id') === ORPHAN_NODE_ID)
    expect(row).toBeInTheDocument()
    expect(controlFor(`${TID}-value-edit`, ORPHAN_NODE_ID)).toBeUndefined()
  })

  /**
   * ⚠ NO CONTROL, NOT A DISABLED ONE — the component's binding rule: *"we never
   * render a button that does nothing"*. A disabled control still advertises an
   * action, which is the defect this lane exists to close, inverted.
   */
  it('offers no control at all when there is no conversation to carry the edit', () => {
    conversation = null
    open()
    expect(screen.queryAllByTestId(`${TID}-value-edit`)).toHaveLength(0)
    expect(screen.getAllByTestId(`${TID}-row`).length).toBeGreaterThan(0)
  })

  /**
   * ⭐ THE SCOPE RULING, PINNED. `ResultsBody` — the PARKED Analysis tab —
   * mounts this same component without the opt-in, and must keep the inert list
   * it has. Paul's ruling is Reasoning and Model only; a writer appearing on a
   * parked surface under a Reasoning-tab commit message is exactly what the
   * default guards against.
   */
  it('offers nothing by default, so the parked tab is unchanged', () => {
    render(<WhatIWasGivenSection />)
    fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
    expect(screen.getAllByTestId(`${TID}-row`).length).toBeGreaterThan(0)
    expect(screen.queryAllByTestId(`${TID}-value-edit`)).toHaveLength(0)
  })
})

describe('the add ruling still stands', () => {
  /**
   * ⭐⭐ THE INERTNESS OF "I ALSO CONSIDERED THESE" IS A PINNED CLAIM, not an
   * absence nobody is watching.
   *
   * `COPY.addAction` records 15 arms over 5 rounds in which every add phrasing
   * was refused by the live router. Those items are NOT nodes — they are the
   * drafting model's own sentences about what it left out — so there is no
   * identity to bind an edit to and nothing to set a value on. A control here
   * would be the product inventing causality on the user's behalf.
   *
   * This is the mutant target: wire a control into the considered list and this
   * REDs.
   */
  it('offers no value control in the considered list', () => {
    open()
    expect(screen.getAllByTestId('what-i-was-given-considered-row').length).toBeGreaterThan(0)
    expect(screen.queryAllByTestId('what-i-was-given-considered-value-edit')).toHaveLength(0)
    // The considered rows carry no node identity to bind to, and must not
    // acquire one: a `data-node-id` here would be an id this panel invented.
    for (const row of screen.getAllByTestId('what-i-was-given-considered-row')) {
      expect(row.getAttribute('data-node-id')).toBeNull()
    }
  })
})

describe('the control reaches the surface the deployed flags mount', () => {
  /**
   * ⚠⚠ BOUND TO THE TAB, NOT TO THE COMPONENT. This estate has twice shipped a
   * feature dark by proving it against a component the deployed flags never
   * mount (CLAUDE.md trap 3b). Every case above renders `WhatIWasGivenSection`
   * directly and would pass on a build that never rendered it, so the mount
   * path is asserted separately, at `AnalysisNewTabBody` — the Reasoning tab,
   * which is where the defect was measured.
   */
  it('is reachable from the reasoning tab body', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={genuineDecision()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
      />,
    )
    const section = screen.getByTestId('what-i-was-given-section')
    fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
    const trigger = controlFor(`${TID}-value-edit`, TARGET_NODE_ID)
    expect(trigger).toBeInTheDocument()
    // DESCENDANCY, not co-presence: a control rendered elsewhere in the
    // document would satisfy mere presence.
    expect(section).toContainElement(trigger as HTMLElement)
  })
})
