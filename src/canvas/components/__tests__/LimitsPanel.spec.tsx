import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LimitsPanel } from '../LimitsPanel'
import * as useEngineLimitsModule from '../../hooks/useEngineLimits'
import type { UseEngineLimitsReturn } from '../../hooks/useEngineLimits'

vi.mock('../../hooks/useEngineLimits', () => ({
  useEngineLimits: vi.fn(),
}))

const mockUseEngineLimits = vi.mocked(useEngineLimitsModule.useEngineLimits)

const createMockReturn = (overrides?: Partial<UseEngineLimitsReturn>): UseEngineLimitsReturn => ({
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

describe('LimitsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    mockUseEngineLimits.mockReturnValue(createMockReturn())

    const { queryByRole } = render(
      <LimitsPanel isOpen={false} onClose={vi.fn()} currentNodes={0} currentEdges={0} />
    )

    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders summary block and usage counts for comfortable zone', () => {
    mockUseEngineLimits.mockReturnValue(createMockReturn())

    render(
      <LimitsPanel isOpen={true} onClose={vi.fn()} currentNodes={50} currentEdges={100} />
    )

    // Summary block
    expect(screen.getByText('Comfortable')).toBeInTheDocument()
    expect(
      screen.getByText(/comfortably within the engine's recommended range/i)
    ).toBeInTheDocument()

    // Usage counts (50/200 nodes, 100/500 edges)
    expect(screen.getByText('50 / 200')).toBeInTheDocument()
    expect(screen.getByText('100 / 500')).toBeInTheDocument()
  })

  it('renders getting complex zone summary when usage between 70% and 89%', () => {
    mockUseEngineLimits.mockReturnValue(createMockReturn())

    render(
      <LimitsPanel isOpen={true} onClose={vi.fn()} currentNodes={150} currentEdges={200} />
    )

    expect(screen.getByText('Getting complex')).toBeInTheDocument()
    expect(screen.getByText(/getting complex but is still within the engine's limits/i)).toBeInTheDocument()

    // 150/200 nodes
    expect(screen.getByText('150 / 200')).toBeInTheDocument()
  })

  it('renders at limit zone summary when usage is >= 90%', () => {
    mockUseEngineLimits.mockReturnValue(createMockReturn())

    render(
      <LimitsPanel isOpen={true} onClose={vi.fn()} currentNodes={190} currentEdges={480} />
    )

    expect(screen.getByText('At limit')).toBeInTheDocument()
    expect(screen.getByText(/at the engine's recommended limit/i)).toBeInTheDocument()

    // 190/200 nodes, 480/500 edges
    expect(screen.getByText('190 / 200')).toBeInTheDocument()
    expect(screen.getByText('480 / 500')).toBeInTheDocument()
  })

  it('renders loading state when limits are loading', () => {
    mockUseEngineLimits.mockReturnValue(
      createMockReturn({
        limits: null,
        loading: true,
      }),
    )

    render(
      <LimitsPanel isOpen={true} onClose={vi.fn()} currentNodes={0} currentEdges={0} />,
    )

    expect(screen.getByText('Loading limits...')).toBeInTheDocument()
  })

  it('renders error state with message and retry button when limits call fails', () => {
    const retry = vi.fn()
    mockUseEngineLimits.mockReturnValue(
      createMockReturn({
        limits: null,
        error: new Error('Network offline'),
        loading: false,
        retry,
      }),
    )

    render(
      <LimitsPanel isOpen={true} onClose={vi.fn()} currentNodes={0} currentEdges={0} />,
    )

    expect(screen.getByText('Limits Unavailable')).toBeInTheDocument()
    expect(screen.getByText('Network offline')).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    expect(retryButton).toBeInTheDocument()
  })
})
