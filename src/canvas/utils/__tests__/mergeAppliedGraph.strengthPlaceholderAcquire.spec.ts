/**
 * POM-8 — ACQUIRING THE PLACEHOLDER LABEL ON A READBACK IS NEVER AN EDIT
 * (review r08 note 9: `strengthPlaceholder.spec.ts`'s "as a no-op (never an
 * edit)" case asserted only that the key was acquired).
 *
 * A canvas saved BEFORE `strengthPlaceholder` existed holds Paul's "Pro plan
 * price → MRR" without it. The receipt of the same, unchanged server edge must
 * acquire the key (so the line draws thin) and count NOTHING: no updated edge,
 * no history entry — the person moved no value. `strengthPlaceholder` is in
 * `EDGE_METADATA_ONLY_KEYS` and `EDGE_ACQUIRED_METADATA_KEYS` for exactly this.
 *
 * Driven through the real `reconcileAppliedGraph` and the real store, with the
 * wire edge taken verbatim from Paul's fixture, bound by its from/to pair.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { useCanvasStore } from '../../store'
import { counts, seedCanvas } from './__helpers__/mergeAppliedGraphHarness'

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE_EDGES = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const PRICE_TO_MRR = WIRE_EDGES.find((e) => e.from === 'pro_plan_price' && e.to === 'mrr')!

const NODES = [
  { id: 'pro_plan_price', type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Pro plan price' } },
  { id: 'mrr', type: 'goal', position: { x: 400, y: 400 }, data: { kind: 'goal', label: 'MRR' } },
]
const WIRE_NODES = [
  { id: 'pro_plan_price', kind: 'factor', label: 'Pro plan price' },
  { id: 'mrr', kind: 'goal', label: 'MRR' },
]

const theEdge = (): any =>
  useCanvasStore.getState().edges.find((e: any) => e.source === 'pro_plan_price' && e.target === 'mrr')

describe('a receipt onto a canvas saved before the key existed', () => {
  beforeEach(() => {
    const mapped = mapDraftEdgeToCanvas({ ...PRICE_TO_MRR }, 0)
    expect(mapped.data.strengthPlaceholder).toBe(0.5) // PRECONDITION: the wire labels it
    delete mapped.data.strengthPlaceholder
    seedCanvas(NODES, [mapped])
  })

  it('acquires strengthPlaceholder, counts no update and writes no history', () => {
    expect(theEdge().data.strengthPlaceholder).toBeUndefined() // PRECONDITION: the older save
    const history = useCanvasStore.getState().history
    const before = theEdge()
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...PRICE_TO_MRR }] } as any)
    expect(theEdge().data.strengthPlaceholder).toBe(0.5)
    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().history).toBe(history)
    // Nothing but the acquired key moved.
    const { strengthPlaceholder: _acquired, ...rest } = theEdge().data
    expect(rest).toEqual(before.data)
  })

  /**
   * The key must be METADATA-ONLY (`EDGE_METADATA_ONLY_KEYS`), not merely
   * acquired: otherwise its arrival reads as a changed value, the whole receipt
   * is spread over the edge, and a stamp the canvas holds on an UNCHANGED value
   * is rewritten — a counted update and a history entry. The case above cannot
   * see that (its stamps already equal the receipt's), so this one gives the
   * canvas a stamp the receipt does not carry: the person stated the same 0.5.
   */
  it('acquiring it never rewrites a stamp the canvas holds on an unchanged value', () => {
    useCanvasStore.setState({
      edges: useCanvasStore.getState().edges.map((e: any) =>
        e.source === 'pro_plan_price' && e.target === 'mrr' ? { ...e, data: { ...e.data, weightSource: 'user' } } : e,
      ),
    })
    const before = theEdge()
    expect(before.data.weightSource).toBe('user') // PRECONDITION: the canvas stamp
    expect(mapDraftEdgeToCanvas({ ...PRICE_TO_MRR }, 0).data.weightSource).not.toBe('user') // PRECONDITION: the receipt's differs
    const history = useCanvasStore.getState().history
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [{ ...PRICE_TO_MRR }] } as any)
    expect(theEdge().data.strengthPlaceholder).toBe(0.5)
    expect(theEdge().data.weightSource).toBe('user')
    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().history).toBe(history)
    const { strengthPlaceholder: _acquired, ...rest } = theEdge().data
    expect(rest).toEqual(before.data)
  })

  it('CONTRAST: a receipt that MOVES the strength is a counted update', () => {
    const moved = { ...PRICE_TO_MRR, strength: { std: 0.25, mean: 0.62 } }
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [moved] } as any)
    expect(result).toEqual(counts({ updatedEdgeCount: 1 }))
  })
})
