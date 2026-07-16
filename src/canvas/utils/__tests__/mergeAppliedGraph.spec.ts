/**
 * Tests for mergeAppliedGraphAdditive (POC Lane C — applied-edit receipt
 * ingestion on a non-empty canvas).
 *
 * Uses the REAL canvas store (mirrors the hook-level fixture in
 * useConversation.hook.spec.ts) so history, validation, and setState
 * behaviour are exercised for real.
 *
 * Covers:
 * - additive merge: missing wire nodes/edges added, existing untouched
 * - draft-path mapper parity (observed_state → observedState, kind → type)
 * - endpoint-pair dedupe (locally rewritten edge ids don't re-add)
 * - dangling-edge fail-closed drop
 * - fallback edge id collision handling
 * - strict no-op when the receipt carries nothing new
 * - deterministic placement right of the existing bounding box
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mergeAppliedGraphAdditive } from '../mergeAppliedGraph'
import { useCanvasStore } from '../../store'
import { logger } from '../../../lib/logger'

const EXISTING_NODES = [
  {
    id: 'goal-1',
    type: 'goal',
    position: { x: 400, y: 40 },
    data: { kind: 'goal', label: 'Revenue' },
  },
  {
    id: 'factor-1',
    type: 'factor',
    position: { x: 40, y: 200 },
    data: { kind: 'factor', label: 'Spend', observedState: { value: 100 } },
  },
]

const EXISTING_EDGES = [
  {
    id: 'e-0', // locally rewritten fallback id (draft-path mapper)
    source: 'factor-1',
    target: 'goal-1',
    type: 'styled',
    data: { weight: 0.7, direction: 'positive' },
  },
]

function seedCanvas() {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    nodes: structuredClone(EXISTING_NODES) as any,
    edges: structuredClone(EXISTING_EDGES) as any,
    ceeAnalysisReady: null,
  } as any)
}

beforeEach(() => {
  seedCanvas()
})

describe('mergeAppliedGraphAdditive', () => {
  it('adds wire nodes/edges missing from the canvas and leaves existing elements untouched', () => {
    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 100 } },
        { id: 'factor-2', kind: 'factor', label: 'Churn rate', observed_state: { value: 0.05 } },
      ],
      edges: [
        { id: 'factor-1::goal-1::0', from: 'factor-1', to: 'goal-1', weight: 0.7 },
        { id: 'factor-2::goal-1::0', from: 'factor-2', to: 'goal-1', weight: -0.4 },
      ],
    } as any)

    expect(result).toEqual({ addedNodeCount: 1, addedEdgeCount: 1 })

    const { nodes, edges } = useCanvasStore.getState()
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)

    // Draft-path mapper parity on the added node.
    const added = nodes.find((n) => n.id === 'factor-2') as any
    expect(added?.type).toBe('factor')
    expect(added?.data?.kind).toBe('factor')
    expect(added?.data?.label).toBe('Churn rate')
    expect(added?.data?.observedState).toEqual({ value: 0.05 })

    // Added edge mapped with direction inference from the signed weight.
    const addedEdge = edges.find((e) => e.source === 'factor-2') as any
    expect(addedEdge?.target).toBe('goal-1')
    expect(addedEdge?.data?.direction).toBe('negative')
    expect(addedEdge?.data?.weight).toBeCloseTo(0.4)

    // Existing elements untouched (position AND local data preserved).
    const factor1 = nodes.find((n) => n.id === 'factor-1') as any
    expect(factor1?.position).toEqual({ x: 40, y: 200 })
    expect(factor1?.data?.observedState).toEqual({ value: 100 })
  })

  it('places added nodes right of the existing bounding box (no re-layout of existing nodes)', () => {
    mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'A' },
        { id: 'factor-3', kind: 'factor', label: 'B' },
      ],
      edges: [],
    } as any)

    const { nodes } = useCanvasStore.getState()
    const maxExistingX = 400
    const added2 = nodes.find((n) => n.id === 'factor-2') as any
    const added3 = nodes.find((n) => n.id === 'factor-3') as any
    expect(added2.position.x).toBeGreaterThan(maxExistingX)
    expect(added3.position.x).toBe(added2.position.x)
    expect(added3.position.y).toBeGreaterThan(added2.position.y)
    // Existing nodes did not move.
    expect((nodes.find((n) => n.id === 'goal-1') as any).position).toEqual({ x: 400, y: 40 })
  })

  it('does not re-add an existing edge whose local id differs from the wire id (endpoint-pair dedupe)', () => {
    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      // Same endpoints as canvas edge 'e-0', but under CEE's composite id.
      edges: [{ id: 'factor-1::goal-1::0', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    } as any)

    expect(result).toEqual({ addedNodeCount: 0, addedEdgeCount: 0 })
    expect(useCanvasStore.getState().edges).toHaveLength(1)
  })

  it('drops a dangling wire edge fail-closed (endpoint not on canvas and not being added)', () => {
    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      // 'ghost-1' is neither on the canvas nor in the wire node list.
      edges: [{ id: 'ghost-1::goal-1::0', from: 'ghost-1', to: 'goal-1', weight: 0.5 }],
    } as any)

    expect(result).toEqual({ addedNodeCount: 0, addedEdgeCount: 0 })
    expect(useCanvasStore.getState().edges).toHaveLength(1)
  })

  it('uniquifies the mapper fallback edge id against existing canvas ids', () => {
    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'Churn rate' },
      ],
      // No id on the wire edge → mapper falls back to `e-0`, which the
      // canvas already uses for a DIFFERENT edge.
      edges: [{ from: 'factor-2', to: 'goal-1', weight: 0.3 }],
    } as any)

    expect(result).toEqual({ addedNodeCount: 1, addedEdgeCount: 1 })
    const { edges } = useCanvasStore.getState()
    expect(edges).toHaveLength(2)
    const ids = edges.map((e) => e.id)
    expect(new Set(ids).size).toBe(2)
    const addedEdge = edges.find((e) => e.source === 'factor-2') as any
    expect(addedEdge.id).not.toBe('e-0')
  })

  it('is a strict no-op (no history entry) when the receipt carries nothing new', () => {
    const historyBefore = (useCanvasStore.getState() as any).history?.past?.length ?? 0
    const nodesBefore = useCanvasStore.getState().nodes

    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 250 } },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    } as any)

    expect(result).toEqual({ addedNodeCount: 0, addedEdgeCount: 0 })
    const historyAfter = (useCanvasStore.getState() as any).history?.past?.length ?? 0
    expect(historyAfter).toBe(historyBefore)
    // Node identity preserved — no store write at all.
    expect(useCanvasStore.getState().nodes).toBe(nodesBefore)
  })

  it('handles the nested graph shape ({ graph: { nodes, edges } })', () => {
    const result = mergeAppliedGraphAdditive({
      graph: {
        nodes: [
          { id: 'goal-1', kind: 'goal', label: 'Revenue' },
          { id: 'factor-1', kind: 'factor', label: 'Spend' },
          { id: 'risk-1', kind: 'risk', label: 'Regulation' },
        ],
        edges: [],
      },
    } as any)

    expect(result).toEqual({ addedNodeCount: 1, addedEdgeCount: 0 })
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain('risk-1')
  })
})

// ---------------------------------------------------------------------------
// Fixup round (adversarial review on PR #266)
// ---------------------------------------------------------------------------

describe('mergeAppliedGraphAdditive — zero-overlap structural guard', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('DROPS the merge and warns when the wire graph shares zero node ids with the canvas', () => {
    // An applied receipt always contains the committed graph, which supersets
    // the canvas (minus removals) — zero id overlap means this draft_graph is
    // a misdrafted FRESH graph (fresh scenario_id + populated canvas + first
    // brief-shaped message slips past CEE's continuation guard). Grafting it
    // would union two unrelated graphs.
    const nodesBefore = useCanvasStore.getState().nodes
    const edgesBefore = useCanvasStore.getState().edges

    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal_1', kind: 'goal', label: 'Unrelated goal' },
        { id: 'opt_1', kind: 'option', label: 'Unrelated option' },
        { id: 'out_1', kind: 'outcome', label: 'Unrelated outcome' },
      ],
      edges: [{ id: 'opt_1::out_1::0', from: 'opt_1', to: 'out_1', weight: 0.5 }],
    } as any)

    expect(result).toEqual({ addedNodeCount: 0, addedEdgeCount: 0 })
    // Store untouched — identity preserved, nothing grafted.
    expect(useCanvasStore.getState().nodes).toBe(nodesBefore)
    expect(useCanvasStore.getState().edges).toBe(edgesBefore)
    // Warn fired (structured logging, house pattern).
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toBe('merge_applied_graph.zero_overlap_drop')
  })

  it('still merges the normal superset receipt (overlap present) without warning', () => {
    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'Churn rate' },
      ],
      edges: [],
    } as any)

    expect(result).toEqual({ addedNodeCount: 1, addedEdgeCount: 0 })
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('mergeAppliedGraphAdditive — review fixups (edge-pair self-dedupe, staleness flags)', () => {
  it('dedupes two NEW wire edges sharing the same endpoint pair against each other', () => {
    // Direct setState bypasses addEdge's duplicate guard, so the merge must
    // self-dedupe wire edges that share an endpoint pair.
    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'Churn rate' },
      ],
      edges: [
        { id: 'factor-2::goal-1::0', from: 'factor-2', to: 'goal-1', weight: 0.3 },
        { id: 'factor-2::goal-1::1', from: 'factor-2', to: 'goal-1', weight: 0.9 },
      ],
    } as any)

    expect(result).toEqual({ addedNodeCount: 1, addedEdgeCount: 1 })
    const pairs = useCanvasStore
      .getState()
      .edges.filter((e) => e.source === 'factor-2' && e.target === 'goal-1')
    expect(pairs).toHaveLength(1)
  })

  it('flips graphEditedSinceLastRun/analysisStateReady even when pushHistory dedupes the snapshot', () => {
    // pushToHistory early-returns (without flipping the flags) when the
    // current state equals the last history snapshot — reachable when a
    // prior push already snapshotted the exact pre-merge state. The merge
    // must set the staleness flags explicitly, not rely on the push.
    useCanvasStore.getState().pushHistory()
    useCanvasStore.setState({
      graphEditedSinceLastRun: false,
      analysisStateReady: true,
    } as any)

    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'Churn rate' },
      ],
      edges: [],
    } as any)

    expect(result).toEqual({ addedNodeCount: 1, addedEdgeCount: 0 })
    expect(useCanvasStore.getState().graphEditedSinceLastRun).toBe(true)
    expect(useCanvasStore.getState().analysisStateReady).toBe(false)
  })

  it('marks the freshness overlay dirty on a structural add — the banner must never keep claiming currency', () => {
    // The freshness banners read analysisFreshnessDirty, not the legacy
    // graphEditedSinceLastRun flag — see mergeAppliedGraphAdditive's commit block.
    useCanvasStore.setState({ analysisFreshnessDirty: false } as any)

    mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'risk-new', kind: 'risk', label: 'Key engineer quits' },
      ],
      edges: [],
    } as any)

    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('does NOT dirty the freshness overlay on a nothing-new receipt (strict no-op stays a no-op)', () => {
    useCanvasStore.setState({ analysisFreshnessDirty: false } as any)

    const result = mergeAppliedGraphAdditive({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      edges: [],
    } as any)

    expect(result).toEqual({ addedNodeCount: 0, addedEdgeCount: 0 })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
})
