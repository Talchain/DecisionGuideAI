/**
 * "Add its current value." — and, now, the means of adding it.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Measured on the served build: the Reasoning tab's `analysis-new-deeper`
 * section renders 1,123 characters and EXACTLY ONE interactive element (its
 * own disclosure toggle). Inside it, three rows end with a literal imperative
 * naming a specific factor:
 *
 *   "Carrier Cut-off Compliance has no current value recorded, so zero was
 *    assumed. Anything downstream of it may be unreliable. Add its current
 *    value."
 *
 * The product instructs the reader three times and gives them nothing to
 * press. This is not a cosmetic gap: `semanticQualitySufficient` reads
 * `material_parameters_user_stated > 0`, so stating one factor value is the
 * act that moves the analysis from withholding a leading option to naming one.
 * Three instances of that act were inert prose.
 *
 * ── ⚠ THE PREMISE, AND THE HALF OF IT THAT DID NOT HOLD ────────────────────
 * The brief's premise was that the projection drops the node id and that
 * widening it is the work. HALF TRUE, and the untrue half is the important
 * one.
 *
 * `selectHumanisedInferenceWarningsOutsideStrip` does project to
 * `{code, title}`. But the id was never absent from the wire — it rides on the
 * producer's structured `field` key, and `nodeIdFromField` already reads it so
 * the humaniser can NAME the factor. That is why the served build says
 * "Carrier Cut-off Compliance" rather than "A starting factor".
 *
 * ⛔ WHAT IS NOT SAFE IS THE OBVIOUS GENERALISATION: "a warning that resolves
 * a node id gets a control". Complete census at `a62d2ffa` — 109 JSON files,
 * 151 entries carrying both `code` and `field`, contrast control 203 entries
 * carrying `code` + `message`:
 *
 *   ROOT_NODE_DEFAULT_VALUE   `nodes[ID].observed_state.value`   6/6
 *   GOAL_ANCESTOR_DATA_GAP    `nodes[ID]`                        3/3
 *   category_reclassified     `nodes[ID].category`              26
 *
 * `GOAL_ANCESTOR_DATA_GAP`'s field names **the goal**, not the starting
 * factors its sentence asks the reader to fill in — those ids appear ONLY
 * inside the message prose, which this estate forbids parsing. So a control
 * driven by "any resolvable node id" would sit under "Add current values for
 * those factors" and write the typed number to THE GOAL. That is the
 * wrong-factor harm, reached by a route that looks like success.
 *
 * ⭐ THE ADMISSION IS THEREFORE THE VALUE SLOT, NOT THE NODE. A control is
 * offered only where the producer's own field path addresses
 * `observed_state.value` — the exact slot the write targets. It is
 * self-describing rather than a code allowlist, so a new code that addresses
 * the same slot is admitted on the producer's terms and one that does not is
 * refused without anybody maintaining a list (trap 12).
 *
 * ⚠ `affected_nodes` IS DELIBERATELY NOT A CARRIER. `types.ts:1013` records it
 * as empty for this family, and its per-code semantics is underived: for
 * `GOAL_ANCESTOR_DATA_GAP` nothing establishes whether it would name the goal
 * or the ancestors, and guessing is the harm above.
 *
 * ── WHAT IS REUSED ─────────────────────────────────────────────────────────
 * `FactorValueControl` is #1491's control, extracted — same editing state,
 * same three-outcome mapping, same stays-open-on-refusal rule, same strings
 * from `ANALYSIS_NEW_COPY.modelStrip`. It commits through `useFactorValueCommit`
 * → `useModelEditAuthority.proposeFactorValue`. No second writer, no second
 * validation, no second policy; this file mints ZERO new product strings.
 *
 * Only the conversation transport is stubbed, so `buildFactorValueEditEvent`
 * runs for real and `sentEvents` holds the bytes the product would send.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { DeeperAnalysis } from '../sections/DeeperAnalysis'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { makeData } from './analysisNewFixtures'
import { useCanvasStore } from '@/canvas/store'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import type { ConfidenceSectionData } from '../../types'

const TID = 'analysis-new-deeper'

/**
 * ── IDENTITY ANCHORS, HAND-PINNED ──────────────────────────────────────────
 * Never derived at runtime from the thing under test: a value read back out of
 * the view model inside the assertion is an oracle agreeing with itself.
 */
const TARGET_NODE_ID = 'fac_carrier_cutoff'
const TARGET_LABEL = 'Carrier Cut-off Compliance'
/** A second defaulted root, also in the graph — the GREEN half of the pair. */
const OTHER_NODE_ID = 'fac_seasonal_demand'
const OTHER_LABEL = 'Seasonal Demand Volatility'
/** The goal. `GOAL_ANCESTOR_DATA_GAP`'s `field` names THIS, and its sentence
 *  asks for the ancestors' values — so this id must never reach a control. */
const GOAL_NODE_ID = 'g_twelve_month'
/** A defaulted root the warning names and the canvas does not hold. */
const ORPHAN_NODE_ID = 'fac_deleted_root'

/**
 * ⚠ THE NODE SHAPE IS THE STATE THE WARNING DESCRIBES, AND AN EARLIER VERSION
 * OF THIS FIXTURE WAS WRONG ABOUT IT — recorded because the error was silent
 * and the corrected shape is what makes the scale assertion mean anything.
 *
 * `ROOT_NODE_DEFAULT_VALUE` says the factor "has no current value recorded".
 * The first draft nevertheless gave these nodes `observedState.value = 0`, and
 * `resolveValueInputSeed` reads a present `value` with no `raw_value` as a
 * MODEL-SCALE basis (`inUserUnits: false`) — so the typed number went to the
 * wire unscaled and with no `raw_value` at all. The test failed, which is the
 * only reason the fixture's falsity was visible: a fixture describing a state
 * the producer never emits proves nothing about the producer (trap 16-inverse).
 *
 * With no recorded value the seed resolver falls to its last branch
 * (`{ seed: undefined, inUserUnits: true }`), which is the honest reading of a
 * user typing into an empty field on a factor that declares a cap and a unit.
 *
 * ⚠ THE CAP IS THE POINT OF THE ASSERTION. Without it `value` and `raw_value`
 * would be the same number and the test could not tell a control that honours
 * the scale contract from one that ignores it. `cap: 20, unit: 'months'` means
 * typing 12 must reach the wire as `value: 0.6` AND `raw_value: 12`.
 */
const CANVAS_NODES = [
  { id: GOAL_NODE_ID, type: 'goal', data: { label: 'Hit the 12-month goal' } },
  {
    id: TARGET_NODE_ID,
    type: 'factor',
    data: { label: TARGET_LABEL, observedState: { cap: 20, unit: 'months' } },
  },
  {
    id: OTHER_NODE_ID,
    type: 'factor',
    data: { label: OTHER_LABEL, observedState: { cap: 50, unit: '%' } },
  },
]

/**
 * The five rows, written as the producer emits them: `severity: 'info'`, so
 * every one falls OUTSIDE `isStripEntry` and into this section's list.
 * `message` is non-empty because the selector requires it.
 */
const WARNINGS = [
  {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    field: `nodes[${TARGET_NODE_ID}].observed_state.value`,
    severity: 'info',
    affected_nodes: [],
    message: `No observed value provided for root node '${TARGET_NODE_ID}'; defaulted to 0.0.`,
  },
  {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    field: `nodes[${OTHER_NODE_ID}].observed_state.value`,
    severity: 'info',
    affected_nodes: [],
    message: `No observed value provided for root node '${OTHER_NODE_ID}'; defaulted to 0.0.`,
  },
  {
    // ⛔ NAMES THE GOAL, ASKS FOR THE ANCESTORS. The row stays prose.
    code: 'GOAL_ANCESTOR_DATA_GAP',
    field: `nodes[${GOAL_NODE_ID}]`,
    severity: 'info',
    affected_nodes: [],
    message: `Goal node '${GOAL_NODE_ID}' is scored from its forward-propagated outcome distribution, but root ancestor(s) '${TARGET_NODE_ID}', '${OTHER_NODE_ID}' carry no observed value`,
  },
  {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    field: `nodes[${ORPHAN_NODE_ID}].observed_state.value`,
    severity: 'info',
    affected_nodes: [],
    message: `No observed value provided for root node '${ORPHAN_NODE_ID}'; defaulted to 0.0.`,
  },
  {
    // No `field` at all — nothing to bind to, so nothing is offered.
    code: 'EDGE_E_VALUE_NON_FINITE_DROPPED',
    severity: 'info',
    affected_nodes: [],
    message: '2 edge E-value entries were omitted from edge_e_values.',
  },
]

const dataWithWarnings = () =>
  makeData({
    confidence: {
      evidenceGapsAssessed: true,
      inferenceWarnings: WARNINGS,
    } as Partial<ConfidenceSectionData>,
  })

const build = (data: ReturnType<typeof makeData>) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_gap',
  })

/** Render the section the way `AnalysisNewTabBody` mounts it, and open it. */
const openDeeper = () => {
  render(<DeeperAnalysis deeper={build(dataWithWarnings()).deeper} offerFactorValueControl={true} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
}

/**
 * Find a control BY THE ROW'S NODE ID, never by position or by label text.
 * `getAllByTestId(...)[0]` would pass on whichever row happened to sort first —
 * an assertion bound by a predicate another object satisfies (trap 19).
 */
const controlFor = (testId: string, nodeId: string): HTMLElement | undefined =>
  screen.queryAllByTestId(testId).find((el) => el.getAttribute('data-node-id') === nodeId)

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

beforeEach(() => {
  sentEvents.length = 0
  showToast.mockReset()
  conversation = {
    sendSystemEvent: (e: unknown) => {
      sentEvents.push(e)
      return Promise.resolve(undefined)
    },
  }
  useCanvasStore.setState({ currentScenarioId: 'sc_1', nodes: CANVAS_NODES } as never)
})

afterEach(() => {
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
  cleanup()
})

describe('a defaulted factor can be given its value where the gap is stated', () => {
  /**
   * ⭐ RED-FIRST SIGNATURE 1 — at pristine no control is rendered for any gap
   * row, so this fails on `toBeInTheDocument`.
   */
  it('offers a value control on a gap row whose node the graph holds', () => {
    openDeeper()
    expect(controlFor(`${TID}-value-edit`, TARGET_NODE_ID)).toBeInTheDocument()
  })

  /**
   * ⭐ RED-FIRST SIGNATURE 2 — the identity binding and the scale contract in
   * one assertion, against the REAL wire event.
   *
   * This is the assertion the discriminating mutant pair targets: M1 rebinds
   * THIS row's commit to another row's id and must turn it RED; M2 rebinds an
   * UNRELATED row and must leave it GREEN.
   */
  it("dispatches factor_value_edit carrying that row's OWN nodeId, at the right scale", () => {
    openDeeper()
    setValueOn(TARGET_NODE_ID, '12')

    expect(sentEvents).toHaveLength(1)
    expect(sentEvents[0]).toMatchObject({
      type: 'factor_value_edit',
      payload: {
        target_id: TARGET_NODE_ID,
        field: 'value',
        // model scale, from the node's own cap — not the typed magnitude
        value: 0.6,
        raw_value: 12,
        unit: 'months',
      },
    })
  })

  /** The other row is a real, independent target — this is what makes the
   *  pair's GREEN half meaningful rather than vacuous. */
  it('binds the second defaulted root to ITS own id, not the first', () => {
    openDeeper()
    setValueOn(OTHER_NODE_ID, '25')
    expect(sentEvents).toHaveLength(1)
    expect(sentEvents[0]).toMatchObject({
      type: 'factor_value_edit',
      payload: { target_id: OTHER_NODE_ID, value: 0.5, raw_value: 25, unit: '%' },
    })
  })

  it('reports the dispatch in the sanctioned words, and mints no new ones', () => {
    openDeeper()
    setValueOn(TARGET_NODE_ID, '12')
    expect(showToast).toHaveBeenCalledWith(ANALYSIS_NEW_COPY.modelStrip.valueDispatched)
  })
})

describe('⛔ the plural goal-ancestor row is left as prose', () => {
  /**
   * THE WRONG-FACTOR GUARD. `GOAL_ANCESTOR_DATA_GAP`'s `field` resolves a
   * perfectly real node id — the GOAL — and its sentence asks for the
   * ANCESTORS' values. A control here would write the reader's number to the
   * wrong element while looking like it worked.
   */
  it('offers no control on the goal-ancestor row, whose field names the goal', () => {
    openDeeper()
    expect(controlFor(`${TID}-value-edit`, GOAL_NODE_ID)).toBeUndefined()
  })

  /**
   * CONTROL FOR THE ABOVE: the probe can SEE a control when one is there, and
   * the goal node IS in the canvas — so the absence is the admission rule's
   * doing, not an unresolvable id or a blind probe.
   */
  it('CONTROL: the goal node is in the graph and the probe can see controls', () => {
    openDeeper()
    expect(useCanvasStore.getState().nodes.some((n) => n.id === GOAL_NODE_ID)).toBe(true)
    expect(screen.queryAllByTestId(`${TID}-value-edit`).length).toBeGreaterThan(0)
  })

  /** And the sentence itself is untouched — the row still says its piece. */
  it('still renders the goal-ancestor sentence', () => {
    openDeeper()
    expect(screen.getByText(/Add current values for those factors/)).toBeInTheDocument()
  })
})

describe('no addressable factor, no control — never a disabled one', () => {
  it('renders the row but no control when the graph does not hold that node', () => {
    openDeeper()
    expect(controlFor(`${TID}-value-edit`, ORPHAN_NODE_ID)).toBeUndefined()
    // The finding is still stated: only the action goes.
    const rows = screen.getAllByTestId(`${TID}-group`)
    expect(rows.length).toBeGreaterThan(0)
    expect(document.querySelectorAll('[data-gap-code="ROOT_NODE_DEFAULT_VALUE"]').length).toBe(3)
  })

  it('offers no control on a warning carrying no field at all', () => {
    openDeeper()
    const edgeRow = document.querySelector('[data-gap-code="EDGE_E_VALUE_NON_FINITE_DROPPED"]')
    expect(edgeRow).toBeTruthy()
    expect(edgeRow?.querySelector(`[data-testid="${TID}-value-edit"]`)).toBeNull()
  })

  /**
   * ⚠ NO CARRIER, NO CONTROL. Without a conversation the commit could only
   * write locally, and a local-only change to a number the panel has just
   * called a placeholder is a claim this surface must not make.
   */
  it('offers no control at all when there is no conversation', () => {
    conversation = null
    openDeeper()
    expect(screen.queryAllByTestId(`${TID}-value-edit`)).toHaveLength(0)
  })

  /** The default is OFF, so a surface that has not opted in cannot acquire the
   *  act by accident. Pinned against the mount case below. */
  it('offers nothing by default', () => {
    render(<DeeperAnalysis deeper={build(dataWithWarnings()).deeper} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    expect(screen.queryAllByTestId(`${TID}-value-edit`)).toHaveLength(0)
  })
})

describe('the mount path', () => {
  /**
   * Bound to the surface the deployed flags actually mount: the control must be
   * a DESCENDANT of the deeper section as `AnalysisNewTabBody` renders it. A
   * control present anywhere in the document would satisfy mere presence.
   */
  it('is reachable from the reasoning tab body', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={dataWithWarnings()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_gap"
      />,
    )
    const section = screen.getByTestId(TID)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    const trigger = controlFor(`${TID}-value-edit`, TARGET_NODE_ID)
    expect(trigger).toBeInTheDocument()
    expect(section).toContainElement(trigger as HTMLElement)
  })
})
