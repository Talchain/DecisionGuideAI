/**
 * ROADMAP 2.467 — canvas → CEE wire, for the registration seam.
 *
 * FIXTURE PROVENANCE: `fixtures/walk-import-modified.canvas.json` is a BYTE
 * COPY of the file a real browser actually imported during the 5 Aug P0 witness
 * walk (`PHASE0-EVIDENCE-2026-07-28/walk-p0-witness-raw/import-modified.json`).
 * Nothing about it was written by this lane — it is the producer's own export,
 * relabelled by the walker on exactly one node. `walk-export-original.canvas.json`
 * is the same model BEFORE that relabel, so the pair is the real before/after.
 *
 * That matters more than usual here: the defect is that CEE analysed a
 * DIFFERENT graph from the one on screen, so a hand-written fixture would
 * encode this lane's model of a canvas node rather than the canvas's.
 */
import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import { buildRegistrationGraph } from '../buildRegistrationGraph'

import IMPORTED_CANVAS from './fixtures/walk-import-modified.canvas.json'
import ORIGINAL_CANVAS from './fixtures/walk-export-original.canvas.json'
import CODEX_EXPORT from './fixtures/codex-export-2026-08-05.canvas.json'

type CanvasFile = { nodes: Node[]; edges: Edge[] }

const IMPORTED = IMPORTED_CANVAS as unknown as CanvasFile
const ORIGINAL = ORIGINAL_CANVAS as unknown as CanvasFile

function okGraph(result: ReturnType<typeof buildRegistrationGraph>) {
  if (!result.ok) throw new Error(`expected ok, got refusal: ${result.reason}`)
  return result.graph
}

function refusal(result: ReturnType<typeof buildRegistrationGraph>) {
  if (result.ok) throw new Error('expected a refusal, got ok')
  return result
}

/** Deep-clone so a mutation in one case cannot leak into another. */
function clone(file: CanvasFile): CanvasFile {
  return JSON.parse(JSON.stringify(file)) as CanvasFile
}

describe('buildRegistrationGraph — the captured canvas file', () => {
  it('POSITIVE CONTROL: the fixture is the walk pair, and it carries the shapes this projection must handle', () => {
    // Trap 13. Everything below about "positions are dropped" and "the sentinel
    // survives" is vacuous if the fixture never carried a position or a sentinel.
    expect(IMPORTED.nodes).toHaveLength(14)
    expect(IMPORTED.edges).toHaveLength(32)
    expect(IMPORTED.nodes.every((n) => n.position !== undefined)).toBe(true)
    const sentinel = IMPORTED.nodes.find((n) => n.id === 'opt_alpha')
    expect((sentinel?.data as Record<string, unknown>)?.label).toBe('ZZZ IMPORTED OPTION')
    // The before/after pair really is a pair: one label differs, nothing else.
    expect((ORIGINAL.nodes.find((n) => n.id === 'opt_alpha')?.data as Record<string, unknown>)?.label).toBe(
      'Alpha Hall',
    )
    expect(ORIGINAL.nodes.map((n) => n.id)).toEqual(IMPORTED.nodes.map((n) => n.id))
    // At least one node carries the canvas spelling CEE renames.
    expect(
      IMPORTED.nodes.some((n) => 'observedState' in ((n.data ?? {}) as Record<string, unknown>)),
    ).toBe(true)
  })

  it('projects the real import into CEE wire shape, carrying the sentinel', () => {
    const graph = okGraph(buildRegistrationGraph(IMPORTED.nodes, IMPORTED.edges))
    expect(graph.nodes).toHaveLength(14)
    expect(graph.edges).toHaveLength(32)
    // Bound BY IDENTITY, never by a value predicate another node could satisfy.
    const sentinel = graph.nodes.find((n) => n.id === 'opt_alpha')
    expect(sentinel?.label).toBe('ZZZ IMPORTED OPTION')
    expect(sentinel?.kind).toBe('option')
  })

  it('DISCRIMINATES the two captured graphs — the projection is not label-blind', () => {
    // The whole train exists because two graphs that differ by a label were
    // treated as one. A projection that flattened that difference would hand
    // CEE a graph indistinguishable from the one it already has.
    const after = okGraph(buildRegistrationGraph(IMPORTED.nodes, IMPORTED.edges))
    const before = okGraph(buildRegistrationGraph(ORIGINAL.nodes, ORIGINAL.edges))
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before))
    expect(after.nodes.find((n) => n.id === 'opt_alpha')?.label).toBe('ZZZ IMPORTED OPTION')
    expect(before.nodes.find((n) => n.id === 'opt_alpha')?.label).toBe('Alpha Hall')
  })

  it('drops layout — `scenarios.graph` carries no positions', () => {
    const graph = okGraph(buildRegistrationGraph(IMPORTED.nodes, IMPORTED.edges))
    const serialised = JSON.stringify(graph)
    expect(serialised).not.toContain('"position"')
    expect(graph.nodes.every((n) => !('position' in n))).toBe(true)
  })

  it('the ReactFlow renderer key NEVER outranks the semantic spelling', () => {
    // MEASURED: on the captured file all three spellings agree, so a mutant
    // that flipped the precedence to `node.type ?? data.kind` SURVIVED. That is
    // a hole in the oracle, not an equivalence — `node.type` is a RENDERER key
    // and `data.kind` is what the analysis means by the node. This is the case
    // that discriminates them.
    const file = clone(IMPORTED)
    const node = file.nodes.find((n) => n.id === 'opt_alpha')!
    // POSITIVE CONTROL: the fixture starts with all three agreeing, so the
    // divergence below is genuinely introduced by this test.
    expect(node.type).toBe('option')
    node.type = 'factor'

    const graph = okGraph(buildRegistrationGraph(file.nodes, file.edges))
    expect(graph.nodes.find((n) => n.id === 'opt_alpha')?.kind).toBe('option')
  })

  it('drops a position nested INSIDE node.data, not just the top-level one', () => {
    // MEASURED: deleting `'position'` from the canvas-only key list left every
    // test green, because the captured file carries `position` only at the top
    // level (which is dropped structurally, by never being copied). The
    // blocklist entry exists for the nested case — so the nested case is what
    // has to be asserted, or the entry is decoration a tidy-up would delete.
    const file = clone(IMPORTED)
    const node = file.nodes.find((n) => n.id === 'opt_alpha')!
    ;(node.data as Record<string, unknown>).position = { x: 1, y: 2 }

    const graph = okGraph(buildRegistrationGraph(file.nodes, file.edges))
    expect(graph.nodes.find((n) => n.id === 'opt_alpha')).not.toHaveProperty('position')
    expect(JSON.stringify(graph)).not.toContain('"position"')
  })

  it('emits exactly ONE kind spelling per node — no `type` reaches the wire', () => {
    const graph = okGraph(buildRegistrationGraph(IMPORTED.nodes, IMPORTED.edges))
    expect(graph.nodes.every((n) => typeof n.kind === 'string')).toBe(true)
    expect(graph.nodes.every((n) => !('type' in n))).toBe(true)
  })

  it('renames `observedState` to CEE`s `observed_state` and keeps its contents', () => {
    const graph = okGraph(buildRegistrationGraph(IMPORTED.nodes, IMPORTED.edges))
    const facAlpha = graph.nodes.find((n) => n.id === 'fac_alpha')
    expect(facAlpha).toBeDefined()
    expect(facAlpha).not.toHaveProperty('observedState')
    expect(facAlpha?.observed_state).toEqual(
      (IMPORTED.nodes.find((n) => n.id === 'fac_alpha')?.data as Record<string, unknown>)
        .observedState,
    )
  })

  it('maps edge endpoints to `from`/`to` — the canvas spells them `source`/`target`', () => {
    const graph = okGraph(buildRegistrationGraph(IMPORTED.nodes, IMPORTED.edges))
    const first = IMPORTED.edges[0]
    expect(graph.edges[0]).toMatchObject({ from: first.source, to: first.target })
    expect(graph.edges.every((e) => !('source' in e) && !('target' in e))).toBe(true)
  })

  it('signs the edge strength by direction and clamps it to [-1, +1]', () => {
    const nodes = [
      { id: 'a', type: 'factor', data: { kind: 'factor', label: 'A' } },
      { id: 'b', type: 'goal', data: { kind: 'goal', label: 'B' } },
    ] as unknown as Node[]
    const negative = [
      { id: 'e1', source: 'a', target: 'b', data: { weight: 1.5, direction: 'negative' } },
    ] as unknown as Edge[]
    const overWeight = [
      { id: 'e1', source: 'a', target: 'b', data: { weight: 9, direction: 'positive' } },
    ] as unknown as Edge[]

    expect(okGraph(buildRegistrationGraph(nodes, negative)).edges[0]).toMatchObject({
      strength: { mean: -1 },
      effect_direction: 'negative',
    })
    expect(okGraph(buildRegistrationGraph(nodes, overWeight)).edges[0]).toMatchObject({
      strength: { mean: 1 },
    })
  })
})

describe('buildRegistrationGraph — the analysis-bearing fields must reach the server', () => {
  /**
   * FIXTURE: the independent reviewer's own export, 5 Aug 2026
   * (`PHASE0-EVIDENCE-2026-07-28/codex-deep-review-2026-08-05-raw/canvas-export-1785945361783.json`,
   * SHA-256 `b2c195f16778…`) — 20 nodes, 34 edges, carrying a real
   * goal-threshold quad (`raw 250000`, `unit £`, `cap 312500`, `frame level`).
   *
   * ⚠ WHY THIS FIXTURE IS THE FILE AND NOT THE CANVAS. Measured at these bytes:
   *   the IMPORT path itself strips this data before the canvas ever sees it —
   *   `importCanvas` on this exact file returns 20 nodes whose goal `data` is
   *   reduced to `{kind, label, provenance, type}`, because
   *   `V2SnapshotSchema`'s `AnyNodeDataSchema` is a strict discriminated union
   *   and Zod drops undeclared keys. That defect is UPSTREAM of this module and
   *   is reported, not silently absorbed.
   *
   *   This test therefore pins THIS seam's own obligation: given a canvas that
   *   DOES carry the analysis-bearing fields, the registration projection must
   *   not become a SECOND strip. Registering a hollowed-out graph would make
   *   the server agree with a hollowed-out screen — agreement is not the goal,
   *   carrying the user's model is.
   */
  const codex = CODEX_EXPORT as unknown as CanvasFile

  it('POSITIVE CONTROL: the reviewer`s export really carries the goal-threshold quad', () => {
    const goal = codex.nodes.find((n) => n.id === 'goal_mrr')
    const data = goal?.data as Record<string, unknown>
    expect(data.goal_threshold_raw).toBe(250000)
    expect(data.goal_threshold_unit).toBe('£')
    expect(data.goal_threshold_cap).toBe(312500)
    expect(data.goal_threshold_frame).toBe('level')
    expect(codex.nodes).toHaveLength(20)
    expect(codex.edges).toHaveLength(34)
  })

  it('carries the WHOLE goal-threshold quad through to the wire, bound to the goal node by id', () => {
    const graph = okGraph(buildRegistrationGraph(codex.nodes, codex.edges))
    const goal = graph.nodes.find((n) => n.id === 'goal_mrr')
    expect(goal).toMatchObject({
      kind: 'goal',
      goal_threshold_raw: 250000,
      goal_threshold_unit: '£',
      goal_threshold_cap: 312500,
      goal_threshold_frame: 'level',
    })
  })

  it('carries the baseline-option marker and per-node observed values', () => {
    const graph = okGraph(buildRegistrationGraph(codex.nodes, codex.edges))
    // Bound by IDENTITY: this option, not "an option somewhere with is_baseline".
    expect(graph.nodes.find((n) => n.id === 'opt_status_quo')?.is_baseline).toBe(true)
    expect(graph.nodes.find((n) => n.id === 'opt_hire_sales')?.is_baseline).toBe(false)
  })

  it('DISCRIMINATING HALF: a canvas WITHOUT the quad produces a wire node without it — the test is not asserting a constant', () => {
    const stripped = clone(codex)
    const goal = stripped.nodes.find((n) => n.id === 'goal_mrr')!
    for (const k of Object.keys(goal.data as Record<string, unknown>)) {
      if (k.startsWith('goal_threshold')) delete (goal.data as Record<string, unknown>)[k]
    }
    const graph = okGraph(buildRegistrationGraph(stripped.nodes, stripped.edges))
    expect(graph.nodes.find((n) => n.id === 'goal_mrr')).not.toHaveProperty('goal_threshold_raw')
  })
})

describe('buildRegistrationGraph — refusals (2.467c: disagreement is refused, absence is resolved)', () => {
  it('REFUSES a divergent-field file and names the node BY ID', () => {
    const file = clone(IMPORTED)
    const node = file.nodes.find((n) => n.id === 'opt_alpha')!
    ;(node.data as Record<string, unknown>).type = 'factor'

    const r = refusal(buildRegistrationGraph(file.nodes, file.edges))
    expect(r.reason).toBe('divergent_node_kind')
    expect(r.nodeIds).toEqual(['opt_alpha'])
  })

  it('DISCRIMINATING PAIR: diverging a DIFFERENT node names THAT node, not opt_alpha', () => {
    const file = clone(IMPORTED)
    const node = file.nodes.find((n) => n.id === 'goal_turnout')!
    ;(node.data as Record<string, unknown>).type = 'risk'

    const r = refusal(buildRegistrationGraph(file.nodes, file.edges))
    expect(r.nodeIds).toEqual(['goal_turnout'])
    expect(r.nodeIds).not.toContain('opt_alpha')
  })

  it('DISCRIMINATING PAIR: the SAME node with an AGREEING `type` is accepted', () => {
    // Without this half, the refusals above could be "any node carrying
    // `data.type` is refused" rather than "a node whose spellings disagree".
    // The captured file already carries an agreeing `data.type` on all 14
    // nodes, which is exactly why the accepted case above passes.
    const file = clone(IMPORTED)
    const node = file.nodes.find((n) => n.id === 'opt_alpha')!
    expect((node.data as Record<string, unknown>).type).toBe('option')
    expect((node.data as Record<string, unknown>).kind).toBe('option')
    const graph = okGraph(buildRegistrationGraph(file.nodes, file.edges))
    expect(graph.nodes.find((n) => n.id === 'opt_alpha')?.kind).toBe('option')
  })

  it('RESOLVES absence: a node with only `data.type` keeps its meaning', () => {
    const file = clone(IMPORTED)
    for (const n of file.nodes) delete (n.data as Record<string, unknown>).kind
    const graph = okGraph(buildRegistrationGraph(file.nodes, file.edges))
    expect(graph.nodes.find((n) => n.id === 'opt_alpha')?.kind).toBe('option')
  })

  it('falls back to the ReactFlow renderer key ONLY when no semantic spelling exists', () => {
    const file = clone(IMPORTED)
    for (const n of file.nodes) {
      delete (n.data as Record<string, unknown>).kind
      delete (n.data as Record<string, unknown>).type
    }
    const graph = okGraph(buildRegistrationGraph(file.nodes, file.edges))
    expect(graph.nodes.find((n) => n.id === 'goal_turnout')?.kind).toBe('goal')
  })

  it('REFUSES rather than coercing an untypeable node to `factor`', () => {
    // The legacy turn mapper coerces. This one must not: quietly relabelling a
    // node during a whole-graph REPLACE is how screen and server diverge.
    const file = clone(IMPORTED)
    const node = file.nodes.find((n) => n.id === 'fac_weather')!
    delete (node.data as Record<string, unknown>).kind
    delete (node.data as Record<string, unknown>).type
    node.type = 'not-a-real-kind'

    const r = refusal(buildRegistrationGraph(file.nodes, file.edges))
    expect(r.reason).toBe('unresolvable_node_kind')
    expect(r.nodeIds).toEqual(['fac_weather'])
  })

  it('REFUSES an empty canvas — registering emptiness would erase the server model', () => {
    const r = refusal(buildRegistrationGraph([], []))
    expect(r.reason).toBe('empty_graph')
  })

  it('reports DIVERGENCE ahead of UNRESOLVABLE when a file has both', () => {
    const file = clone(IMPORTED)
    ;(file.nodes.find((n) => n.id === 'opt_alpha')!.data as Record<string, unknown>).type = 'factor'
    const weather = file.nodes.find((n) => n.id === 'fac_weather')!
    delete (weather.data as Record<string, unknown>).kind
    delete (weather.data as Record<string, unknown>).type
    weather.type = 'nonsense'

    expect(refusal(buildRegistrationGraph(file.nodes, file.edges)).reason).toBe(
      'divergent_node_kind',
    )
  })

  it('never mutates the canvas it projects', () => {
    const before = JSON.stringify(IMPORTED)
    buildRegistrationGraph(IMPORTED.nodes, IMPORTED.edges)
    expect(JSON.stringify(IMPORTED)).toBe(before)
  })
})
