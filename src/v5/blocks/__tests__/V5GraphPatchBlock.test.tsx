/**
 * V5GraphPatchBlock DOM tests — Workstream 1 (Journey 3 / Journey 6).
 *
 * Asserts the receipt rendering does NOT leak raw IDs, schema field names,
 * operator codes, or before/after JSON keys into the default UI surface.
 *
 * Mocks `useCanvasStore` so the component sees a controlled set of nodes
 * for label resolution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import type { V5GraphPatchBlock as V5GraphPatchBlockType } from '../../../canvas/conversation/types'
import { RAW_ID_PATTERN } from '../../../canvas/conversation/friendlyOperation'

// Mock the canvas store so the block uses our controlled nodes/edges.
const NODES = [
  { id: 'fac_team_morale', data: { label: 'team morale' } },
  { id: 'fac_morale', data: { label: 'team morale' } },
  { id: 'goal_outcome', data: { label: 'overall outcome' } },
]
const EDGES = [
  { id: 'edge_morale_to_outcome', source: 'fac_morale', target: 'goal_outcome' },
]

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (selector: (s: { nodes: unknown; edges: unknown }) => unknown) =>
    selector({ nodes: NODES, edges: EDGES }),
}))

// Mock the freshness hook so each test can control the verdict
// independently. Default is the neutral 'unknown' verdict (no hint).
const mockFreshnessState = vi.fn(() => ({
  freshness: 'unknown' as const,
  reason: null,
  recommendedAction: 'continue_editing' as const,
  inputsMissing: [],
}))

vi.mock('../../../lib/useAnalysisFreshnessState', () => ({
  useAnalysisFreshnessState: () => mockFreshnessState(),
}))

// Import AFTER the mock so the component uses the mocked store.
import { V5GraphPatchBlock } from '../V5GraphPatchBlock'

const FORBIDDEN_TERMS = [
  'target_id',
  'operator',
  'noop',
  'fact_type',
  'graph_hash',
  'set_factor_value',
  'add_constraint',
  'adjust_edge_strength',
  'before',
  'after',
]

function expectNoLeakInDOM(): void {
  const card = screen.getByTestId('v5-graph-patch')
  const rendered = card.textContent ?? ''
  expect(rendered).not.toMatch(RAW_ID_PATTERN)
  for (const term of FORBIDDEN_TERMS) {
    expect(rendered.toLowerCase()).not.toContain(term)
  }
}

beforeEach(() => {
  cleanup()
  mockFreshnessState.mockReturnValue({
    freshness: 'unknown',
    reason: null,
    recommendedAction: 'continue_editing',
    inputsMissing: [],
  })
})

describe('V5GraphPatchBlock — clean receipt rendering', () => {
  it('renders set_factor_value as "Updated factor" + entity + numeric diff', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.5 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-graph-patch-action').textContent).toBe('Updated factor')
    expect(screen.getByTestId('v5-graph-patch-entity').textContent).toBe('team morale')
    expect(screen.getByTestId('v5-graph-patch-change').textContent).toBe('0.5 → 0.7')
    expect(screen.getByTestId('v5-graph-patch-status').textContent).toBe('Applied')
    expectNoLeakInDOM()
  })

  it('renders add_constraint as "Added constraint" + label + value with currency', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'add_constraint',
      target_id: 'con_budget',
      before: null,
      after: { label: 'budget', value: 50000, unit: 'GBP', operator: 'lte' },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-graph-patch-action').textContent).toBe('Added constraint')
    expect(screen.getByTestId('v5-graph-patch-entity').textContent).toBe('budget')
    expect(screen.getByTestId('v5-graph-patch-change').textContent).toBe('≤ £50,000')
    expectNoLeakInDOM()
  })

  it('renders adjust_edge_strength as "Adjusted connection" + endpoints + numeric diff', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'edge_morale_to_outcome',
      before: { strength: 0.3 },
      after: { strength: 0.6 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-graph-patch-action').textContent).toBe('Adjusted connection')
    expect(screen.getByTestId('v5-graph-patch-entity').textContent).toBe('team morale → overall outcome')
    expect(screen.getByTestId('v5-graph-patch-change').textContent).toBe('0.3 → 0.6')
    expectNoLeakInDOM()
  })

  it('renders noop as "No change" with the no-change action label', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'noop',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.7 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-graph-patch-status').textContent).toBe('No change')
    expect(screen.getByTestId('v5-graph-patch-action').textContent).toBe('Factor already at this value')
    expect(screen.queryByTestId('v5-graph-patch-change')).toBeNull()
    expectNoLeakInDOM()
  })

  it('falls back to generic element type when canvas-store label is missing (no leak)', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_unmapped_factor',
      before: { value: 0.5 },
      after: { value: 0.8 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-graph-patch-entity').textContent).toBe('factor')
    expectNoLeakInDOM()
  })

  it('does not render entity row when no friendly label resolves at all', () => {
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'edge_unknown',
      before: { strength: 0.3 },
      after: { strength: 0.6 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.queryByTestId('v5-graph-patch-entity')).toBeNull()
    expectNoLeakInDOM()
  })

  it('shows freshness hint when applied and prior analysis is now stale', () => {
    mockFreshnessState.mockReturnValue({
      freshness: 'stale',
      reason: 'graph_hash_diverged',
      recommendedAction: 'rerun_analysis',
      inputsMissing: [],
    })
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.5 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.getByTestId('v5-graph-patch-freshness-hint').textContent).toBe(
      'Latest analysis is now out of date.',
    )
    expectNoLeakInDOM()
  })

  it('does NOT show freshness hint when freshness is fresh / none / unknown', () => {
    for (const freshness of ['fresh', 'none', 'unknown'] as const) {
      mockFreshnessState.mockReturnValue({
        freshness,
        reason: null,
        recommendedAction: freshness === 'fresh' ? 'view_results' : 'continue_editing',
        inputsMissing: [],
      })
      const block: V5GraphPatchBlockType = {
        type: 'v5_graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'fac_team_morale',
        before: { value: 0.5 },
        after: { value: 0.7 },
      }
      const { unmount } = render(<V5GraphPatchBlock block={block} />)
      expect(screen.queryByTestId('v5-graph-patch-freshness-hint')).toBeNull()
      unmount()
    }
  })

  it('does NOT show freshness hint on noop status (no impact change to surface)', () => {
    mockFreshnessState.mockReturnValue({
      freshness: 'stale',
      reason: 'graph_hash_diverged',
      recommendedAction: 'rerun_analysis',
      inputsMissing: [],
    })
    const block: V5GraphPatchBlockType = {
      type: 'v5_graph_patch',
      status: 'noop',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.7 },
      after: { value: 0.7 },
    }
    render(<V5GraphPatchBlock block={block} />)
    expect(screen.queryByTestId('v5-graph-patch-freshness-hint')).toBeNull()
  })
})
