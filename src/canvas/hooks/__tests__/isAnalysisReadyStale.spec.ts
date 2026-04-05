/**
 * Tests for isAnalysisReadyStale — ensures analysis_ready is invalidated
 * when the graph changes (new options, deleted nodes, label changes).
 */
import { describe, it, expect } from 'vitest'
import { isAnalysisReadyStale } from '../useV2Run'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAnalysisReady(overrides?: Partial<CEEAnalysisReady>): CEEAnalysisReady {
  return {
    goal_node_id: 'goal_1',
    options: [
      {
        id: 'opt_a',
        label: 'Option A',
        interventions: { factor_1: { value: 0.5, source: 'cee_hypothesis' } },
      },
      {
        id: 'opt_b',
        label: 'Option B',
        interventions: { factor_1: { value: 0.3, source: 'user_specified' } },
      },
    ],
    ...overrides,
  }
}

function makeNodes(
  ids: Array<{ id: string; kind: string; label?: string }>
): Array<{ id: string; data: Record<string, unknown> }> {
  return ids.map(({ id, kind, label }) => ({
    id,
    data: { kind, label: label ?? id },
  }))
}

const BASE_NODES = makeNodes([
  { id: 'goal_1', kind: 'goal' },
  { id: 'opt_a', kind: 'option', label: 'Option A' },
  { id: 'opt_b', kind: 'option', label: 'Option B' },
  { id: 'factor_1', kind: 'factor' },
])

const BASE_NODE_IDS = BASE_NODES.map((n) => n.id)

// ---------------------------------------------------------------------------
// Existing behaviour — deleted nodes
// ---------------------------------------------------------------------------

describe('isAnalysisReadyStale — deleted nodes (regression)', () => {
  it('returns not stale when graph is unchanged', () => {
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      new Set(BASE_NODE_IDS),
      BASE_NODE_IDS,
      BASE_NODES
    )
    expect(result.isStale).toBe(false)
  })

  it('returns stale when goal node is deleted', () => {
    const currentIds = BASE_NODE_IDS.filter((id) => id !== 'goal_1')
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      new Set(currentIds),
      BASE_NODE_IDS,
      BASE_NODES.filter((n) => n.id !== 'goal_1')
    )
    expect(result.isStale).toBe(true)
    expect(result.reason).toContain('goal node no longer exists')
  })

  it('returns stale when intervention target is deleted', () => {
    const currentIds = BASE_NODE_IDS.filter((id) => id !== 'factor_1')
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      new Set(currentIds),
      BASE_NODE_IDS,
      BASE_NODES.filter((n) => n.id !== 'factor_1')
    )
    expect(result.isStale).toBe(true)
    expect(result.reason).toContain('intervention target')
  })

  it('returns stale when an option node is deleted from the canvas', () => {
    const currentNodes = BASE_NODES.filter((n) => n.id !== 'opt_b')
    const currentIds = new Set(currentNodes.map((n) => n.id))
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      currentIds,
      BASE_NODE_IDS,
      currentNodes
    )
    expect(result.isStale).toBe(true)
    expect(result.reason).toContain('Option B')
    expect(result.reason).toContain('deleted')
  })

  it('returns not stale when storedNodeIds is null (backwards compat)', () => {
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      new Set(BASE_NODE_IDS),
      null,
      BASE_NODES
    )
    expect(result.isStale).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// New: added option nodes
// ---------------------------------------------------------------------------

describe('isAnalysisReadyStale — new option nodes', () => {
  it('returns stale when a new option node is added', () => {
    const newNodes = [
      ...BASE_NODES,
      { id: 'opt_c', data: { kind: 'option', label: 'Option C' } },
    ]
    const currentIds = new Set(newNodes.map((n) => n.id))
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      currentIds,
      BASE_NODE_IDS,
      newNodes
    )
    expect(result.isStale).toBe(true)
    expect(result.reason).toContain('new option nodes added')
    expect(result.reason).toContain('Option C')
  })

  it('returns not stale when a new non-option node is added (factor)', () => {
    const newNodes = [
      ...BASE_NODES,
      { id: 'factor_2', data: { kind: 'factor', label: 'Factor 2' } },
    ]
    const currentIds = new Set(newNodes.map((n) => n.id))
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      currentIds,
      BASE_NODE_IDS,
      newNodes
    )
    expect(result.isStale).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// New: option label changes
// ---------------------------------------------------------------------------

describe('isAnalysisReadyStale — option label changes', () => {
  it('returns stale when an option label changes', () => {
    const changedNodes = BASE_NODES.map((n) =>
      n.id === 'opt_a'
        ? { ...n, data: { ...n.data, label: 'Renamed Option A' } }
        : n
    )
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      new Set(BASE_NODE_IDS),
      BASE_NODE_IDS,
      changedNodes
    )
    expect(result.isStale).toBe(true)
    expect(result.reason).toContain('option label changed')
  })
})

// ---------------------------------------------------------------------------
// New: without currentNodes (backwards compat)
// ---------------------------------------------------------------------------

describe('isAnalysisReadyStale — without currentNodes param', () => {
  it('skips new-option and label checks gracefully', () => {
    const result = isAnalysisReadyStale(
      makeAnalysisReady(),
      new Set(BASE_NODE_IDS),
      BASE_NODE_IDS
      // no currentNodes arg
    )
    expect(result.isStale).toBe(false)
  })
})
