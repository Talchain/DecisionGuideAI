/**
 * Canvas option 3 (Paul, 20 Oct 2026): on the core lane the goal's today's level is typed on the card, through the
 * existing `factor_value_edit` on the goal id, in the TARGET's unit (DL: core `living-model/edit.ts`, `unit_mismatch`).
 * Other lanes have no write for it, so the card offers no field there.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'
import { buildFactorValueEditEvent } from '../../conversation/factorValueEdit'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})


const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

// The saved model on screen: a core scenario carries a living model; a legacy one does not.
const saved = vi.hoisted(() => ({ graph: { nodes: [], living_model: { aims: [], links: [] } } as unknown }))
vi.mock('../shared/savedGraph', () => ({ useSavedGraph: () => saved.graph }))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'goal_pricing_transition',
  type: 'goal',
  selected: false,
  isConnectable: true,
  position: { x: 0, y: 0 },
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/** The pricing board's own goal, as the served card rendered it. */
const TARGET_SET = { goal_threshold_raw: 100, goal_threshold_unit: 'tickets per week' }

function renderCard(data: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  const { container } = render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: 'Transition to usage-based pricing', type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
  return container
}


afterEach(() => { cleanup(); window.history.replaceState(null, '', '/') })

describe("today's level on the goal card", () => {
  it('core lane, target set, level unknown: the empty field, announced by the needs-input mark', () => {
    window.history.replaceState(null, '', '/#/canvas?ai=core')
    renderCard(TARGET_SET)
    expect(screen.getByTestId('goal-today-level-editor-goal_pricing_transition')).toBeTruthy()
    const empty = screen.getByTestId('goal-today-level-empty-goal_pricing_transition')
    expect(empty.querySelector('[data-card-mark="needs-input"]')?.getAttribute('aria-label')).toBe("Today's level needed")
    expect(empty.textContent).toContain('tickets per week')
  })

  // ⭐ Served 21 Oct: the default `openai` mode is served by core (CEE `laneModeFor`), so a core scenario on the default
  // path has the write, and gets the field. (Supersedes "the default lane has no write": that was the URL mode, not the
  // scenario.)
  it('a core scenario on the DEFAULT path (no ?ai=core) gets the field', () => {
    renderCard(TARGET_SET)
    expect(screen.getByTestId('goal-today-level-editor-goal_pricing_transition')).toBeTruthy()
  })

  it('CONTRAST: a legacy scenario (no living model) has no write for it, so no field, whatever the URL says', () => {
    saved.graph = { nodes: [] }
    window.history.replaceState(null, '', '/#/canvas?ai=core')
    renderCard(TARGET_SET)
    expect(screen.queryByTestId('goal-today-level-editor-goal_pricing_transition')).toBeNull()
    saved.graph = { nodes: [], living_model: { aims: [], links: [] } }
  })

  it('CONTRAST: no target, no field (CEE refuses `no_target`)', () => {
    window.history.replaceState(null, '', '/#/canvas?ai=core')
    renderCard({})
    expect(screen.queryByTestId('goal-today-level-editor-goal_pricing_transition')).toBeNull()
  })
})

describe('the level write names the unit it was typed in', () => {
  it("a goal's level goes out with its target's unit, not the node's own", () => {
    const ev = buildFactorValueEditEvent({ nodeId: 'goal-1', typedValue: 80, nodeData: { observedState: { unit: 'tickets' } }, unit: 'tickets per week' })
    expect(ev?.payload).toMatchObject({ target_id: 'goal-1', raw_value: 80, unit: 'tickets per week' })
  })

  it('a goal holding only a model-scale value still sends the typed figure as raw_value in that unit', () => {
    const ev = buildFactorValueEditEvent({ nodeId: 'goal-1', typedValue: 90, nodeData: { observedState: { value: 0.8 } }, unit: 'tickets per week' })
    expect(ev?.payload).toMatchObject({ target_id: 'goal-1', raw_value: 90, unit: 'tickets per week' })
  })

  it("CONTRAST: without one, the node's own unit stands", () => {
    const ev = buildFactorValueEditEvent({ nodeId: 'f-1', typedValue: 80, nodeData: { observedState: { unit: 'tickets' } } })
    expect((ev?.payload as { unit?: string }).unit).toBe('tickets')
  })
})
