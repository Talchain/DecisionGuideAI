/**
 * MG ruling (1 Oct 2026) — A LINK THAT HOLDS BY DEFINITION OFFERS NO STRENGTH
 * EDIT. The pure half: the ONE gate every editor surface asks
 * (`edgeStrengthEditIsAssertable`) and the three readers that take only its
 * answer — the double-click hint, the results review set, and the Model tab
 * row's value (the cell that would otherwise be the editor button).
 *
 * #2403 made these links read "by definition"; every strength editor still let a
 * person try to change one, and CEE refuses the write. Each row has two
 * controls on the SAME fixture: the wire without `definitional` (still
 * editable, so the gate is live on it), and the definitional link whose weight
 * the PERSON set (`weightSource: 'user'` — not definitional by the predicate,
 * so editable exactly as before).
 *
 * Expected words are bound as exact literals, never imported from the module
 * under test, so the spec reads the same at base and at head.
 */
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { edgeStrengthEditIsAssertable } from '../edgeStrengthEdit'
import { edgeDoubleClickAffordance, EDGE_AFFORDANCE_EDITABLE } from '../../edges/edgeAffordance'
import { reviewableStrengthEdgeIds } from '../../../components/results/strengthElicitation/reviewableEdges'
import { toModelRows, type ModelProjectionInput } from '../../model-tab-v2/adapters'

type WireEdge = Record<string, unknown> & { from: string; to: string }

const PART = 'sprint_capacity_on_ai_reporting'
const TOTAL = 'total_sprint_capacity_allocated'
/** Verbatim from the MG CEE probe, as in `domain/__tests__/strengthDefinitional.spec.ts`. */
const NATURAL = {
  amount: 1,
  amount_unit: '% of upcoming sprint capacity',
  per_source_change: 1,
  per_source_change_unit: '% of upcoming sprint capacity',
  strength_mean: 1,
  strength_mean_frame: 'edge_strength',
}
const DEFINITIONAL: WireEdge = {
  from: PART,
  to: TOTAL,
  strength: { mean: 1, std: 0.001 },
  exists_probability: 1,
  effect_direction: 'positive',
  provenance_display: 'ai_inferred',
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL, definitional: true },
}
/** CONTROL: the same wire as an ordinary Olumi estimate. */
const ESTIMATE: WireEdge = {
  ...DEFINITIONAL,
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL },
}

const ingest = (e: WireEdge) => mapDraftEdgeToCanvas({ ...e }, 0).data as Record<string, unknown>
const asEdge = (data: Record<string, unknown>) =>
  ({ id: 'e1', source: PART, target: TOTAL, data }) as unknown as Edge
/** CONTROL: the definitional link whose weight the person set. */
const userSet = (data: Record<string, unknown>): Record<string, unknown> => ({ ...data, weightSource: 'user' })

const DEFINITIONAL_DATA = ingest(DEFINITIONAL)
const ESTIMATE_DATA = ingest(ESTIMATE)
const USER_DATA = userSet(DEFINITIONAL_DATA)

const NODES = [
  { id: PART, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Sprint capacity on AI reporting' } },
  { id: TOTAL, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Total sprint capacity allocated' } },
]

describe('fixture preconditions — or every row below is vacuous', () => {
  it('the definitional fixture carries the flag; the estimate does not; both carry a server-stated strength', () => {
    expect(DEFINITIONAL_DATA.strengthDefinitional).toBe(true)
    expect('strengthDefinitional' in ESTIMATE_DATA).toBe(false)
    expect(USER_DATA.strengthDefinitional).toBe(true)
    expect(USER_DATA.weightSource).toBe('user')
  })
})

describe('G1 — the ONE gate: edgeStrengthEditIsAssertable', () => {
  it('a definitional link is not editable', () => {
    expect(edgeStrengthEditIsAssertable(asEdge(DEFINITIONAL_DATA))).toBe(false)
  })
  it('CONTROL: the same wire as an Olumi estimate is editable (the gate is live on this fixture)', () => {
    expect(edgeStrengthEditIsAssertable(asEdge(ESTIMATE_DATA))).toBe(true)
  })
  it('CONTROL: a definitional link whose weight the person set stays editable', () => {
    expect(edgeStrengthEditIsAssertable(asEdge(USER_DATA))).toBe(true)
  })
})

describe('G2 — the double-click hint (canvas title + assistive name)', () => {
  it('says "By definition", then the honest gesture — never the edit promise', () => {
    expect(edgeDoubleClickAffordance(asEdge(DEFINITIONAL_DATA) as never)).toBe('By definition. Double-click to inspect')
  })
  it('CONTROL: the Olumi estimate keeps the edit promise', () => {
    expect(edgeDoubleClickAffordance(asEdge(ESTIMATE_DATA) as never)).toBe(EDGE_AFFORDANCE_EDITABLE)
    expect(EDGE_AFFORDANCE_EDITABLE).toBe('Double-click to set its strength')
  })
  it("CONTROL: the person's own weight keeps the edit promise", () => {
    expect(edgeDoubleClickAffordance(asEdge(USER_DATA) as never)).toBe(EDGE_AFFORDANCE_EDITABLE)
  })
})

describe('G3 — the results review entries (reviewableStrengthEdgeIds)', () => {
  const ids = (data: Record<string, unknown>) =>
    reviewableStrengthEdgeIds(NODES, [asEdge(data)] as never)
  it('a definitional link is never routed to an editor', () => {
    expect(ids(DEFINITIONAL_DATA).has('e1')).toBe(false)
  })
  it('CONTROL: the Olumi estimate is', () => {
    expect(ids(ESTIMATE_DATA).has('e1')).toBe(true)
  })
  it("CONTROL: the person's own weight is", () => {
    expect(ids(USER_DATA).has('e1')).toBe(true)
  })
})

describe('G4 — the Model tab row value, where the editor button would be', () => {
  function relationshipRow(data: Record<string, unknown>) {
    const input: ModelProjectionInput = {
      nodes: NODES as unknown as Node[],
      edges: [asEdge(data)] as never,
      goalThreshold: null,
    }
    const row = toModelRows(input).find((r) => r.kind === 'relationship')
    expect(row, 'no relationship row was projected — the fixture is wrong, not the code').toBeDefined()
    return row!
  }
  // Without a natural effect the row falls back to the band, which said nothing
  // about the definition: the cell where the editor was would then be silent.
  const NO_NATURAL = (wire: WireEdge): WireEdge => ({
    ...wire,
    provenance: { ...(wire.provenance as Record<string, unknown>), natural_effect: undefined },
  })

  it('the band fallback says "by definition"', () => {
    const data = ingest(NO_NATURAL(DEFINITIONAL))
    expect(data.strengthDefinitional).toBe(true)
    expect(relationshipRow(data).primaryValue).toMatch(/ · by definition$/)
  })
  it('the natural-effect sentence still says it once (#2403 D1, unchanged)', () => {
    expect(relationshipRow(DEFINITIONAL_DATA).primaryValue).toBe(
      'Increase of 1 % of upcoming sprint capacity per 1 % of upcoming sprint capacity · by definition',
    )
  })
  it('CONTROL: the Olumi estimate band carries no definition', () => {
    expect(relationshipRow(ingest(NO_NATURAL(ESTIMATE))).primaryValue).not.toMatch(/definition/)
  })
  it("CONTROL: the person's own band carries no definition", () => {
    expect(relationshipRow(userSet(ingest(NO_NATURAL(DEFINITIONAL)))).primaryValue).not.toMatch(/definition/)
  })
})
