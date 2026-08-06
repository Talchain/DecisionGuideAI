/**
 * OptionNode — SYSTEM-VERDICT language pin for the leader chip (ROADMAP 2.724).
 *
 * ── WHAT THIS PROTECTS ────────────────────────────────────────────────────
 * Paul's ratified doctrine: the product recommends what to INVESTIGATE, never
 * what to CHOOSE. Rankings by measured goal-fit are ANALYSIS and stay; a
 * SYSTEM VERDICT ("the best choice", "recommended", "the winner") does not.
 *
 * The chip pinned here was the sharpest instance in the estate, because it did
 * not merely SHOW a verdict — it composed one INTO THE USER'S OWN TRANSCRIPT.
 * Clicking "What would change this?" on the leading option sent:
 *
 *     "What would need to change for {label} to no longer be the best choice?"
 *
 * The user never wrote that. The system put a crowning claim in their mouth and
 * then answered it, which is the presupposition class ROADMAP 1.223 purged from
 * `winnerChipCopy.ts`. The replacement is CONTRASTIVE — it asks about the
 * alternative rather than asserting anything about the leader — and it loses no
 * information: the `what_would_flip` intent, the flip semantics, and the option
 * identity all survive.
 *
 * ── WHY THIS SURFACE, AND HOW THE BINDING IS PROVED (trap 3b) ─────────────
 * This estate has twice shipped copy DARK by pinning it to a component the
 * deployed flags do not mount. So the mount path is asserted, not assumed:
 *
 *   1. `nodeTypes.option === OptionNode` is asserted IN-TEST against the real
 *      `../registry`, which `src/canvas/ReactFlowGraph.tsx:21` imports. If the
 *      registry ever re-points `option` at another component, this pin fails
 *      LOUD rather than passing against a component nobody renders.
 *   2. Derived from the SERVED BUNDLE, not from imports: the deployed staging
 *      build at tip `a81121d1` (`/version.json` commit ==
 *      `a81121d1c401a8d51bc4c32e53d1d0e63a7640a3`) carries this chip in
 *      `assets/ReactFlowGraph-IP33MDVH.js`, byte-context:
 *        `chipId:"option_what_would_change",actionType:"what_would_flip",
 *         label:"What would change this?",message:\`What would need to change
 *         for ${'${t}'} to no longer be the best choice?\``
 *      i.e. the string the doctrine bans was executing in front of users.
 *
 * ── WHY THE ASSERTION BINDS BY IDENTITY (trap 19) ────────────────────────
 * The label "What would change this?" is NOT unique — the non-leader close-call
 * branch (`option_what_would_change_close_call`) uses the identical label with a
 * different message. Binding on label text alone would let this pin pass on the
 * wrong chip. Every assertion here therefore keys on the dispatched
 * `parameters.chip_id`, which is the chip's stable wire identity, and the
 * discrimination test below proves the pin can tell the two apart.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { nodeTypes } from '../registry'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../../adapters/plot/constraintTrust', () => ({
  PLOT_JOINT_HEADLINE_SUSPECT: true,
  PLOT_PER_OPTION_CONSTRAINTS_SUSPECT: true,
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

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

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useGuidanceStore } from '../../stores/guidanceStore'

const baseProps = {
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const OPTION_LABEL = 'Hire 3 engineers'

/** `near_tie.top_option_id` is the producer's own leader claim (see OptionNode.spec.tsx). */
const producerLeaderClaim = (winArgmaxOptionId: string) => ({
  near_tie: { is_tie: false, top_option_id: winArgmaxOptionId },
})

const REPORT = {
  option_probabilities: {
    'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
    'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.7 },
  },
  robustness: producerLeaderClaim('option-1'),
}

const NODES = [
  { id: 'option-1', type: 'option', data: { type: 'option' } },
  { id: 'option-2', type: 'option', data: { type: 'option' } },
]

/** Renders one option node post-analysis with the producer naming option-1 as leader. */
function renderPostAnalysisOption(nodeId: string, winRate: number) {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate,
    isResultsMode: true,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  } as never)
  vi.mocked(useCanvasStore).mockImplementation(((selector: (s: unknown) => unknown) =>
    selector(makeStoreState({
      results: { status: 'complete', report: REPORT },
      nodes: NODES,
    }))) as never)
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id={nodeId} data={{ label: OPTION_LABEL, type: 'option' }} />
    </ReactFlowProvider>
  )
}

type Dispatched = { parameters?: Record<string, unknown>; label: string; message: string }

/**
 * Clicks every chip carrying `label` and returns the dispatched payloads keyed
 * by chip_id. Returning the whole map (rather than one message) is what lets the
 * discrimination test below assert on the OTHER chip without a second harness.
 */
function clickChipsAndCollect(label: string): Record<string, Dispatched> {
  const seen: Record<string, Dispatched> = {}
  useGuidanceStore.setState({
    _dispatchAction: (opts: Dispatched) => {
      const id = String(opts.parameters?.chip_id ?? '<no-chip-id>')
      seen[id] = opts
    },
  } as never)
  const buttons = screen.getAllByRole('button', { name: label })
  buttons.forEach((b) => fireEvent.click(b))
  return seen
}

describe('OptionNode leader chip — no SYSTEM VERDICT in the user\'s transcript (ROADMAP 2.724)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null } as never)
  })

  // MOUNT-PATH ASSERTION (trap 3b). Not a formality: it is the only thing in
  // this file that fails when the surface under test stops being the surface
  // the app renders.
  it('is the component the canvas node registry mounts for type "option"', () => {
    expect(nodeTypes.option).toBe(OptionNode)
  })

  it('composes a CONTRASTIVE flip question, presupposing no verdict about the leader', () => {
    renderPostAnalysisOption('option-1', 0.72)
    const dispatched = clickChipsAndCollect('What would change this?')

    // Precondition pin (trap 13b third face): the fixture must actually have
    // reproduced the leader branch. Without this, the copy assertion below could
    // pass by never having rendered the chip at all.
    expect(Object.keys(dispatched)).toContain('option_what_would_change')

    const chip = dispatched['option_what_would_change']
    expect(chip.message).toBe(
      `What would need to change for another option to lead instead of ${OPTION_LABEL}?`
    )
  })

  it('never sends a crowning verdict — "best choice"/"best option" cannot reach the transcript', () => {
    renderPostAnalysisOption('option-1', 0.72)
    const dispatched = clickChipsAndCollect('What would change this?')

    expect(Object.keys(dispatched)).toContain('option_what_would_change')
    const chip = dispatched['option_what_would_change']
    // The banned register, on the message the USER is shown as having sent.
    expect(chip.message).not.toMatch(/best (choice|option|bet|pick)/i)
    expect(chip.message).not.toMatch(/\brecommend/i)
    expect(chip.message).not.toMatch(/\bwinner\b/i)
  })

  /**
   * DISCRIMINATING PAIR (trap 19). The leader chip and the close-call chip share
   * the label "What would change this?". This test renders the NON-leader and
   * proves the harness resolves a DIFFERENT chip_id with a DIFFERENT message —
   * so a green result above cannot have come from the wrong object.
   */
  it('binds to the leader chip by identity, not by its label (the close-call chip shares it)', () => {
    renderPostAnalysisOption('option-2', 0.7)
    const dispatched = clickChipsAndCollect('What would change this?')

    expect(Object.keys(dispatched)).toContain('option_what_would_change_close_call')
    expect(Object.keys(dispatched)).not.toContain('option_what_would_change')
    // The close-call copy was already doctrine-clean and is deliberately untouched.
    expect(dispatched['option_what_would_change_close_call'].message).toBe(
      `What would need to change for ${OPTION_LABEL} to become the leader?`
    )
  })
})
