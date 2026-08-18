/**
 * RELATIONSHIPS READ IN ENGLISH — the KEEP-BUT-FIX the dedupe would have lost.
 *
 * ## The defect
 *
 * `adapters.ts` rendered an edge with no `label` of its own as
 * `${edge.source} → ${edge.target}` — the RAW WIRE IDS, e.g.
 * `fac_arr → out_uk_arr_retention`. The v1 stack it is replacing resolved both
 * endpoints to their node labels (`RelationshipsSection.tsx:149-150`), so the
 * canonical editor was the LESS readable of the two on the one thing a
 * relationship exists to state: what affects what. Deduplicating the tab without
 * this fix would have deleted the readable rendering and kept the identifiers.
 *
 * Two more sites leaked the same way and were invisible from the row: the detail
 * region's "What it affects" list used `e.target` and `edge.target` AS THE LABEL.
 *
 * ## Binding
 *
 * Every absence assertion here carries a CONTRAST CONTROL that must read
 * non-zero in the same test — the human labels are asserted PRESENT in the same
 * breath as the ids are asserted ABSENT. An absence alone is satisfiable by
 * rendering nothing at all.
 */
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { toModelRows, toRowDetail, type ModelProjectionInput } from '../adapters'

const SOURCE_ID = 'fac_arr'
const TARGET_ID = 'out_uk_arr_retention'

function nodes(sourceLabel: string | undefined, targetLabel: string | undefined): Node[] {
  return [
    { id: SOURCE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: sourceLabel } },
    { id: TARGET_ID, type: 'outcome', position: { x: 0, y: 0 }, data: { label: targetLabel } },
  ] as unknown as Node[]
}

function edge(over: Record<string, unknown> = {}): Edge {
  return {
    id: 'e1',
    source: SOURCE_ID,
    target: TARGET_ID,
    data: { ...over },
  } as unknown as Edge
}

function project(
  sourceLabel: string | undefined,
  targetLabel: string | undefined,
  edgeData: Record<string, unknown> = {},
): ModelProjectionInput {
  return {
    nodes: nodes(sourceLabel, targetLabel),
    edges: [edge(edgeData)] as never,
    goalThreshold: null,
  }
}

function relationshipRow(input: ModelProjectionInput) {
  const row = toModelRows(input).find(r => r.kind === 'relationship')
  expect(row, 'no relationship row was projected — the fixture is wrong, not the code').toBeDefined()
  return row!
}

describe('the relationship row names both endpoints in the user’s words', () => {
  it('renders "From → To" from the node labels, and NOT the ids', () => {
    const label = relationshipRow(project('ARR', 'UK ARR retention')).label
    // Present: the human words.
    expect(label).toBe('ARR → UK ARR retention')
    // Absent: the identifiers. Asserted alongside the presence above, so this
    // cannot pass by rendering nothing.
    expect(label).not.toContain(SOURCE_ID)
    expect(label).not.toContain(TARGET_ID)
  })

  it('an edge that names ITSELF wins over anything derived from its endpoints', () => {
    expect(
      relationshipRow(project('ARR', 'UK ARR retention', { label: 'Retention drives ARR' })).label,
    ).toBe('Retention drives ARR')
  })

  it('an unnamed endpoint becomes "Unnamed element" — NEVER its identifier', () => {
    const label = relationshipRow(project(undefined, 'UK ARR retention')).label
    expect(label).toBe('Unnamed element → UK ARR retention')
    expect(label).not.toContain(SOURCE_ID)
  })

  it('a label that is ITSELF id-shaped is rejected, so the leak cannot move upstream', () => {
    // The shared policy rejects an id-shaped label via RAW_ID_PATTERN. Without
    // that guard, a node whose label was seeded from its id would leak here.
    const label = relationshipRow(project('fac_arr', 'UK ARR retention')).label
    expect(label).toBe('Unnamed element → UK ARR retention')
    expect(label).not.toContain('fac_arr')
  })

  it('both endpoints unnamed still yields prose, not a pair of ids', () => {
    const label = relationshipRow(project(undefined, undefined)).label
    expect(label).toBe('Unnamed element → Unnamed element')
    expect(label).not.toMatch(/(?:fac|out)_/)
  })
})

describe('the detail region’s "What it affects" list names elements, not ids', () => {
  it('a factor’s outbound list carries the TARGET’s name and the EDGE’s id', () => {
    const detail = toRowDetail(project('ARR', 'UK ARR retention'), SOURCE_ID)
    expect(detail).not.toBeNull()
    expect(detail!.affects).toEqual([{ id: 'e1', label: 'UK ARR retention' }])
    // The navigation id is the edge's, deliberately — the label is what the user
    // reads, the id is what the click resolves. Opposite-direction twin: the
    // label must NOT be an id and the id must NOT have become a label.
    expect(detail!.affects[0].label).not.toContain(TARGET_ID)
  })

  it('an edge row’s affects list names its target', () => {
    const detail = toRowDetail(project('ARR', 'UK ARR retention'), 'e1')
    expect(detail).not.toBeNull()
    expect(detail!.affects).toEqual([{ id: TARGET_ID, label: 'UK ARR retention' }])
    expect(detail!.affects[0].label).not.toBe(TARGET_ID)
  })

  it('an unnamed target degrades to prose in the affects list too', () => {
    const detail = toRowDetail(project('ARR', undefined), 'e1')
    expect(detail!.affects[0].label).toBe('Unnamed element')
    expect(detail!.affects[0].label).not.toBe(TARGET_ID)
  })
})
