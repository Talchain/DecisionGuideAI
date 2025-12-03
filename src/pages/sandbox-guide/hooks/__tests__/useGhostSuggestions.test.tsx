/**
 * useGhostSuggestions Hook Tests
 *
 * Tests for ghost edge suggestion lifecycle:
 * - Hover delay (300ms)
 * - Suggestion generation
 * - Tab acceptance
 * - Esc dismissal
 * - Stage gating
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGhostSuggestions } from '../useGhostSuggestions'
import type { Node, Edge } from '@xyflow/react'

// Mock ReactFlow
const mockGetNodes = vi.fn()
const mockGetEdges = vi.fn()

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getNodes: mockGetNodes,
    getEdges: mockGetEdges,
  }),
}))

// Mock canvas store
const mockAddEdge = vi.fn()
vi.mock('../../../../canvas/store', () => ({
  useCanvasStore: (selector: any) => {
    const state = { addEdge: mockAddEdge }
    return selector ? selector(state) : state
  },
}))

// Mock guide store
const mockJourneyStage = vi.fn()
vi.mock('../useCopilotStore', () => ({
  useGuideStore: (selector: any) => {
    const state = { journeyStage: mockJourneyStage() }
    return selector ? selector(state) : state
  },
}))

const mockNodes: Node[] = [
  {
    id: 'n1',
    type: 'option',
    data: { type: 'option' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'n2',
    type: 'outcome',
    data: { type: 'outcome' },
    position: { x: 100, y: 0 },
  },
]

const mockEdges: Edge[] = []

describe('useGhostSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNodes.mockReturnValue(mockNodes)
    mockGetEdges.mockReturnValue(mockEdges)
    mockJourneyStage.mockReturnValue('building')
  })

  it('generates suggestions on node hover after delay', async () => {
    const { result } = renderHook(() => useGhostSuggestions())

    act(() => {
      result.current.handleNodeMouseEnter('n1')
    })

    // Should not show immediately
    expect(result.current.suggestions).toEqual([])

    // Wait for delay (300ms)
    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0)
      },
      { timeout: 500 }
    )

    expect(result.current.hoveredNode).toBe('n1')
  })

  it('clears suggestions on mouse leave', async () => {
    const { result } = renderHook(() => useGhostSuggestions())

    act(() => {
      result.current.handleNodeMouseEnter('n1')
    })

    // Wait for suggestions to appear
    await waitFor(() => {
      expect(result.current.suggestions.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.handleNodeMouseLeave()
    })

    expect(result.current.suggestions).toEqual([])
    expect(result.current.hoveredNode).toBeNull()
  })

  it('clears timeout on quick mouse leave', () => {
    const { result } = renderHook(() => useGhostSuggestions())

    act(() => {
      result.current.handleNodeMouseEnter('n1')
    })

    // Leave immediately (before 300ms delay)
    act(() => {
      result.current.handleNodeMouseLeave()
    })

    // Suggestions should not appear
    expect(result.current.suggestions).toEqual([])
    expect(result.current.hoveredNode).toBeNull()
  })

  it('calls addEdge when accepting suggestion', () => {
    const { result } = renderHook(() => useGhostSuggestions())

    const suggestion = {
      from: 'n1',
      to: 'n2',
      suggestedWeight: 0.5,
      confidence: 0.8,
      reasoning: 'Test',
    }

    act(() => {
      result.current.acceptSuggestion(suggestion)
    })

    expect(mockAddEdge).toHaveBeenCalledWith({
      source: 'n1',
      target: 'n2',
      data: {
        weight: 0.5,
        belief: 80,
      },
    })
    expect(result.current.suggestions).toEqual([])
  })

  it('dismisses suggestions', () => {
    const { result } = renderHook(() => useGhostSuggestions())

    // Manually set suggestions
    act(() => {
      result.current.handleNodeMouseEnter('n1')
    })

    act(() => {
      result.current.dismissSuggestions()
    })

    expect(result.current.suggestions).toEqual([])
    expect(result.current.hoveredNode).toBeNull()
  })

  it('does not show ghosts outside building stage', async () => {
    mockJourneyStage.mockReturnValue('post-run')

    const { result } = renderHook(() => useGhostSuggestions())

    act(() => {
      result.current.handleNodeMouseEnter('n1')
    })

    // Wait to ensure no suggestions appear
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(result.current.suggestions).toEqual([])
  })

  it('does not show ghosts with < 2 nodes', async () => {
    mockGetNodes.mockReturnValue([mockNodes[0]]) // Only 1 node

    const { result } = renderHook(() => useGhostSuggestions())

    act(() => {
      result.current.handleNodeMouseEnter('n1')
    })

    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(result.current.suggestions).toEqual([])
  })

  it('returns top 3 suggestions max', async () => {
    const manyOutcomes = [
      mockNodes[0],
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `outcome${i}`,
        type: 'outcome',
        data: { type: 'outcome' },
        position: { x: i * 100, y: 0 },
      })),
    ]
    mockGetNodes.mockReturnValue(manyOutcomes)

    const { result } = renderHook(() => useGhostSuggestions())

    act(() => {
      result.current.handleNodeMouseEnter('n1')
    })

    await waitFor(() => {
      expect(result.current.suggestions.length).toBeGreaterThan(0)
    })

    expect(result.current.suggestions.length).toBeLessThanOrEqual(3)
  })
})
