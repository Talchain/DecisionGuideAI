/**
 * THE CANVAS CARD CARRIES NEITHER THE LEADER CLAIM NOR ITS ROBUSTNESS GRADE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SUITE USED TO PIN, AND WHY IT NOW PINS THE OPPOSITE
 * ═══════════════════════════════════════════════════════════════════════════
 * The founder's payload (deployed UI `a9c2e050`, 5 Sep 2026) carried
 * `robustness.aggregate_level: "very_low"` AND a permitted leader claim; the
 * card wore a crown with no caveat while the prose hedged. The fix of the day
 * put a robustness grade (`leading-option-robustness-${id}`, e.g. "Highly
 * sensitive") beside the "Most supported" pill, gated on the same claim.
 *
 * ⭐ ED #63 5799353114 DECISION 1 (23 Sep 2026): "Drop 'Most supported'. It
 * reads as a recommendation." — and decision 5: "No new recommendation
 * language, warning styling or invented science semantics." With the claim
 * gone, the grade that qualified it has nothing to qualify and goes with it;
 * the panel owns the comparative claim and its robustness caveat.
 *
 * ⭐ THE INVARIANT NOW, exercised in the STRONGEST case (permitted claim, this
 * card IS the leader, `very_low` grade) and across every level the old suite
 * drove, so no input that used to produce a pill or a grade produces one now:
 *   any run  ⇒  no pill, no grade, no "Most supported" — AND the card's own
 *               model-relative result row is still there (contrast control).
 *
 * ⭐ THE DATA IS NOT THE CLAIM. The win share is still printed on a fragile run
 * — that half of the old suite is kept verbatim.
 *
 * Binds by IDENTITY (`leading-option-pill-${id}`, `leading-option-robustness-
 * ${id}`), plus the text a user would read — CLAUDE.md trap 19.
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

/**
 * ED #63 5799353114 decision 1 — absence of the claim AND of its qualifier,
 * each read from the SAME render as a contrast control that is present: the
 * card's label and its "N% of runs" result row. A blank render cannot pass.
 */
function expectNoClaimNoGrade(container: HTMLElement) {
  // CONTRAST CONTROL FIRST.
  expect(screen.getByText('Hire a Tech Lead')).toBeInTheDocument()
  expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent('53% of runs')
  // The claim.
  expect(screen.queryByTestId(PILL)).toBeNull()
  expect(screen.queryByText(/most supported/i)).toBeNull()
  // The qualifier — by identity, by visible text, and by accessible name (the
  // grade was a `role="img"` carrying its sentence in `aria-label`).
  expect(screen.queryByTestId(GRADE)).toBeNull()
  expect(screen.queryByText(/highly sensitive/i)).toBeNull()
  expect(screen.queryByRole('img', { name: /sensitive|small changes could flip it/i })).toBeNull()
  const text = container.textContent ?? ''
  expect(text).not.toMatch(/most supported/i)
  expect(text).not.toMatch(/highly sensitive/i)
}

describe('OptionNode — no leader pill and no robustness grade on the card (ED #63 5799353114 decision 1)', () => {
  it('⭐ STRONGEST CASE — permitted claim, this card leads, `very_low`: no pill, no grade', () => {
    // Exactly the payload that used to produce BOTH (the founder's run).
    const { container } = renderOption(reportWithRobustness({ level: 'very_low' }))
    expectNoClaimNoGrade(container)
  })

  // Every input the old suite drove — the two hedged levels that produced a
  // grade, the two robust twins that produced a bare pill, and the fail-closed
  // shapes — now produces neither, so no single level can bring the pill back.
  it.each([
    ['low', { level: 'low' }],
    ['moderate', { level: 'moderate' }],
    ['high', { level: 'high' }],
    ['legacy producer sending no robustness grade', {}],
    ['an unrecognised level string', { level: 'catastrophic', recommendation_stability: 0.1 }],
    ['no `level`, only a fragile-looking recommendation_stability', { recommendation_stability: 0.05 }],
    ['no `level`, only a high recommendation_stability', { recommendation_stability: 0.95 }],
  ])('%s: no pill, no grade', (_name, robustness) => {
    const { container } = renderOption(reportWithRobustness(robustness))
    expectNoClaimNoGrade(container)
  })

  it('TWIN — the win probability is never suppressed on a fragile run', () => {
    // ⚠ BOUND BY IDENTITY, and the first cut of this test was not: `getByText(/53%/)`
    // matched several elements and threw. A value predicate another element can
    // satisfy is trap 19, in the suite whose own header warns about it.
    renderOption(reportWithRobustness({ level: 'very_low' }))
    expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent('53%')
  })

  it('withheld crown on a fragile run: still neither', () => {
    const withheld = {
      ...reportWithRobustness({ level: 'very_low' }),
      producer_leader_permission: { permitted: false, withheld_reason: 'separation_unavailable' },
    }
    const { container } = renderOption(withheld)
    expectNoClaimNoGrade(container)
  })
})
