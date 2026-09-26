/**
 * A CONFIRMED LINK STOPS SAYING "· Olumi's estimate" — RED-first (served 26 Sep, #70 5849398628).
 *
 * THE DEFECT (witness confirm-loop2, UI 8d18cace · CEE 6a3bde4): the person confirmed
 * "AI feature availability → New Pro subscribers per month" as slight. CEE's approve
 * response and the boot read both carried `source: user_specified` with NO `magnitude`
 * and NO `natural_effect` (the magnitude contract drops both on a user write). The Model
 * tab still read "Increase of about 10 subscribers/month · Olumi's estimate" after the
 * confirm AND after reload: `overlayEdge` only ever acquired `naturalEffect`, so an
 * absent one never removed the canvas copy.
 *
 * THE RULE: on a server edge (receipt or boot readback) a missing `naturalEffect`
 * removes the canvas's — never an edit (no counted update, no history). A server edge
 * that still carries it keeps or acquires it. Every case binds the edge by its own id.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { reconcileAppliedGraph, overlayEdge } from '../mergeAppliedGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { naturalEffectPhrase } from '../../domain/naturalEffect'
import { useCanvasStore } from '../../store'
import { counts, seedCanvas } from './__helpers__/mergeAppliedGraphHarness'

const EDGE_ID = 'ai_feature_availability::new_pro_subscribers_per_month::0'
const FROM = 'ai_feature_availability'
const TO = 'new_pro_subscribers_per_month'

const NODES = [
  { id: FROM, type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'AI feature availability' } },
  { id: TO, type: 'factor', position: { x: 400, y: 200 }, data: { kind: 'factor', label: 'New Pro subscribers per month' } },
]
const WIRE_NODES = [
  { id: FROM, kind: 'factor', label: 'AI feature availability' },
  { id: TO, kind: 'factor', label: 'New Pro subscribers per month' },
]

// The served pair, verbatim (turns.jsonl rows 0 and 2, draft_graph.edges[11]).
const NATURAL_EFFECT = {
  amount: 10, amount_unit: 'subscribers/month', strength_mean: 0.02, per_source_change: 1,
  strength_mean_frame: 'edge_strength', per_source_change_unit: 'switch',
}
const BEFORE = {
  id: EDGE_ID, from: FROM, to: TO, strength: { std: 0.01, mean: 0.02 }, effect_direction: 'positive',
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL_EFFECT },
}
const AFTER_CONFIRM = {
  id: EDGE_ID, from: FROM, to: TO, strength: { std: 0.01, mean: 0.02 }, effect_direction: 'positive',
  provenance: { source: 'user_specified' },
}

const POSITIVE = { show: true, direction: 'positive' } as const
const theEdge = (): any => useCanvasStore.getState().edges.find((e: any) => e.id === EDGE_ID)
const phraseOf = (edge: any): string | null => naturalEffectPhrase(edge.data.naturalEffect, edge.data.weight, POSITIVE as any)

function seedBefore(): void {
  const mapped = mapDraftEdgeToCanvas(BEFORE, 0)
  seedCanvas(NODES, [{ ...mapped, id: EDGE_ID, source: FROM, target: TO }])
}

describe('a server edge with no natural size removes the canvas copy', () => {
  beforeEach(seedBefore)

  it('precondition: the seeded edge says the served stale label', () => {
    expect(phraseOf(theEdge())).toBe("Increase of about 10 subscribers/month · Olumi's estimate")
  })

  it('receipt of the confirm: the label goes, and it is not an edit', () => {
    const history = useCanvasStore.getState().history
    const before = theEdge()
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [AFTER_CONFIRM] } as any)
    expect(theEdge().data.naturalEffect).toBeUndefined()
    expect(phraseOf(theEdge())).toBeNull()
    expect(theEdge().data.weight).toBe(before.data.weight)
    expect(result).toEqual(counts())
    expect(useCanvasStore.getState().history).toBe(history)
  })

  it('boot readback after reload: the label goes', () => {
    expect(mergeServerGraphOnHydrate({ nodes: WIRE_NODES, edges: [AFTER_CONFIRM] }).accepted).toBe(true)
    expect(theEdge().data.naturalEffect).toBeUndefined()
    expect(phraseOf(theEdge())).toBeNull()
    const settled = useCanvasStore.getState().edges
    mergeServerGraphOnHydrate({ nodes: WIRE_NODES, edges: [AFTER_CONFIRM] })
    expect(useCanvasStore.getState().edges, 'a repeat readback is a strict no-op').toBe(settled)
  })

  it('a value change with no size removes it too', () => {
    const next = overlayEdge(theEdge(), { ...AFTER_CONFIRM, strength: { std: 0.05, mean: 0.3 } }, { acquireServerStrengthOnNoop: true })
    expect(next.data.naturalEffect).toBeUndefined()
    expect(next.data.weight).toBe(0.3)
  })

  it('CONTRAST: a server edge that still carries the size keeps it — same reference', () => {
    const edge = theEdge()
    expect(overlayEdge(edge, BEFORE, { acquireServerStrengthOnNoop: true })).toBe(edge)
    const result = reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [BEFORE] } as any)
    expect(theEdge()).toBe(edge)
    expect(result).toEqual(counts())
  })

  it('CONTRAST: a caller that is not server-authoritative never removes it', () => {
    const edge = theEdge()
    expect(overlayEdge(edge, AFTER_CONFIRM).data.naturalEffect).toEqual(edge.data.naturalEffect)
  })
})
