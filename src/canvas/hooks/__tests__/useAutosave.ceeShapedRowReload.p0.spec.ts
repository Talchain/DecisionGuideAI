/**
 * P0 — reloading a CEE-written scenario crashes the canvas.
 *
 * WITNESSED ON THE DEPLOYED BUILD, 2026-08-13, UI `978d073c`
 * (`olumi-docs/PHASE0-EVIDENCE-2026-07-28/analysis-500-p0-2026-08-13/WITNESS-978d073c.md`
 * §8, Arm F). Reloading `#/scenario/:id` on a row CEE last wrote produced:
 *
 *     TypeError: Cannot read properties of undefined (reading 'localeCompare')
 *         at ReactFlowGraph-wf6K1mco.js:23:465004
 *         at Array.sort (<anonymous>)
 *         at Object.Gu [as useMemo]
 *
 * — thrown during render, so React's error boundary took the whole canvas:
 * **0 nodes, 0 edges**, under a panel reading "Your work is auto-saved."
 * Witnessed 3/3 on CEE-written rows and 0/2 on React-Flow-written rows, i.e. a
 * discriminating pair: the failure is specific to the shape CEE writes.
 *
 * MECHANISM. `useScenario.loadScenario` hydrates the `scenarios.graph` column
 * into the canvas store VERBATIM (`useScenario.ts:648-689` — the only transform
 * spreads DEFAULT_EDGE_DATA into `edge.data`). CEE-written edges carry `from`/`to`
 * and have **no** `source`/`target`, so `computeGraphHash`'s edge projection read
 * `e.source` → `undefined`, and the `.sort()` comparator then called
 * `undefined.localeCompare(...)`.
 *
 * ⭐ THE ASYMMETRY THAT NAMES THE DEFECT: eleven lines apart in the same function,
 * the NODE half was already defensive (`n.position?.x ?? 0`) and the EDGE half was
 * not. One half of a mirrored projection was hardened and the other was not.
 *
 * ⚠ WHY "DOES NOT THROW" IS NOT THE ACCEPTANCE CONDITION. `computeGraphHash` is
 * the autosave's DIRTY-DETECTION signature: it is compared only against itself
 * in-memory (`lastSavedHashRef`) to decide whether to write. A "fix" that merely
 * stopped the throw — `e.source ?? ''` — would make every CEE-shaped edge project
 * the SAME endpoints, so rewiring an edge would not flip the hash, the autosave
 * would skip, and the edit would be silently lost on reload. That is the #457 loss
 * class this module's own header exists to prevent, and it is WORSE than the crash
 * because nothing reports it. Hence the FIDELITY tests below, not just the
 * no-throw test.
 *
 * FIXTURE PROVENANCE — REAL PRODUCER BYTES, NOT HAND-AUTHORED.
 * `fixtures/cee-persisted-graph-wire-2026-08-12.json` is the `.body.draft_graph`
 * of a real captured CEE draft turn
 * (`olumi-docs/PHASE0-EVIDENCE-2026-07-28/coaching-surface-2026-08-12/wire2-02-draft-raw.json`,
 * captured 2026-08-12). Node and edge objects are VERBATIM — no field was added,
 * removed or rewritten; only the enclosing `{nodes, edges}` was lifted out. Its
 * edge key manifest matches the witness's persisted-row manifest character for
 * character. Its node objects carry three keys the witnessed row did not show
 * (`encoding_map`, `is_baseline`, `prior`) — a SUPERSET, which cannot make the
 * defect easier to hit, since what triggers it is the ABSENCE of `source`/`target`.
 * A fixture I authored myself would only encode my model of the producer; this is
 * the producer's own output.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutosave, computeGraphHash } from '../useAutosave'
import { useCanvasStore } from '../../store'
import ceeRow from './fixtures/cee-persisted-graph-wire-2026-08-12.json'

const CEE_NODES = ceeRow.nodes as unknown as any[]
const CEE_EDGES = ceeRow.edges as unknown as any[]

/**
 * PRECONDITION PIN (trap 13b). Every assertion below is only meaningful while the
 * fixture is genuinely in the defect class. If a later tidy-up "helpfully" adds
 * `source`/`target` or `position` to the fixture, these tests would keep passing
 * while testing nothing at all. This block makes that failure LOUD instead.
 */
describe('the fixture is a real CEE-shaped row (precondition — not the defect itself)', () => {
  it('carries CEE edge endpoints and NONE of the React Flow markers', () => {
    expect(CEE_NODES).toHaveLength(15)
    expect(CEE_EDGES).toHaveLength(28)

    // The React Flow markers that MUST be absent, or the defect cannot fire.
    expect(CEE_NODES.filter((n) => 'position' in n)).toHaveLength(0)
    expect(CEE_NODES.filter((n) => 'data' in n)).toHaveLength(0)
    expect(CEE_EDGES.filter((e) => 'source' in e)).toHaveLength(0)
    expect(CEE_EDGES.filter((e) => 'target' in e)).toHaveLength(0)
    expect(CEE_EDGES.filter((e) => 'id' in e)).toHaveLength(0)

    // The CEE markers that MUST be present.
    expect(CEE_EDGES.filter((e) => typeof e.from === 'string' && typeof e.to === 'string'))
      .toHaveLength(28)
    expect(CEE_NODES.filter((n) => typeof n.id === 'string')).toHaveLength(15)
  })
})

describe('P0: computeGraphHash over a CEE-written row', () => {
  it('does not throw — RED at pristine with "Cannot read properties of undefined (reading \'localeCompare\')"', () => {
    expect(() => computeGraphHash(CEE_NODES, CEE_EDGES)).not.toThrow()
  })

  it('renders the autosave hook without taking the error boundary (the deployed failure)', () => {
    useCanvasStore.setState({ nodes: CEE_NODES as any, edges: CEE_EDGES as any })

    // renderHook throws if the useMemo throws — which is exactly what took the
    // canvas on the deployed build. Surviving render is the behavioural claim.
    expect(() => renderHook(() => useAutosave())).not.toThrow()

    // And the graph is still there afterwards: the deployed symptom was 0 nodes.
    expect(useCanvasStore.getState().nodes).toHaveLength(15)
    expect(useCanvasStore.getState().edges).toHaveLength(28)
  })
})

/**
 * FIDELITY — the half that stops a crash-fix becoming a silent-data-loss fix.
 * Each case changes exactly ONE thing about a CEE-shaped graph and requires the
 * dirty signature to notice. A projection that collapsed CEE edges to a constant
 * would pass the no-throw test above and fail every one of these.
 */
describe('P0: the CEE-shaped signature is FAITHFUL, not merely non-throwing', () => {
  const baseline = () => computeGraphHash(CEE_NODES, CEE_EDGES)

  it('notices an edge endpoint being rewired', () => {
    const rewired = CEE_EDGES.map((e, i) =>
      i === 0 ? { ...e, to: CEE_NODES[CEE_NODES.length - 1].id } : e,
    )
    // Guard the case is real: the rewire must actually change the endpoint.
    expect(rewired[0].to).not.toBe(CEE_EDGES[0].to)
    expect(computeGraphHash(CEE_NODES, rewired)).not.toBe(baseline())
  })

  it('notices an edge being removed', () => {
    expect(computeGraphHash(CEE_NODES, CEE_EDGES.slice(1))).not.toBe(baseline())
  })

  it('notices two DIFFERENT edges swapping endpoints (order-insensitive sort still discriminates)', () => {
    const swapped = CEE_EDGES.map((e, i) =>
      i === 0 ? { ...e, from: CEE_EDGES[1].from, to: CEE_EDGES[1].to } : e,
    )
    expect(computeGraphHash(CEE_NODES, swapped)).not.toBe(baseline())
  })

  it('actually carries the CEE endpoint identities into the signature', () => {
    const hash = computeGraphHash(CEE_NODES, CEE_EDGES)
    // If the projection collapsed endpoints to '' or undefined, these are absent.
    expect(hash).toContain(CEE_EDGES[0].from)
    expect(hash).toContain(CEE_EDGES[0].to)
  })

  it('notices a CEE node label edit (label is top-level on CEE nodes, not in data)', () => {
    const relabelled = CEE_NODES.map((n, i) => (i === 0 ? { ...n, label: 'Renamed by the user' } : n))
    expect(relabelled[0].label).not.toBe(CEE_NODES[0].label)
    expect(computeGraphHash(relabelled, CEE_EDGES)).not.toBe(baseline())
  })
})

/**
 * NON-REGRESSION for the shape that already worked. The fix must not change the
 * signature behaviour of React-Flow-shaped graphs — those reload fine today
 * (witnessed 2/2) and every existing autosave pin depends on them.
 */
describe('React-Flow-shaped graphs are unaffected', () => {
  const rfNodes = [
    { id: 'n1', type: 'factor', position: { x: 10, y: 20 }, data: { kind: 'factor', label: 'A' } },
    { id: 'n2', type: 'goal', position: { x: 30, y: 40 }, data: { kind: 'goal', label: 'B' } },
  ]
  const rfEdges = [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 1 } }]

  it('still projects source/target and still discriminates a rewire', () => {
    const before = computeGraphHash(rfNodes, rfEdges)
    expect(before).toContain('n1')
    expect(before).toContain('n2')
    const rewired = [{ ...rfEdges[0], target: 'n1' }]
    expect(computeGraphHash(rfNodes, rewired)).not.toBe(before)
  })

  it('still discriminates a React Flow node label edit', () => {
    const before = computeGraphHash(rfNodes, rfEdges)
    const edited = rfNodes.map((n, i) => (i === 0 ? { ...n, data: { ...n.data, label: 'A2' } } : n))
    expect(computeGraphHash(edited, rfEdges)).not.toBe(before)
  })
})
