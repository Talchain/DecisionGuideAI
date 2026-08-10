/**
 * RESIDUAL COMPARATIVE SURFACES — the canvas OptionNode (ROADMAP 1.239).
 *
 * The post-arc render probe (UI ae77248a / CEE e679eb6) confirmed the nine
 * enumerated leader surfaces now pass both directions, and then found what was
 * left. Two of them live here:
 *
 *   · "Behind: <reason>"                    — 30 occurrences on a WITHHELD run
 *                                             against 20 on a permitted one.
 *   · "Close call: within N percentage points"
 *
 * A1's ruling is why they are in scope for gate G-CEE-1: a comparative
 * designation on a withheld turn is a leader claim in INVERSE form. Saying two
 * of three options are "Behind" designates the third as ahead by elimination,
 * and "within N points of the leader" measures a distance to a leader the
 * producer declined to name.
 *
 * The 30-vs-20 ratio is the diagnosis, not a detail. `isRecommended` is now
 * `verdict.hasLeadingOption && verdict.leaderId === id`, so on a withheld turn
 * NO option is the leader — and the "Behind:" line, gated only on
 * `!isRecommended`, therefore rendered on EVERY option including the
 * front-runner. 3 options x 10 screens = 30; 2 non-leaders x 10 = 20. The
 * withheld run did not merely leak the claim, it made the canvas incoherent:
 * everything behind, nothing ahead.
 *
 * Every withheld case below has a PERMITTED twin. Over-suppression is an equal
 * failure — an earlier lane in this arc introduced a single-option regression
 * doing exactly that.
 *
 * CLAUDE.md trap 3: these assert presence/absence of TEXT. jsdom cannot prove
 * visibility and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import {
  LEADER_ID,
  RUNNER_UP_ID,
  PERMITTED_REPORT,
  WITHHELD_REPORT,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const BASELINE_ID = 'opt_status_quo'

/**
 * The canvas graph behind the shared wire fixture. The third option is flagged
 * `is_baseline` so its "Behind:" reason ("no changes from current state")
 * DIFFERS from the runner-up's ("fewer key changes") — otherwise the
 * identical-reason suppression (audit section 8 P1) hides the line on both and
 * the absence assertion would pass for the wrong reason (trap 13).
 */
const OPTION_NODES = [
  { id: LEADER_ID, type: 'option', data: { type: 'option', label: 'Standardise on MacBook Pro' } },
  { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: 'Standardise on Dell XPS' } },
  { id: BASELINE_ID, type: 'option', data: { type: 'option', label: 'Status Quo', is_baseline: true } },
]

const makeStoreState = (report: unknown, nodes: unknown[] = OPTION_NODES) => ({
  hoveredOptionId: null,
  nodes,
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'complete', report },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'expert',
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

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

function renderNode(id: string, label: string) {
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseProps as any)} id={id} data={{ label, type: 'option' }} />
    </ReactFlowProvider>,
  )
}

function withStore(report: unknown, nodes: unknown[] = OPTION_NODES) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState(report, nodes) as never),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.314))
})

describe('OptionNode — "Behind: <reason>" (ROADMAP 1.239 residual 1)', () => {
  it('WITHHELD: the runner-up carries no "Behind:" line', () => {
    withStore(WITHHELD_REPORT)
    renderNode(RUNNER_UP_ID, 'Standardise on Dell XPS')
    expect(screen.queryByText(/Behind:/)).toBeNull()
  })

  it('WITHHELD: the FRONT-RUNNER carries none either — the 30-vs-20 half of the defect', () => {
    // With no entitled leader, `isRecommended` is false for the front-runner
    // too, so the line rendered on the very option the numbers put on top.
    //
    // The graph is trimmed to leader + baseline on purpose. With the runner-up
    // present the front-runner's reason ("fewer key changes") duplicates the
    // runner-up's and the identical-reason rule hides it anyway — so the
    // assertion would pass BEFORE the fix, pinning nothing (trap 13 in its
    // subtler form: a test that cannot fail). Against the baseline, whose
    // reason is "no changes from current state", the reasons differ and the
    // line genuinely renders today.
    withStore(WITHHELD_REPORT, [OPTION_NODES[0], OPTION_NODES[2]])
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.66))
    renderNode(LEADER_ID, 'Standardise on MacBook Pro')
    expect(screen.queryByText(/Behind:/)).toBeNull()
  })

  it('WITHHELD: the node still renders — the absence assertions are not vacuous', () => {
    // Trap 13 positive control: an absence test must first prove it can see a
    // presence. If OptionNode threw or rendered nothing, every queryByText
    // above would pass by testing nothing.
    withStore(WITHHELD_REPORT)
    renderNode(RUNNER_UP_ID, 'Standardise on Dell XPS')
    expect(screen.getByText('Standardise on Dell XPS')).toBeDefined()
  })

  it('PERMITTED: the runner-up keeps its "Behind:" reason (over-suppression control)', () => {
    withStore(PERMITTED_REPORT)
    renderNode(RUNNER_UP_ID, 'Standardise on Dell XPS')
    expect(screen.getByText(/Behind: fewer key changes/)).toBeDefined()
  })
})

// ── "Close call: within N percentage points" ────────────────────────────────
//
// NOT in the dispatched enumeration. Found in the same memo family while
// verifying residual 1 at the bytes, and reported as an addition rather than
// folded in silently. It is the same defect in the same file: the line
// measures a distance to `verdict.leaderId`, which still flows on a withheld
// turn BY DESIGN (identity survives; only the entitlement is withheld — see
// decisionVerdict.ts). The probe scored it silent only because that run's gap
// was 0.346, far outside the 5pp window — empirically silent, never gated. A
// withheld run with a close race fires it.

const closeCallProbabilities = {
  [LEADER_ID]: { win_probability: 0.5 },
  [RUNNER_UP_ID]: { win_probability: 0.47 },
}

const CLOSE_CALL_WITHHELD = {
  option_probabilities: closeCallProbabilities,
  robustness: { recommended_option_id: LEADER_ID },
}

const CLOSE_CALL_PERMITTED = {
  option_probabilities: closeCallProbabilities,
  robustness: {
    recommended_option_id: LEADER_ID,
    // PLoT's own answer to "is there a clear leader?". `is_tie: false` on a
    // 3pp gap is the producer overriding its own threshold — which is exactly
    // the case that must keep rendering, because the claim is OWNED.
    near_tie: { is_tie: false, top_option_id: LEADER_ID },
  },
}

const CLOSE_CALL_NODES = OPTION_NODES.slice(0, 2)

describe('OptionNode — the close-call marker (was "Close call: within N percentage points"; the quantity retired 2026-08-10, the signal kept)', () => {
  beforeEach(() => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.47))
  })

  it('WITHHELD: no distance-to-the-leader line', () => {
    withStore(CLOSE_CALL_WITHHELD, CLOSE_CALL_NODES)
    renderNode(RUNNER_UP_ID, 'Standardise on Dell XPS')
    // Bound to the marker that actually renders: /Close call: within/ stops
    // matching once the colon-and-number form is retired, so it would pass by
    // testing nothing.
    expect(screen.queryByText(/Close call/i)).toBeNull()
  })

  it('PERMITTED: the line renders (over-suppression control)', () => {
    withStore(CLOSE_CALL_PERMITTED, CLOSE_CALL_NODES)
    renderNode(RUNNER_UP_ID, 'Standardise on Dell XPS')
    // ⭐ SUPERSEDED 2026-08-10: was 'Close call: within 3 percentage points'.
    // The withheld-turn ENTITLEMENT this describe block exists to pin is
    // unchanged; only the quantity has gone. The percentage-point gap between
    // two win frequencies is retired from every user-facing surface.
    expect(screen.getByText('Close call with the leading option')).toBeDefined()
    expect(screen.queryByText(/percentage point/i)).toBeNull()
  })
})
