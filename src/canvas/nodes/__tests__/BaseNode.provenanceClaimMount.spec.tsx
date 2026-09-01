/**
 * ⭐ THE CANVAS OBEYS THE CLAIM AXIS — because a correct predicate nothing calls
 * is this estate's signature defect.
 *
 * `domain/__tests__/nodeProvenanceClaim.spec.ts` proves the RULE. This proves
 * the CARD obeys it, by rendering the real node components and asking what is on
 * the card — not by reading the source and agreeing with it.
 *
 * ⚠ THE DEFECTS IT PINS, measured on deployed staging and not on a fixture:
 *   · on `be33648b` the GOAL card carried "From brief" (this mark) 18px above
 *     "From your brief" (`GOAL_LABEL_FROM_BRIEF_COPY`) — ONE wire literal in two
 *     spellings, which a reader cannot tell is one fact;
 *   · every non-factor card read the value vocabulary ("AI estimate") about a
 *     number that does not exist on it — 21 of 25 captured non-factor nodes
 *     carry no value key at all.
 *
 * ⛔ BOTH DIRECTIONS, EVERY TIME. A change that suppressed the mark everywhere,
 * or made every card structural, would satisfy the goal and option cases here
 * while deleting the signal the founder specifically valued. The factor cases
 * are load-bearing, not decoration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { GoalNode } from '../GoalNode'
import { DecisionNode } from '../DecisionNode'
import { VALUE_PROVENANCE_LABEL } from '../../domain/valueProvenance'
import { STRUCTURAL_PROVENANCE_LABEL } from '../../domain/nodeProvenanceClaim'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  GOAL_LABEL_FROM_BRIEF_TESTID,
} from '../../domain/goalLabelProvenance'

/* ReactFlow's NodeProps requires a dozen fields no assertion here reads; the
   casts below are the sibling node specs' own pattern. */
const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function mockStore(over: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
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
      ...over,
    } as never),
  )
}

/**
 * ⚠ BOUND BY IDENTITY — the node id, never a value predicate another node could
 * satisfy. Each case renders exactly one card, so the mark found is that card's.
 */
function renderNode(
  Comp: (p: any) => any,
  type: string,
  id: string,
  data: Record<string, unknown>,
) {
  mockStore({ nodes: [{ id, type, data }] })
  return render(
    <ReactFlowProvider>
      <Comp {...(baseProps as any)} type={type} id={id} data={data as any} />
    </ReactFlowProvider>,
  )
}

const mark = () => screen.queryByTestId('node-provenance-mark')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('⛔ a card with no number does not claim one — but it still speaks', () => {
  it('OPTION — the mark is present, and it makes the STRUCTURAL claim', () => {
    renderNode(OptionNode, 'option', 'opt_rebuild', {
      label: 'Rebuild',
      type: 'option',
      provenance: 'ai_inferred',
    })
    const el = mark()
    expect(el).not.toBeNull()
    expect(el!.getAttribute('data-provenance-claim')).toBe('structural')
    expect(el!.getAttribute('aria-label')).toBe(STRUCTURAL_PROVENANCE_LABEL.ai)
    // The founder's question — "did Olumi suggest this option?" — is answered.
    expect(el!.getAttribute('aria-label')).not.toContain('estimate')
  })

  it('DECISION — present and structural, not silent and not "AI estimate"', () => {
    renderNode(DecisionNode, 'decision', 'dec_1', {
      label: 'Which direction?',
      type: 'decision',
      provenance: 'ai_inferred',
    })
    expect(mark()).not.toBeNull()
    expect(mark()!.getAttribute('aria-label')).toBe(STRUCTURAL_PROVENANCE_LABEL.ai)
    expect(mark()!.getAttribute('aria-label')).not.toBe(VALUE_PROVENANCE_LABEL.ai)
  })

  it('FACTOR with NO observed value — structural, by the same rule', () => {
    renderNode(FactorNode, 'factor', 'fac_1', {
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      provenance: 'ai_inferred',
    })
    expect(mark()!.getAttribute('data-provenance-claim')).toBe('structural')
  })
})

describe('⛔ THE TWIN — a valued card still makes the value claim on screen', () => {
  it('FACTOR with an observed value — the VALUE claim reaches the card', () => {
    renderNode(FactorNode, 'factor', 'fac_valued', {
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      provenance: 'ai_inferred',
      observedState: { value: 0.7, source: 'cee_inference' },
    })
    const el = mark()
    expect(el).not.toBeNull()
    expect(el!.getAttribute('data-provenance-claim')).toBe('value')
    expect(el!.getAttribute('aria-label')).toBe(VALUE_PROVENANCE_LABEL.ai)
  })

  it('and a human-owned valued factor says so in the value vocabulary', () => {
    renderNode(FactorNode, 'factor', 'fac_human', {
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      provenance: 'user_set',
      observedState: { value: 0.7, source: 'user_override' },
    })
    expect(mark()!.getAttribute('aria-label')).toBe(VALUE_PROVENANCE_LABEL.human)
  })
})

describe('the GOAL states its provenance ONCE', () => {
  /**
   * The duplication measured on `be33648b`. The goal card owns a correctly
   * scoped surface for this exact literal; the mark rendering it again, in a
   * second spelling, 18px away, is the defect.
   */
  it('no provenance mark on the goal card', () => {
    renderNode(GoalNode, 'goal', 'goal_1', {
      label: 'Grow revenue',
      type: 'goal',
      provenance: 'from_brief',
    })
    expect(mark()).toBeNull()
  })

  it('and the fact itself is NOT lost — it is stated once, not zero times', () => {
    // ⚠ THE PRECONDITION FOR THE SUPPRESSION, PINNED IN-TEST. Without this the
    // assertion above would be satisfied by a change that simply deleted the
    // goal's provenance from the product entirely — a removal masquerading as a
    // de-duplication.
    renderNode(GoalNode, 'goal', 'goal_1', {
      label: 'Grow revenue',
      type: 'goal',
      provenance: 'from_brief',
    })
    // Bound by the goal surface's OWN testid, never by a text predicate the
    // suppressed mark could also have satisfied.
    const own = screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)
    expect(own.textContent).toContain(GOAL_LABEL_FROM_BRIEF_COPY.pill)
    // Stated exactly once: the goal's own surface, and no second spelling.
    expect(mark()).toBeNull()
  })
})
