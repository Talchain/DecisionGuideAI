/**
 * ROADMAP 2.146 — hop 3 of 3: `edge.validation` overlays onto an EXISTING canvas
 * edge through `reconcileAppliedGraph` / `overlayEdge`.
 *
 * Separate file from `edgeValidationMapperMirror.spec.ts` because this hop needs
 * the REAL canvas store (that suite mocks it to drive the patch builder), and a
 * half-mocked store would prove less than either.
 *
 * `overlayEdge` needs no edit for this field — it derives its behaviour from
 * `mapDraftEdgeToCanvas`. That is exactly why it needs a test: "derived, so it
 * follows automatically" is a claim about a filter whose whole design is to
 * SUPPRESS mapped values that match the mapper baseline. Whether `validation`
 * lands on the suppressed side of that filter is a fact, not a corollary.
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { useCanvasStore } from '../../store'
// R-10: the store-seeding field set (incl. the `lastAuthoritativeGraph` leak
// guard) and `counts()` come from the harness shared with
// `mergeAppliedGraph.spec.ts`. Both were re-declared here — and `counts()` was
// SKIPPED, so the overlay path asserted 2 of 6 counters while the sibling's own
// docstring states that an unasserted counter is how an unintended removal slips
// through. Importing it restores the stronger rule as well as removing the copy.
import { counts, seedCanvas as seedStore } from './__helpers__/mergeAppliedGraphHarness'

const WIRE_VALIDATION = {
  status: 'contested',
  contested_reasons: ['sign_flip'],
  pass1: { strength_mean: 0.6, strength_std: 0.1, exists_probability: 0.8 },
  pass2: {
    strength_mean: -0.2,
    strength_std: 0.2,
    exists_probability: 0.6,
    reasoning: 'Direction is not supported by the brief.',
    basis: 'domain_prior',
    needs_user_input: true,
  },
  max_divergence: 0.8,
  distance_to_goal: 1,
  evoi_rank: null,
  evoi_impact: null,
  was_shown: false,
  user_action: 'pending',
  resolved_value: null,
  resolved_by: 'default',
} as const

const EXISTING_NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Revenue' } },
  { id: 'factor-1', type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Spend' } },
]

/** An edge already on the canvas, carrying NO validation metadata. */
const EXISTING_EDGES = [
  {
    id: 'factor-1::goal-1::0',
    source: 'factor-1',
    target: 'goal-1',
    type: 'styled',
    data: { weight: 0.7, direction: 'positive' },
  },
]

function seedCanvas(edges: unknown[] = EXISTING_EDGES) {
  seedStore(EXISTING_NODES, edges)
}

function receipt(edgeExtras: Record<string, unknown>) {
  return {
    nodes: [
      { id: 'goal-1', kind: 'goal', label: 'Revenue' },
      { id: 'factor-1', kind: 'factor', label: 'Spend' },
    ],
    edges: [
      { id: 'factor-1::goal-1::0', from: 'factor-1', to: 'goal-1', weight: 0.7, ...edgeExtras },
    ],
  } as any
}

function overlaidEdge() {
  return useCanvasStore.getState().edges.find((e) => e.id === 'factor-1::goal-1::0') as any
}

describe('reconcileAppliedGraph — edge.validation overlay (hop 3)', () => {
  beforeEach(() => {
    seedCanvas()
  })

  it('overlays validation onto an existing edge that had none', () => {
    const result = reconcileAppliedGraph(receipt({ validation: WIRE_VALIDATION }))

    // R-10 — ALL SIX counters, via the shared `counts()`. This case used to assert
    // `addedEdgeCount` and `updatedEdgeCount` only, which is the exact weakening
    // that helper's docstring warns about: an unasserted counter is how an
    // unintended REMOVAL slips through, and this receipt names both existing nodes
    // and the existing edge, so a spurious removal here is a live possibility
    // rather than a hypothetical. The overlay is an UPDATE, not an add — the edge
    // already existed.
    expect(result).toEqual(counts({ updatedEdgeCount: 1 }))
    expect(overlaidEdge().data.validation).toEqual(WIRE_VALIDATION)
  })

  it('preserves the local edge state the receipt did not change', () => {
    reconcileAppliedGraph(receipt({ validation: WIRE_VALIDATION }))
    const edge = overlaidEdge()
    // The overlay must add metadata, not reset the edge. Weight 0.7 is the user's
    // (and the receipt's) value; direction is local.
    expect(edge.data.weight).toBeCloseTo(0.7)
    expect(edge.data.direction).toBe('positive')
  })

  it('a receipt WITHOUT validation does not clear validation already on the edge', () => {
    // Wire absence is not "clear it" — CEE omits optional fields it has no value
    // for, and a resolved-then-reingested edge must not silently lose its
    // metadata. POSITIVE CONTROL: the previous tests prove the same code path
    // DOES write the key when the wire supplies it, so this is not vacuous.
    seedCanvas([
      {
        ...EXISTING_EDGES[0],
        data: { ...EXISTING_EDGES[0].data, validation: WIRE_VALIDATION },
      } as any,
    ])

    reconcileAppliedGraph(receipt({}))
    expect(overlaidEdge().data.validation).toEqual(WIRE_VALIDATION)
  })

  it('a receipt carrying validation for a NEW edge adds it with the metadata', () => {
    // The add path goes through mapDraftEdgeToCanvas directly rather than through
    // overlayEdge's baseline filter — a different branch, so a separate case.
    useCanvasStore.setState({ edges: [] } as any)
    reconcileAppliedGraph(receipt({ validation: WIRE_VALIDATION }))
    expect(overlaidEdge().data.validation).toEqual(WIRE_VALIDATION)
  })
})
