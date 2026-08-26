/**
 * P0 — A CEE-SHAPED ROW THAT CARRIES `position` DEFEATS THE SHAPE DISCRIMINATOR.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT, AND WHY THE EXISTING SUITE CANNOT SEE IT
 * ─────────────────────────────────────────────────────────────────────────────
 * `isCanvasShapedNode` decided canvas-shape on ONE signal:
 *
 *     return typeof n === 'object' && n !== null && 'position' in n
 *
 * Its header justified that with *"`position` is the discriminator: React Flow
 * requires it on every node and CEE's GraphV3 carries no geometry at all"* — a
 * statement about the DATA, and the data refutes it. A census of staging
 * `scenarios` (2026-08-26) found **19 GraphV3 rows carrying node `position`**,
 * every one updated within the preceding 30 days.
 *
 * For those rows the predicate answers TRUE, the node is passed through
 * UNPROJECTED, and a CEE-shaped object lands in a store whose every consumer
 * assumes React Flow shape — the exact P0 `normalisePersistedGraph` was created
 * to retire, walking back in through its own discriminator.
 *
 * ⚠ THE EXISTING CORPUS ASSERTS THE CLASS AWAY. `store.ceeShapedHydration.p0`'s
 * fixture precondition is:
 *
 *     it('is a real CEE row: edges carry no id, nodes carry no position', …)
 *     expect(CEE_NODES.filter((n) => 'position' in n)).toHaveLength(0)
 *
 * That is an honest precondition pin, and it is also CLAUDE.md trap 13d in its
 * purest form: **a corpus that omits a value class the contract admits cannot
 * certify the code over that class.** The contract admits it — the column is
 * untyped JSONB with two writers — and the live data contains it. So the whole
 * suite is green over a class that is 19 rows wide in production.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE CORPUS IS DERIVED, NOT INVENTED
 * ─────────────────────────────────────────────────────────────────────────────
 * The base row is the REAL captured wire fixture
 * (`cee-persisted-graph-wire-2026-08-12.json`, 15 nodes / 28 edges). This spec
 * DERIVES the geometry-bearing class from it by adding `position` — it never
 * edits the capture, which is a dated historic record and append-only
 * (CLAUDE.md trap 14b). A self-authored CEE node would encode my model of CEE
 * rather than CEE (trap 16-inverse); every analytical field asserted below is
 * one the real capture actually carries.
 *
 * The preconditions are pinned IN-TEST so this spec fails loud if it ever stops
 * modelling the class it was written for (trap 13b: a discriminator must pin its
 * own precondition, or it decays into a guard agreeing with itself).
 */

import { describe, it, expect } from 'vitest'
import {
  normalisePersistedGraph,
  isCanvasShapedNode,
} from '../normalisePersistedGraph'
import ceeRow from '../../hooks/__tests__/fixtures/cee-persisted-graph-wire-2026-08-12.json'

const REAL_CEE_NODES = ceeRow.nodes as unknown as any[]
const REAL_CEE_EDGES = ceeRow.edges as unknown as any[]

/**
 * The live class: a GraphV3 node that ALSO carries geometry. Derived from the
 * real capture by adding `position` and nothing else.
 */
const GEOMETRY_BEARING_CEE_NODES = REAL_CEE_NODES.map((n, i) => ({
  ...n,
  position: { x: 100 + i * 40, y: 200 + i * 25 },
}))

const GEOMETRY_BEARING_ROW = {
  nodes: GEOMETRY_BEARING_CEE_NODES,
  edges: REAL_CEE_EDGES,
}

/** The four analytical fields that live at TOP LEVEL on a CEE node. */
const ANALYTICAL_FIELDS = [
  'observed_state',
  'display_value',
  'category',
  'interventions',
] as const

describe('corpus precondition — this spec really is modelling the live class', () => {
  it('the base fixture is a real CEE row: no node carries `data`', () => {
    expect(REAL_CEE_NODES).toHaveLength(15)
    expect(REAL_CEE_NODES.filter((n) => 'data' in n)).toHaveLength(0)
  })

  it('the base fixture carries no geometry (so the derivation below is the ONLY source of it)', () => {
    expect(REAL_CEE_NODES.filter((n) => 'position' in n)).toHaveLength(0)
  })

  it('the derived class is CEE-shaped AND geometry-bearing — both, on every node', () => {
    expect(GEOMETRY_BEARING_CEE_NODES).toHaveLength(15)
    // still CEE-shaped: payload at top level, no React Flow envelope
    expect(GEOMETRY_BEARING_CEE_NODES.filter((n) => 'data' in n)).toHaveLength(0)
    expect(
      GEOMETRY_BEARING_CEE_NODES.filter((n) => typeof n.kind === 'string'),
    ).toHaveLength(15)
    // …and carrying geometry, which is what defeats the old discriminator
    expect(
      GEOMETRY_BEARING_CEE_NODES.filter(
        (n) => typeof n.position?.x === 'number',
      ),
    ).toHaveLength(15)
  })

  it('the real capture actually carries every analytical field this spec asserts', () => {
    // Guards against asserting preservation of a field the corpus never had —
    // which would pass vacuously for ever.
    for (const field of ANALYTICAL_FIELDS) {
      expect(
        REAL_CEE_NODES.some((n) => n[field] !== undefined),
        `real capture carries no \`${field}\` — this spec's preservation assertion would be vacuous`,
      ).toBe(true)
    }
  })
})

describe('P0: a geometry-bearing CEE row must still be projected to canvas shape', () => {
  it('does NOT classify a geometry-bearing CEE node as canvas-shaped', () => {
    // The whole defect in one assertion. `position` alone is not the envelope.
    const offenders = GEOMETRY_BEARING_CEE_NODES.filter((n) =>
      isCanvasShapedNode(n),
    )
    expect(offenders).toHaveLength(0)
  })

  it('projects every node into the React Flow envelope (label/kind reach `data`)', () => {
    const { nodes } = normalisePersistedGraph(GEOMETRY_BEARING_ROW)

    expect(nodes).toHaveLength(15)
    expect(
      nodes.filter((n: any) => typeof n.data?.label === 'string'),
    ).toHaveLength(15)
    expect(
      nodes.filter((n: any) => typeof n.data?.kind === 'string'),
    ).toHaveLength(15)
  })

  it('POST-CONDITION: no node in the output is still in the un-projected shape', () => {
    // Assert the invariant rather than narrate it (Finding A). This REDs if a
    // SECOND shape ever reaches the store, whatever route it arrives by.
    const { nodes } = normalisePersistedGraph(GEOMETRY_BEARING_ROW)

    const unProjected = nodes.filter(
      (n: any) => n.data == null || typeof n.data !== 'object',
    )
    expect(unProjected).toHaveLength(0)
  })

  it('binds by IDENTITY: the specific factor node keeps its own label and kind', () => {
    // Not a value predicate another node could satisfy (CLAUDE.md trap 19).
    const { nodes } = normalisePersistedGraph(GEOMETRY_BEARING_ROW)
    const adoption = nodes.find((n: any) => n.id === 'fac_adoption_speed')

    expect(adoption).toBeDefined()
    expect(adoption!.data.label).toBe('Sales Team Adoption Speed')
    expect(adoption!.data.kind).toBe('factor')
  })
})

describe('the mandatory opposite-direction twin: projecting must not LOSE anything', () => {
  it('preserves every top-level analytical field into `data` on the geometry-bearing row', () => {
    const { nodes } = normalisePersistedGraph(GEOMETRY_BEARING_ROW)
    const byId = new Map(nodes.map((n: any) => [n.id, n]))

    for (const field of ANALYTICAL_FIELDS) {
      const sources = REAL_CEE_NODES.filter((n) => n[field] !== undefined)
      expect(sources.length).toBeGreaterThan(0)

      for (const src of sources) {
        const out: any = byId.get(src.id)
        expect(out, `node ${src.id} vanished during normalisation`).toBeDefined()

        // `observed_state` is deliberately renamed to `observedState` by the
        // canonical mapper; the rest ride through under their own names.
        const landed =
          field === 'observed_state'
            ? out.data.observedState
            : out.data[field]

        expect(
          landed,
          `\`${field}\` was dropped for node ${src.id} — a shape fix must never become a data loss`,
        ).toEqual(src[field])
      }
    }
  })

  it('preserves the same fields on the position-LESS row too (both input shapes)', () => {
    const { nodes } = normalisePersistedGraph({
      nodes: REAL_CEE_NODES,
      edges: REAL_CEE_EDGES,
    })
    const byId = new Map(nodes.map((n: any) => [n.id, n]))

    for (const field of ANALYTICAL_FIELDS) {
      for (const src of REAL_CEE_NODES.filter((n) => n[field] !== undefined)) {
        const out: any = byId.get(src.id)
        const landed =
          field === 'observed_state' ? out.data.observedState : out.data[field]
        expect(landed, `\`${field}\` dropped for ${src.id}`).toEqual(src[field])
      }
    }
  })

  it('KEEPS the persisted geometry rather than resetting it to {0,0}', () => {
    // The naive fix — route these through the mapper — would scramble the
    // user's canvas, because `mapDraftNodeToCanvas` hardcodes {x:0,y:0}.
    // Shape is normalised; layout is preserved.
    const { nodes } = normalisePersistedGraph(GEOMETRY_BEARING_ROW)
    const byId = new Map(nodes.map((n: any) => [n.id, n]))

    for (const src of GEOMETRY_BEARING_CEE_NODES) {
      const out: any = byId.get(src.id)
      expect(out.position).toEqual(src.position)
    }
  })

  it('does not leave geometry loose inside `data` (it is not an analytical field)', () => {
    const { nodes } = normalisePersistedGraph(GEOMETRY_BEARING_ROW)
    expect(nodes.filter((n: any) => 'position' in n.data)).toHaveLength(0)
  })
})

describe('the other direction: a genuine React Flow row must not be touched', () => {
  const RF_NODES = [
    { id: 'n1', type: 'factor', position: { x: 5, y: 6 }, data: { kind: 'factor', label: 'A' } },
    { id: 'n2', type: 'goal', position: { x: 7, y: 8 }, data: { kind: 'goal', label: 'B' } },
  ]

  it('still classifies a real canvas node as canvas-shaped', () => {
    expect(RF_NODES.filter((n) => isCanvasShapedNode(n))).toHaveLength(2)
  })

  it('returns the SAME node objects by reference (no re-projection, no layout churn)', () => {
    const { nodes } = normalisePersistedGraph({ nodes: RF_NODES, edges: [] })
    expect(nodes[0]).toBe(RF_NODES[0])
    expect(nodes[1]).toBe(RF_NODES[1])
  })

  it('keeps the persisted positions exactly', () => {
    const { nodes } = normalisePersistedGraph({ nodes: RF_NODES, edges: [] })
    expect((nodes[0] as any).position).toEqual({ x: 5, y: 6 })
    expect((nodes[1] as any).position).toEqual({ x: 7, y: 8 })
  })
})
