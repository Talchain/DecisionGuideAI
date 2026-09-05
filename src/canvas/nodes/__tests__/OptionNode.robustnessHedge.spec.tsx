/**
 * THE CANVAS HEDGES THE CLAIM THE PROSE HEDGES — the founder's payload.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM, MEASURED (deployed UI `a9c2e050`, founder session 5 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * One payload carried `robustness.aggregate_level: "very_low"` AND
 * `leader_claim.permitted: true`. The chat said *"treat this as provisional…
 * not yet robust — small changes could flip it."* The option card, inches away
 * and reading the same run, wore a `Leading option` crown over a bare
 * `Ahead 53%` bar and said nothing about robustness.
 *
 * ⭐ THE INVARIANT THIS SUITE PINS, IN BOTH DIRECTIONS:
 *   fragile run + permitted crown  ⇒ crown STILL renders, AND a grade beside it
 *   robust  run + permitted crown  ⇒ crown renders, and NO grade
 * The second is the opposite-direction twin and it is the load-bearing half. A
 * suppression-only corpus cannot see a fix that closes the lie by silencing the
 * truth, and silencing is the worse defect — `src/lib/decisionVerdict.ts` owns
 * axis 1 and forbids denying a lead because it is fragile.
 *
 * ⭐ AND THE THIRD DIRECTION: the disclosure may never appear WITHOUT the claim.
 * A withheld crown on a fragile run must show neither.
 *
 * Binds by IDENTITY (`leading-option-robustness-${id}`), never "some element
 * reading 'Highly sensitive'" — CLAUDE.md trap 19.
 *
 * ⚠ WHAT IT DOES NOT CLAIM (trap 3). jsdom performs no layout. These are
 * assertions about what is MOUNTED, never about pixels or visibility.
 *
 * ⚠ THE HOOK IS NOT MOCKED — the store is driven and `useNodeDisplayMetadata`
 * derives from it, so the fixture cannot hand the card a state the real
 * producer chain cannot reach (trap 16-inverse). Store shape mirrors
 * `OptionNode.withheldLeaderClaim.spec.tsx`'s, deliberately.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

import { useCanvasStore } from '../../store'

const NODE_ID = 'option-1'
const SIBLING_ID = 'option-2'

const PILL = `leading-option-pill-${NODE_ID}`
const GRADE = `leading-option-robustness-${NODE_ID}`

/**
 * A report that permits the crown on NODE_ID, with the run's robustness block
 * supplied by the caller. Separating the two makes every case below a
 * one-variable change on a constant leader claim.
 */
function reportWithRobustness(robustness: Record<string, unknown>) {
  return {
    option_probabilities: {
      [NODE_ID]: { win_probability: 0.53 },
      [SIBLING_ID]: { win_probability: 0.21 },
    },
    robustness: {
      recommended_option_id: NODE_ID,
      near_tie: { is_tie: false, top_option_id: NODE_ID },
      ...robustness,
    },
  }
}

const makeStoreState = (report: unknown) => ({
  hoveredOptionId: null,
  nodes: [
    { id: NODE_ID, type: 'option', data: { type: 'option' } },
    { id: SIBLING_ID, type: 'option', data: { type: 'option' } },
  ],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'complete', report },
  highlightedNodes: new Set<string>(),
  dimmedNodeIds: new Set<string>(),
  optionNumbering: { [NODE_ID]: 1, [SIBLING_ID]: 2 },
  editedSinceRunNodeIds: new Set<string>(),
  olumiAttention: { nodeIds: [] as string[] },
  analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
  lens: { _dimmedNodeIds: new Set<string>(), _hiddenNodeIds: new Set<string>(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  lodRung: 'full',
  viewMode: 'expert',
  setHoveredOption: vi.fn(),
  selectNodeWithoutHistory: vi.fn(),
})

const baseProps = {
  id: NODE_ID,
  type: 'option',
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

function renderOption(report: unknown) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState(report)),
  )
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire a Tech Lead', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OptionNode — the run\'s robustness travels with the leader claim', () => {
  it('PRECONDITION: the fixture actually crowns this card, so every case below is about the GRADE', () => {
    // Pins the suite's own precondition in-test. Without this, a fixture that
    // silently stopped crowning would make every "no grade" assertion below
    // pass for the wrong reason — a tautology with no red anywhere (trap 13b).
    renderOption(reportWithRobustness({ level: 'high' }))
    expect(screen.getByTestId(PILL)).toBeInTheDocument()
  })

  it('very_low: crowns the card AND discloses the grade beside it', () => {
    renderOption(reportWithRobustness({ level: 'very_low' }))
    expect(screen.getByTestId(PILL)).toBeInTheDocument()
    expect(screen.getByTestId(GRADE)).toHaveTextContent('Highly sensitive')
  })

  it('low: crowns the card AND discloses the grade beside it', () => {
    renderOption(reportWithRobustness({ level: 'low' }))
    expect(screen.getByTestId(PILL)).toBeInTheDocument()
    expect(screen.getByTestId(GRADE)).toHaveTextContent('Sensitive')
  })

  // ── THE OPPOSITE-DIRECTION TWIN ──────────────────────────────────────────
  // A robust, permitted result must still render its leader in FULL. These are
  // the cases a suppression-only fix would break, and they must stay green.
  it('TWIN — high: crowns the card and adds NO grade', () => {
    renderOption(reportWithRobustness({ level: 'high' }))
    expect(screen.getByTestId(PILL)).toBeInTheDocument()
    expect(screen.queryByTestId(GRADE)).toBeNull()
  })

  it('TWIN — moderate: crowns the card and adds NO grade', () => {
    renderOption(reportWithRobustness({ level: 'moderate' }))
    expect(screen.getByTestId(PILL)).toBeInTheDocument()
    expect(screen.queryByTestId(GRADE)).toBeNull()
  })

  it('TWIN — the win probability is never suppressed on a fragile run', () => {
    // ⚠ BOUND BY IDENTITY, and the first cut of this test was not: `getByText(/53%/)`
    // matched several elements and threw. A value predicate another element can
    // satisfy is trap 19, in the suite whose own header warns about it.
    renderOption(reportWithRobustness({ level: 'very_low' }))
    expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent('53%')
  })

  // ── FAIL-CLOSED ON ABSENCE ───────────────────────────────────────────────
  it('legacy producer sending no robustness grade: crown unchanged, no invented caveat', () => {
    renderOption(reportWithRobustness({}))
    expect(screen.getByTestId(PILL)).toBeInTheDocument()
    expect(screen.queryByTestId(GRADE)).toBeNull()
  })

  it('an unrecognised level string is not re-derived into a grade', () => {
    renderOption(reportWithRobustness({ level: 'catastrophic', recommendation_stability: 0.1 }))
    expect(screen.queryByTestId(GRADE)).toBeNull()
  })

  it('numeric stability stands in when the producer omits the level', () => {
    renderOption(reportWithRobustness({ recommendation_stability: 0.2 }))
    expect(screen.getByTestId(GRADE)).toBeInTheDocument()
  })

  it('TWIN — numeric stability that is HIGH yields no grade', () => {
    renderOption(reportWithRobustness({ recommendation_stability: 0.95 }))
    expect(screen.queryByTestId(GRADE)).toBeNull()
  })

  // ── THE DISCLOSURE MAY NEVER APPEAR WITHOUT THE CLAIM ────────────────────
  it('withheld crown on a fragile run shows NEITHER the crown nor the grade', () => {
    const withheld = {
      ...reportWithRobustness({ level: 'very_low' }),
      producer_leader_permission: { permitted: false, withheld_reason: 'separation_unavailable' },
    }
    renderOption(withheld)
    expect(screen.queryByTestId(PILL)).toBeNull()
    expect(screen.queryByTestId(GRADE)).toBeNull()
  })
})
