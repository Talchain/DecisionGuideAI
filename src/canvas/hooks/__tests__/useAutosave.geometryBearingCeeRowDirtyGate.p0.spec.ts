/**
 * P0 — THE EDIT-LOSS CONSEQUENCE OF A GEOMETRY-BEARING CEE ROW.
 *
 * `useAutosave.computeGraphHash` is the autosave's DIRTY GATE: if an edit does
 * not flip this hash, the debounced save is skipped and the edit is gone on
 * reload (the #457 loss class).
 *
 * The hash covers `data.*` by default. It reaches a node's analytical payload
 * only when that payload is under `data` — which is precisely what the
 * hydration-boundary projector is for. `useAutosave`'s own header recorded the
 * gap as a RESIDUAL:
 *
 *     ⚠ RESIDUAL, deliberately not closed here: for a CEE-shaped node the
 *     analytical payload (`observed_state`, `display_value`, `category`,
 *     `interventions`) lives at the TOP LEVEL, not under `data`, so it is not
 *     covered by the `data.*` hash-by-default rule and an edit to it would not
 *     flip this hash. […] the fix belongs at the hydration boundary.
 *
 * It was right about where the fix belonged. The boundary could not deliver it
 * for the **geometry-bearing** class, because `isCanvasShapedNode` discriminated
 * on `position` alone and waved those rows through unprojected — so on the 19
 * live rows that carry geometry, a user's edit to a factor's observed value
 * changed nothing the dirty gate could see, and was lost on reload.
 *
 * These tests pin the consequence end-to-end: hydrate the way `loadScenario`
 * does, then assert the gate can SEE an analytical edit.
 *
 * ⚠ BOTH DIRECTIONS ARE PINNED, and the second one is the trap. `position` IS
 * legitimately part of this hash — it is the one authority in the estate that
 * should see geometry, because a node move is a real change that must be
 * persisted to the layout sidecar. A "fix" that made this hash ignore geometry
 * would stop layout being saved at all. Analysis staleness is a DIFFERENT
 * question with a DIFFERENT owner (`hasAnalyticalGraphChange` /
 * `analyticalNodeFields`, which classifies position as cosmetic). Two questions,
 * two authorities — CLAUDE.md trap 21.
 */

import { describe, it, expect } from 'vitest'
import { computeGraphHash } from '../useAutosave'
import { normalisePersistedGraph } from '../../utils/normalisePersistedGraph'
import ceeRow from './fixtures/cee-persisted-graph-wire-2026-08-12.json'

const REAL_CEE_NODES = ceeRow.nodes as unknown as any[]
const REAL_CEE_EDGES = ceeRow.edges as unknown as any[]

/** The live class: a real GraphV3 row that also carries geometry. */
function geometryBearingRow() {
  return {
    nodes: REAL_CEE_NODES.map((n, i) => ({
      ...n,
      position: { x: 100 + i * 40, y: 200 + i * 25 },
    })),
    edges: REAL_CEE_EDGES,
  }
}

/** Hydrate exactly the way `useScenario.loadScenario` does. */
function hydrate(row: unknown) {
  return normalisePersistedGraph(row)
}

/** A node the real capture gives an `observed_state`. Bound by IDENTITY. */
const OBSERVED_NODE_ID = (
  REAL_CEE_NODES.find((n) => n.observed_state !== undefined) ?? {}
).id as string

describe('corpus precondition', () => {
  it('the capture really does carry an `observed_state` node to edit', () => {
    // Without this the edit below would be a no-op and every assertion vacuous.
    expect(OBSERVED_NODE_ID).toBeTypeOf('string')
    const src = REAL_CEE_NODES.find((n) => n.id === OBSERVED_NODE_ID)
    expect(src.observed_state).toBeDefined()
  })
})

describe('P0: the dirty gate must SEE an analytical edit on a geometry-bearing CEE row', () => {
  it('an edit to `observed_state` flips the autosave hash (otherwise it is lost on reload)', () => {
    const before = hydrate(geometryBearingRow())
    const baseline = computeGraphHash(before.nodes, before.edges)

    // Edit the factor's observed value, as the Model tab does.
    const edited = hydrate(geometryBearingRow())
    const target = edited.nodes.find((n: any) => n.id === OBSERVED_NODE_ID) as any
    expect(target, 'the node under test must survive hydration').toBeDefined()
    target.data.observedState = {
      ...(target.data.observedState ?? {}),
      value: 0.4242,
    }

    const after = computeGraphHash(edited.nodes, edited.edges)
    expect(after).not.toBe(baseline)
  })

  it('the analytical payload is actually reachable under `data` after hydration', () => {
    // Binds the mechanism, not just the outcome: if this stops holding, the
    // test above could still pass for an unrelated reason.
    const { nodes } = hydrate(geometryBearingRow())
    const target = nodes.find((n: any) => n.id === OBSERVED_NODE_ID) as any
    expect(target.data.observedState).toBeDefined()
  })
})

describe('the twin: a pure LAYOUT move must STILL dirty the autosave', () => {
  it('moving a node flips the hash — geometry belongs to this authority', () => {
    const before = hydrate(geometryBearingRow())
    const baseline = computeGraphHash(before.nodes, before.edges)

    const moved = hydrate(geometryBearingRow())
    const target = moved.nodes.find((n: any) => n.id === OBSERVED_NODE_ID) as any
    target.position = { x: target.position.x + 137, y: target.position.y + 91 }

    const after = computeGraphHash(moved.nodes, moved.edges)
    expect(
      after,
      'a layout move must still be saved — this hash is the layout sidecar’s gate',
    ).not.toBe(baseline)
  })

  it('and an unchanged graph does NOT flip it (the gate is not simply always-dirty)', () => {
    // Without this, both assertions above would pass on a hash that changes on
    // every call — a gate that always fires is not a gate.
    const a = hydrate(geometryBearingRow())
    const b = hydrate(geometryBearingRow())
    expect(computeGraphHash(a.nodes, a.edges)).toBe(
      computeGraphHash(b.nodes, b.edges),
    )
  })
})
