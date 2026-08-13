/**
 * P0 — the SECOND crash on reloading a CEE-written scenario, and the one that
 * fires FIRST.
 *
 * The witness (`WITNESS-978d073c.md` §8) named the fatal render-time throw in
 * `useAutosave.computeGraphHash`. Sweeping `src/` for the same class at that SHA
 * found an earlier one on the very same path:
 *
 *     store.ts  getMaxNumericId → `id.replace(/\D/g, '')`
 *     store.ts  reseedIds       → getMaxNumericId(edges.map(e => e.id))
 *     store.ts  hydrateGraphSlice → get().reseedIds(loaded.nodes, loaded.edges)
 *
 * CEE-written edges carry **no `id` key at all**, so `id` is `undefined` and
 * `undefined.replace(...)` throws. The `try { … } finally { … }` around the
 * `reseedIds` call only decrements a counter — it does NOT catch — so the
 * TypeError propagates out of `hydrateGraphSlice`, out of `loadScenario`, and
 * lands in the `.catch()` at `routes/CanvasMVP.tsx:64`, which outside DEV
 * swallows it in silence.
 *
 * ⭐ THE ORDERING IS THE INTERESTING PART, AND IT RECONCILES TWO RECORDS THAT
 * LOOKED CONTRADICTORY. `hydrateGraphSlice` calls `set(...)` with the new nodes
 * and edges BEFORE it calls `reseedIds`. So on a CEE row:
 *
 *   · the graph DOES land in the store (ROADMAP 2.1096's premise — correct), and
 *   · everything in `loadScenario` AFTER the hydrate — framing, `currentStage`,
 *     `lastSavedAt`, the analysis-status reset, and the `analysis_status ===
 *     'ready'` hydration — silently never runs (2.1096's "silent partial
 *     hydration" — also correct), and
 *   · the user still sees a BLANK canvas, because the separate render-time throw
 *     in `useAutosave` then takes the error boundary (the witness — also correct).
 *
 * Two authorities answering two different questions, both right. What was wrong
 * was reading either as the whole account.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'
import { normalisePersistedGraph } from '../utils/normalisePersistedGraph'
import ceeRow from '../hooks/__tests__/fixtures/cee-persisted-graph-wire-2026-08-12.json'

const CEE_NODES = ceeRow.nodes as unknown as any[]
const CEE_EDGES = ceeRow.edges as unknown as any[]

/** Precondition pin — these assertions are vacuous if the fixture drifts. */
describe('fixture precondition', () => {
  it('is a real CEE row: edges carry no id, nodes carry no position', () => {
    expect(CEE_EDGES.filter((e) => 'id' in e)).toHaveLength(0)
    expect(CEE_NODES.filter((n) => 'position' in n)).toHaveLength(0)
    expect(CEE_EDGES).toHaveLength(28)
  })
})

describe('P0: hydrating a CEE-written row must not throw out of the store', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodes: [], edges: [] })
  })

  /**
   * RED at pristine with:
   *   TypeError: Cannot read properties of undefined (reading 'replace')
   *     at getMaxNumericId … at reseedIds … at hydrateGraphSlice
   */
  it('hydrateGraphSlice survives edges with no `id` (defence in depth)', () => {
    expect(() =>
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: CEE_NODES as any,
        edges: CEE_EDGES as any,
        currentScenarioId: 'scenario-under-test',
        goalConstraints: null,
      }),
    ).not.toThrow()
  })

  it('and the id reseed still advances past the ids that ARE numeric', () => {
    useCanvasStore.getState().hydrateGraphSlice({
      nodes: [{ id: 'n7' }, { id: 'n2' }] as any,
      edges: [{ id: 'e4' }, { from: 'a', to: 'b' } as any] as any,
      currentScenarioId: 's',
      goalConstraints: null,
    })
    // A malformed (id-less) element must be SKIPPED, not allowed to reset the
    // seed — otherwise the next created edge collides with an existing one.
    expect(useCanvasStore.getState().nextNodeId).toBe(8)
    expect(useCanvasStore.getState().nextEdgeId).toBe(5)
  })
})

/**
 * `historyHash` read `n.position.x` unguarded and runs on EVERY graph edit via
 * `pushToHistory`. With the normaliser in place a position-less node should not
 * reach the store by the reload route — but this is the same defence-in-depth
 * argument as the id guard, and an unpinned guard is one a tidy-up deletes.
 */
describe('P0: an edit does not throw when a node somehow lacks geometry', () => {
  it('pushToHistory tolerates a position-less node (historyHash guard)', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'factor', data: { label: 'A' } } as any],
      edges: [],
      history: { past: [], future: [] },
    } as any)

    // updateNode routes through the store's edit chokepoint → pushToHistory →
    // historyHash. RED before the guard: `Cannot read properties of undefined
    // (reading 'x')` — which is the OTHER TypeError the witness recorded firing
    // on reload (WITNESS-978d073c.md §8 item 1), the non-fatal one.
    expect(() => useCanvasStore.getState().updateNode('n1', { label: 'B' } as any)).not.toThrow()
  })
})

describe('P0: the normalised row is what should reach the store', () => {
  it('normalisePersistedGraph turns the real CEE row into canvas shape', () => {
    const { nodes, edges } = normalisePersistedGraph(ceeRow)

    expect(nodes).toHaveLength(15)
    expect(edges).toHaveLength(28)

    // Every node now has the geometry React Flow requires and a `data` bag.
    expect(nodes.filter((n: any) => n.position && typeof n.position.x === 'number')).toHaveLength(15)
    expect(nodes.filter((n: any) => n.data && typeof n.data === 'object')).toHaveLength(15)

    // Every edge now has React Flow endpoints AND an id.
    expect(edges.filter((e: any) => typeof e.source === 'string' && typeof e.target === 'string'))
      .toHaveLength(28)
    expect(edges.filter((e: any) => typeof e.id === 'string')).toHaveLength(28)
  })

  it('carries the CEE label and kind through to where the canvas reads them', () => {
    const { nodes } = normalisePersistedGraph(ceeRow)
    const decision: any = nodes.find((n: any) => n.id === CEE_NODES[0].id)
    // The canvas renders `data.label`; CEE puts it at the top level. If this
    // regressed, the user's decision would render as unlabelled empty boxes.
    expect(decision.data.label).toBe(CEE_NODES[0].label)
    expect(decision.data.kind).toBe(CEE_NODES[0].kind)
    expect(decision.type).toBe(CEE_NODES[0].kind)
  })

  it('preserves the real endpoint identities (no collapse to a constant)', () => {
    const { edges } = normalisePersistedGraph(ceeRow)
    expect(edges[0].source).toBe(CEE_EDGES[0].from)
    expect(edges[0].target).toBe(CEE_EDGES[0].to)
    // Distinct edges stay distinct.
    expect(new Set(edges.map((e: any) => `${e.source}>${e.target}`)).size)
      .toBe(new Set(CEE_EDGES.map((e: any) => `${e.from}>${e.to}`)).size)
  })

  it('hydrating the NORMALISED row leaves a canvas the store can render', () => {
    const { nodes, edges } = normalisePersistedGraph(ceeRow)
    useCanvasStore.getState().hydrateGraphSlice({
      nodes: nodes as any,
      edges: edges as any,
      currentScenarioId: 'scenario-under-test',
      goalConstraints: null,
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(15)
    expect(useCanvasStore.getState().edges).toHaveLength(28)
  })
})

/**
 * IDENTITY for the shape that already worked. A React-Flow-shaped row must not
 * be re-mapped — those rows reload correctly today and re-mapping them would be
 * a silent behaviour change for the majority path.
 */
describe('a React-Flow-shaped row passes through unchanged', () => {
  const rfRow = {
    nodes: [
      { id: 'n1', type: 'factor', position: { x: 5, y: 6 }, data: { kind: 'factor', label: 'A' } },
      { id: 'n2', type: 'goal', position: { x: 7, y: 8 }, data: { kind: 'goal', label: 'B' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'styled', data: { weight: 1 } }],
  }

  it('returns the SAME node objects by reference', () => {
    const { nodes } = normalisePersistedGraph(rfRow)
    expect(nodes[0]).toBe(rfRow.nodes[0])
    expect(nodes[1]).toBe(rfRow.nodes[1])
  })

  it('keeps edge endpoints and ids, and applies only the DEFAULT_EDGE_DATA backfill', () => {
    const { edges } = normalisePersistedGraph(rfRow)
    expect(edges[0].id).toBe('e1')
    expect(edges[0].source).toBe('n1')
    expect(edges[0].target).toBe('n2')
    expect((edges[0].data as any).weight).toBe(1)
  })

  it('tolerates a null / empty column without inventing a graph', () => {
    expect(normalisePersistedGraph(null)).toEqual({ nodes: [], edges: [] })
    expect(normalisePersistedGraph({})).toEqual({ nodes: [], edges: [] })
  })
})
