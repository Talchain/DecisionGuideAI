import { beforeEach, describe, expect, it } from 'vitest'

import type { CEEGoalConstraint } from '../../../adapters/cee/types'
import { useCanvasStore } from '../../store'
import {
  canvasAnalyticallyMatchesCanonicalGraph,
  reconcileCanvasWithCanonicalGraph,
} from '../graphAuthority'

const CANONICAL_GRAPH = {
  nodes: [{ id: 'factor-1', kind: 'factor', label: 'Demand' }],
  edges: [],
}

const STALE_CONSTRAINT: CEEGoalConstraint = {
  constraint_id: 'constraint-stale',
  node_id: 'factor-1',
  operator: '<=',
  value: 5,
}

function seedCanvas(
  data: Record<string, unknown> = {},
  goalConstraints: CEEGoalConstraint[] | null = null,
): void {
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({
    currentScenarioId: '11111111-2222-4333-8444-555555555555',
    nodes: [{
      id: 'factor-1',
      type: 'factor',
      position: { x: 10, y: 20 },
      data: { label: 'Demand', kind: 'factor', ...data },
    }] as never,
    edges: [],
    goalConstraints,
    history: { past: [], future: [] },
    lastAuthoritativeGraph: null,
  })
}

describe('canonical graph analytical identity', () => {
  beforeEach(() => {
    localStorage.clear()
    seedCanvas()
  })

  it.each([
    ['factor_type', 'continuous'],
    ['intercept', 0.25],
    ['encoding_map', { low: 0, high: 1 }],
  ])('treats absent canonical %s as authoritative and removes the stale local value', (field, value) => {
    seedCanvas({ [field]: value })

    // Each row is independently discriminating: with only this extra field,
    // exactness must fail before reconciliation and pass after its removal.
    expect(canvasAnalyticallyMatchesCanonicalGraph(CANONICAL_GRAPH)).toBe(false)

    expect(reconcileCanvasWithCanonicalGraph(CANONICAL_GRAPH)).toMatchObject({
      ok: true,
      changed: true,
      hasProtections: false,
    })
    expect(useCanvasStore.getState().nodes[0]?.data).not.toHaveProperty(field)
    expect(canvasAnalyticallyMatchesCanonicalGraph(CANONICAL_GRAPH)).toBe(true)
  })

  it('normalises both absent and empty canonical constraints to no local constraint', () => {
    for (const graph of [CANONICAL_GRAPH, { ...CANONICAL_GRAPH, goal_constraints: [] }]) {
      seedCanvas({}, [STALE_CONSTRAINT])
      expect(canvasAnalyticallyMatchesCanonicalGraph(graph)).toBe(false)

      expect(reconcileCanvasWithCanonicalGraph(graph)).toMatchObject({
        ok: true,
        changed: true,
      })
      expect(useCanvasStore.getState().goalConstraints).toBeNull()
      expect(canvasAnalyticallyMatchesCanonicalGraph(graph)).toBe(true)
    }
  })

  it('applies the complete present projection and proves it by value', () => {
    const graph = {
      ...CANONICAL_GRAPH,
      nodes: [{
        ...CANONICAL_GRAPH.nodes[0],
        factor_type: 'continuous',
        intercept: 0.4,
        encoding_map: { low: 0, high: 1 },
      }],
      goal_constraints: [STALE_CONSTRAINT],
    }

    expect(reconcileCanvasWithCanonicalGraph(graph)).toMatchObject({ ok: true, changed: true })
    expect(useCanvasStore.getState().nodes[0]?.data).toMatchObject({
      factor_type: 'continuous',
      intercept: 0.4,
      encoding_map: { low: 0, high: 1 },
    })
    expect(useCanvasStore.getState().goalConstraints).toEqual([STALE_CONSTRAINT])
    expect(canvasAnalyticallyMatchesCanonicalGraph(graph)).toBe(true)
  })

  it.each([
    ['factor_type', 'continuous'],
    ['intercept', 0.25],
    ['encoding_map', { low: 0, high: 1 }],
  ])('fails the post-apply proof if a subscriber restores stale %s bytes', (field, value) => {
    seedCanvas({ [field]: value })
    let sabotaged = false
    const unsubscribe = useCanvasStore.subscribe((state) => {
      const node = state.nodes[0]
      if (sabotaged || !node || field in node.data) return
      sabotaged = true
      useCanvasStore.setState({
        nodes: [{ ...node, data: { ...node.data, [field]: value } }] as never,
      })
    })

    const result = reconcileCanvasWithCanonicalGraph(CANONICAL_GRAPH)
    unsubscribe()

    expect(sabotaged).toBe(true)
    expect(result).toMatchObject({
      ok: false,
      reason: 'analytical_projection_mismatch',
    })
    expect(canvasAnalyticallyMatchesCanonicalGraph(CANONICAL_GRAPH)).toBe(false)
  })

  it('fails the post-apply proof if a subscriber restores a stale constraint', () => {
    seedCanvas({}, [STALE_CONSTRAINT])
    let sabotaged = false
    const unsubscribe = useCanvasStore.subscribe((state) => {
      if (sabotaged || state.goalConstraints !== null) return
      sabotaged = true
      useCanvasStore.setState({ goalConstraints: [STALE_CONSTRAINT] })
    })

    const result = reconcileCanvasWithCanonicalGraph(CANONICAL_GRAPH)
    unsubscribe()

    expect(sabotaged).toBe(true)
    expect(result).toMatchObject({
      ok: false,
      reason: 'analytical_projection_mismatch',
    })
    expect(canvasAnalyticallyMatchesCanonicalGraph(CANONICAL_GRAPH)).toBe(false)
  })

  it('preserves an explicitly protected newer factor value while reporting a mixed projection', () => {
    const newerObservedState = { value: 0.9, baseline: 0.3, cap: 1 }
    seedCanvas({ observedState: newerObservedState })
    const graph = {
      ...CANONICAL_GRAPH,
      nodes: [{
        ...CANONICAL_GRAPH.nodes[0],
        observed_state: { value: 0.2, baseline: 0.1, cap: 1 },
      }],
    }

    expect(reconcileCanvasWithCanonicalGraph(graph, {
      nodes: [{
        nodeId: 'factor-1',
        fields: ['observedState'],
        data: { observedState: newerObservedState },
      }],
    })).toMatchObject({ ok: true, hasProtections: true })
    expect(useCanvasStore.getState().nodes[0]?.data.observedState).toEqual(newerObservedState)
    // The coordinator may retain this projection only while the factor writer's
    // independent Run hold remains; it is intentionally not the raw receipt.
    expect(canvasAnalyticallyMatchesCanonicalGraph(graph)).toBe(false)
  })
})
