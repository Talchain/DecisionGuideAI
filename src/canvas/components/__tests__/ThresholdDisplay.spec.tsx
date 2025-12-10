/**
 * ThresholdDisplay Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const mockNodes: Node[] = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Marketing Spend' }, type: 'factor' },
  { id: 'n2', position: { x: 100, y: 0 }, data: { label: 'Market Share' }, type: 'factor' },
]

const mockEdges: Edge[] = [
  {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    data: {
      functionType: 'threshold',
      functionParams: { threshold: 0.7 },
    },
  },
]

const mockSetHighlightedNodes = vi.fn()
const mockSetHighlightedEdges = vi.fn()

const createMockStore = (overrides = {}) => ({
  nodes: mockNodes,
  edges: mockEdges,
  results: { status: 'complete' },
  setHighlightedNodes: mockSetHighlightedNodes,
  setHighlightedEdges: mockSetHighlightedEdges,
  ...overrides,
})

// Mock store - define selector function that mocks will override
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = {
      nodes: mockNodes,
      edges: mockEdges,
      results: { status: 'complete' },
      setHighlightedNodes: mockSetHighlightedNodes,
      setHighlightedEdges: mockSetHighlightedEdges,
    }
    return selector(state)
  }),
}))

// Mock ISL conformal hook
vi.mock('../../../hooks/useISLConformal', () => ({
  useISLConformal: () => ({
    data: null,
    loading: false,
    error: null,
    predict: vi.fn(),
  }),
}))

// Mock focus helpers
vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

// Import after mocks
import { useCanvasStore } from '../../store'
import { ThresholdDisplay } from '../ThresholdDisplay'

describe('ThresholdDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to default state
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(createMockStore() as any)
    )
  })

  describe('empty state', () => {
    it('returns null when no results yet', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(createMockStore({
          nodes: [],
          edges: [],
          results: null,
        }) as any)
      )

      const { container } = render(<ThresholdDisplay />)
      expect(container.firstChild).toBeNull()
    })

    it('shows empty state when no thresholds found', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(createMockStore({
          edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { functionType: 'linear' } }],
        }) as any)
      )

      render(<ThresholdDisplay />)

      expect(screen.getByTestId('threshold-display-empty')).toBeInTheDocument()
      expect(screen.getByText('No critical thresholds')).toBeInTheDocument()
    })
  })

  describe('with thresholds', () => {
    it('renders collapsed by default', () => {
      render(<ThresholdDisplay />)

      expect(screen.getByTestId('threshold-display')).toBeInTheDocument()
      expect(screen.getByText('Critical Thresholds')).toBeInTheDocument()
      expect(screen.getByText('1 identified')).toBeInTheDocument()
    })

    it('expands when header clicked', () => {
      render(<ThresholdDisplay />)

      const header = screen.getByRole('button', { expanded: false })
      fireEvent.click(header)

      // Should now show threshold content
      expect(screen.getByText(/Marketing Spend/)).toBeInTheDocument()
      expect(screen.getByText('70%')).toBeInTheDocument()
    })

    it('starts expanded when defaultExpanded is true', () => {
      render(<ThresholdDisplay defaultExpanded={true} />)

      expect(screen.getByText(/Marketing Spend/)).toBeInTheDocument()
    })

    it('shows threshold effects', () => {
      render(<ThresholdDisplay defaultExpanded={true} />)

      expect(screen.getByText(/Below:/)).toBeInTheDocument()
      expect(screen.getByText(/Above:/)).toBeInTheDocument()
    })
  })

  describe('focus interaction', () => {
    it('highlights edge when threshold clicked', async () => {
      render(<ThresholdDisplay defaultExpanded={true} />)

      // Click on the threshold item
      const thresholdItem = screen.getByText(/Marketing Spend/).closest('[role="button"]')
      if (thresholdItem) {
        fireEvent.click(thresholdItem)
      }

      expect(mockSetHighlightedEdges).toHaveBeenCalledWith(['e1'])
    })

    it('supports keyboard navigation', () => {
      render(<ThresholdDisplay defaultExpanded={true} />)

      const thresholdItem = screen.getByText(/Marketing Spend/).closest('[role="button"]')
      if (thresholdItem) {
        fireEvent.keyDown(thresholdItem, { key: 'Enter' })
      }

      expect(mockSetHighlightedEdges).toHaveBeenCalled()
    })
  })

  describe('multiple thresholds', () => {
    it('limits visible thresholds', () => {
      const manyEdges: Edge[] = [
        { id: 'e1', source: 'n1', target: 'n2', data: { functionType: 'threshold', functionParams: { threshold: 0.7 } } },
        { id: 'e2', source: 'n1', target: 'n2', data: { functionType: 's_curve', functionParams: { midpoint: 0.5, steepness: 8 } } },
      ]

      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(createMockStore({ edges: manyEdges }) as any)
      )

      render(<ThresholdDisplay defaultExpanded={true} maxVisible={1} />)

      // Should show +1 more
      expect(screen.getByText('+1 more threshold')).toBeInTheDocument()
    })
  })
})
