/**
 * readinessStore — the readiness request must carry a factor's CATEGORY.
 *
 * THE DEFECT
 *
 * CEE's readiness authority raises the "this option needs a value" blocker for
 * a factor only when that factor is something an option could plausibly move.
 * It reads the factor's `category` to decide, and it treats an ABSENT category
 * as `controllable` — the conservative default, correct for CEE, because a
 * factor it knows nothing about should not be silently exempted.
 *
 * This projection emitted `{id, type, kind, label}`, plus `data.value` when
 * numeric, plus `observed_state` for factors and `interventions` for options —
 * and dropped `category`. So every factor arrived at CEE looking controllable,
 * including the ones the model itself had classified as `external`.
 *
 * What a user was asked, verbatim, on a real drafted model:
 *
 *     "Choose which option changes for Labour Market Conditions and by how much."
 *     "Choose which option changes for Cash Runway and by how much."
 *     "Choose which option changes for UK Market Saturation and by how much."
 *
 * All three are `category: "external"` in the graph. The product was demanding
 * the user set values on things it had already decided nobody controls.
 *
 * WHY THE FIX BELONGS HERE AND NOT IN CEE
 *
 * Loosening CEE's absent-category default would LOWER the readiness bar and
 * mask genuinely unclassified factors. The information was never missing — the
 * canvas holds it (`FactorNodeDataSchema.category`, `domain/nodes.ts`), the
 * draft adapter carries it and even INFERS it when the model omits it
 * (`adapters/cee/client.ts` `inferMissingCategories`), and the inspector lets
 * the user set it (`useInspectorMutations.setCategory`). This projection simply
 * failed to forward it. Restoring dropped information is the honest fix.
 *
 * WHY TOP-LEVEL `node.category` AND NOT `node.data.category`
 *
 * Derived from the PRODUCER, not chosen: CEE's own wire nodes carry `category`
 * at the top level — `inferMissingCategories` writes `node.category` on the
 * wire node, and `mapDraftNodeToCanvas` destructures `{id, kind, type, label,
 * observed_state, ...rest}` and spreads `rest` into canvas `data`. So the wire
 * shape is top-level and the canvas shape is nested; this projection converts
 * back. It is also where the two established siblings sit: `observed_state`
 * and `interventions` are both top-level for the same reason.
 *
 * PASSTHROUGH DISCIPLINE. `category` is producer-owned: carried only when the
 * canvas supplies it, never invented, never defaulted, never recomputed. In
 * particular it is NOT back-filled from `controllability`, whose enum carries
 * two values (`partial`, `unknown`) that `FactorCategoryEnum` does not admit —
 * that would be a new judgement, not a restoration.
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { FactorCategory } from '@talchain/schemas'
import { buildReadinessPayload } from '../readinessStore'

type WireNode = Record<string, unknown>

function factorNode(id: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label, ...data } } as Node
}

function optionNode(id: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label, ...data } } as Node
}

function wireNodes(nodes: Node[], edges: Edge[] = []): WireNode[] {
  const payload = JSON.parse(
    buildReadinessPayload({
      nodes,
      edges,
      ceeAnalysisReady: null,
      currentBriefText: null,
      currentScenarioId: null,
    }),
  )
  return payload.graph.nodes as WireNode[]
}

const byId = (nodes: WireNode[], id: string): WireNode => {
  const found = nodes.find((n) => n.id === id)
  if (!found) throw new Error(`no wire node with id ${id}`)
  return found
}

describe('buildReadinessPayload — factor category reaches the wire', () => {
  // ── The defect, in the words the user actually saw ────────────────────────

  it('forwards `external` for the three factors the product wrongly demanded values for', () => {
    const nodes = wireNodes([
      factorNode('fac_labour', 'Labour Market Conditions', { category: 'external' }),
      factorNode('fac_runway', 'Cash Runway', { category: 'external' }),
      factorNode('fac_saturation', 'UK Market Saturation', { category: 'external' }),
    ])

    // Bound by IDENTITY — this node, this value. "some node has a category"
    // would be satisfied by the wrong object.
    expect(byId(nodes, 'fac_labour').category).toBe('external')
    expect(byId(nodes, 'fac_runway').category).toBe('external')
    expect(byId(nodes, 'fac_saturation').category).toBe('external')
  })

  // ── THE OPPOSITE-DIRECTION TWIN ───────────────────────────────────────────
  //
  // The harm being fixed is a factor that is external arriving as controllable.
  // The MIRROR harm is a factor that is genuinely controllable arriving as
  // something else — which would EXEMPT it from a blocker the user needs. A
  // projection that forwarded only `external` would pass the case above and
  // cause the mirror harm. Both directions, same run.

  it('forwards `controllable` and `observable` verbatim — it does not privilege one value', () => {
    const nodes = wireNodes([
      factorNode('fac_price', 'Price', { category: 'controllable' }),
      factorNode('fac_demand', 'Demand', { category: 'observable' }),
      factorNode('fac_fx', 'FX Rate', { category: 'external' }),
    ])

    expect(byId(nodes, 'fac_price').category).toBe('controllable')
    expect(byId(nodes, 'fac_demand').category).toBe('observable')
    expect(byId(nodes, 'fac_fx').category).toBe('external')
  })

  it('discriminates between two factors in ONE graph — the value is read per node, not once', () => {
    // A projection that read the category off the FIRST factor, or hoisted one
    // value to all nodes, would satisfy every single-value test above. This is
    // the case that fails for it.
    const nodes = wireNodes([
      factorNode('fac_controllable', 'Headcount', { category: 'controllable' }),
      factorNode('fac_external', 'UK Market Saturation', { category: 'external' }),
    ])

    expect(byId(nodes, 'fac_controllable').category).toBe('controllable')
    expect(byId(nodes, 'fac_external').category).toBe('external')
    expect(byId(nodes, 'fac_controllable').category).not.toBe(
      byId(nodes, 'fac_external').category,
    )
  })

  // ── Never invented, never defaulted ───────────────────────────────────────

  it('omits the key entirely when the canvas holds no category', () => {
    const nodes = wireNodes([factorNode('fac_plain', 'Unclassified')])

    // Absent, not `undefined`, not a guessed default: CEE's absent-category
    // default is what SHOULD apply to a factor nobody has classified.
    expect('category' in byId(nodes, 'fac_plain')).toBe(false)
  })

  it('does NOT back-fill category from `controllability`', () => {
    // `controllability` admits `partial` and `unknown`, which CEE's category
    // enum does not. Promoting it would invent a classification and could send
    // a value the contract rejects.
    const nodes = wireNodes([
      factorNode('fac_partial', 'Brand Equity', { controllability: 'partial' }),
      factorNode('fac_unknown', 'Regulatory Mood', { controllability: 'unknown' }),
    ])

    expect('category' in byId(nodes, 'fac_partial')).toBe(false)
    expect('category' in byId(nodes, 'fac_unknown')).toBe(false)
  })

  it('ignores a non-string category rather than forwarding rubbish', () => {
    const nodes = wireNodes([
      factorNode('fac_num', 'Numeric', { category: 3 as unknown as string }),
      factorNode('fac_null', 'Null', { category: null as unknown as string }),
    ])

    expect('category' in byId(nodes, 'fac_num')).toBe(false)
    expect('category' in byId(nodes, 'fac_null')).toBe(false)
  })

  // ── The failure mode that would be WORSE than the defect ──────────────────

  it('drops an out-of-enum category instead of sending one CEE would 400', () => {
    // Derived at CEE `e67d1512`: the request `Graph` is `.passthrough()`, so an
    // UNDECLARED key rides along harmlessly — but `category` is DECLARED as
    // `FactorCategory.optional()` (`src/schemas/graph.ts:292`). A declared field
    // is VALIDATED, so a value outside the three-member enum fails safeParse and
    // returns HTTP 400 CEE_VALIDATION_FAILED for the WHOLE readiness request.
    //
    // Forwarding an unvalidated string would therefore trade a wrong question
    // for a dead panel. Dropping it leaves CEE's conservative absent-category
    // default in force — the safe direction, and today's behaviour.
    const nodes = wireNodes([
      // `controllability`'s two extra members, which the category enum rejects.
      factorNode('fac_partial', 'Brand Equity', { category: 'partial' }),
      factorNode('fac_unknown', 'Regulatory Mood', { category: 'unknown' }),
      // Legacy/foreign values seen elsewhere in the tree.
      factorNode('fac_general', 'Misc', { category: 'general' }),
      factorNode('fac_kpi', 'Revenue', { category: 'KPI' }),
      // Casing and whitespace variants — the enum admits neither.
      factorNode('fac_case', 'Cased', { category: 'External' }),
      factorNode('fac_space', 'Spaced', { category: 'external ' }),
      factorNode('fac_empty', 'Empty', { category: '' }),
    ])

    // Reported as a list so a failure names WHICH value leaked, rather than
    // just "expected false".
    const leaked = [
      'fac_partial',
      'fac_unknown',
      'fac_general',
      'fac_kpi',
      'fac_case',
      'fac_space',
      'fac_empty',
    ].filter((id) => 'category' in byId(nodes, id))

    expect(leaked).toEqual([])

    // CONTRAST CONTROL, same run: the three legal values DO reach the wire, so
    // this test cannot pass by the projection simply forwarding nothing.
    const legal = wireNodes([
      factorNode('fac_c', 'C', { category: 'controllable' }),
      factorNode('fac_o', 'O', { category: 'observable' }),
      factorNode('fac_e', 'E', { category: 'external' }),
    ])
    expect(byId(legal, 'fac_c').category).toBe('controllable')
    expect(byId(legal, 'fac_o').category).toBe('observable')
    expect(byId(legal, 'fac_e').category).toBe('external')
  })

  it('forwards exactly the enum the shared contract declares — no more, no fewer', () => {
    // Pins the allowlist to the CONTRACT rather than to this test's opinion: if
    // the contract ever gains or loses a member, this fails rather than
    // silently drifting. Derived, not hand-listed.
    const accepted = ['controllable', 'observable', 'external', 'partial', 'unknown', 'general', '']
      .filter((c) => {
        const nodes = wireNodes([factorNode('fac_probe', 'Probe', { category: c })])
        return 'category' in byId(nodes, 'fac_probe')
      })

    expect(accepted).toEqual(FactorCategory.options)
  })

  // ── Scope: factors only, matching the producer's own semantics ────────────

  it('does not attach a category to non-factor nodes', () => {
    // Derived from the producer: CEE's `inferMissingCategories` assigns
    // category to factor nodes ONLY, and its adapter spec pins that
    // ("does not assign category to non-factor nodes").
    const nodes = wireNodes([
      factorNode('fac_price', 'Price', { category: 'controllable' }),
      optionNode('opt_a', 'Premium', { category: 'external' }),
    ])

    expect(byId(nodes, 'fac_price').category).toBe('controllable')
    expect('category' in byId(nodes, 'opt_a')).toBe(false)
  })

  // ── Changes nothing else ──────────────────────────────────────────────────

  it('adds exactly one key and leaves the rest of the projection intact', () => {
    const nodes: Node[] = [
      factorNode('fac_price', 'Price', {
        value: 0.5,
        observedState: { value: 0.5, raw_value: 20 },
        category: 'external',
      }),
      optionNode('opt_a', 'Premium', { interventions: { fac_price: 0.9 } }),
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'opt_a', target: 'fac_price', data: { weight: 0.3 } } as Edge,
    ]

    const payload = JSON.parse(
      buildReadinessPayload({
        nodes,
        edges,
        ceeAnalysisReady: null,
        currentBriefText: null,
        currentScenarioId: null,
      }),
    )

    expect(byId(payload.graph.nodes, 'fac_price')).toEqual({
      id: 'fac_price',
      type: 'factor',
      kind: 'factor',
      label: 'Price',
      data: { value: 0.5 },
      observed_state: { value: 0.5, raw_value: 20 },
      category: 'external',
    })

    // Option projection unchanged, field for field.
    expect(byId(payload.graph.nodes, 'opt_a')).toEqual({
      id: 'opt_a',
      type: 'option',
      kind: 'option',
      label: 'Premium',
      interventions: { fac_price: 0.9 },
    })

    // Edge projection untouched.
    expect(payload.graph.edges).toEqual([
      { id: 'e1', from: 'opt_a', to: 'fac_price', weight: 0.3, belief: 0.8, effect_direction: 'positive' },
    ])
  })

  // ── The verdict is a FUNCTION of category ─────────────────────────────────

  it('re-asks the server when only the category changed', () => {
    // `buildReadinessPayload` is also the change detector: two canvases that
    // project identically are never re-asked. Before this fix, reclassifying a
    // factor from controllable to external produced a BYTE-IDENTICAL payload,
    // so the panel kept serving a verdict computed from the old
    // classification and the user's correction changed nothing.
    const controllable = buildReadinessPayload({
      nodes: [factorNode('fac_x', 'Saturation', { category: 'controllable' })],
      edges: [],
      ceeAnalysisReady: null,
      currentBriefText: null,
      currentScenarioId: null,
    })
    const external = buildReadinessPayload({
      nodes: [factorNode('fac_x', 'Saturation', { category: 'external' })],
      edges: [],
      ceeAnalysisReady: null,
      currentBriefText: null,
      currentScenarioId: null,
    })

    expect(controllable).not.toBe(external)
  })
})
