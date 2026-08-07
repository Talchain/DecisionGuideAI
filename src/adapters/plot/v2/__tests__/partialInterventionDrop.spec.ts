/**
 * PARTIAL intervention drop on the PRIMARY run path.
 *
 * PR #499 closed the two hops that could put a NON-FINITE value ON the wire,
 * and stated the residual gap in its own section 4b: on the primary run path
 * (`buildV2RequestFromAnalysisReady` → `ceeOptionToV2Option` →
 * `flattenInterventions`) an option carrying ONE unusable entry alongside
 * valid ones is silently reduced. The wire stays valid, so PLoT never
 * complains — and the user is handed a confident answer to a question they
 * did not ask.
 *
 * House doctrine, ruled twice on 26 Jul (PLoT ingress + UI #499): what gets
 * analysed is never silently altered. A partial drop is the purest form of
 * that violation, because nothing anywhere reports it.
 *
 * TWO DROP SITES, not one. #499 named only the first. The second is upstream
 * of it and would have survived a fix aimed solely at `ceeOptionToV2Option`:
 *
 *   SITE A — `ceeOptionToV2Option` (adapter.ts). Reached when
 *     `reconcileOptionsWithCanvasNodes` passes an analysis_ready option
 *     through as-is (its PRIMARY hot path, taken whenever the option has at
 *     least one usable intervention). The unusable siblings survive
 *     reconciliation and die at the flatten.
 *
 *   SITE B — `reconcileOptionsWithCanvasNodes` itself, on BOTH canvas-backfill
 *     branches. Each calls `flattenInterventions(node.data.interventions)`
 *     BEFORE `canvasInterventionsToCEE`, so unusable entries are already gone
 *     by the time any downstream consumer — including the pre-run gate — sees
 *     the option. A fix at site A alone cannot see these at all.
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import {
  ceeOptionToV2Option,
  buildV2RequestFromAnalysisReady,
  reconcileOptionsWithCanvasNodes,
  reconcileOptionsWithCanvasNodesDetailed,
  InterventionValidationError,
  flattenInterventions,
} from '../adapter'
import type { CEEOptionV3 } from '../../../../types/options'
// `CanvasNodeData` is module-local to adapter.ts, so the fixtures below use the
// permissive node/edge generics the sibling adapter specs use.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The defect shape: one good entry, one authored-but-unusable entry. */
function partialOption(): CEEOptionV3 {
  return {
    id: 'opt_partial',
    label: 'Raise price',
    status: 'ready',
    interventions: {
      fac_good: { value: 0.4, source: 'brief_extraction' },
      // Authored — the key names a real target — but carries no usable value.
      // `flattenInterventions` drops it and says nothing.
      fac_bad: { value: null as unknown as number, source: 'brief_extraction' },
    },
  }
}

function allValidOption(): CEEOptionV3 {
  return {
    id: 'opt_valid',
    label: 'Hold price',
    status: 'ready',
    interventions: {
      fac_good: { value: 0.4, source: 'brief_extraction' },
      fac_zero: { value: 0, source: 'brief_extraction' },
    },
  }
}

function allBadOption(): CEEOptionV3 {
  return {
    id: 'opt_allbad',
    label: 'Cut price',
    status: 'ready',
    interventions: {
      fac_bad: { value: null as unknown as number, source: 'brief_extraction' },
      fac_worse: { value: 'tbd' as unknown as number, source: 'brief_extraction' },
    },
  }
}

const NODES: Node<any>[] = [
  { id: 'goal_1', type: 'goal', data: { label: 'Profit', kind: 'goal' } as any, position: { x: 0, y: 0 } },
  { id: 'fac_good', type: 'factor', data: { label: 'Unit margin', kind: 'factor' } as any, position: { x: 0, y: 100 } },
  { id: 'fac_bad', type: 'factor', data: { label: 'Customer churn', kind: 'factor' } as any, position: { x: 0, y: 200 } },
  { id: 'fac_zero', type: 'factor', data: { label: 'Volume', kind: 'factor' } as any, position: { x: 0, y: 300 } },
  { id: 'fac_worse', type: 'factor', data: { label: 'Brand risk', kind: 'factor' } as any, position: { x: 0, y: 400 } },
]

const EDGES: Edge<any>[] = [
  { id: 'e1', source: 'fac_good', target: 'goal_1', data: { weight: 0.5 } as any },
]

function optionNode(id: string, label: string, interventions: Record<string, unknown>): Node<any> {
  return {
    id,
    type: 'option',
    data: { label, kind: 'option', interventions } as any,
    position: { x: 500, y: 0 },
  }
}

// ---------------------------------------------------------------------------
// SITE A — ceeOptionToV2Option
// ---------------------------------------------------------------------------

describe('SITE A — ceeOptionToV2Option must not silently shrink an option', () => {
  it('REFUSES an option whose interventions include an authored-but-unusable entry', () => {
    expect(() => ceeOptionToV2Option(partialOption())).toThrow(InterventionValidationError)
  })

  it('names the dropped target and the option in the refusal', () => {
    let caught: unknown
    try {
      ceeOptionToV2Option(partialOption())
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(InterventionValidationError)
    const err = caught as InterventionValidationError
    expect(err.code).toBe('INVALID_INTERVENTION_VALUE')
    expect(err.optionId).toBe('opt_partial')
    expect(err.invalidTargets).toEqual(['fac_bad'])
    expect(err.message).toContain('Raise price')
    expect(err.message).toContain('fac_bad')
  })

  it('POSITIVE CONTROL — an all-valid option is converted unchanged, including 0', () => {
    const v2 = ceeOptionToV2Option(allValidOption())
    expect(v2).toEqual({
      id: 'opt_valid',
      label: 'Hold price',
      interventions: { fac_good: 0.4, fac_zero: 0 },
    })
  })

  it('POSITIVE CONTROL — an option with NO interventions at all is still converted, not refused (the empty case belongs to the pre-run gate)', () => {
    const v2 = ceeOptionToV2Option({ id: 'o', label: 'L', status: 'ready', interventions: {} })
    expect(v2.interventions).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// SITE B — reconcileOptionsWithCanvasNodes canvas-backfill branches
// ---------------------------------------------------------------------------

describe('SITE B — the canvas-backfill branches must report what they filtered', () => {
  it('canvas-only option: reports the unusable target instead of silently flattening it away', () => {
    const nodes = [...NODES, optionNode('opt_canvas', 'Canvas option', { fac_good: 0.5, fac_bad: { value: null } })]
    const { options, unusableByOptionId } = reconcileOptionsWithCanvasNodesDetailed(
      null,
      nodes,
      new Set(nodes.map((n) => n.id)),
      { silent: true },
    )
    // The usable entry still flows (behaviour preserved) …
    const opt = options.find((o) => o.id === 'opt_canvas')!
    expect(Object.keys(opt.interventions)).toEqual(['fac_good'])
    // … and the dropped one is now VISIBLE.
    expect(unusableByOptionId.get('opt_canvas')).toEqual(['fac_bad'])
  })

  it('analysis_ready option backfilled from its canvas node: reports the unusable target', () => {
    const nodes = [...NODES, optionNode('opt_ar', 'AR option', { fac_good: 0.5, fac_bad: { value: 'tbd' } })]
    const analysisReady = {
      goal_node_id: 'goal_1',
      status: 'ready',
      // empty interventions → forces the backfill branch
      options: [{ id: 'opt_ar', label: 'AR option', status: 'ready', interventions: {} }],
    } as any
    const { unusableByOptionId } = reconcileOptionsWithCanvasNodesDetailed(
      analysisReady,
      nodes,
      new Set(nodes.map((n) => n.id)),
      { silent: true },
    )
    expect(unusableByOptionId.get('opt_ar')).toEqual(['fac_bad'])
  })

  it('primary pass-through branch: reports the unusable sibling that ceeOptionToV2Option would later drop', () => {
    const nodes = [...NODES, optionNode('opt_partial', 'Raise price', {})]
    const analysisReady = { goal_node_id: 'goal_1', status: 'ready', options: [partialOption()] } as any
    const { unusableByOptionId } = reconcileOptionsWithCanvasNodesDetailed(
      analysisReady,
      nodes,
      new Set(nodes.map((n) => n.id)),
      { silent: true },
    )
    expect(unusableByOptionId.get('opt_partial')).toEqual(['fac_bad'])
  })

  it('POSITIVE CONTROL — an all-valid graph reports NOTHING unusable', () => {
    const nodes = [...NODES, optionNode('opt_canvas', 'Canvas option', { fac_good: 0.5, fac_zero: 0 })]
    const { unusableByOptionId } = reconcileOptionsWithCanvasNodesDetailed(
      null,
      nodes,
      new Set(nodes.map((n) => n.id)),
      { silent: true },
    )
    expect(unusableByOptionId.size).toBe(0)
  })

  it('POSITIVE CONTROL — the undetailed wrapper returns exactly the options array it always did', () => {
    const nodes = [...NODES, optionNode('opt_canvas', 'Canvas option', { fac_good: 0.5, fac_bad: { value: null } })]
    const validIds = new Set(nodes.map((n) => n.id))
    const plain = reconcileOptionsWithCanvasNodes(null, nodes, validIds, { silent: true })
    const detailed = reconcileOptionsWithCanvasNodesDetailed(null, nodes, validIds, { silent: true })
    expect(JSON.stringify(plain)).toBe(JSON.stringify(detailed.options))
  })

  it('a STALE target (not on the canvas) is NOT reported as unusable — that is a different failure with its own handling', () => {
    const nodes = [...NODES, optionNode('opt_canvas', 'Canvas option', { fac_good: 0.5, fac_deleted: 0.2 })]
    const { unusableByOptionId } = reconcileOptionsWithCanvasNodesDetailed(
      null,
      nodes,
      new Set(nodes.map((n) => n.id)), // fac_deleted absent → stale, not unusable
      { silent: true },
    )
    expect(unusableByOptionId.has('opt_canvas')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The whole primary path
// ---------------------------------------------------------------------------

describe('buildV2RequestFromAnalysisReady — the primary run path', () => {
  it('does not build a request that quietly analyses fewer interventions than the canvas holds', () => {
    const nodes = [...NODES, optionNode('opt_partial', 'Raise price', {})]
    const analysisReady = {
      goal_node_id: 'goal_1',
      status: 'ready',
      suggested_seed: '424242',
      options: [partialOption()],
    } as any
    expect(() => buildV2RequestFromAnalysisReady(nodes, EDGES, analysisReady)).toThrow(
      InterventionValidationError,
    )
  })

  it('POSITIVE CONTROL — an all-valid request is BYTE-IDENTICAL to the pristine build', () => {
    const nodes = [...NODES, optionNode('opt_valid', 'Hold price', {})]
    const analysisReady = {
      goal_node_id: 'goal_1',
      status: 'ready',
      suggested_seed: '424242',
      options: [allValidOption()],
    } as any
    const { request } = buildV2RequestFromAnalysisReady(nodes, EDGES, analysisReady)
    // Captured by running this exact build on pristine fff04eb5, BEFORE any
    // change in this PR. `suggested_seed` pins the otherwise clock-derived
    // seed so the string is stable. Any drift in the outbound bytes — key
    // order included — fails here.
    expect(JSON.stringify(request)).toBe(PRISTINE_VALID_REQUEST_JSON)
  })

  it('POSITIVE CONTROL — the ALL-bad option keeps its pre-existing full-drop behaviour at the reconciler, and is left for the pre-run gate', () => {
    const nodes = [...NODES, optionNode('opt_allbad', 'Cut price', {})]
    const analysisReady = { goal_node_id: 'goal_1', status: 'ready', options: [allBadOption()] } as any
    const { options } = reconcileOptionsWithCanvasNodesDetailed(
      analysisReady,
      nodes,
      new Set(nodes.map((n) => n.id)),
      { silent: true },
    )
    // Unchanged: zero usable interventions survive …
    expect(Object.keys(flattenInterventions(options[0].interventions))).toHaveLength(0)
    // … which is precisely what the existing MISSING_INTERVENTIONS gate keys on.
  })
})

// Pinned pristine bytes — see the byte-identical control above. Captured by
// running that exact build on pristine fff04eb5 before any change in this PR.
const PRISTINE_VALID_REQUEST_JSON =
  '{"graph":{"nodes":[{"id":"goal_1","kind":"goal","label":"Profit"},{"id":"fac_good","kind":"factor","label":"Unit margin"},{"id":"fac_bad","kind":"factor","label":"Customer churn"},{"id":"fac_zero","kind":"factor","label":"Volume"},{"id":"fac_worse","kind":"factor","label":"Brand risk"},{"id":"opt_valid","kind":"option","label":"Hold price"}],"edges":[{"from":"fac_good","to":"goal_1","strength":{"mean":0.5,"std":0.07999999999999999}}]},"options":[{"id":"opt_valid","label":"Hold price","interventions":{"fac_good":0.4,"fac_zero":0}}],"goal_node_id":"goal_1","seed":"424242","detail_level":"deep"}'
