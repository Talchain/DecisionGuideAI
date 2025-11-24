import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContextBar } from '../ContextBar'
import { useCanvasStore } from '../../store'
import * as useEngineLimitsModule from '../../hooks/useEngineLimits'
import type { UseEngineLimitsReturn } from '../../hooks/useEngineLimits'
import type { GraphHealth } from '../../validation/types'

vi.mock('../../hooks/useEngineLimits', () => ({
  useEngineLimits: vi.fn(),
}))

const mockUseEngineLimits = vi.mocked(useEngineLimitsModule.useEngineLimits)

const createMockLimitsReturn = (overrides?: Partial<UseEngineLimitsReturn>): UseEngineLimitsReturn => ({
  limits: {
    nodes: { max: 200 },
    edges: { max: 500 },
    engine_p95_ms_budget: 30000,
  },
  source: 'live',
  loading: false,
  error: null,
  fetchedAt: Date.now(),
  retry: vi.fn(),
  ...overrides,
})

const setStoreGraph = (nodesCount: number, edgesCount: number, graphHealth: GraphHealth | null = null) => {
  const store = useCanvasStore.getState()
  // minimal shape: id + position
  const nodes = Array.from({ length: nodesCount }).map((_, i) => ({
    id: String(i + 1),
    position: { x: 0, y: 0 },
    data: {},
  }))
  const edges = Array.from({ length: edgesCount }).map((_, i) => ({
    id: `e${i + 1}`,
    source: '1',
    target: '1',
    data: {},
  }))

  useCanvasStore.setState({
    nodes,
    edges,
    graphHealth,
  } as any)

  return store
}

describe('ContextBar', () => {
  beforeEach(() => {
    // reset store to a sane baseline
    const state = useCanvasStore.getState()
    if (state.resetCanvas) {
      state.resetCanvas()
    }
    useCanvasStore.setState({ graphHealth: null } as any)
    vi.clearAllMocks()
  })

  it('renders graph stats and comfortable limits / unknown health by default', () => {
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())
    setStoreGraph(3, 2, null)

    const { container } = render(<ContextBar />)

    expect(screen.getByTestId('context-bar')).toBeInTheDocument()
    expect(screen.getByText('3 nodes • 2 edges')).toBeInTheDocument()

    // Limits: under thresholds -> Comfortable
    expect(screen.getByText('Limits')).toBeInTheDocument()
    expect(screen.getByText('Loading limits')).not.toBeInTheDocument()
    expect(container.textContent).toContain('Comfortable')

    // Health: Unknown when no graphHealth
    expect(container.textContent).toContain('Health: Unknown')
  })

  it('shows loading limits state when hook is loading', () => {
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn({
      loading: true,
      limits: null,
    }))
    setStoreGraph(1, 1)

    render(<ContextBar />)

    expect(screen.getByText('Loading limits')).toBeInTheDocument()
    expect(screen.getByText('Fetching current engine limits for this graph.')).toBeInTheDocument()
  })

  it('shows limits unavailable when limits missing or error present', () => {
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn({
      limits: null,
      error: new Error('Network issue'),
    }))
    setStoreGraph(5, 5)

    render(<ContextBar />)

    expect(screen.getByText('Limits unavailable')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Limits could not be loaded. You can still edit the graph, but run behaviour may be constrained.',
      ),
    ).toBeInTheDocument()
  })

  it('shows healthy graph health strings when status is healthy', () => {
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())

    const health: GraphHealth = {
      status: 'healthy',
      score: 92,
      issues: [],
    }

    setStoreGraph(10, 4, health)

    const { container } = render(<ContextBar />)

    expect(container.textContent).toContain('Health: Good')
    expect(container.textContent).toContain('Score: 92/100')
  })

  it('shows warnings health strings with issue count', () => {
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())

    const health: GraphHealth = {
      status: 'warnings',
      score: 65,
      issues: [
        {
          id: '1',
          type: 'cycle',
          severity: 'warning',
          message: 'Test warning',
        },
      ],
    }
    setStoreGraph(10, 4, health)

    const { container } = render(<ContextBar />)

    expect(container.textContent).toContain('Health: Warnings')
    expect(container.textContent).toContain('Score: 65/100')
    expect(container.textContent).toContain('1 issues')
  })

  it('shows errors health strings with issue count', () => {
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())

    const health: GraphHealth = {
      status: 'errors',
      score: 40,
      issues: [
        {
          id: '1',
          type: 'cycle',
          severity: 'error',
          message: 'Test error',
        },
        {
          id: '2',
          type: 'dangling_edge',
          severity: 'error',
          message: 'Another error',
        },
      ],
    }

    setStoreGraph(20, 10, health)

    const { container } = render(<ContextBar />)

    expect(container.textContent).toContain('Health: Errors')
    expect(container.textContent).toContain('Score: 40/100')
    expect(container.textContent).toContain('2 issues')
  })

  it('does not render any null bytes in the text content', () => {
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())
    setStoreGraph(1, 1)

    const { container } = render(<ContextBar />)

    expect(container.textContent).not.toContain('\u0000')
    expect(container.textContent).not.toContain('\ufffd')
  })
})
