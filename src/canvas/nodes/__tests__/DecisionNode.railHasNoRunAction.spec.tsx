/**
 * DESIGN-GAP-AUDIT row 5(b) — the Question card's rail no longer carries a
 * "Run the analysis now" action.
 *
 * OWNER DECISION (24 Sep 2026, gap-frame-footer lane): running the analysis
 * lives in the panel's Analyse button; contract v3.1 §02's Question rail is
 * edit + coaching only. This SUPERSEDES the 23 Sep 2026 "locked design"
 * ruling in `runAnalysisOneAuthority.spec.tsx` that consolidated the goal
 * card's duplicate "Run analysis" chip onto this card's rail — that file is
 * updated in the same commit to record the new ruling rather than silently
 * dropping the old one (its own header is the house convention for this: a
 * superseded ruling is recorded, not deleted).
 *
 * Bound by IDENTITY: the exact rail testid the removed action used to render,
 * `decision-run-analysis-<id>`, in the READY state where it fires today (every
 * factor valued AND a goal set) — the CONTRAST case that makes this a real
 * assertion rather than one that is vacuously true in a state where the icon
 * was never going to render anyway.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const DECISION_ID = 'decision-1'
const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision', label: 'Which plan?' } }
/** A factor with a stated value — counts as present for `allFactorsPresent`. */
const readyFactor = {
  id: 'f-ready', type: 'factor',
  data: { type: 'factor', label: 'Adoption friction', category: 'controllable', observedState: { value: 0.4, extractionType: 'inferred' } },
}
const optionNodes = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire three' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire none' } },
]
const optionEdges = [
  { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
  { id: 'e2', source: DECISION_ID, target: 'option-2', data: {} },
]

const hoisted = vi.hoisted(() => ({ state: null as any }))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useGuidanceStore } from '../../stores/guidanceStore'
import { DecisionNode } from '../DecisionNode'

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes, readyFactor],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    // A stated numeric threshold — `isGoalDefined` admits it, so together with
    // the one ready factor above `showRunAnalysis` is true: the exact state
    // that rendered the Play icon before this change.
    goalThreshold: 0.5,
    goalConstraints: [],
    viewMode: 'standard',
    lodRung: 'full',
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}

const renderDecision = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode
        {...({
          id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 },
          selected: false, isConnectable: true,
          positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
          data: { label: 'Which plan?', type: 'decision' },
        } as any)}
      />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  setStore()
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as any)
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
})

describe('gap 5(b) — the rail carries no run action, even in the READY state', () => {
  it('CONTRAST: this fixture IS the ready state — the coaching icon still rails, proving the card rendered rather than being empty', () => {
    renderDecision()
    expect(screen.getByTestId(`node-coaching-icon-${DECISION_ID}`)).toBeDefined()
  })

  it('no `decision-run-analysis-<id>` element renders, in the ready state where it used to', () => {
    renderDecision()
    expect(screen.queryByTestId(`decision-run-analysis-${DECISION_ID}`)).toBeNull()
  })

  it('no control anywhere on the card is named "Run the analysis now" or "Run analysis"', () => {
    const { container } = renderDecision()
    const named = Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]')).filter(
      (el) => /^(Run analysis|Run the analysis now)$/.test((el.textContent ?? '').trim()) ||
        /^(Run analysis|Run the analysis now)$/.test(el.getAttribute('aria-label') ?? ''),
    )
    expect(named).toHaveLength(0)
  })
})
