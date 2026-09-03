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
 * ── AND THE SECOND HALF: A CHIP THAT NAMES A GAP MUST NAME THE REPAIR ──────
 * The visible text carries the route (`— add one`) rather than parking it in a
 * `title`, because a `title` is unreachable by keyboard and absent on touch —
 * the same rule `NodeMetricRow`'s header applies to its captions.
 *
 * ⚠ THE ROUTE ITSELF ALREADY EXISTED AND IS PINNED HERE RATHER THAN ADDED.
 * The chip has always called `openNodeInspector(id)`, and the inspector's goal
 * panel renders `GoalThresholdEditor` on exactly the null-target branch this
 * chip fires on (`GoalPanel.tsx:351-381`, read at the bytes). So the claim the
 * new copy makes — that there is somewhere to go — is a claim about behaviour,
 * and behaviour is what the last block asserts. Copy that promises an
 * affordance is only honest while the affordance answers.
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
  GOAL_NO_TARGET_REPAIR,
  GOAL_NO_TARGET_CHIP,
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

  it('⭐ the visible chip text names the state AND the repair', () => {
    const { chip } = renderGoal()
    // IDENTITY, not a value predicate another element could satisfy: the chip
    // is found by its testid and its whole text is asserted.
    expect(chip!.textContent).toBe(GOAL_NO_TARGET_CHIP)
    expect(GOAL_NO_TARGET_CHIP).toContain(GOAL_NO_TARGET_STATE)
    expect(GOAL_NO_TARGET_CHIP).toContain(GOAL_NO_TARGET_REPAIR)
  })

  it('⭐ THE COPY PIN, ONCE — the constants are what the card ships, in British English', () => {
    // The single literal in this file. Everything else binds to the constants,
    // so a wording change edits exactly one line here and nothing drifts.
    expect(GOAL_NO_TARGET_STATE).toBe('Target not captured')
    expect(GOAL_NO_TARGET_REPAIR).toBe('add one')
    expect(GOAL_NO_TARGET_CHIP).toBe('Target not captured — add one')
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

  it('⛔ every channel names the repair route, including the two the sighted-hover path does not reach', () => {
    // A screen-reader user gets the aria-label and nothing else; a touch user
    // never sees the title. Parking the route in `title` alone would leave both
    // with a confession and no way out.
    const { chip } = renderGoal()
    const channels = channelsOf(chip!)
    expect(channels.visible).toContain(GOAL_NO_TARGET_REPAIR)
    expect(channels['aria-label']).toMatch(/add one/i)
    expect(channels.title).toMatch(/add one/i)
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
    // The reduced line is CSS-truncated with an ellipsis (`BaseNode.tsx:1052`),
    // so the repair clause would be cut mid-word at that size. The STATE is the
    // half that survives, and it comes from the same constant the chip renders
    // — never a second hand-written copy (this file's own reason to exist is
    // that the last such copy dropped a colon).
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

describe('the repair the copy promises actually answers', () => {
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
