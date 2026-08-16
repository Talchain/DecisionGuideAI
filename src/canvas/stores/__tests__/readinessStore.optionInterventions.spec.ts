/**
 * readinessStore — the readiness request must be able to EXPRESS a configured
 * option.
 *
 * THE MECHANISM (derived at CEE `c4476269` and at this tip):
 *
 * CEE's canonical readiness assessor (`assessCanonicalAnalysisReadiness`, the
 * turn path's sole whole-model authority) decides whether an option is
 * configured by reading that option's INTERVENTIONS off the graph. The
 * readiness route's request projection has never sent them: it emitted
 * `{id, type, kind, label}`, plus `data.value` when numeric, plus
 * `observed_state` for factors — and nothing else.
 *
 * So a model the user has fully configured on the canvas arrived at CEE
 * WIRE-INDISTINGUISHABLE from an empty one. Measured on the CEE side with a
 * contrast control: the identical model read `can_run_analysis: false` with a
 * `MISSING_OPTION_VALUE` blocker on EVERY option, and read `ready` the moment
 * the graph carried interventions. Nothing else differed.
 *
 * That gap is why the readiness route cannot yet be re-pointed at the one
 * canonical assessor (CEE #991). This closes it.
 *
 * ⚠ WHY TOP-LEVEL `node.interventions` AND NOT `node.data.interventions`:
 * CEE's request `Graph` schema types option `data` as `OptionData`, whose
 * `interventions` is `z.record(z.string(), z.number())` — STRICTLY NUMERIC. The
 * canvas stores rich `{ value, source, target_match }` entries, so writing
 * those under `data` risks failing `NodeData`'s union and returning HTTP 400.
 * The top-level field is the safe carrier and the canonical one: `Node` is
 * `.passthrough()` (so it survives the request parse) and CEE's `NodeV3`
 * DECLARES `interventions: z.record(z.string(), z.any())`. The top-level
 * numeric shape is the one verified end-to-end against the canonical assessor.
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { buildReadinessPayload } from '../readinessStore'

type WireNode = Record<string, unknown>

function optionNode(id: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label, ...data } } as Node
}

function factorNode(id: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label, ...data } } as Node
}

function wireNodes(nodes: Node[], edges: Edge[] = []): WireNode[] {
  const payload = JSON.parse(
    buildReadinessPayload({ nodes, edges, ceeAnalysisReady: null, currentBriefText: null }),
  )
  return payload.graph.nodes as WireNode[]
}

const byId = (nodes: WireNode[], id: string): WireNode => {
  const found = nodes.find((n) => n.id === id)
  if (!found) throw new Error(`no wire node with id ${id}`)
  return found
}

describe('buildReadinessPayload — option interventions reach the wire', () => {
  it('forwards a configured option\'s interventions, bound to THAT option and THAT factor', () => {
    const nodes = wireNodes([
      factorNode('fac_price', 'Price'),
      optionNode('opt_a', 'Premium', { interventions: { fac_price: 0.9 } }),
      optionNode('opt_c', 'Value', { interventions: { fac_price: 0.4 } }),
    ])

    // Bind by IDENTITY: this option, this factor, this value — not "some node
    // has interventions", which a wrong-object match would also satisfy.
    expect(byId(nodes, 'opt_a').interventions).toEqual({ fac_price: 0.9 })
    expect(byId(nodes, 'opt_c').interventions).toEqual({ fac_price: 0.4 })
  })

  it('normalises rich CEEInterventionV3 entries to their numeric value', () => {
    // The canvas stores either a bare number or a full
    // `{ value, source, target_match }` object (applyPatch.ts:594-605).
    const nodes = wireNodes([
      factorNode('fac_price', 'Price'),
      optionNode('opt_a', 'Premium', {
        interventions: {
          fac_price: {
            value: 0.75,
            source: 'cee_hypothesis',
            target_match: { node_id: 'fac_price', match_type: 'exact_id', confidence: 'high' },
          },
        },
      }),
    ])

    expect(byId(nodes, 'opt_a').interventions).toEqual({ fac_price: 0.75 })
  })

  // ==========================================================================
  // NEGATIVE ARM — the forwarding must be narrow.
  // ==========================================================================

  it('omits the field entirely for an UNCONFIGURED option', () => {
    const nodes = wireNodes([
      factorNode('fac_price', 'Price'),
      optionNode('opt_b', 'Unconfigured'),
    ])

    // Absent, not `{}` — an empty map is a configured-with-nothing claim.
    expect('interventions' in byId(nodes, 'opt_b')).toBe(false)
  })

  it('leaves NON-OPTION nodes untouched', () => {
    const nodes = wireNodes([
      factorNode('fac_price', 'Price', { interventions: { fac_other: 0.5 } }),
      optionNode('opt_a', 'Premium', { interventions: { fac_price: 0.9 } }),
    ])

    // A factor never carries interventions on the wire, even if the canvas
    // somehow holds them — only option nodes are configured objects.
    expect('interventions' in byId(nodes, 'fac_price')).toBe(false)
    // ...and the option still does. This is the discrimination half: a change
    // that forwarded interventions for EVERY node would pass the assertion
    // above's twin but fail here.
    expect(byId(nodes, 'opt_a').interventions).toEqual({ fac_price: 0.9 })
  })

  it('drops malformed entries rather than sending a non-numeric value', () => {
    const nodes = wireNodes([
      factorNode('fac_price', 'Price'),
      factorNode('fac_time', 'Time'),
      optionNode('opt_a', 'Premium', {
        interventions: {
          fac_price: 0.9,
          fac_time: 'soon', // categorical, not yet encoded
        },
      }),
    ])

    // Only the numeric entry survives; the categorical one is not invented into
    // a number, and does not poison the whole map.
    expect(byId(nodes, 'opt_a').interventions).toEqual({ fac_price: 0.9 })
  })

  it('omits the field when every entry is malformed', () => {
    const nodes = wireNodes([
      optionNode('opt_a', 'Premium', { interventions: { fac_time: 'soon' } }),
    ])

    expect('interventions' in byId(nodes, 'opt_a')).toBe(false)
  })

  // ==========================================================================
  // ADDITIVE ONLY — the rest of the payload must not move.
  // ==========================================================================

  it('changes nothing else about the projection', () => {
    const nodes: Node[] = [
      factorNode('fac_price', 'Price', { value: 0.5, observedState: { value: 0.5, raw_value: 20 } }),
      optionNode('opt_a', 'Premium', { interventions: { fac_price: 0.9 } }),
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'opt_a', target: 'fac_price', data: { weight: 0.3 } } as Edge,
    ]

    const payload = JSON.parse(
      buildReadinessPayload({ nodes, edges, ceeAnalysisReady: null, currentBriefText: null }),
    )

    // Factor projection intact, field for field.
    expect(byId(payload.graph.nodes, 'fac_price')).toEqual({
      id: 'fac_price',
      type: 'factor',
      kind: 'factor',
      label: 'Price',
      data: { value: 0.5 },
      observed_state: { value: 0.5, raw_value: 20 },
    })

    // Option projection is the OLD shape plus exactly one key.
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
})
