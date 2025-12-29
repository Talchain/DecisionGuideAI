/**
 * Node ID Normalisation Regression Tests (P1 - Regression Prevention)
 *
 * These tests lock critical normalisation behaviours:
 * 1. Mapping Coherence - shared idMap for nodes and intervention keys
 * 2. Collision Determinism - deterministic __2 suffixes regardless of input order
 *
 * If these behaviours break, the V2 pipeline will silently fail with mismatched IDs.
 */

import { describe, it, expect } from 'vitest'
import {
  normaliseId,
  isValidId,
  normaliseGraphIds,
  translateResponseToUIIds,
} from '../nodeIdNormalisation'

// ============================================================================
// Test Fixtures
// ============================================================================

interface TestNode {
  id: string
  label?: string
}

interface TestEdge {
  id?: string
  from: string
  to: string
}

interface TestOption {
  id: string
  interventions: Record<string, number>
}

function makeTestGraph(nodeIds: string[], edgePairs: [string, string][] = []): {
  nodes: TestNode[]
  edges: TestEdge[]
} {
  return {
    nodes: nodeIds.map((id) => ({ id, label: id })),
    edges: edgePairs.map(([from, to], i) => ({ id: `e${i}`, from, to })),
  }
}

// ============================================================================
// Test Set 1: Mapping Coherence
// ============================================================================

describe('Mapping Coherence - shared idMap for nodes and interventions', () => {
  it('intervention keys are normalised using the same idMap as nodes', () => {
    // GIVEN: A graph with nodes that require normalisation (uppercase)
    const graph = makeTestGraph(['Price', 'Revenue'], [['Price', 'Revenue']])

    // AND: Options with interventions targeting those nodes (using original IDs)
    const options: TestOption[] = [
      { id: 'option_1', interventions: { Price: 120, Revenue: 1000 } },
    ]

    // WHEN: We normalise the graph and options together
    const result = normaliseGraphIds(graph, options, 'Revenue')

    // THEN: Node IDs should be normalised
    const normalisedNodeIds = new Set(result.graph.nodes.map((n) => n.id))
    expect(normalisedNodeIds.has('price')).toBe(true)
    expect(normalisedNodeIds.has('revenue')).toBe(true)

    // AND: Intervention keys should reference the SAME normalised IDs
    const interventionKeys = Object.keys(result.options[0].interventions)
    expect(interventionKeys).toContain('price')
    expect(interventionKeys).toContain('revenue')

    // AND: Every intervention key should be a valid node ID in the graph
    for (const key of interventionKeys) {
      expect(normalisedNodeIds.has(key)).toBe(true)
    }
  })

  it('intervention values are preserved exactly during normalisation', () => {
    // GIVEN: Interventions with specific values
    const graph = makeTestGraph(['Factor A', 'Factor B'])
    const options: TestOption[] = [
      { id: 'opt1', interventions: { 'Factor A': 123.456, 'Factor B': -789.012 } },
    ]

    // WHEN: We normalise
    const result = normaliseGraphIds(graph, options, 'Factor A')

    // THEN: The values should be preserved exactly (no mutation)
    const interventions = result.options[0].interventions
    expect(Object.values(interventions)).toContain(123.456)
    expect(Object.values(interventions)).toContain(-789.012)
  })

  it('goal node ID uses the same idMap as nodes', () => {
    // GIVEN: A goal node that requires normalisation
    const graph = makeTestGraph(['MyGoal', 'Factor'])
    const options: TestOption[] = []

    // WHEN: We normalise with the goal
    const result = normaliseGraphIds(graph, options, 'MyGoal')

    // THEN: The goal should be normalised to match the node
    expect(result.goalNodeId).toBe('mygoal')

    // AND: It should match an actual node ID in the graph
    const nodeIds = result.graph.nodes.map((n) => n.id)
    expect(nodeIds).toContain(result.goalNodeId)
  })

  it('option IDs use the same idMap as nodes (if option is also a node)', () => {
    // GIVEN: Options that correspond to node IDs
    const graph = makeTestGraph(['Option A', 'Factor 1'])
    const options: TestOption[] = [
      { id: 'Option A', interventions: { 'Factor 1': 50 } },
    ]

    // WHEN: We normalise
    const result = normaliseGraphIds(graph, options, 'Factor 1')

    // THEN: Option ID should be normalised consistently with nodes
    expect(result.options[0].id).toBe('option_a')

    // AND: It should match the corresponding node
    const nodeIds = result.graph.nodes.map((n) => n.id)
    expect(nodeIds).toContain('option_a')
  })

  it('edge endpoints use the same idMap as nodes', () => {
    // GIVEN: Edges referencing nodes that will be normalised
    const graph = makeTestGraph(['Cause', 'Effect'], [['Cause', 'Effect']])
    const options: TestOption[] = []

    // WHEN: We normalise
    const result = normaliseGraphIds(graph, options, 'Effect')

    // THEN: Edge from/to should use normalised node IDs
    const edge = result.graph.edges[0]
    expect(edge.from).toBe('cause')
    expect(edge.to).toBe('effect')

    // AND: Those IDs should exist in the node set
    const nodeIds = new Set(result.graph.nodes.map((n) => n.id))
    expect(nodeIds.has(edge.from)).toBe(true)
    expect(nodeIds.has(edge.to)).toBe(true)
  })

  it('fails scenario: intervention targeting non-existent node after normalisation', () => {
    // This test documents the expected behaviour when an intervention
    // targets a node that doesn't exist in the graph
    const graph = makeTestGraph(['Factor'])
    const options: TestOption[] = [
      { id: 'opt1', interventions: { NonExistent: 100 } },
    ]

    // The normalisation should pass through the unknown key unchanged
    const result = normaliseGraphIds(graph, options, 'Factor')

    // The intervention key should not match any node (this is the "bug" scenario)
    const nodeIds = new Set(result.graph.nodes.map((n) => n.id))
    const interventionKeys = Object.keys(result.options[0].interventions)

    // NonExistent normalises to nonexistent, which is not in nodes
    expect(interventionKeys.some((k) => !nodeIds.has(k))).toBe(true)
  })
})

// ============================================================================
// Test Set 2: Collision Determinism
// ============================================================================

describe('Collision Determinism - deterministic __2 suffixes regardless of order', () => {
  it('produces identical normalised IDs regardless of input array order', () => {
    // GIVEN: Nodes that will collide after normalisation
    const nodeIds = ['price', 'Price', 'PRICE']

    // Create multiple orderings
    const orderings = [
      ['price', 'Price', 'PRICE'],
      ['PRICE', 'price', 'Price'],
      ['Price', 'PRICE', 'price'],
      ['PRICE', 'Price', 'price'],
    ]

    // WHEN: We normalise each ordering
    const resultSets = orderings.map((order) => {
      const graph = makeTestGraph(order)
      const result = normaliseGraphIds(graph, [], null)
      return new Set(result.graph.nodes.map((n) => n.id))
    })

    // THEN: All orderings should produce the same set of normalised IDs
    const referenceSet = resultSets[0]
    for (const resultSet of resultSets.slice(1)) {
      expect(resultSet).toEqual(referenceSet)
    }

    // AND: The set should contain collision suffixes
    expect(referenceSet.has('price')).toBe(true)
    expect(referenceSet.has('price__2')).toBe(true)
    expect(referenceSet.has('price__3')).toBe(true)
  })

  it('assigns collision suffixes consistently for the same inputs', () => {
    // GIVEN: Nodes that collide
    const graph = makeTestGraph(['price', 'Price', 'PRICE'])

    // WHEN: We normalise the same graph twice
    const result1 = normaliseGraphIds(graph, [], null)
    const result2 = normaliseGraphIds(graph, [], null)

    // THEN: Both runs should produce identical mappings
    for (const [original, normalised] of result1.idMap) {
      expect(result2.idMap.get(original)).toBe(normalised)
    }

    // AND: The base name and suffixes should all be present
    const normalisedIds = new Set(result1.graph.nodes.map((n) => n.id))
    expect(normalisedIds.has('price')).toBe(true)
    expect(normalisedIds.has('price__2')).toBe(true)
    expect(normalisedIds.has('price__3')).toBe(true)

    // AND: Each original ID should map to exactly one normalised ID
    const assignedIds = new Set(result1.idMap.values())
    expect(assignedIds.size).toBe(3) // All unique
  })

  it('reverse mapping is consistent with forward mapping', () => {
    // GIVEN: Nodes that will be normalised
    const graph = makeTestGraph(['Factor_1', 'Factor 1', 'factor-1'])

    // WHEN: We normalise
    const result = normaliseGraphIds(graph, [], null)

    // THEN: Every forward mapping should have a reverse
    for (const [original, normalised] of result.idMap) {
      expect(result.reverseIdMap.get(normalised)).toBe(original)
    }

    // AND: Every reverse mapping should have a forward
    for (const [normalised, original] of result.reverseIdMap) {
      expect(result.idMap.get(original)).toBe(normalised)
    }
  })

  it('response translation correctly reverses the normalisation', () => {
    // GIVEN: A normalised graph with known mapping
    const graph = makeTestGraph(['MyNode', 'AnotherNode'])
    const { reverseIdMap } = normaliseGraphIds(graph, [], null)

    // AND: A mock response with normalised IDs
    const mockResponse = {
      options: [{ id: 'mynode' }],
      critiques: [{ affected_nodes: ['mynode', 'anothernode'] }],
      drivers: [{ node_id: 'mynode' }],
    }

    // WHEN: We translate the response back
    const translated = translateResponseToUIIds(mockResponse, reverseIdMap)

    // THEN: IDs should be restored to original form
    expect(translated.options![0].id).toBe('MyNode')
    expect(translated.critiques![0].affected_nodes).toEqual(['MyNode', 'AnotherNode'])
    expect(translated.drivers![0].node_id).toBe('MyNode')
  })

  it('handles multiple independent collisions', () => {
    // GIVEN: Two sets of colliding nodes
    const graph = makeTestGraph([
      'Alpha', 'alpha', 'ALPHA',  // First collision group
      'Beta', 'beta', 'BETA',     // Second collision group
    ])

    // WHEN: We normalise
    const result = normaliseGraphIds(graph, [], null)
    const normalisedIds = new Set(result.graph.nodes.map((n) => n.id))

    // THEN: Each collision group should have its own suffixes
    expect(normalisedIds.has('alpha')).toBe(true)
    expect(normalisedIds.has('alpha__2')).toBe(true)
    expect(normalisedIds.has('alpha__3')).toBe(true)
    expect(normalisedIds.has('beta')).toBe(true)
    expect(normalisedIds.has('beta__2')).toBe(true)
    expect(normalisedIds.has('beta__3')).toBe(true)

    // AND: Total should be 6 unique IDs
    expect(normalisedIds.size).toBe(6)
  })
})

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('normaliseId', () => {
  it('is idempotent for already-valid IDs', () => {
    const validIds = ['price', 'factor_1', 'node-2', 'a:b:c']

    for (const id of validIds) {
      expect(normaliseId(id)).toBe(id)
    }
  })

  it('lowercases uppercase characters', () => {
    expect(normaliseId('PRICE')).toBe('price')
    expect(normaliseId('Price')).toBe('price')
    expect(normaliseId('PrIcE')).toBe('price')
  })

  it('replaces invalid characters with underscore', () => {
    expect(normaliseId('factor 1')).toBe('factor_1')
    expect(normaliseId('factor@1')).toBe('factor_1')
    expect(normaliseId('factor#1$2')).toBe('factor_1_2')
  })

  it('collapses multiple underscores', () => {
    expect(normaliseId('factor__1')).toBe('factor_1')
    expect(normaliseId('factor___1')).toBe('factor_1')
    expect(normaliseId('a___b___c')).toBe('a_b_c')
  })

  it('trims leading and trailing underscores', () => {
    expect(normaliseId('_factor')).toBe('factor')
    expect(normaliseId('factor_')).toBe('factor')
    expect(normaliseId('_factor_')).toBe('factor')
    expect(normaliseId('__factor__')).toBe('factor')
  })

  it('handles edge cases', () => {
    expect(normaliseId('')).toBe('node')
    expect(normaliseId('___')).toBe('node')
    expect(normaliseId('@#$')).toBe('node')
  })
})

describe('isValidId', () => {
  it('accepts valid ISL V2 IDs', () => {
    expect(isValidId('price')).toBe(true)
    expect(isValidId('factor_1')).toBe(true)
    expect(isValidId('node-2')).toBe(true)
    expect(isValidId('a:b:c')).toBe(true)
    expect(isValidId('abc123')).toBe(true)
  })

  it('rejects invalid IDs', () => {
    expect(isValidId('Price')).toBe(false)  // Uppercase
    expect(isValidId('factor 1')).toBe(false)  // Space
    expect(isValidId('factor@1')).toBe(false)  // Special char
    expect(isValidId('')).toBe(false)  // Empty
  })
})

// ============================================================================
// Test Set 3: V2 Response Translation Coverage (Contract Test)
// ============================================================================

describe('V2 Response Translation Coverage', () => {
  /**
   * Contract test to ensure all node ID fields in V2 responses are translated.
   * If a new field with node IDs is added to V2RunResponse/V2RunError,
   * this test should be updated to verify translation coverage.
   */
  it('translates all known node ID fields in V2RunResponse', () => {
    // GIVEN: A reverseIdMap from normalisation
    const reverseIdMap = new Map([
      ['price_node', 'Price Node'],
      ['revenue_node', 'Revenue Node'],
      ['option_a', 'Option A'],
      ['factor_x', 'Factor X'],
    ])

    // AND: A V2-like response with normalised IDs in all node ID fields
    const response = {
      // options[].id - option identifiers
      options: [
        { id: 'option_a', label: 'Option A', outcome: { mean: 100 } },
      ],
      // critiques[].affected_nodes - nodes affected by critique
      critiques: [
        { code: 'TEST', severity: 'warning', message: 'Test', affected_nodes: ['price_node', 'revenue_node'] },
      ],
      // drivers[].node_id - driver node reference
      drivers: [
        { node_id: 'factor_x', label: 'Factor X', contribution: 0.5, direction: 'positive' },
      ],
      // robustness.factors[].node_id - sensitivity factor node reference
      robustness: {
        level: 'high',
        confidence: 0.9,
        factors: [
          { node_id: 'price_node', sensitivity: 0.3 },
        ],
      },
    }

    // WHEN: We translate the response
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: All node ID fields should be translated back to UI IDs
    expect(translated.options[0].id).toBe('Option A')
    expect(translated.critiques[0].affected_nodes).toEqual(['Price Node', 'Revenue Node'])
    expect(translated.drivers[0].node_id).toBe('Factor X')
    expect(translated.robustness?.factors?.[0].node_id).toBe('Price Node')
  })

  it('preserves unknown IDs when not in reverseIdMap', () => {
    // GIVEN: A reverseIdMap missing some IDs
    const reverseIdMap = new Map([
      ['known_id', 'Known ID'],
    ])

    const response = {
      options: [{ id: 'unknown_id', label: 'Unknown' }],
      critiques: [{ code: 'TEST', message: 'Test', affected_nodes: ['unknown_node'] }],
      drivers: [{ node_id: 'unknown_driver', label: 'Driver', contribution: 0.5 }],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: Unknown IDs should be preserved unchanged
    expect(translated.options[0].id).toBe('unknown_id')
    expect(translated.critiques[0].affected_nodes).toEqual(['unknown_node'])
    expect(translated.drivers[0].node_id).toBe('unknown_driver')
  })

  it('handles empty reverseIdMap (no normalisation occurred)', () => {
    // GIVEN: Empty reverseIdMap (no IDs were normalised)
    const reverseIdMap = new Map<string, string>()

    const response = {
      options: [{ id: 'option_1', label: 'Option' }],
      critiques: [{ code: 'TEST', message: 'Test', affected_nodes: ['node_1'] }],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: Response should be returned unchanged (identity)
    expect(translated).toBe(response)
  })

  it('handles missing optional fields gracefully', () => {
    // GIVEN: A minimal response with missing optional fields
    const reverseIdMap = new Map([['opt', 'Option']])

    const response = {
      options: [{ id: 'opt', label: 'Option' }],
      // No critiques, drivers, or robustness
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: Should not throw and should translate what's present
    expect(translated.options[0].id).toBe('Option')
    expect(translated.critiques).toBeUndefined()
    expect(translated.drivers).toBeUndefined()
    expect(translated.robustness).toBeUndefined()
  })
})
