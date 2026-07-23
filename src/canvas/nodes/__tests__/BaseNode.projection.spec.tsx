/**
 * BaseNode — analysis-graph projection marker (driver node).
 *
 * A driver node named by the analysisHighlight slice (source 'drivers') carries
 * an info ring while viewed. This pins the consumer read: the node exposes the
 * data-analysis-driver marker + an info outline when — and only when — the slice
 * names it. The ring uses `outline` (a separate CSS channel) so it composes with
 * the selection / hover rings rather than replacing them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'

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
  lodActive: false,
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
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

vi.mock('../../../hooks/useCEEInsights', () => ({ useCEEInsights: vi.fn(() => ({ data: null })) }))
vi.mock('../../../hooks/useISLValidation', () => ({ useISLValidation: vi.fn(() => ({ data: null })) }))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'decision-1',
  type: 'decision',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

const renderWith = (state: Record<string, unknown>) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(state) as any))
  return render(
    <ReactFlowProvider>
      <DecisionNode {...baseProps} />
    </ReactFlowProvider>,
  )
}

describe('BaseNode — analysis-graph projection marker (driver node)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks the node when the drivers slice names it', () => {
    renderWith({ analysisHighlight: { source: 'drivers', nodeIds: new Set(['decision-1']), edgeIds: new Set() } })
    const group = screen.getByRole('group', { name: /decision/i })
    expect(group.getAttribute('data-analysis-driver')).toBe('true')
    expect(group.style.outline).toContain('var(--semantic-info)')
  })

  it('does NOT mark the node when the slice is empty', () => {
    renderWith({ analysisHighlight: { source: null, nodeIds: new Set(), edgeIds: new Set() } })
    const group = screen.getByRole('group', { name: /decision/i })
    expect(group.getAttribute('data-analysis-driver')).toBeNull()
    expect(group.style.outline).toBe('')
  })

  it('does NOT mark the node when a DIFFERENT node is named', () => {
    renderWith({ analysisHighlight: { source: 'drivers', nodeIds: new Set(['other-node']), edgeIds: new Set() } })
    const group = screen.getByRole('group', { name: /decision/i })
    expect(group.getAttribute('data-analysis-driver')).toBeNull()
  })

  it('does NOT mark when the source is flip_risks (node ids belong only to drivers)', () => {
    renderWith({ analysisHighlight: { source: 'flip_risks', nodeIds: new Set(['decision-1']), edgeIds: new Set() } })
    const group = screen.getByRole('group', { name: /decision/i })
    expect(group.getAttribute('data-analysis-driver')).toBeNull()
  })
})
