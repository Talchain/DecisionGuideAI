/** ModelTabBody — the sole connected Model route. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { ModelTabBody } from '../ModelTabBody'
import { openOutlineGroups } from '../../model-tab-v2/__tests__/openOutlineGroups'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] }
function getMockState() {
  return {
    nodes: mockGraph.nodes,
    edges: mockGraph.edges,
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: null,
    currentStage: null,
    graphEditedSinceLastRun: false,
    goalThreshold: null,
    goalThresholdRepresentation: null,
  }
}
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (state: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))
// Q1 readers: the saved read a link's words come from; none unless a row sets one.
const savedRead = vi.hoisted(() => ({ graph: null as unknown }))
vi.mock('../../nodes/shared/savedGraph', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), useSavedGraph: () => savedRead.graph }))
vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const nodes: Node[] = [
  {
    id: 'goal-1',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Protect gross margin' },
  },
  {
    id: 'factor-budget',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Migration budget',
      category: 'observable',
      observedState: { value: 0.5, raw_value: 20000, source: 'brief_extraction' },
    },
  },
  {
    id: 'factor-adoption',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Team adoption',
      category: 'observable',
      observedState: { value: 0.4, source: 'cee_inference' },
    },
  },
]

const props = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

function renderTab(edges: Edge[] = []) {
  mockGraph.nodes = nodes
  mockGraph.edges = edges
  return render(<ModelTabBody {...props} nodes={nodes} edges={edges} />)
}

function copyJsonAndParse(edges: Edge[]) {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  renderTab(edges)
  fireEvent.click(screen.getByTestId('model-copy-json'))
  expect(writeText).toHaveBeenCalledTimes(1)
  return JSON.parse(writeText.mock.calls[0][0] as string)
}

beforeEach(() => { vi.clearAllMocks() })

describe('the JSON export is data: it keeps the stored label', () => {
  it('a factor the person named "Decision: …" is exported with its words (the display strip never reaches an export)', () => {
    const named: Node[] = [
      ...nodes,
      { id: 'factor-named', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Decision: retain the platform', category: 'observable' } },
    ]
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mockGraph.nodes = named
    mockGraph.edges = []
    render(<ModelTabBody {...props} nodes={named} edges={[]} />)
    fireEvent.click(screen.getByTestId('model-copy-json'))
    const payload = JSON.parse(writeText.mock.calls[0][0] as string)
    expect(payload.factors.find((f: { id: string }) => f.id === 'factor-named')?.label).toBe('Decision: retain the platform')
  })
})

describe('connected Model surface', () => {
  it('shows each entity exactly once on the v2 outline', () => {
    renderTab()
    // NAVIGATION, NOT A RELAXED ASSERTION: the outline opens closed, so rows are
    // not on screen at mount. The subject — each entity appears exactly ONCE —
    // and every assertion below are unchanged.
    openOutlineGroups()
    expect(screen.getAllByText('Protect gross margin')).toHaveLength(1)
    expect(screen.getAllByText('Migration budget')).toHaveLength(1)
    expect(screen.getAllByText('Team adoption')).toHaveLength(1)
    expect(screen.queryByTestId('model-tab-v1-stack')).not.toBeInTheDocument()
  })

  it('the one search surface actually filters the outline', () => {
    renderTab()
    const search = screen.getByTestId('model-tab-v2-filter')
    expect(search).toBeEnabled()
    // ⭐ PRECONDITION, PINNED IN-TEST. Groups start CLOSED, so BOTH rows are
    // absent before the search runs. Without this line the negative assertion
    // below passes VACUOUSLY — a collapsed group and a filtered-out row are
    // indistinguishable to `queryByTestId`, so half this test could not fail.
    expect(screen.queryByTestId('model-row-v2-factor-adoption')).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'adoption' } })
    // Searching REVEALS the match even though its group was shut...
    expect(screen.getByTestId('model-row-v2-factor-adoption')).toBeInTheDocument()
    // ...and the non-match is absent because it does not MATCH, not because it
    // is still collapsed — its group is the same one that just opened.
    expect(screen.queryByTestId('model-row-v2-factor-budget')).not.toBeInTheDocument()
  })

  it('keeps copy actions, without restoring the inert duplicate search', () => {
    renderTab()
    expect(screen.getByTestId('model-copy')).toBeEnabled()
    expect(screen.getByTestId('model-copy-json')).toBeEnabled()
    expect(screen.getAllByRole('searchbox')).toHaveLength(1)
  })

  it('keeps explicit edge provenance attached to the F7 JSON clipboard payload', () => {
    const stamped: Edge = {
      id: 'edge-stamped',
      source: 'factor-budget',
      target: 'factor-adoption',
      data: {
        weight: 0.42,
        weightSource: 'user',
        beliefExists: 0.73,
        beliefExistsSource: 'cee',
        direction: 'positive',
        provenance: 'user_study',
      },
    }

    const payload = copyJsonAndParse([stamped])
    expect(payload.edges).toHaveLength(1)
    expect(payload.edges[0]).toEqual(expect.objectContaining({
      weight: 0.42,
      weightSource: 'user',
      beliefExists: 0.73,
      beliefExistsSource: 'cee',
      provenance: 'user_study',
    }))
  })

  it('exports unstamped default numbers as unsourced in the F7 JSON clipboard payload', () => {
    const unstamped: Edge = {
      id: 'edge-unstamped',
      source: 'factor-budget',
      target: 'factor-adoption',
      data: { weight: 0.3, beliefExists: 0.8, direction: 'positive' },
    }

    const payload = copyJsonAndParse([unstamped])
    expect(payload.edges).toHaveLength(1)
    expect(payload.edges[0]).toEqual(expect.objectContaining({
      weight: 0.3,
      weightSource: null,
      beliefExists: 0.8,
      beliefExistsSource: null,
    }))
  })
})

// Q1 readers (PL BLOCK 2, 28 Oct): a link in words is exported with its stated claim (`link_words`), never the wire's
// plumbing `exists_probability: 1` as a belief, nor the mapper's defaulted "positive" as its direction. Two parallel links
// between the same cards under their own ids: the numerical one is exported as before.
describe('the JSON export says a link in words as its words', () => {
  afterEach(() => { savedRead.graph = null })
  it('word link → link_words, no belief, no direction; the numerical twin unchanged', () => {
    const wordWire = { id: 'budget__goal', from: 'factor-budget', to: 'goal-1', exists_probability: 1, direction_settled: false,
      provenance: { source: 'cee_hypothesis' }, origin: 'model_program:display',
      link_words: { direction: 'conditional', confidence: 'unsure', basis: 'Only if the budget is spent on training' } }
    const numWire = { id: 'budget__goal__2', from: 'factor-budget', to: 'goal-1', exists_probability: 1, effect_direction: 'positive',
      strength: { mean: 0.4, std: 0.1 }, provenance: { source: 'cee_hypothesis' }, origin: 'model_program:calculation' }
    savedRead.graph = { edges: [wordWire, numWire], living_model: { model_program: 'v1' } }
    const payload = copyJsonAndParse([wordWire, numWire].map((w, i) => mapDraftEdgeToCanvas(w, i)) as Edge[])
    const word = payload.edges.find((e: { id: string }) => e.id === 'budget__goal')
    const num = payload.edges.find((e: { id: string }) => e.id === 'budget__goal__2')
    expect(word.link_words).toEqual({ direction: 'conditional', confidence: 'unsure', basis: 'Only if the budget is spent on training' })
    expect(word).not.toHaveProperty('beliefExists')
    expect(word).not.toHaveProperty('beliefExistsSource')
    expect(word).not.toHaveProperty('direction')
    expect(num).toMatchObject({ beliefExists: 1, beliefExistsSource: 'cee', direction: 'positive' })
    expect(num).not.toHaveProperty('link_words')
  })
})
