/**
 * THE CANVAS ASKS *WHETHER ANYONE LEADS* AND NEVER *WHETHER IT MAY SAY SO*.
 *
 * ## The two questions, and which one the canvas was missing
 *
 * `useAnalysisReady.ts` states the contract this file pins, and states it as
 * TWO questions that are conjoined at the point of use:
 *
 *   Q1  does the MODEL license a comparative-leader claim?  `permitted_analysis_mode`
 *       — a property of the GRAPH, decided before the run.
 *   Q2  did THIS RESULT separate the arms?                  `verdict.hasLeadingOption`
 *       — a property of the RUN.
 *
 * `useResultsSectionData` composes them (`modelLicensesComparativeClaim &&
 * resultSeparatesArms`) and publishes the answer as `leaderDesignationPermitted`,
 * which every RESULTS-PANEL designation site reads.
 *
 * THE CANVAS READS Q2 ALONE. `OptionNode`, `DecisionNode` and
 * `V5AnalysisResultBlock` each quote `deriveDecisionVerdict` — correctly, that
 * is the one module entitled to answer Q2 — and then designate a leader on the
 * strength of that answer by itself. So on a run where CEE admits the model at
 * `permitted_analysis_mode: 'exploratory'` (or refuses outright at `'none'`)
 * while the arms DID separate, the results panel withholds and the canvas puts
 * a crown on an option four inches away. That is not a hypothetical shape: it
 * is the same incoherence ROADMAP 1.223 fixed in the other direction, when the
 * canvas printed "X leads in N% of scenarios" beside CEE's own "no option can
 * be put forward yet".
 *
 * ## Why this file gates THREE readers on OptionNode and not just the crown
 *
 * ⚠ GATING `isRecommended` ALONE WOULD MAKE THE CANVAS WORSE, and the estate
 * has already measured exactly that failure. `residualComparative.optionNode.spec.tsx`
 * records it: "Behind: <reason>" is gated only on `!isRecommended`, so when no
 * option is the leader the line renders on EVERY option including the
 * front-runner — the probe measured 30 occurrences withheld against 20
 * permitted. "Everything behind, nothing ahead."
 *
 * A1's ruling, quoted there, is why the other two readers are in scope at all
 * rather than being scope creep: a comparative designation is a leader claim in
 * INVERSE form. Saying two of three options are "Behind" designates the third
 * as ahead by elimination, and "Close call: within N points of the leading
 * option" measures a distance to a leader the producer declined to name. The
 * minimum COHERENT change is therefore all three readers, not one.
 *
 * ## The three arms, and why the absent arm is not decoration
 *
 * Q1's absence arm is `true` — the producer has not spoken, so nothing changes.
 * That is what makes this consumer safe to land before any CEE half, in either
 * deploy order, and it is asserted (ARM A) rather than assumed. Q2's absence
 * arm is `false`. The two are opposite ON PURPOSE and must never be aligned:
 * two questions under one name is the defect this estate has paid for twice.
 *
 * Every withheld case has a PERMITTED twin. Over-suppression is an equal
 * failure — a lane in the 1.239 arc shipped exactly that regression — and a
 * corpus that tests one direction is a guard watching one door.
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * jsdom proves what the component EMITS: text, attributes, test ids. It applies
 * no stylesheet, so nothing here is a claim about what a user SEES. The
 * mount-path assertions are what bind these components to the surface the app
 * actually renders (trap 3b) — this estate has twice shipped a fix onto a
 * component the deployed flag posture does not mount, with every test green.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import DecisionNode from '../DecisionNode'
import { nodeTypes, rawNodeTypes } from '../registry'
import {
  LEADER_ID,
  LEADER_LABEL,
  RUNNER_UP_ID,
  RUNNER_UP_LABEL,
  PERMITTED_REPORT,
  WIN_LEADER,
  WIN_RUNNER_UP,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'
import type { AnalysisAdmissionV1 } from '../../../adapters/cee/types'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

/** Transparent popover: the real one is behind a 300ms hover delay jsdom never fires. */
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const BASELINE_ID = 'opt_status_quo'

/**
 * The third option is `is_baseline` so its "Behind:" reason ("no changes from
 * current state") DIFFERS from the runner-up's ("fewer key changes"). Without
 * that, the identical-reason suppression hides the line on both and an absence
 * assertion would pass for the wrong reason (trap 13).
 */
const OPTION_NODES = [
  { id: LEADER_ID, type: 'option', data: { type: 'option', label: LEADER_LABEL } },
  { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: RUNNER_UP_LABEL } },
  { id: BASELINE_ID, type: 'option', data: { type: 'option', label: 'Status Quo', is_baseline: true } },
]

/** Q1 REFUSED. `reasons` is non-empty by contract on a refusal. */
const ADMISSION_WITHHELD: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'none',
  reasons: [{ field: 'estimates', message: 'Every estimate here is machine-invented.' }],
}

/**
 * Q1 REFUSED, SECOND SHAPE. `exploratory` is a REFUSAL of the comparative
 * claim while still being a perfectly good run — asserted separately because a
 * predicate written as `!== 'none'` would pass every `'none'` case above and
 * still leak here. One value of an enum is not the enum.
 */
const ADMISSION_EXPLORATORY: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'exploratory',
  reasons: [{ field: 'evidence', message: 'Not enough evidence to rank these.' }],
}

/** Q1 GRANTED — the over-suppression control. */
const ADMISSION_PERMITTED: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'comparative_leader',
  reasons: [],
}

const makeStoreState = (
  admission: AnalysisAdmissionV1 | undefined,
  nodes: unknown[] = OPTION_NODES,
  report: unknown = PERMITTED_REPORT,
) => ({
  hoveredOptionId: null,
  nodes,
  edges: [],
  // ARM A is expressed by the ABSENCE of `analysis_admission`, not by a
  // sentinel — the two states cannot collapse: one is `undefined`, the other an
  // object.
  ceeAnalysisReady: admission ? { status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: admission } : null,
  results: { status: 'complete', report },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'expert',
})

function withStore(
  admission: AnalysisAdmissionV1 | undefined,
  nodes: unknown[] = OPTION_NODES,
  report: unknown = PERMITTED_REPORT,
) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState(admission, nodes, report) as never),
  )
}

const resultsMetadata = (winRate: number) =>
  ({
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
  }) as never

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

function renderOption(id: string, label: string) {
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseProps as any)} id={id} data={{ label, type: 'option' }} />
    </ReactFlowProvider>,
  )
}

function renderDecision() {
  return render(
    <ReactFlowProvider>
      <DecisionNode
        {...(baseProps as any)}
        id="decision-1"
        type="decision"
        data={{ label: 'Which laptop should we standardise on?', type: 'decision' }}
      />
    </ReactFlowProvider>,
  )
}

/** The crown, bound BY OPTION ID — never by a value another option could satisfy. */
const crownFor = (id: string) => screen.queryByTestId(`leading-option-pill-${id}`)

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(WIN_LEADER))
})

// ───────────────────────────────────────────────────────────────────────────
// MOUNT PATH (trap 3b)
// ───────────────────────────────────────────────────────────────────────────

describe('the surfaces under test are the ones the canvas actually mounts', () => {
  it('the registry mounts THESE renderers for "option" and "decision"', () => {
    // Not a formality. It is the only thing in this file that fails when the
    // component under test stops being the component the app renders — the
    // failure mode that shipped a badge fix onto an unmounted hero twice, with
    // every render test green.
    expect(rawNodeTypes.option).toBe(OptionNode)
    expect(rawNodeTypes.decision).toBe(DecisionNode)
    // And what React Flow is HANDED: the keyboard scope around that renderer,
    // identified by name, so a scope applied to a different component fails
    // here rather than passing on "something is exported for this key".
    expect((nodeTypes.option as { displayName?: string }).displayName).toBe(
      `NodeKeyboardScope(${OptionNode.displayName ?? OptionNode.name})`,
    )
    expect((nodeTypes.decision as { displayName?: string }).displayName).toBe(
      `NodeKeyboardScope(${DecisionNode.displayName ?? DecisionNode.name})`,
    )
  })
})

// ───────────────────────────────────────────────────────────────────────────
// OptionNode — the crown
// ───────────────────────────────────────────────────────────────────────────

describe('OptionNode crown — Q1 is consulted, not only Q2', () => {
  it('HARNESS PRECONDITION: Q2 is TRUE on this fixture, so every arm below isolates Q1', () => {
    // Trap 13b third face: a discriminator whose precondition nothing pins can
    // stop discriminating silently. If `PERMITTED_REPORT` ever stopped
    // separating the arms, every withheld assertion below would pass for the
    // WRONG reason — Q2 refusing rather than Q1 — and the file would read green
    // while pinning nothing about admission at all.
    withStore(undefined)
    renderOption(LEADER_ID, LEADER_LABEL)
    expect(
      crownFor(LEADER_ID),
      'the fixture must crown the leader with no admission present, or these arms measure Q2',
    ).not.toBeNull()
  })

  it('ARM A — no admission key at all: today’s behaviour, byte for byte', () => {
    // The producer has not spoken. This arm is what makes the change safe to
    // land in either deploy order, and it is asserted rather than assumed.
    withStore(undefined)
    renderOption(LEADER_ID, LEADER_LABEL)
    expect(crownFor(LEADER_ID)).not.toBeNull()
  })

  it('ARM B — permitted: the leader keeps its crown (over-suppression control)', () => {
    withStore(ADMISSION_PERMITTED)
    renderOption(LEADER_ID, LEADER_LABEL)
    expect(crownFor(LEADER_ID)).not.toBeNull()
  })

  it('⭐ ARM C — refused (`none`): the leader is NOT crowned', () => {
    withStore(ADMISSION_WITHHELD)
    renderOption(LEADER_ID, LEADER_LABEL)
    expect(
      crownFor(LEADER_ID),
      'CEE refused a comparative claim on this model and the canvas crowned an option anyway',
    ).toBeNull()
  })

  it('⭐ ARM C2 — refused (`exploratory`): the leader is NOT crowned either', () => {
    // A predicate written as `mode !== "none"` passes ARM C and leaks here.
    // One value of an enum is not the enum.
    withStore(ADMISSION_EXPLORATORY)
    renderOption(LEADER_ID, LEADER_LABEL)
    expect(crownFor(LEADER_ID)).toBeNull()
  })

  it('the node still renders on a refused run — the absence assertions are not vacuous', () => {
    // Trap 13: an absence assertion must first prove it can see a presence.
    withStore(ADMISSION_WITHHELD)
    renderOption(LEADER_ID, LEADER_LABEL)
    expect(screen.getByText(LEADER_LABEL)).toBeDefined()
  })

  it('the crown binds to the OPTION ID — a refused run crowns nobody, not just not-this-one', () => {
    // Identity, not a value predicate another option could satisfy (trap 19).
    // Rendering the runner-up proves the absence is a property of the run
    // rather than of which card happens to be on screen.
    withStore(ADMISSION_WITHHELD)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(WIN_RUNNER_UP))
    renderOption(RUNNER_UP_ID, RUNNER_UP_LABEL)
    expect(crownFor(RUNNER_UP_ID)).toBeNull()
    expect(crownFor(LEADER_ID)).toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// OptionNode — the two INVERSE-FORM designations
// ───────────────────────────────────────────────────────────────────────────

describe('OptionNode "Behind:" — a leader claim in inverse form', () => {
  it('ARM B — permitted: the runner-up keeps its reason (over-suppression control)', () => {
    withStore(ADMISSION_PERMITTED)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(WIN_RUNNER_UP))
    renderOption(RUNNER_UP_ID, RUNNER_UP_LABEL)
    expect(screen.getByText(/Behind:/)).toBeDefined()
  })

  it('⭐ ARM C — refused: the runner-up carries no "Behind:" line', () => {
    withStore(ADMISSION_WITHHELD)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(WIN_RUNNER_UP))
    renderOption(RUNNER_UP_ID, RUNNER_UP_LABEL)
    expect(screen.queryByText(/Behind:/)).toBeNull()
  })

  it('⭐ ARM C — refused: the FRONT-RUNNER carries none either (the 30-vs-20 half)', () => {
    // The failure mode gating the crown ALONE would create: with no entitled
    // leader, `isRecommended` is false for the front-runner too, so the line
    // whose only gate was `!isRecommended` renders on the very option the
    // numbers put on top. Everything behind, nothing ahead.
    //
    // Trimmed to leader + baseline on purpose: with the runner-up present the
    // front-runner's reason duplicates it and the identical-reason rule hides
    // the line anyway, so the assertion would pass before any fix.
    withStore(ADMISSION_WITHHELD, [OPTION_NODES[0], OPTION_NODES[2]])
    renderOption(LEADER_ID, LEADER_LABEL)
    expect(screen.queryByText(/Behind:/)).toBeNull()
  })
})

describe('OptionNode "Close call" — a distance to a leader nobody may name', () => {
  const CLOSE_PROBS = {
    [LEADER_ID]: { win_probability: 0.5 },
    [RUNNER_UP_ID]: { win_probability: 0.47 },
  }
  /** Q2 TRUE, a 3pp gap — inside the 5pp window, so the line genuinely fires. */
  const CLOSE_CALL_REPORT = {
    option_probabilities: CLOSE_PROBS,
    robustness: { recommended_option_id: LEADER_ID, near_tie: { is_tie: false, top_option_id: LEADER_ID } },
    decision_brief: {
      headline: `${LEADER_LABEL} currently leads.`,
      headline_banded: { band: 'clearly_ahead', leader_option_id: LEADER_ID, robustness_gated: false },
    },
  }
  const CLOSE_NODES = [OPTION_NODES[0], OPTION_NODES[1]]

  it('ARM B — permitted: the close-call line renders (over-suppression control)', () => {
    withStore(ADMISSION_PERMITTED, CLOSE_NODES, CLOSE_CALL_REPORT)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.47))
    renderOption(RUNNER_UP_ID, RUNNER_UP_LABEL)
    expect(screen.getByText(/Close call/)).toBeDefined()
  })

  it('⭐ ARM C — refused: no close-call line', () => {
    withStore(ADMISSION_WITHHELD, CLOSE_NODES, CLOSE_CALL_REPORT)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.47))
    renderOption(RUNNER_UP_ID, RUNNER_UP_LABEL)
    expect(screen.queryByText(/Close call/)).toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// DecisionNode — "X leads in N% of scenarios"
// ───────────────────────────────────────────────────────────────────────────

describe('DecisionNode headline — Q1 is consulted, not only Q2', () => {
  const leads = () => screen.queryByText(/leads in/)

  it('HARNESS PRECONDITION: Q2 is TRUE, so every arm below isolates Q1', () => {
    withStore(undefined)
    renderDecision()
    expect(
      leads(),
      'the fixture must produce a headline with no admission present, or these arms measure Q2',
    ).not.toBeNull()
  })

  it('ARM A — no admission key at all: today’s behaviour, byte for byte', () => {
    withStore(undefined)
    renderDecision()
    expect(leads()).not.toBeNull()
  })

  it('ARM B — permitted: the headline stays (over-suppression control)', () => {
    withStore(ADMISSION_PERMITTED)
    renderDecision()
    expect(leads()).not.toBeNull()
  })

  it('⭐ ARM C — refused (`none`): no "leads in N% of scenarios" sentence', () => {
    withStore(ADMISSION_WITHHELD)
    renderDecision()
    expect(
      leads(),
      'CEE refused a comparative claim and the decision node named a leader anyway',
    ).toBeNull()
  })

  it('⭐ ARM C2 — refused (`exploratory`): no sentence either', () => {
    withStore(ADMISSION_EXPLORATORY)
    renderDecision()
    expect(leads()).toBeNull()
  })

  it('⭐ ARM C — the leader METRIC ROW goes with the sentence', () => {
    // `headline` feeds three surfaces (the sentence, this row, and the
    // low-detail summary). Pinning only the sentence would leave a bar labelled
    // "ahead" carrying the withheld leader's win probability.
    withStore(ADMISSION_WITHHELD)
    renderDecision()
    expect(screen.queryByTestId('decision-leader-metric-row')).toBeNull()
  })

  it('ARM B — the leader metric row is present when permitted (not suppressed wholesale)', () => {
    withStore(ADMISSION_PERMITTED)
    renderDecision()
    expect(screen.queryByTestId('decision-leader-metric-row')).not.toBeNull()
  })

  it('the node still renders on a refused run — the absence assertions are not vacuous', () => {
    withStore(ADMISSION_WITHHELD)
    renderDecision()
    expect(screen.getByText('Which laptop should we standardise on?')).toBeDefined()
  })
})
