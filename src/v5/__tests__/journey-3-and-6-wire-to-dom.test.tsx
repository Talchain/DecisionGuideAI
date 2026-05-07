/**
 * Workstream 1 — wire-to-DOM integrated proof for Journeys 3 and 6.
 *
 * Takes a V5 OlumiResponse envelope (the shape CEE actually emits on a
 * mutation turn) and proves the full UI chain:
 *
 *   wire envelope
 *     → applyV5State (writes ceeAnalysisReady incl. freshness)
 *     → mapV5Blocks (graph_patch → v5_graph_patch)
 *     → V5GraphPatchBlock renders friendly receipt
 *     → useAnalysisFreshnessState (mocked from store snapshot)
 *     → freshness hint surfaces when stale
 *     → no internal terms appear in the DOM
 *
 * This catches regressions in any layer in one journey-shaped test
 * without depending on a Playwright run. Sonnet/CEE are NOT exercised
 * (the envelope is constructed in the test); the proof is that the UI
 * end of the V5 contract behaves correctly given a well-formed envelope.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import { mapV5Blocks } from '../blocks/mapV5Blocks'
import { RAW_ID_PATTERN } from '../../canvas/conversation/friendlyOperation'
import type { V5GraphPatchBlock as V5GraphPatchBlockType } from '../../canvas/conversation/types'
import type { AnalysisFreshnessState } from '../../lib/analysisFreshnessState'

// ─── Canvas-store mock ────────────────────────────────────────────────────
//
// The V5GraphPatchBlock component reads nodes/edges from useCanvasStore so
// it can resolve raw target_id → friendly label. Mock it with the same
// node set the test envelope references.

const NODES = [
  { id: 'fac_team_morale', data: { label: 'team morale' } },
  { id: 'goal_outcome', data: { label: 'overall outcome' } },
]
const EDGES = [
  { id: 'edge_morale_to_outcome', source: 'fac_team_morale', target: 'goal_outcome' },
]

vi.mock('../../canvas/store', () => ({
  useCanvasStore: (selector: (s: { nodes: unknown; edges: unknown }) => unknown) =>
    selector({ nodes: NODES, edges: EDGES }),
}))

// ─── Freshness hook mock ──────────────────────────────────────────────────
//
// Each test sets the verdict the freshness derivation would produce given
// the canvas-store ceeAnalysisReady (written by applyV5State a moment
// earlier). We assert on whether the hint appears, not on the
// derivation itself — the derivation is unit-tested separately.

const mockFreshnessState = vi.fn<[], AnalysisFreshnessState>(() => ({
  freshness: 'unknown',
  reason: null,
  recommendedAction: 'continue_editing',
  inputsMissing: [],
}))

vi.mock('../../lib/useAnalysisFreshnessState', () => ({
  useAnalysisFreshnessState: () => mockFreshnessState(),
}))

const { V5GraphPatchBlock } = await import('../blocks/V5GraphPatchBlock')

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeApplicatorStore(): {
  store: V5ApplicatorStore
  setCeeAnalysisReady: ReturnType<typeof vi.fn>
} {
  const setCeeAnalysisReady = vi.fn()
  return {
    store: {
      setCurrentStage: vi.fn(),
      updateNode: vi.fn(),
      updateEdgeData: vi.fn(),
      setRunMeta: vi.fn(),
      setCeeAnalysisReady,
      nodes: NODES.map((n) => ({ ...n, type: n.id.startsWith('goal_') ? 'goal' : 'factor' })) as V5ApplicatorStore['nodes'],
      edges: EDGES as V5ApplicatorStore['edges'],
    },
    setCeeAnalysisReady,
  }
}

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
] as const

function expectNoLeakInDOM(): void {
  const card = screen.getByTestId('v5-graph-patch')
  const text = card.textContent ?? ''
  expect(text).not.toMatch(RAW_ID_PATTERN)
  for (const term of FORBIDDEN_TERMS) {
    expect(text.toLowerCase()).not.toContain(term)
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

// ─── Wire envelopes ───────────────────────────────────────────────────────
//
// These mirror the shape CEE emits on the wire after a successful
// mutation turn (see CEE journey-3-and-6-envelope-contract.test.ts for
// the producing side). The graph_patch block here is V5-shape.

function journey3Envelope(opts: { freshness: 'fresh' | 'stale' | 'unknown' | 'none' }): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: 'I have applied a budget constraint of at most £50,000.',
    blocks: [
      {
        type: 'graph_patch',
        status: 'applied',
        operation: 'add_constraint',
        target_id: 'con_budget',
        before: null,
        after: { label: 'budget', value: 50000, unit: 'GBP', operator: 'lte' },
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    // analysis_ready is a passthrough optional on the schema — cast
    // through unknown to avoid re-deriving the z.infer shape.
    ...({
      analysis_ready: {
        status: 'ready',
        goal_node_id: 'goal_outcome',
        options: [
          { id: 'opt-a', status: 'ready', interventions: { 'fac_team_morale': { value: 1 } } },
        ],
        freshness: opts.freshness,
        freshness_reason: opts.freshness === 'stale' ? 'graph_hash_diverged' : 'graph_hash_match',
      },
    } as unknown as Partial<OlumiResponse>),
  }
}

function journey6Envelope(opts: { freshness: 'fresh' | 'stale' | 'unknown' | 'none' }): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: 'I have updated team morale from 0.5 to 0.7.',
    blocks: [
      {
        type: 'graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'fac_team_morale',
        before: { value: 0.5 },
        after: { value: 0.7 },
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'decide',
    ...({
      analysis_ready: {
        status: 'ready',
        goal_node_id: 'goal_outcome',
        options: [
          { id: 'opt-a', status: 'ready', interventions: { 'fac_team_morale': { value: 1 } } },
        ],
        freshness: opts.freshness,
        freshness_reason: opts.freshness === 'stale' ? 'graph_hash_diverged' : 'graph_hash_match',
      },
    } as unknown as Partial<OlumiResponse>),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Workstream 1 — Journey 3 wire-to-DOM (add_constraint)', () => {
  it('applyV5State writes ceeAnalysisReady with the freshness verdict from the wire', () => {
    const { store, setCeeAnalysisReady } = makeApplicatorStore()
    const envelope = journey3Envelope({ freshness: 'stale' })

    const result = applyV5State(envelope, store)

    expect(result.applied).toContain('analysis_ready:set')
    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
    const written = setCeeAnalysisReady.mock.calls[0][0]
    expect(written.freshness).toBe('stale')
    expect(written.freshness_reason).toBe('graph_hash_diverged')
  })

  it('mapV5Blocks renders a clean graph_patch receipt for the constraint', () => {
    const envelope = journey3Envelope({ freshness: 'stale' })
    const blocks = mapV5Blocks(envelope.blocks)
    expect(blocks).toHaveLength(1)
    const v5Block = blocks[0] as V5GraphPatchBlockType
    expect(v5Block.type).toBe('v5_graph_patch')
    expect(v5Block.operation).toBe('add_constraint')
    expect(v5Block.status).toBe('applied')
    expect(v5Block.target_id).toBe('con_budget')
  })

  it('V5GraphPatchBlock renders the friendly receipt + stale freshness hint', () => {
    mockFreshnessState.mockReturnValue({
      freshness: 'stale',
      reason: 'graph_hash_diverged',
      recommendedAction: 'rerun_analysis',
      inputsMissing: [],
    })
    const envelope = journey3Envelope({ freshness: 'stale' })
    const block = mapV5Blocks(envelope.blocks)[0] as V5GraphPatchBlockType

    render(<V5GraphPatchBlock block={block} />)

    expect(screen.getByTestId('v5-graph-patch-status').textContent).toBe('Applied')
    expect(screen.getByTestId('v5-graph-patch-action').textContent).toBe('Added constraint')
    expect(screen.getByTestId('v5-graph-patch-entity').textContent).toBe('budget')
    expect(screen.getByTestId('v5-graph-patch-change').textContent).toBe('≤ £50,000')
    expect(screen.getByTestId('v5-graph-patch-freshness-hint').textContent).toBe(
      'Latest analysis is now out of date.',
    )
    expectNoLeakInDOM()
  })

  it('V5GraphPatchBlock suppresses freshness hint on a fresh-after-mutation turn', () => {
    mockFreshnessState.mockReturnValue({
      freshness: 'fresh',
      reason: 'graph_hash_match',
      recommendedAction: 'view_results',
      inputsMissing: [],
    })
    const envelope = journey3Envelope({ freshness: 'fresh' })
    const block = mapV5Blocks(envelope.blocks)[0] as V5GraphPatchBlockType

    render(<V5GraphPatchBlock block={block} />)
    expect(screen.queryByTestId('v5-graph-patch-freshness-hint')).toBeNull()
    expectNoLeakInDOM()
  })
})

describe('Workstream 1 — Journey 6 wire-to-DOM (set_factor_value)', () => {
  it('applyV5State writes ceeAnalysisReady with the freshness verdict from the wire', () => {
    const { store, setCeeAnalysisReady } = makeApplicatorStore()
    const envelope = journey6Envelope({ freshness: 'stale' })

    const result = applyV5State(envelope, store)

    expect(result.applied).toContain('analysis_ready:set')
    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
    expect(setCeeAnalysisReady.mock.calls[0][0].freshness).toBe('stale')
  })

  it('V5GraphPatchBlock renders a clean numeric-update receipt + stale hint', () => {
    mockFreshnessState.mockReturnValue({
      freshness: 'stale',
      reason: 'graph_hash_diverged',
      recommendedAction: 'rerun_analysis',
      inputsMissing: [],
    })
    const envelope = journey6Envelope({ freshness: 'stale' })
    const block = mapV5Blocks(envelope.blocks)[0] as V5GraphPatchBlockType

    render(<V5GraphPatchBlock block={block} />)

    expect(screen.getByTestId('v5-graph-patch-action').textContent).toBe('Updated factor')
    expect(screen.getByTestId('v5-graph-patch-entity').textContent).toBe('team morale')
    expect(screen.getByTestId('v5-graph-patch-change').textContent).toBe('0.5 → 0.7')
    expect(screen.getByTestId('v5-graph-patch-freshness-hint').textContent).toBe(
      'Latest analysis is now out of date.',
    )
    expectNoLeakInDOM()
  })
})
