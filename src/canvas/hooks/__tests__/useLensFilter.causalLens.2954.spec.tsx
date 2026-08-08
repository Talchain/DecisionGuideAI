/**
 * ROADMAP 2.954 — the causal ARM of useLensFilter must write provenance-gated
 * params into the store, not `computeSignedMean`'s fabrications.
 *
 * WHY THIS FILE EXISTS BESIDE THE StyledEdge SPEC: the DOM spec feeds the
 * store map itself, so it proves store → render and producer purity — and
 * NOTHING about the arm that populates the map on the live chain
 * (useLensFilter → setLensVisuals → store). A fix that changed the producer
 * but left the arm calling `computeSignedMean` would pass every DOM test
 * while staging kept fabricating (trap 16: reachability within one seam is
 * not reachability in the system). This spec drives the REAL hook against the
 * REAL store with REAL ingested capture bytes and reads the map the
 * components will read.
 *
 * Fixtures: the same pricing-model.draft.json edges as the DOM spec, through
 * the exported `mapDraftEdgeToCanvas`, plus a `{ ...USER_EDGE_DEFAULTS }`
 * user-drawn edge (byte-identical to the store's onConnect construction).
 * State-class: seeded store, fresh per test.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useLensFilter } from '../useLensFilter'
import { useCanvasStore } from '../../store'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveCausalLensEdgeParams } from '../../domain/edgeValueProvenance'
import { USER_EDGE_DEFAULTS } from '../../domain/edges'

type WireEdge = Record<string, unknown>

function findEdge(from: string, to: string): WireEdge {
  const p = resolve(__dirname, '../../starters/data', 'pricing-model.draft.json')
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const edges = (j.edges ?? j.graph?.edges ?? []) as WireEdge[]
  const hit = edges.find(e => e.from === from && e.to === to)
  expect(hit, `capture no longer carries ${from} → ${to}`).toBeDefined()
  return hit as WireEdge
}

const SET_WIRE = findEdge('fac_adoption_friction', 'out_bottom_up_growth')
const NEITHER_WIRE: WireEdge = (() => {
  const { strength: _s, effect_direction: _d, ...rest } =
    SET_WIRE as Record<string, unknown> & { strength?: unknown; effect_direction?: unknown }
  return rest
})()

// Real mapped edges — ids e-0 / e-1 from the mapper's fallback; the user edge
// mirrors store.ts onConnect (`data: { ...USER_EDGE_DEFAULTS }`).
const SET_EDGE = mapDraftEdgeToCanvas(SET_WIRE, 0)
const NEITHER_EDGE = mapDraftEdgeToCanvas(NEITHER_WIRE, 1)
NEITHER_EDGE.id = 'e-1' // distinct id (mapper falls back to e-<i>; pin it explicitly)
const USER_EDGE = {
  id: 'e-user',
  source: 'fac_adoption_friction',
  target: 'out_bottom_up_growth',
  type: 'styled' as const,
  data: { ...USER_EDGE_DEFAULTS },
}

const NODES = [
  { id: 'fac_adoption_friction', type: 'factor', data: { label: 'Adoption friction' }, position: { x: 0, y: 0 } },
  { id: 'out_bottom_up_growth', type: 'outcome', data: { label: 'Bottom-up growth' }, position: { x: 0, y: 0 } },
  // An organisational pair, to pin the arm's hide branch stays intact.
  { id: 'dec_pricing', type: 'decision', data: { label: 'Pricing' }, position: { x: 0, y: 0 } },
  { id: 'opt_hybrid', type: 'option', data: { label: 'Hybrid' }, position: { x: 0, y: 0 } },
]
const STRUCTURAL_EDGE = {
  id: 'e-structural',
  source: 'dec_pricing',
  target: 'opt_hybrid',
  type: 'styled' as const,
  data: { ...USER_EDGE_DEFAULTS },
}

function Probe() {
  useLensFilter()
  return null
}

/**
 * Seed graph state with the lens OFF ('full'). The hook's push effect skips
 * the FIRST computed visuals (its prevVisualsRef starts equal), so the live
 * flow is always mount → user activates the lens → recompute → push. The
 * tests reproduce exactly that: render the probe, THEN switch to 'causal'.
 */
function seedGraph(): void {
  useCanvasStore.setState({
    nodes: NODES as never,
    edges: [SET_EDGE, NEITHER_EDGE, USER_EDGE, STRUCTURAL_EDGE] as never,
    lens: { ...useCanvasStore.getState().lens, active: 'full' },
  } as never)
}

/** Mount the hook, then activate the causal lens the way the product does. */
function mountAndActivateCausal(): void {
  render(<Probe />)
  act(() => {
    useCanvasStore.setState({
      lens: { ...useCanvasStore.getState().lens, active: 'causal' },
    } as never)
  })
}

describe('useLensFilter causal arm — provenance-gated store map (ROADMAP 2.954)', () => {
  beforeEach(() => {
    seedGraph()
  })

  afterEach(() => {
    useCanvasStore.setState({
      nodes: [] as never,
      edges: [] as never,
      lens: {
        ...useCanvasStore.getState().lens,
        active: 'full',
        _causalEdgeParams: new Map(),
        _hiddenNodeIds: new Set(),
        _hiddenEdgeIds: new Set(),
      },
    } as never)
  })

  it('writes the producer values for the stated edge (hook → store, live chain)', () => {
    mountAndActivateCausal()
    const map = useCanvasStore.getState().lens._causalEdgeParams
    const p = map.get(SET_EDGE.id)
    expect(p, 'the stated edge got no causal params').toBeDefined()
    expect(p!.magnitude).toBeCloseTo(0.3504, 3)
    expect(p!.direction).toBe('negative')
    expect(p!.std).toBeCloseTo(0.109, 3)
    expect(p!.existsProb).toBe(0.88)
  })

  it('DEFECT WITNESS: writes a REFUSAL, not the fabricated +0.5 constant, for the unset edge', () => {
    mountAndActivateCausal()
    const map = useCanvasStore.getState().lens._causalEdgeParams
    const p = map.get('e-1') as Record<string, unknown> | undefined
    expect(p, 'the unset edge got no causal params').toBeDefined()
    expect(p!.magnitude).toBeNull()
    expect(p!.direction).toBeNull()
    // The legacy raw `mean` channel is GONE from the map — the rename is the
    // fail-loud guard: a stale consumer reading `.mean` breaks at types, and
    // at pristine this assertion prints the fabricated 0.5 in the diff.
    expect(p!.mean).toBeUndefined()
  })

  it('the user-drawn edge (all channels defaulted) refuses on every channel', () => {
    mountAndActivateCausal()
    const map = useCanvasStore.getState().lens._causalEdgeParams
    expect(map.get('e-user')).toEqual({ magnitude: null, direction: null, std: null, existsProb: null })
  })

  it('the arm agrees with the exported producer, edge for edge (one owner, no drift)', () => {
    mountAndActivateCausal()
    const map = useCanvasStore.getState().lens._causalEdgeParams
    for (const edge of [SET_EDGE, NEITHER_EDGE, USER_EDGE]) {
      expect(map.get(edge.id)).toEqual(
        resolveCausalLensEdgeParams(edge.data as Record<string, unknown>),
      )
    }
  })

  it('INVARIANT: structural edges stay hidden and get no params (the hide branch is untouched)', () => {
    mountAndActivateCausal()
    const s = useCanvasStore.getState().lens
    expect(s._hiddenEdgeIds.has('e-structural')).toBe(true)
    expect(s._causalEdgeParams.has('e-structural')).toBe(false)
    expect(s._hiddenNodeIds.has('dec_pricing')).toBe(true)
    expect(s._hiddenNodeIds.has('opt_hybrid')).toBe(true)
  })
})
