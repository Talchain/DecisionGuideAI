/**
 * BaseNode — the Changes view's marks (row E). Mirrors `nodes/__tests__/BaseNode.projection.spec.tsx`.
 *
 *   N1  a node the `run_changes` projection marks carries its word, the info outline and `data-run-change`
 *   N2  while anything is marked, a node nothing happened to is subdued — and says so in `data-run-change-subdued`
 *   N3  a projection that marks NO node subdues no node (the attention lesson: an empty hold never greys the board)
 *   N4  another source's ids never read as a change (drivers are not changes)
 */
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../../nodes/DecisionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  edges: [],
  nodes: [],
  results: { status: 'complete', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  ceeAnalysisReady: null,
  lodRung: 'full',
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../../nodes/shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'decision-1', type: 'decision', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

const renderWith = (state: Record<string, unknown>) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(state) as never))
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as unknown as React.ComponentProps<typeof DecisionNode>)} />
    </ReactFlowProvider>,
  )
}
const card = () => screen.getByRole('group', { name: /^Question:/i })
const runChanges = (marks: Array<[string, 'changed' | 'added' | 'moved']>) => ({
  analysisHighlight: {
    source: 'run_changes', nodeIds: new Set(marks.map(([id]) => id)), edgeIds: new Set(),
    nodeMarks: new Map(marks), edgeMarks: new Map(),
  },
})

describe('BaseNode — the Changes view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('N1 a marked node carries its word, the info outline and data-run-change', () => {
    renderWith(runChanges([['decision-1', 'changed']]))
    expect(card().getAttribute('data-run-change')).toBe('changed')
    expect(card().style.outline).toContain('var(--semantic-info)')
    expect(screen.getByTestId('run-change-badge-decision-1')).toHaveTextContent('Changed')
    expect(card().getAttribute('data-run-change-subdued')).toBeNull()
  })

  it('N1c the word sits below-right, outside the card — never above-left, where the lane title is', () => {
    renderWith(runChanges([['decision-1', 'changed']]))
    const cls = screen.getByTestId('run-change-badge-decision-1').className
    expect(cls).toContain('top-full')
    expect(cls).toContain('right-0')
    expect(cls).not.toContain('bottom-full')
    expect(cls).not.toMatch(/\bleft-0\b/)
  })

  it('N1b an option that entered the comparison says so — not "new"', () => {
    renderWith(runChanges([['decision-1', 'added']]))
    expect(screen.getByTestId('run-change-badge-decision-1')).toHaveTextContent('Added to the comparison')
  })

  it('N2 while anything is marked, an unmarked node is subdued and carries no word', () => {
    renderWith(runChanges([['other-node', 'moved']]))
    expect(card().getAttribute('data-run-change-subdued')).toBe('true')
    expect(card().className).toContain('opacity-30')
    expect(screen.queryByTestId('run-change-badge-decision-1')).toBeNull()
  })

  it('N3 a projection that marks no node subdues no node', () => {
    renderWith(runChanges([]))
    expect(card().getAttribute('data-run-change-subdued')).toBeNull()
    expect(card().className).not.toContain('opacity-30')
  })

  it('N4 a drivers projection is not a change', () => {
    renderWith({ analysisHighlight: { source: 'drivers', nodeIds: new Set(['decision-1']), edgeIds: new Set() } })
    expect(card().getAttribute('data-run-change')).toBeNull()
    expect(screen.queryByTestId('run-change-badge-decision-1')).toBeNull()
  })
})
