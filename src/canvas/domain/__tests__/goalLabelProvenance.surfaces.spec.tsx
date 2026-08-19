/**
 * The OTHER two surfaces that print the goal label: the canvas goal node and
 * the Model outline row.
 *
 * Both consume the SAME predicate and the SAME copy as the Analysis Goal field
 * (`domain/goalLabelProvenance`). This file exists to stop them drifting into
 * three different claims about one node, and every assertion binds by node ID
 * or by the shared testid — never by the label string, which is the thing under
 * change.
 *
 * Scope limit (trap 3): jsdom pins presence/absence only. Nothing here claims
 * anything about layout or visibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GOAL_LABEL_FROM_BRIEF_TESTID } from '../goalLabelProvenance'
import { toModelRows } from '../../model-tab-v2/adapters'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const GOAL_ID = 'goal_board_direction'
const FACTOR_ID = 'fac_price'

let storeState: Record<string, unknown>
vi.mock('../../store', () => {
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(storeState))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => storeState
  return { useCanvasStore }
})

const { GoalNode } = await import('../../nodes/GoalNode')

const makeStoreState = () => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  setShowInspectorPanel: vi.fn(),
})

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

/** The label is the live capture's, so the fixture is not the author's invention. */
const CAPTURED_FRAGMENT = 'We need a direction before the January board meeting'

function renderGoalNodeWith(provenance: string | undefined) {
  storeState = makeStoreState()
  return render(
    <ReactFlowProvider>
      <GoalNode
        {...baseProps}
        data={{ label: CAPTURED_FRAGMENT, type: 'goal', kind: 'goal', ...(provenance ? { provenance } : {}) }}
      />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the canvas goal node', () => {
  it('marks a brief extract', () => {
    renderGoalNodeWith('from_brief')
    expect(screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).toBeInTheDocument()
  })

  it('does NOT mark an Olumi-authored objective — the discriminating twin', () => {
    renderGoalNodeWith('ai_inferred')
    expect(screen.queryByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).not.toBeInTheDocument()
  })

  it('does NOT mark a node with no provenance stamp at all', () => {
    renderGoalNodeWith(undefined)
    expect(screen.queryByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).not.toBeInTheDocument()
  })
})

describe('the Model outline row', () => {
  const project = (goalProvenance: string) =>
    toModelRows({
      nodes: [
        { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: CAPTURED_FRAGMENT, kind: 'goal', provenance: goalProvenance } },
        { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'from_brief' } },
      ] as never,
      edges: [],
      goalThreshold: null,
    })

  it('flags the GOAL row, bound by node id', () => {
    const rows = project('from_brief')
    expect(rows.find(r => r.id === GOAL_ID)?.labelFromBrief).toBe(true)
  })

  it('leaves a FACTOR row alone even when IT carries from_brief — the second twin', () => {
    // ⚠ The predicate is applied to the GOAL row only. On a factor the same
    // literal is a claim about the VALUE, and flagging its label would be the
    // two-questions-under-one-name defect this module exists to avoid.
    const rows = project('from_brief')
    expect(rows.find(r => r.id === FACTOR_ID)?.labelFromBrief).toBeUndefined()
  })

  it('does not flag an Olumi-authored goal — the discriminating twin', () => {
    const rows = project('ai_inferred')
    expect(rows.find(r => r.id === GOAL_ID)?.labelFromBrief).toBe(false)
  })
})
