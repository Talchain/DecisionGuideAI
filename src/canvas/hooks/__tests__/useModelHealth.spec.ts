/**
 * Tests for useModelHealth — client-side structural health checks.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useModelHealth } from '../useModelHealth'
import { useCanvasStore } from '../../store'

// Helper to set store state
function setGraph(
  nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>,
  edges: Array<{ id: string; source: string; target: string; data?: Record<string, unknown> }>,
) {
  useCanvasStore.setState({
    nodes: nodes as any,
    edges: edges as any,
  })
}

describe('useModelHealth', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
    })
  })

  it('returns empty array for empty graph', () => {
    const { result } = renderHook(() => useModelHealth())
    expect(result.current).toEqual([])
  })

  it('detects missing goal node', () => {
    setGraph(
      [{ id: 'f1', type: 'factor' }],
      [],
    )
    const { result } = renderHook(() => useModelHealth())
    const goalIssue = result.current.find(i => i.key === 'missing-goal')
    expect(goalIssue).toBeDefined()
    expect(goalIssue!.severity).toBe('blocker')
  })

  it('detects orphan nodes', () => {
    setGraph(
      [
        { id: 'g1', type: 'goal', data: { label: 'My Goal' } },
        { id: 'f1', type: 'factor', data: { label: 'Orphan Factor' } },
      ],
      [],
    )
    const { result } = renderHook(() => useModelHealth())
    const orphan = result.current.find(i => i.key === 'orphan-f1')
    expect(orphan).toBeDefined()
    expect(orphan!.severity).toBe('warning')
    expect(orphan!.description).toContain('Orphan Factor')
  })

  it('detects cycles', () => {
    setGraph(
      [
        { id: 'a', type: 'factor' },
        { id: 'b', type: 'factor' },
        { id: 'c', type: 'factor' },
      ],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'a' },
      ],
    )
    const { result } = renderHook(() => useModelHealth())
    const cycle = result.current.find(i => i.key === 'cycle')
    expect(cycle).toBeDefined()
    expect(cycle!.severity).toBe('blocker')
    expect(cycle!.affectedIds).toHaveLength(3)
  })

  it('detects disconnected options', () => {
    setGraph(
      [
        { id: 'g1', type: 'goal', data: { label: 'Goal' } },
        { id: 'o1', type: 'option', data: { label: 'Option A' } },
        { id: 'f1', type: 'factor' },
      ],
      [
        { id: 'e1', source: 'f1', target: 'g1' },
        // o1 is not connected to anything leading to g1
      ],
    )
    const { result } = renderHook(() => useModelHealth())
    const disconnected = result.current.find(i => i.key === 'disconnected-option-o1')
    expect(disconnected).toBeDefined()
    expect(disconnected!.severity).toBe('blocker')
  })

  it('detects duplicate edges', () => {
    setGraph(
      [
        { id: 'a', type: 'factor' },
        { id: 'b', type: 'factor' },
      ],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'b' },
      ],
    )
    const { result } = renderHook(() => useModelHealth())
    const dup = result.current.find(i => i.key.startsWith('duplicate-edge'))
    expect(dup).toBeDefined()
    expect(dup!.severity).toBe('warning')
  })

  it('reports no issues for a valid simple graph', () => {
    setGraph(
      [
        { id: 'g1', type: 'goal' },
        { id: 'f1', type: 'factor' },
        { id: 'o1', type: 'option' },
      ],
      [
        { id: 'e1', source: 'f1', target: 'g1' },
        { id: 'e2', source: 'o1', target: 'f1' },
      ],
    )
    const { result } = renderHook(() => useModelHealth())
    // Should have no blockers (option→factor→goal path exists)
    const blockers = result.current.filter(i => i.severity === 'blocker')
    expect(blockers).toHaveLength(0)
  })

  it('detects extreme edge weights', () => {
    setGraph(
      [
        { id: 'a', type: 'factor' },
        { id: 'b', type: 'factor' },
      ],
      [
        { id: 'e1', source: 'a', target: 'b', data: { weight: 1.5, strengthStd: 0.02 } },
      ],
    )
    const { result } = renderHook(() => useModelHealth())
    const extreme = result.current.find(i => i.key.startsWith('extreme-weight'))
    expect(extreme).toBeDefined()
    expect(extreme!.severity).toBe('warning')
  })

  it('detects no-bridge when factors cannot reach goal', () => {
    setGraph(
      [
        { id: 'g1', type: 'goal' },
        { id: 'f1', type: 'factor' },
        { id: 'f2', type: 'factor' },
      ],
      [
        // factors connected to each other but NOT to goal
        { id: 'e1', source: 'f1', target: 'f2' },
      ],
    )
    const { result } = renderHook(() => useModelHealth())
    const bridge = result.current.find(i => i.key === 'no-bridge')
    expect(bridge).toBeDefined()
    expect(bridge!.severity).toBe('blocker')
  })
})
