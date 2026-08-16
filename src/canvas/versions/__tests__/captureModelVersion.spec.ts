/**
 * Capture projection — behaviour pinned.
 *
 * The load-bearing assertions here are the NEGATIVE ones: that capture never
 * invents a default and never re-stamps a provenance marker. An absent
 * `weightSource` means "nobody set the weight"; a capture that filled it in
 * would launder a UI default into a claim about the user.
 */

import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { captureEdge, captureModelVersion, captureNode } from '../captureModelVersion'

function rfNode(id: string, data: Record<string, unknown>, type = 'factor'): Node {
  return { id, type, position: { x: 0, y: 0 }, data } as Node
}

function rfEdge(id: string, source: string, target: string, data: Record<string, unknown> = {}): Edge {
  return { id, source, target, data } as Edge
}

describe('captureNode', () => {
  it('carries node identity, kind and label', () => {
    const node = rfNode('n1', { label: 'Price', kind: 'factor' })

    expect(captureNode(node)).toMatchObject({ id: 'n1', kind: 'factor', label: 'Price' })
  })

  it('prefers data.kind over the React Flow type', () => {
    const node = rfNode('n1', { label: 'Price', kind: 'outcome' }, 'factor')

    expect(captureNode(node).kind).toBe('outcome')
  })

  it('falls back to the React Flow type when data.kind is absent', () => {
    const node = rfNode('n1', { label: 'Price' }, 'risk')

    expect(captureNode(node).kind).toBe('risk')
  })

  it('captures scalar domain fields from the open data bag', () => {
    const node = rfNode('n1', {
      label: 'Price',
      description: 'unit price',
      utility: 0.4,
      provenance: 'user_set',
    })

    const captured = captureNode(node)

    expect(captured.fields.description).toBe('unit price')
    expect(captured.fields.utility).toBe(0.4)
    expect(captured.fields.provenance).toBe('user_set')
  })

  it('captures undeclared-but-live renderer fields (no schema parse strips them)', () => {
    // These are read by GoalNode but declared by no node schema. A capture that
    // parsed through AnyNodeDataSchema would silently destroy them.
    const node = rfNode('n1', {
      label: 'Revenue',
      success_threshold: 500000,
      goal_threshold_unit: '£',
      threshold_source: 'user',
    })

    const captured = captureNode(node)

    expect(captured.fields.success_threshold).toBe(500000)
    expect(captured.fields.goal_threshold_unit).toBe('£')
    expect(captured.fields.threshold_source).toBe('user')
  })

  it('flattens observedState one level with dotted keys', () => {
    const node = rfNode('n1', {
      label: 'Price',
      observedState: { value: 0.5, unit: '£', raw_value: '26000', display_value: null },
    })

    const captured = captureNode(node)

    expect(captured.fields['observedState.value']).toBe(0.5)
    expect(captured.fields['observedState.unit']).toBe('£')
    expect(captured.fields['observedState.raw_value']).toBe('26000')
    expect(captured.fields['observedState.display_value']).toBeNull()
  })

  it('does NOT invent fields that are absent', () => {
    const node = rfNode('n1', { label: 'Price' })

    const captured = captureNode(node)

    expect(Object.keys(captured.fields)).toEqual([])
    expect('utility' in captured.fields).toBe(false)
    expect('provenance' in captured.fields).toBe(false)
  })

  it('preserves a falsy value rather than dropping it', () => {
    const node = rfNode('n1', { label: 'Price', utility: 0, is_baseline: false, body: '' })

    const captured = captureNode(node)

    expect(captured.fields.utility).toBe(0)
    expect(captured.fields.is_baseline).toBe(false)
    expect(captured.fields.body).toBe('')
  })

  it('excludes presentation and React Flow interaction state', () => {
    const node = rfNode('n1', {
      label: 'Price',
      selected: true,
      zIndex: 5,
      width: 200,
      schemaVersion: 4,
      templateId: 'tpl-1',
    })

    const captured = captureNode(node)

    for (const excluded of ['selected', 'zIndex', 'width', 'schemaVersion', 'templateId']) {
      expect(captured.fields[excluded]).toBeUndefined()
    }
  })

  it('does not capture nested structures it cannot compare honestly', () => {
    const node = rfNode('n1', {
      label: 'Choice',
      interventions: { price: 3 },
      prior: { distribution: 'normal', range_min: 1, range_max: 5 },
    })

    const captured = captureNode(node)

    expect(captured.fields.interventions).toBeUndefined()
    expect(captured.fields.prior).toBeUndefined()
  })

  it('captures a scalar prior, which IS comparable', () => {
    const node = rfNode('n1', { label: 'Choice', prior: 0.7 })

    expect(captureNode(node).fields.prior).toBe(0.7)
  })

  it('falls back to the node id when the label is missing or empty', () => {
    expect(captureNode(rfNode('n1', {})).label).toBe('n1')
    expect(captureNode(rfNode('n2', { label: '' })).label).toBe('n2')
  })

  it('tolerates a node with no data bag at all', () => {
    const node = { id: 'n1', type: 'factor', position: { x: 0, y: 0 } } as Node

    expect(() => captureNode(node)).not.toThrow()
    expect(captureNode(node)).toMatchObject({ id: 'n1', label: 'n1' })
  })
})

describe('captureEdge', () => {
  it('carries edge identity and endpoints from source/target', () => {
    expect(captureEdge(rfEdge('e1', 'n1', 'n2'))).toMatchObject({ id: 'e1', from: 'n1', to: 'n2' })
  })

  it('captures strength, belief and direction fields', () => {
    const edge = rfEdge('e1', 'n1', 'n2', {
      weight: 0.8,
      beliefExists: 0.9,
      beliefStrength: 0.6,
      direction: 'positive',
      strength_mean: -0.4,
    })

    const captured = captureEdge(edge)

    expect(captured.fields.weight).toBe(0.8)
    expect(captured.fields.beliefExists).toBe(0.9)
    expect(captured.fields.beliefStrength).toBe(0.6)
    expect(captured.fields.direction).toBe('positive')
    expect(captured.fields.strength_mean).toBe(-0.4)
  })

  it('copies a provenance marker that IS present', () => {
    const edge = rfEdge('e1', 'n1', 'n2', { weight: 0.8, weightSource: 'user' })

    expect(captureEdge(edge).fields.weightSource).toBe('user')
  })

  it('NEVER stamps an absent provenance marker — absent means defaulted', () => {
    // A user-drawn edge carries weight 0.5 by UI default with NO weightSource.
    // Stamping one here would claim the user set it.
    const edge = rfEdge('e1', 'n1', 'n2', { weight: 0.5, direction: 'positive' })

    const captured = captureEdge(edge)

    expect('weightSource' in captured.fields).toBe(false)
    expect('directionSource' in captured.fields).toBe(false)
    expect('beliefExistsSource' in captured.fields).toBe(false)
    expect('strengthStdSource' in captured.fields).toBe(false)
  })

  it('NEVER applies an edge default for an absent value', () => {
    const captured = captureEdge(rfEdge('e1', 'n1', 'n2', {}))

    expect('weight' in captured.fields).toBe(false)
    expect('direction' in captured.fields).toBe(false)
    expect(captured.fields).toEqual({})
  })

  it('excludes edge presentation fields', () => {
    const edge = rfEdge('e1', 'n1', 'n2', {
      weight: 0.5,
      style: 'dashed',
      curvature: 0.2,
      pathType: 'bezier',
    })

    const captured = captureEdge(edge)

    expect(captured.fields.weight).toBe(0.5)
    expect(captured.fields.style).toBeUndefined()
    expect(captured.fields.curvature).toBeUndefined()
    expect(captured.fields.pathType).toBeUndefined()
  })

  it('carries a string label and omits a non-string one', () => {
    expect(captureEdge(rfEdge('e1', 'n1', 'n2', { label: 'drives' })).label).toBe('drives')
    expect(captureEdge(rfEdge('e2', 'n1', 'n2', { label: 42 })).label).toBeUndefined()
  })
})

describe('captureModelVersion', () => {
  const nodes = [rfNode('n1', { label: 'Price' }), rfNode('n2', { label: 'Revenue' })]
  const edges = [rfEdge('e1', 'n1', 'n2', { weight: 0.5 })]

  it('carries the supplied metadata verbatim', () => {
    const version = captureModelVersion(nodes, edges, {
      id: 'v1',
      name: 'Before board review',
      origin: 'manual',
      createdAt: 1234,
    })

    expect(version).toMatchObject({
      id: 'v1',
      name: 'Before board review',
      origin: 'manual',
      createdAt: 1234,
    })
    expect(version.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(version.edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('omits graphHash entirely when none was supplied', () => {
    const version = captureModelVersion(nodes, edges, {
      id: 'v1',
      name: 'v',
      origin: 'manual',
      createdAt: 1,
    })

    expect('graphHash' in version).toBe(false)
  })

  it('copies a supplied graphHash verbatim and never derives one', () => {
    const version = captureModelVersion(nodes, edges, {
      id: 'v1',
      name: 'v',
      origin: 'manual',
      createdAt: 1,
      graphHash: 'abc123',
    })

    expect(version.graphHash).toBe('abc123')
  })

  it('captures an empty canvas without throwing', () => {
    const version = captureModelVersion([], [], {
      id: 'v1',
      name: 'empty',
      origin: 'pre-ingest',
      createdAt: 1,
    })

    expect(version.nodes).toEqual([])
    expect(version.edges).toEqual([])
  })

  it('produces a version that diffs clean against itself', () => {
    const version = captureModelVersion(nodes, edges, {
      id: 'v1',
      name: 'v',
      origin: 'manual',
      createdAt: 1,
    })

    expect(JSON.parse(JSON.stringify(version))).toEqual(version)
  })
})
