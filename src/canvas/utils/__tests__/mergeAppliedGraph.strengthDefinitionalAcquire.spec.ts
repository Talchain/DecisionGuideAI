/**
 * MG 0ebb952a — ACQUIRING THE BY-DEFINITION LABEL ON A RECEIPT IS NEVER AN EDIT.
 * The twin of `mergeAppliedGraph.strengthPlaceholderAcquire.spec.ts`.
 *
 * A canvas saved BEFORE `strengthDefinitional` existed holds a part → total link
 * (CEE #2445) without it. The receipt of the same, unchanged server edge must
 * acquire the key (so every surface says "by definition") and count NOTHING: no
 * updated edge, no history entry. `strengthDefinitional` is in
 * `EDGE_METADATA_ONLY_KEYS` and `EDGE_ACQUIRED_METADATA_KEYS` for exactly this.
 *
 * Driven through the real `reconcileAppliedGraph` and the real store. The wire
 * edge's `provenance` is verbatim from the MG CEE probe (see
 * `domain/__tests__/strengthDefinitional.spec.ts`).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { useCanvasStore } from '../../store'
import { counts, seedCanvas } from './__helpers__/mergeAppliedGraphHarness'

const PART = 'sprint_capacity_on_ai_reporting'
const TOTAL = 'total_sprint_capacity_allocated'
const DEFINITIONAL = {
  from: PART,
  to: TOTAL,
  strength: { mean: 1, std: 0.001 },
  exists_probability: 1,
  effect_direction: 'positive',
  provenance_display: 'ai_inferred',
  provenance: {
    source: 'cee_hypothesis',
    magnitude: 'olumi_estimate',
    natural_effect: {
      amount: 1,
      amount_unit: '% of upcoming sprint capacity',
      per_source_change: 1,
      per_source_change_unit: '% of upcoming sprint capacity',
      strength_mean: 1,
      strength_mean_frame: 'edge_strength',
    },
    definitional: true,
  },
}

const NODES = [
  { id: PART, type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Sprint capacity on AI reporting' } },
  { id: TOTAL, type: 'factor', position: { x: 400, y: 400 }, data: { kind: 'factor', label: 'Total sprint capacity allocated' } },
]
const WIRE_NODES = [
  { id: PART, kind: 'factor', label: 'Sprint capacity on AI reporting' },
  { id: TOTAL, kind: 'factor', label: 'Total sprint capacity allocated' },
]

const theEdge = (): any =>
  useCanvasStore.getState().edges.find((e: any) => e.source === PART && e.target === TOTAL)

describe('a receipt onto a canvas saved before the key existed', () => {
  beforeEach(() => {
    const mapped = mapDraftEdgeToCanvas({ ...DEFINITIONAL }, 0)
    expect(mapped.data.strengthDefinitional).toBe(true) // PRECONDITION: the wire labels it
    delete (mapped.data as Record<string, unknown>).strengthDefinitional
    seedCanvas(NODES, [mapped])
  })

  it('acquires strengthDefinitional, counts no update and writes no history', () => {
    expect(theEdge().data.strengthDefinitional).toBeUndefined() // PRECONDITION: the older save
    const history = useCanvasStore.getState().history
    const before = theEdge()
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...DEFINITIONAL }] } as any)
    expect(theEdge().data.strengthDefinitional).toBe(true)
    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().history).toBe(history)
    const { strengthDefinitional: _acquired, ...rest } = theEdge().data
    expect(rest).toEqual(before.data)
  })

  it('CONTRAST: a receipt that MOVES the strength is a counted update', () => {
    const moved = { ...DEFINITIONAL, strength: { std: 0.001, mean: 0.5 } }
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [moved] } as any)
    expect(result).toEqual(counts({ updatedEdgeCount: 1 }))
  })
})
