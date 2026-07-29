/**
 * ROADMAP 2.146 — `edge.validation` survives ALL THREE canvas ingestion hops.
 *
 * The contested-edge render surface in `StyledEdge` has existed and been tested
 * since Brief 5.7, reading `edge.data.validation`. Nothing on the DRAFT path ever
 * populated that key: `mapDraftEdgeToCanvas` extracts wire edge fields by a
 * hand-maintained list ("no blind spread") and `validation` was not on it. So the
 * styling was real, its tests were real, and the field they styled never arrived.
 *
 * There are three hops, and they fail differently — a test covering one says
 * nothing about the others:
 *
 *   1. `mapDraftEdgeToCanvas`  (applyDraftResult.ts) — full draft ingestion.
 *   2. `buildEdge`             (conversation/utils/applyPatch.ts) — a HAND-MIRRORED
 *      COPY of hop 1, used on `edit_graph` receipts. A field added only to hop 1
 *      is present after a draft and VANISHES on the next patch touching the edge.
 *      That is the drift this suite exists to catch, and it is the failure mode
 *      nobody notices, because it needs two turns to appear.
 *   3. `overlayEdge`           (mergeAppliedGraph.ts) — DERIVED from hop 1, so it
 *      follows automatically. But its baseline filter deliberately UNDER-applies:
 *      a mapped value equal to the mapper default counts as "the wire did not send
 *      this". That makes "`validation` has NO entry in DEFAULT_EDGE_DATA" a
 *      load-bearing property rather than an omission, and it is pinned here.
 *
 * Every absence assertion below is paired with the presence it denies (trap 13).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'

// ── The wire shape CEE's validation pipeline emits (abridged to the fields the
//    UI's render surface and card actually read). Not a re-declaration of the
//    contract: this suite asserts the object arrives INTACT, by identity of
//    content, so it never needs to know the full field list.
const WIRE_VALIDATION = {
  status: 'contested',
  contested_reasons: ['strength_band_change'],
  pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
  pass2: {
    strength_mean: 0.7,
    strength_std: 0.15,
    exists_probability: 0.9,
    reasoning: 'The brief implies a weaker link than the draft assumed.',
    basis: 'brief_explicit',
    needs_user_input: false,
  },
  max_divergence: 0.4,
  distance_to_goal: 1,
  evoi_rank: null,
  evoi_impact: null,
  was_shown: false,
  user_action: 'pending',
  resolved_value: null,
  resolved_by: 'default',
} as const

/** A V3 causal edge as CEE puts it on the wire, with validation attached. */
const WIRE_EDGE = {
  from: 'factor-1',
  to: 'goal-1',
  strength: { mean: 0.3, std: 0.1 },
  exists_probability: 0.8,
  effect_direction: 'positive',
  edge_type: 'directed',
  validation: WIRE_VALIDATION,
}

describe('edge.validation — hop 1: mapDraftEdgeToCanvas (draft ingestion)', () => {
  it('carries validation through to edge data, intact', () => {
    const mapped = mapDraftEdgeToCanvas({ ...WIRE_EDGE }, 0)
    expect(mapped.data.validation).toEqual(WIRE_VALIDATION)
  })

  it('omits the key entirely when the wire carries no validation', () => {
    // POSITIVE CONTROL for the assertion below: the same mapper DOES produce the
    // key when the wire supplies it (previous test), so `not.toHaveProperty`
    // here is measuring absence rather than measuring nothing.
    const mapped = mapDraftEdgeToCanvas({ from: 'a', to: 'b', weight: 0.5 }, 0)
    expect(mapped.data).not.toHaveProperty('validation')
  })

  it('omits the key for an explicit null (a cleared field is not a value)', () => {
    const mapped = mapDraftEdgeToCanvas({ from: 'a', to: 'b', validation: null }, 0)
    expect(mapped.data).not.toHaveProperty('validation')
  })

  it('DEFAULT_EDGE_DATA carries no validation default — hop 3 depends on this', () => {
    // Not cosmetic. `overlayEdge` treats a mapped value equal to the mapper
    // baseline as unsupplied; a non-undefined default here would silently stop
    // validation metadata from ever overlaying onto an existing edge.
    expect(DEFAULT_EDGE_DATA).not.toHaveProperty('validation')
    const baseline = mapDraftEdgeToCanvas({ from: 'x', to: 'y' }, 0)
    expect(baseline.data).not.toHaveProperty('validation')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Hop 2 — the hand-mirrored patch builder. Needs the canvas store, so it is
// driven through the public `applyAutoApplyPatch` entry point.
// ─────────────────────────────────────────────────────────────────────────────

let storeNodes: any[] = []
let storeEdges: any[] = []

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({
      nodes: storeNodes,
      edges: storeEdges,
      outcomeNodeId: null,
      ceeAnalysisReady: null,
      applyLayout: vi.fn(() => Promise.resolve()),
      setPendingLayout: vi.fn(),
      setOutcomeNode: vi.fn(),
      currentScenarioId: null,
    }),
    setState: vi.fn((update: any) => {
      if (update.nodes) storeNodes = update.nodes
      if (update.edges) storeEdges = update.edges
    }),
  }),
}))

vi.mock('../../store/scenarios', () => ({
  saveAutosave: vi.fn(),
}))

const { applyAutoApplyPatch } = await import('../../conversation/utils/applyPatch')

function seedPatchStore() {
  storeNodes = [
    { id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Spend' } },
    { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
  ]
  storeEdges = []
}

function addEdgePatch(data: Record<string, unknown>) {
  return {
    block_type: 'graph_patch' as const,
    auto_apply: true,
    operations: [{ op: 'add_edge' as const, target_id: 'e1', data }],
  }
}

describe('edge.validation — hop 2: applyPatch buildEdge (edit_graph receipt)', () => {
  beforeEach(() => {
    seedPatchStore()
  })

  it('carries validation through an add_edge receipt, intact', () => {
    applyAutoApplyPatch(addEdgePatch({ ...WIRE_EDGE }) as any)
    expect(storeEdges).toHaveLength(1)
    expect(storeEdges[0].data.validation).toEqual(WIRE_VALIDATION)
  })

  it('omits the key when the receipt carries no validation', () => {
    applyAutoApplyPatch(addEdgePatch({ from: 'factor-1', to: 'goal-1', weight: 0.5 }) as any)
    expect(storeEdges[0].data).not.toHaveProperty('validation')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE MIRROR-DRIFT CATCHER
// ─────────────────────────────────────────────────────────────────────────────

describe('edge.validation — the two hand-mirrored mappers stay in lockstep', () => {
  beforeEach(() => {
    seedPatchStore()
  })

  it('a full draft and a patch receipt of the SAME wire edge agree on validation', () => {
    // THE PIN. Adding `validation` to one extraction list and not the other is
    // invisible in every single-hop test, in typecheck, and in review — the field
    // simply disappears one turn later. This is the assertion that notices.
    //
    // Deliberately compared through the two PUBLIC entry points rather than by
    // reading the source: a comparison of two hand-written field lists would
    // itself be a third mirror.
    const drafted = mapDraftEdgeToCanvas({ ...WIRE_EDGE }, 0)
    applyAutoApplyPatch(addEdgePatch({ ...WIRE_EDGE }) as any)
    const patched = storeEdges[0]

    expect(drafted.data.validation).toEqual(WIRE_VALIDATION)
    expect(patched.data.validation).toEqual(WIRE_VALIDATION)
    expect(patched.data.validation).toEqual(drafted.data.validation)
  })

  it('both hops agree on ABSENCE too (neither invents a default)', () => {
    const bare = { from: 'factor-1', to: 'goal-1', weight: 0.5 }
    const drafted = mapDraftEdgeToCanvas({ ...bare }, 0)
    applyAutoApplyPatch(addEdgePatch({ ...bare }) as any)

    expect('validation' in drafted.data).toBe(false)
    expect('validation' in storeEdges[0].data).toBe(false)
    // Same answer from both hops — a default appearing in one and not the other
    // would be the same drift in the opposite direction.
    expect('validation' in drafted.data).toBe('validation' in storeEdges[0].data)
  })
})
