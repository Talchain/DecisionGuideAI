/**
 * ⭐⭐⭐ THE GOAL CARD MAY NOT TELL A USER THEY SET NO TARGET WHILE ITS OWN
 * TITLE STATES ONE.
 *
 * ⚠⚠ WITNESSED ON A REAL USER'S SCREEN, 3 Sep 2026. The goal card rendered
 * its title and its status chip ~20px apart:
 *
 *     title   Reach £30k MRR Within 18 Months
 *     chip    No target set
 *
 * The target is IN THE TITLE. The anchor element of the whole model
 * contradicted itself in one glance. The compiled model behind it carried
 * `goal_threshold: null` and `goal_constraints: null` (measured in a real
 * 19-turn session bundle, `Talchain/olumi-programme-docs` @ `b15bf3f`,
 * `artefacts/manual-test-2026-09-03/`), so the CHIP WAS NOT LYING ABOUT THE
 * DATA. Extraction is a separate defect with a separate owner, and this file
 * asserts nothing about it.
 *
 * ── THE TWO QUESTIONS, WRITTEN DOWN BEFORE THE ASSERTIONS (trap 21) ────────
 * `No target set` is true of one question and read as an answer to the other:
 *
 *   what the card computes   "does the MODEL hold a threshold?"   → no
 *   what the reader hears    "did I state a target?"              → you didn't
 *
 * Two questions under one sentence. Per trap 21 the remedy is to NAME THEM
 * APART, not to align them and not to hide the chip: the chip keeps answering
 * the first question and stops phrasing its answer as a verdict on the reader.
 * `Target not captured` puts the subject where the truth is — on Olumi's
 * capture, not on the user's statement — and it is equally honest for the user
 * who genuinely never stated one, because nothing was captured either way.
 *
 * ⚠ THE SIBLING SURFACE IS DELIBERATELY UNTOUCHED. The Reasoning panel's model
 * strip says `Target · None set` (`analysisNewCopy.ts:successTarget.none`),
 * adjudicated there as "a FACT ABOUT THE MODEL" under a `Target` caption that
 * frames it as a readout. This chip has no such frame — it is a standalone
 * affordance on the card — so the two surfaces are not a hand-copied pair and
 * are not being aligned here. Neither contradicts the other: both say the model
 * holds nothing.
 *
 * ── ⚠⚠ AND THE SECOND HALF WAS WITHDRAWN IN ROUND 3, HAVING BEEN REFUTED ───
 * THIS SECTION SAID: *"A CHIP THAT NAMES A GAP MUST NAME THE REPAIR … the
 * inspector's goal panel renders `GoalThresholdEditor` on exactly the
 * null-target branch this chip fires on (read at the bytes) … Copy that
 * promises an affordance is only honest while the affordance answers."*
 *
 * The BAR in that last sentence is right and is kept. The claim that this copy
 * MET it was false. `InspectorRouter` wraps the panel body in an unconditional
 * `<fieldset disabled>` beneath "those changes can't yet be saved", and
 * `GoalThresholdEditor` renders a form control, which that fieldset inerts. The
 * editor is PRESENT and does not ANSWER — so `— add one` named a route that
 * dead-ends one layer below where "read at the bytes" was reading.
 *
 * ⚠ NOTE WHAT THAT PHRASE COST. "Read at the bytes" was true of the bytes it
 * was pointed at (`GoalPanel`) and silent about the mount the product actually
 * produces (`InspectorRouter` → `GoalPanel`). A capture proves what it was
 * pointed at (CLAUDE.md trap 16/20), and an inspection claim inherits the scope
 * of the file it inspected.
 *
 * The chip now states the fact and says only what the click does. The rule and
 * its evidence live in `goalChipPromiseVsDestination.spec.tsx`, which mounts
 * the REAL router and derives ACTIONABILITY — this file cannot see any of that,
 * because it renders `GoalNode` against a mocked store with no inspector in it,
 * and that limit is exactly why the promise shipped.
 *
 * ── PROOF SHAPE ───────────────────────────────────────────────────────────
 * RED-first at pristine `86786efb`: every assertion below fails, because the
 * chip rendered `No target set` and its aria-label/title repeated it.
 *
 * ⚠ AND WHY BOTH A CONSTANT-BOUND ASSERTION AND A LITERAL ONE. Binding only to
 * the exported constant would let a future edit launder `No target set` back
 * through the indirection with every equality assertion still green — the shape
 * `BaseNode.goalNeedsInputCopy.spec.tsx` guards against in its own last test.
 * Binding only to a literal would make this a third hand-written copy of the
 * card's string (trap 12). So: the DOM is asserted equal to the constant, the
 * constant is asserted equal to a literal ONCE, and a separate negative guard
 * bans the withdrawn sentence on every channel a reader can reach.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const GOAL_ID = 'goal-1'
const LABEL = 'Reach £30k MRR Within 18 Months'

const selectNodeWithoutHistory = vi.fn()

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  // ⛔ THE NODE IS ON THE GRAPH. `openNodeInspector` fails CLOSED on an id it
  // cannot find, so an empty `nodes` array would make the route assertion below
  // pass or fail for a reason that has nothing to do with the chip.
  nodes: [{ id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: LABEL } }],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  selectNodeWithoutHistory,
  ...overrides,
})

vi.mock('../../store', () => {
  const useCanvasStore = vi.fn() as unknown as {
    (selector: (s: unknown) => unknown): unknown
    getState: () => unknown
  }
  return { useCanvasStore }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

vi.mock('../../ui/inspector-v2/useAnalysisResults', () => ({
  useHasAnyRealProbability: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import {
  GoalNode,
  GOAL_NO_TARGET_STATE,
  goalNoTargetChannels,
} from '../GoalNode'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../utils/openEdgeStrengthEditor'

const baseProps = {
  id: GOAL_ID,
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function renderGoal(
  data: Record<string, unknown> = {},
  storeOverrides: Record<string, unknown> = {},
) {
  const state = makeStoreState(storeOverrides)
  vi.mocked(useCanvasStore).mockImplementation(((selector: (s: unknown) => unknown) =>
    selector(state)) as never)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  const { container } = render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: LABEL, type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
  return {
    container,
    chip: container.querySelector('[data-testid="goal-node-no-target-chip"]'),
    lodLine: container.querySelector('[data-testid="node-lod-line"]')?.textContent ?? null,
    text: container.textContent ?? '',
  }
}

/** Every channel a reader can reach this chip through. */
const channelsOf = (chip: Element) => ({
  visible: chip.textContent ?? '',
  'aria-label': chip.getAttribute('aria-label') ?? '',
  title: chip.getAttribute('title') ?? '',
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => makeStoreState()
})
afterEach(cleanup)

describe('the no-target chip states a fact about the MODEL, never a verdict on the reader', () => {
  it('PRECONDITION PIN — the chip renders because no target is held, and not otherwise', () => {
    // ⛔ Without this, every assertion in this file could be satisfied by a card
    // that renders the chip unconditionally, and the file would be measuring a
    // constant rather than a state. Same component, same props; only the data
    // differs (CLAUDE.md trap 13b).
    expect(renderGoal().chip).not.toBeNull()
    cleanup()
    expect(renderGoal({ goal_threshold_raw: 30000, goal_threshold_unit: '£' }).chip).toBeNull()
  })

  it('⭐ the visible chip text names the state', () => {
    const { chip } = renderGoal()
    // IDENTITY, not a value predicate another element could satisfy: the chip
    // is found by its testid and its whole text is asserted.
    expect(chip!.textContent).toBe(GOAL_NO_TARGET_STATE)
  })

  it('⭐⭐ THE RENDER↔COMPOSITION BINDING — every channel is what `goalNoTargetChannels` says', () => {
    // ⚠ THIS IS THE ASSERTION THAT MAKES THE RULE IN
    // `goalChipPromiseVsDestination.spec.tsx` BINDING. That file asserts over
    // the COMPOSITION; without this, the component could drift from it and the
    // rule would be guarding a function the card no longer renders — a guard
    // agreeing with itself (CLAUDE.md trap 13b). Both arms, by identity.
    for (const [diagnostic, overrides] of [
      [false, {}],
      [true, { results: { status: 'complete', report: {} } }],
    ] as const) {
      cleanup()
      const { chip } = renderGoal({}, overrides as Record<string, unknown>)
      expect(chip, `diagnostic=${diagnostic}`).not.toBeNull()
      expect(channelsOf(chip!)).toEqual(goalNoTargetChannels({ diagnostic }))
    }
  })

  it('⭐ THE COPY PIN, ONCE — the constant is what the card ships, in British English', () => {
    // The single literal in this file. Everything else binds to the constant,
    // so a wording change edits exactly one line here and nothing drifts.
    expect(GOAL_NO_TARGET_STATE).toBe('Target not captured')
  })

  it('⛔ no channel of the chip says the reader set no target', () => {
    // Literal, not derived: this is what stops a future edit re-introducing the
    // withdrawn sentence behind the constants the assertions above follow.
    const { chip } = renderGoal()
    for (const [name, text] of Object.entries(channelsOf(chip!))) {
      expect(text, `${name} channel`).not.toMatch(/no target set/i)
      expect(text, `${name} channel`).not.toMatch(/never (set|stated)/i)
      // The chip must not be silent on a channel either — an empty string
      // satisfies every negative guard above.
      expect(text.trim().length, `${name} channel`).toBeGreaterThan(0)
    }
  })

  it('⛔ every channel says what the CLICK does, and none promises a repair the destination cannot make', () => {
    // ⚠⚠ THIS TEST WAS THE EXACT INVERSE UNTIL #1172 ROUND 3, and it was the
    // inverse for a good reason that turned out to rest on a false premise:
    // a screen-reader user gets the aria-label and nothing else, a touch user
    // never sees the title, so a route parked in `title` alone leaves both with
    // a confession and no way out. That argument is still right — which is why
    // the promise had to be withdrawn from ALL THREE channels rather than the
    // visible one, once the destination turned out to be inert. The reasoning
    // that decides WHICH way this test points lives in
    // `goalChipPromiseVsDestination.spec.tsx`, which derives the destination's
    // inertness through the REAL router instead of asserting it here.
    const { chip } = renderGoal()
    const channels = channelsOf(chip!)
    for (const [name, text] of Object.entries(channels)) {
      expect(text, `${name} channel`).not.toMatch(/\badd one\b/i)
    }
    // …and each still says what pressing it will do, so the ban is not
    // satisfied by silence.
    expect(channels['aria-label']).toMatch(/open this goal's details/i)
    expect(channels.title).toMatch(/open its details/i)
  })

  it('the post-analysis diagnostic arm keeps its own accessible name and stays free of the withdrawn sentence', () => {
    // C-1's two distinguishable states survive the rewording: a missing target
    // before a run and a run that finished producing no probability are
    // different situations with different next actions.
    const { chip } = renderGoal({}, { results: { status: 'complete', report: {} } })
    expect(chip!.getAttribute('data-diagnostic')).toBe('no-probability')
    const channels = channelsOf(chip!)
    expect(channels['aria-label']).toMatch(/no probability/i)
    expect(channels['aria-label']).not.toMatch(/no target set/i)
    expect(channels.title).not.toMatch(/no target set/i)

    // CONTRAST CONTROL — the two arms genuinely differ, so the assertions above
    // are about the diagnostic arm and not about a name both arms share.
    cleanup()
    const pre = renderGoal()
    expect(pre.chip!.getAttribute('data-diagnostic')).toBeNull()
    expect(pre.chip!.getAttribute('aria-label')).not.toBe(channels['aria-label'])
  })
})

describe('the reduced line carries the state, and is still text the full-zoom card shows', () => {
  it('below the legibility floor the card says the state, not the whole chip', () => {
    // The reduced line is CSS-truncated with an ellipsis (`BaseNode.tsx:1052`).
    // Since round 3 withdrew the repair clause the chip and this line carry the
    // SAME constant, so the truncation risk the clause introduced is gone — but
    // the binding stays, because it is what stops the two becoming a
    // hand-written pair again the next time the chip grows a second half.
    const { lodLine } = renderGoal({}, { lodRung: 'line' })
    expect(lodLine).toBe(GOAL_NO_TARGET_STATE)
  })

  it('⛔ RIDES `GoalNode.goalTargetAgreement.spec.tsx` — the reduced line is a substring of the full-zoom render', () => {
    // The existing agreement guard asserts exactly this for the no-target card.
    // Reproducing it here means a change that splits the chip's text from the
    // reduced line REDs in this file too, beside the copy it broke.
    const full = renderGoal()
    expect(full.text).toContain(LABEL) // positive control: the card rendered
    const fullText = full.text
    cleanup()
    const low = renderGoal({}, { lodRung: 'line' })
    expect(low.lodLine).not.toBeNull()
    expect(low.lodLine!.trim().length).toBeGreaterThan(0)
    expect(fullText).toContain(low.lodLine!)
  })
})

/**
 * ⚠⚠ THIS BLOCK WAS NAMED "the repair the copy promises actually answers"
 * UNTIL #1172 ROUND 3. It never checked that, and could not: it contains the
 * select-and-raise route test and its control, which prove the chip RAISES the
 * inspector and nothing about what the inspector can then do. The name claimed
 * more than anything under it asserted — and the thing it claimed is false
 * (`goalChipPromiseVsDestination.spec.tsx`). Renamed to what it measures.
 */
describe('the chip raises this goal’s inspector — the route, not the repair', () => {
  it('⭐ clicking the chip selects the goal and raises its inspector', () => {
    const raised = vi.fn()
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, raised)
    try {
      const { chip } = renderGoal()
      fireEvent.click(chip!)
      // Bound by identity: the node this chip belongs to, not "some node".
      expect(selectNodeWithoutHistory).toHaveBeenCalledWith(GOAL_ID)
      expect(raised).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, raised)
    }
  })

  it('CONTROL — the listener is not fired by rendering alone, so the assertion above is about the click', () => {
    const raised = vi.fn()
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, raised)
    try {
      renderGoal()
      expect(raised).not.toHaveBeenCalled()
      expect(selectNodeWithoutHistory).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, raised)
    }
  })
})
