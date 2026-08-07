/**
 * Tests for reconcileAppliedGraph (POC Lane C — applied-edit receipt
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
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { useCanvasStore } from '../../store'
import { logger } from '../../../lib/logger'
// Derived, never hardcoded: the pair separator is a NUL, which is invisible
// in source and unwritable as a literal without corrupting the file.
import { edgePairKey } from '../graphIdentity'

// R-10: `counts()` and the store-seeding field set now live in
// `./__helpers__/mergeAppliedGraphHarness.ts`, shared with
// `mergeAppliedGraph.validation.spec.ts` — which had re-declared both, and had
// then asserted only 2 of the 6 counters because it skipped this `counts()`.
import { counts, seedCanvas as seedStore } from './__helpers__/mergeAppliedGraphHarness'

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
  seedStore(EXISTING_NODES, EXISTING_EDGES)
}

beforeEach(() => {
  seedCanvas()
})

describe('reconcileAppliedGraph', () => {
  it('adds wire nodes/edges missing from the canvas and leaves existing elements untouched', () => {
    const result = reconcileAppliedGraph({
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

    expect(result).toEqual(counts({ addedNodeCount: 1, addedEdgeCount: 1 }))

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
    reconcileAppliedGraph({
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
    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      // Same endpoints as canvas edge 'e-0', but under CEE's composite id.
      edges: [{ id: 'factor-1::goal-1::0', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    } as any)

    expect(result).toEqual(counts({ addedNodeCount: 0, addedEdgeCount: 0 }))
    expect(useCanvasStore.getState().edges).toHaveLength(1)
  })

  it('drops a dangling wire edge fail-closed (endpoint not on canvas and not being added)', () => {
    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      // 'ghost-1' is neither on the canvas nor in the wire node list.
      edges: [{ id: 'ghost-1::goal-1::0', from: 'ghost-1', to: 'goal-1', weight: 0.5 }],
    } as any)

    expect(result).toEqual(counts({ addedNodeCount: 0, addedEdgeCount: 0 }))
    expect(useCanvasStore.getState().edges).toHaveLength(1)
  })

  it('uniquifies the mapper fallback edge id against existing canvas ids', () => {
    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'Churn rate' },
      ],
      // No id on the wire edge → mapper falls back to `e-0`, which the
      // canvas already uses for a DIFFERENT edge.
      edges: [{ from: 'factor-2', to: 'goal-1', weight: 0.3 }],
    } as any)

    expect(result).toEqual(counts({ addedNodeCount: 1, addedEdgeCount: 1 }))
    const { edges } = useCanvasStore.getState()
    expect(edges).toHaveLength(2)
    const ids = edges.map((e) => e.id)
    expect(new Set(ids).size).toBe(2)
    const addedEdge = edges.find((e) => e.source === 'factor-2') as any
    expect(addedEdge.id).not.toBe('e-0')
  })

  // ---------------------------------------------------------------------
  // B2 (Codex deep review, 2026-07-18) — CORRECTED, NOT DELETED.
  //
  // This case used to be titled "is a strict no-op (no history entry) when
  // the receipt carries nothing new" and fed a receipt in which factor-1's
  // observed value was 250 while the canvas held 100 — then asserted that
  // NOTHING happened. That is the defect, written down as an expectation:
  // the green suite was pinning the data-loss. A receipt carrying a value
  // the canvas does not have is not "nothing new", it is the whole point of
  // the edit.
  //
  // The genuine no-op case (a receipt that really does carry nothing new)
  // still exists and is asserted separately, below and at the end of the
  // file — losing it would have been the opposite mistake.
  // ---------------------------------------------------------------------
  it('APPLIES an updated value on an existing node (B2 — this receipt is authoritative)', () => {
    const historyBefore = (useCanvasStore.getState() as any).history?.past?.length ?? 0

    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 250 } },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    } as any)

    expect(result).toEqual(counts({ updatedNodeCount: 1 }))

    // The value CEE committed is now what the canvas shows.
    const factor1 = useCanvasStore.getState().nodes.find((n) => n.id === 'factor-1') as any
    expect(factor1?.data?.observedState).toEqual({ value: 250 })

    // ...and it is a real, undoable mutation, not a silent overwrite.
    const historyAfter = (useCanvasStore.getState() as any).history?.past?.length ?? 0
    expect(historyAfter).toBe(historyBefore + 1)

    // LAYOUT PRESERVED — the whole reason this is an overlay and not a
    // replace. CEE's node schema has no position field; if the reconcile
    // took the mapper's node wholesale, this would be {x:0,y:0}.
    expect(factor1?.position).toEqual({ x: 40, y: 200 })
  })

  it('is a strict no-op (no history entry, no store write) when the receipt genuinely matches the canvas', () => {
    const historyBefore = (useCanvasStore.getState() as any).history?.past?.length ?? 0
    const nodesBefore = useCanvasStore.getState().nodes
    const edgesBefore = useCanvasStore.getState().edges

    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        // Same value the canvas already holds.
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 100 } },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    } as any)

    expect(result).toEqual(counts())
    const historyAfter = (useCanvasStore.getState() as any).history?.past?.length ?? 0
    expect(historyAfter).toBe(historyBefore)
    // Identity preserved — no store write at all.
    expect(useCanvasStore.getState().nodes).toBe(nodesBefore)
    expect(useCanvasStore.getState().edges).toBe(edgesBefore)
  })

  it('handles the nested graph shape ({ graph: { nodes, edges } })', () => {
    const result = reconcileAppliedGraph({
      graph: {
        nodes: [
          { id: 'goal-1', kind: 'goal', label: 'Revenue' },
          { id: 'factor-1', kind: 'factor', label: 'Spend' },
          { id: 'risk-1', kind: 'risk', label: 'Regulation' },
        ],
        edges: [],
      },
    } as any)

    expect(result).toEqual(counts({ addedNodeCount: 1, addedEdgeCount: 0 }))
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain('risk-1')
  })
})

// ---------------------------------------------------------------------------
// Fixup round (adversarial review on PR #266)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// B2 — deletions, and the acknowledgement guard that makes them safe
// ---------------------------------------------------------------------------

describe('reconcileAppliedGraph — deletions', () => {
  it('REMOVES a node CEE previously acknowledged and now omits (absence == deletion)', () => {
    // CEE has seen both factor-1 and goal-1 (e.g. from the draft or a prior
    // receipt), so their absence from this receipt is authoritative.
    useCanvasStore.getState().setLastAuthoritativeGraph({
      nodeIds: ['goal-1', 'factor-1'],
      edgePairs: [edgePairKey('factor-1', 'goal-1')],
    })

    const result = reconcileAppliedGraph({
      nodes: [{ id: 'goal-1', kind: 'goal', label: 'Revenue' }],
      edges: [],
    } as any)

    // The node AND the edge that hung off it are gone.
    expect(result).toEqual(counts({ removedNodeCount: 1, removedEdgeCount: 1 }))
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['goal-1'])
    expect(useCanvasStore.getState().edges).toHaveLength(0)
  })

  it('does NOT remove a local node CEE has never acknowledged (unsaved local work survives)', () => {
    // The user added factor-99 seconds ago; the 1500ms autosave has not run,
    // so CEE built its post-state without it. Absence here is ignorance, not
    // deletion — removing it would be a worse bug than the one B2 fixes.
    useCanvasStore.setState({
      nodes: [
        ...structuredClone(EXISTING_NODES),
        { id: 'factor-99', type: 'factor', position: { x: 900, y: 900 }, data: { kind: 'factor', label: 'Local only' } },
      ] as any,
    })
    useCanvasStore.getState().setLastAuthoritativeGraph({
      nodeIds: ['goal-1', 'factor-1'], // factor-99 deliberately absent
      edgePairs: [edgePairKey('factor-1', 'goal-1')],
    })

    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 100 } },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    } as any)

    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain('factor-99')
  })

  it('removes NOTHING when no authoritative graph has been recorded yet (fail-safe)', () => {
    useCanvasStore.getState().setLastAuthoritativeGraph(null)

    const result = reconcileAppliedGraph({
      nodes: [{ id: 'goal-1', kind: 'goal', label: 'Revenue' }],
      edges: [],
    } as any)

    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().nodes).toHaveLength(2)
  })

  it('records the receipt as the new authoritative set even on a no-op turn', () => {
    // Otherwise an idempotent turn would leave the acknowledgement set stale
    // and a LATER receipt could not delete what this one confirmed.
    useCanvasStore.getState().setLastAuthoritativeGraph(null)

    reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 100 } },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    } as any)

    expect(useCanvasStore.getState().lastAuthoritativeGraph).toEqual({
      nodeIds: ['goal-1', 'factor-1'],
      edgePairs: [edgePairKey('factor-1', 'goal-1')],
    })
  })
})

describe('reconcileAppliedGraph — updates preserve layout and local-only data', () => {
  it('keeps position/size/selection while overlaying the wire value', () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: 'factor-1',
          type: 'factor',
          position: { x: 40, y: 200 },
          width: 180,
          height: 90,
          selected: true,
          data: { kind: 'factor', label: 'Spend', observedState: { value: 100 }, is_baseline: true },
        },
        ...structuredClone(EXISTING_NODES).filter((n) => n.id === 'goal-1'),
      ] as any,
    })

    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 250 } },
      ],
      edges: [],
    } as any)

    expect(result).toEqual(counts({ updatedNodeCount: 1 }))
    const f = useCanvasStore.getState().nodes.find((n) => n.id === 'factor-1') as any
    expect(f.data.observedState).toEqual({ value: 250 })
    // Layout-only React Flow state survives untouched.
    expect(f.position).toEqual({ x: 40, y: 200 })
    expect(f.width).toBe(180)
    expect(f.height).toBe(90)
    expect(f.selected).toBe(true)
    // UI-side backfill the wire never mentions is not wiped.
    expect(f.data.is_baseline).toBe(true)
  })

  it('does not splat edge-mapper DEFAULTS over a locally-tuned edge', () => {
    // A wire edge carrying no analytical fields must not overwrite the
    // canvas edge's weight/direction with DEFAULT_EDGE_DATA — otherwise
    // every receipt would churn history and reset the user's edges.
    const edgesBefore = useCanvasStore.getState().edges
    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 100 } },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1' }],
    } as any)

    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().edges).toBe(edgesBefore)
    expect((edgesBefore[0] as any).data.weight).toBeCloseTo(0.7)
  })

  it('APPLIES a changed edge weight from the receipt', () => {
    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 100 } },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1', weight: -0.9 }],
    } as any)

    expect(result).toEqual(counts({ updatedEdgeCount: 1 }))
    const e = useCanvasStore.getState().edges[0] as any
    expect(e.data.weight).toBeCloseTo(0.9)
    expect(e.data.direction).toBe('negative')
  })
})

describe('reconcileAppliedGraph — zero-overlap structural guard', () => {
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

    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal_1', kind: 'goal', label: 'Unrelated goal' },
        { id: 'opt_1', kind: 'option', label: 'Unrelated option' },
        { id: 'out_1', kind: 'outcome', label: 'Unrelated outcome' },
      ],
      edges: [{ id: 'opt_1::out_1::0', from: 'opt_1', to: 'out_1', weight: 0.5 }],
    } as any)

    expect(result).toEqual(counts({ addedNodeCount: 0, addedEdgeCount: 0 }))
    // Store untouched — identity preserved, nothing grafted.
    expect(useCanvasStore.getState().nodes).toBe(nodesBefore)
    expect(useCanvasStore.getState().edges).toBe(edgesBefore)
    // Warn fired (structured logging, house pattern).
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toBe('merge_applied_graph.zero_overlap_drop')
  })

  it('still merges the normal superset receipt (overlap present) without warning', () => {
    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'Churn rate' },
      ],
      edges: [],
    } as any)

    expect(result).toEqual(counts({ addedNodeCount: 1, addedEdgeCount: 0 }))
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('reconcileAppliedGraph — review fixups (edge-pair self-dedupe, staleness flags)', () => {
  it('dedupes two NEW wire edges sharing the same endpoint pair against each other', () => {
    // Direct setState bypasses addEdge's duplicate guard, so the merge must
    // self-dedupe wire edges that share an endpoint pair.
    const result = reconcileAppliedGraph({
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

    expect(result).toEqual(counts({ addedNodeCount: 1, addedEdgeCount: 1 }))
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

    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'Churn rate' },
      ],
      edges: [],
    } as any)

    expect(result).toEqual(counts({ addedNodeCount: 1, addedEdgeCount: 0 }))
    expect(useCanvasStore.getState().graphEditedSinceLastRun).toBe(true)
    expect(useCanvasStore.getState().analysisStateReady).toBe(false)
  })

  it('marks the freshness overlay dirty on a structural add — the banner must never keep claiming currency', () => {
    // The freshness banners read analysisFreshnessDirty, not the legacy
    // graphEditedSinceLastRun flag — see reconcileAppliedGraph's commit block.
    useCanvasStore.setState({ analysisFreshnessDirty: false } as any)

    reconcileAppliedGraph({
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

    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      edges: [],
    } as any)

    expect(result).toEqual(counts({ addedNodeCount: 0, addedEdgeCount: 0 }))
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
})

/**
 * Edge value provenance (`beliefExistsSource` / `weightSource`) through the
 * overlay. Two invariants, both discovered by this suite going red:
 *
 *  1. A stamp must never be applied WITHOUT the value it describes. The overlay
 *     deliberately under-applies a wire value that equals the mapper default —
 *     but a stamp differs from the baseline whenever the wire supplied
 *     anything, so without coupling, a receipt carrying weight 0.5 would stamp
 *     "CEE set this" onto an edge still showing the user's own 0.7. That is the
 *     exact defect class the marker exists to close.
 *  2. A stamp ALONE must not trigger a store write. `reconcileAppliedGraph`
 *     guarantees a matching receipt is a strict no-op; metadata about an
 *     unchanged number does not earn an exception.
 */
describe('reconcileAppliedGraph — edge value provenance', () => {
  it('does NOT stamp a CEE source when the wire value was not applied (equals the mapper default)', () => {
    // Local edge is the user's 0.7. The wire sends 0.5 — DEFAULT_EDGE_DATA.weight
    // — which the baseline filter treats as unsupplied, so the displayed number
    // stays 0.7. The stamp must not travel without it.
    reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1', weight: 0.5 }],
    } as any)

    const edge = useCanvasStore.getState().edges.find((e) => e.id === 'e-0') as any
    expect(edge.data.weight).toBe(0.7)          // the user's value survived…
    expect(edge.data.weightSource).toBeUndefined() // …and is not credited to CEE
  })

  it('drops an ORPHAN stamp even when the receipt DOES write (the escape-catcher)', () => {
    // ⚠ THE MUTATION THAT ESCAPED FIRST TIME. The sibling case above passes
    // even with the coupling rule deleted, because the no-op guard catches it
    // instead — an assertion passing for the wrong reason. Here the receipt
    // genuinely changes beliefExists, so the overlay DOES write; the no-op
    // guard cannot mask anything. Weight is sent as 0.5 (== the mapper
    // default) so it is NOT applied, and its orphan stamp must be dropped —
    // otherwise 'CEE set this' lands on the user's own 0.7.
    reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      edges: [{
        id: 'e-0', from: 'factor-1', to: 'goal-1',
        weight: 0.5, belief_exists: 0.9,
      }],
    } as any)

    const edge = useCanvasStore.getState().edges.find((e) => e.id === 'e-0') as any
    // Proof the overlay really did write — without this the assertion below
    // could pass simply because nothing happened at all.
    expect(edge.data.beliefExists).toBe(0.9)
    expect(edge.data.beliefExistsSource).toBe('cee')
    // …and the orphan is gone.
    expect(edge.data.weight).toBe(0.7)
    expect(edge.data.weightSource).toBeUndefined()
  })

  it('is still a strict no-op when only the stamp would change', () => {
    const historyBefore = (useCanvasStore.getState() as any).history?.past?.length
    const edgesBefore = useCanvasStore.getState().edges

    const result = reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend', observed_state: { value: 100 } },
      ],
      edges: [{ id: 'e-0', from: 'factor-1', to: 'goal-1', weight: 0.7 }],
    } as any)

    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().edges).toBe(edgesBefore)
    expect((useCanvasStore.getState() as any).history?.past?.length).toBe(historyBefore)
  })

  // POSITIVE CONTROL — without this, both assertions above would pass against
  // an overlay that had simply stopped writing provenance at all.
  it('DOES stamp the source when the wire genuinely changes the value', () => {
    reconcileAppliedGraph({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Revenue' },
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
      ],
      edges: [{
        id: 'e-0', from: 'factor-1', to: 'goal-1',
        weight: 0.42, belief_exists: 0.9,
      }],
    } as any)

    const edge = useCanvasStore.getState().edges.find((e) => e.id === 'e-0') as any
    expect(edge.data.weight).toBe(0.42)
    expect(edge.data.weightSource).toBe('cee')
    expect(edge.data.beliefExists).toBe(0.9)
    expect(edge.data.beliefExistsSource).toBe('cee')
  })
})
