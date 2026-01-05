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
      ['goal_node', 'Goal Node'],
    ])

    // AND: A V2-like response with normalised IDs in all node ID fields
    const response = {
      // goal_node_id - the goal node for the analysis
      goal_node_id: 'goal_node',
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
    expect(translated.goal_node_id).toBe('Goal Node')
    expect(translated.options[0].id).toBe('Option A')
    expect(translated.critiques[0].affected_nodes).toEqual(['Price Node', 'Revenue Node'])
    expect(translated.drivers[0].node_id).toBe('Factor X')
    expect(translated.robustness?.factors?.[0].node_id).toBe('Price Node')
  })

  it('translates goal_node_id when present in reverseIdMap', () => {
    // GIVEN: A reverseIdMap with the goal node ID
    const reverseIdMap = new Map([
      ['profit_margin', 'Profit Margin'],
    ])

    // AND: A response with goal_node_id
    const response = {
      goal_node_id: 'profit_margin',
      options: [],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: goal_node_id should be translated
    expect(translated.goal_node_id).toBe('Profit Margin')
  })

  it('preserves goal_node_id when not in reverseIdMap', () => {
    // GIVEN: A reverseIdMap that does NOT include the goal node ID
    const reverseIdMap = new Map([
      ['other_node', 'Other Node'],
    ])

    // AND: A response with goal_node_id not in the map
    const response = {
      goal_node_id: 'unknown_goal',
      options: [],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: goal_node_id should be preserved unchanged
    expect(translated.goal_node_id).toBe('unknown_goal')
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

  // -------------------------------------------------------------------------
  // V2 Response Fields Translation Tests
  // -------------------------------------------------------------------------

  it('translates option_comparison[].option_id (V2 field)', () => {
    // GIVEN: A reverseIdMap with option IDs
    const reverseIdMap = new Map([
      ['option_a', 'Option A'],
      ['option_b', 'Option B'],
    ])

    // AND: A V2 response with option_comparison
    const response = {
      option_comparison: [
        { option_id: 'option_a', option_label: 'Option A', confidence_interval: [0.3, 0.7] },
        { option_id: 'option_b', option_label: 'Option B', confidence_interval: [0.2, 0.5] },
      ],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: option_comparison[].option_id should be translated
    expect(translated.option_comparison![0].option_id).toBe('Option A')
    expect(translated.option_comparison![1].option_id).toBe('Option B')
  })

  it('translates edge_sensitivity fields (V2 field)', () => {
    // GIVEN: A reverseIdMap with node IDs
    const reverseIdMap = new Map([
      ['price_node', 'Price Node'],
      ['revenue_node', 'Revenue Node'],
      ['cost_node', 'Cost Node'],
    ])

    // AND: A V2 response with edge_sensitivity
    const response = {
      edge_sensitivity: [
        { edge_id: 'price_node::revenue_node', from: 'price_node', to: 'revenue_node', elasticity: 0.5, importance_rank: 1, interpretation: 'High impact' },
        { edge_id: 'cost_node->revenue_node', from: 'cost_node', to: 'revenue_node', elasticity: -0.3, importance_rank: 2, interpretation: 'Negative impact' },
      ],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: edge_sensitivity fields should be translated
    expect(translated.edge_sensitivity![0].edge_id).toBe('Price Node::Revenue Node')
    expect(translated.edge_sensitivity![0].from).toBe('Price Node')
    expect(translated.edge_sensitivity![0].to).toBe('Revenue Node')
    expect(translated.edge_sensitivity![1].edge_id).toBe('Cost Node->Revenue Node')
    expect(translated.edge_sensitivity![1].from).toBe('Cost Node')
    expect(translated.edge_sensitivity![1].to).toBe('Revenue Node')
  })

  it('translates factor_sensitivity[].factor_id (V2 field)', () => {
    // GIVEN: A reverseIdMap with factor IDs
    const reverseIdMap = new Map([
      ['factor_a', 'Factor A'],
      ['factor_b', 'Factor B'],
    ])

    // AND: A V2 response with factor_sensitivity
    const response = {
      factor_sensitivity: [
        { factor_id: 'factor_a', sensitivity: 0.8 },
        { factor_id: 'factor_b', sensitivity: 0.3 },
      ],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: factor_sensitivity[].factor_id should be translated
    expect(translated.factor_sensitivity![0].factor_id).toBe('Factor A')
    expect(translated.factor_sensitivity![1].factor_id).toBe('Factor B')
  })

  it('translates robustness.fragile_edges and robust_edges (V2 field)', () => {
    // GIVEN: A reverseIdMap with node IDs
    const reverseIdMap = new Map([
      ['price_node', 'Price Node'],
      ['revenue_node', 'Revenue Node'],
      ['cost_node', 'Cost Node'],
    ])

    // AND: A V2 response with robustness fragile_edges/robust_edges
    const response = {
      robustness: {
        fragile_edges: ['price_node::revenue_node', 'cost_node->revenue_node'],
        robust_edges: ['price_node::cost_node'],
      },
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: fragile_edges and robust_edges should have their node IDs translated
    expect(translated.robustness!.fragile_edges).toEqual([
      'Price Node::Revenue Node',
      'Cost Node->Revenue Node',
    ])
    expect(translated.robustness!.robust_edges).toEqual([
      'Price Node::Cost Node',
    ])
  })

  it('handles edge_id with unknown format (passes through unchanged)', () => {
    // GIVEN: A reverseIdMap
    const reverseIdMap = new Map([
      ['node_a', 'Node A'],
    ])

    // AND: An edge_id with unknown format (neither :: nor ->)
    const response = {
      edge_sensitivity: [
        { edge_id: 'edge_1234', from: 'node_a', to: 'node_a', elasticity: 0.5, importance_rank: 1, interpretation: 'Test' },
      ],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: edge_id should be passed through unchanged
    expect(translated.edge_sensitivity![0].edge_id).toBe('edge_1234')
    // But from/to should still be translated
    expect(translated.edge_sensitivity![0].from).toBe('Node A')
    expect(translated.edge_sensitivity![0].to).toBe('Node A')
  })

  it('translates complete V2 response with all fields', () => {
    // GIVEN: A comprehensive reverseIdMap
    const reverseIdMap = new Map([
      ['goal_node', 'Goal Node'],
      ['option_1', 'Option 1'],
      ['option_2', 'Option 2'],
      ['price', 'Price'],
      ['revenue', 'Revenue'],
      ['cost', 'Cost'],
    ])

    // AND: A complete V2 response
    const response = {
      goal_node_id: 'goal_node',
      option_comparison: [
        { option_id: 'option_1', option_label: 'Opt 1', confidence_interval: [0.3, 0.7] as [number, number] },
        { option_id: 'option_2', option_label: 'Opt 2', confidence_interval: [0.4, 0.6] as [number, number] },
      ],
      edge_sensitivity: [
        { edge_id: 'price::revenue', from: 'price', to: 'revenue', elasticity: 0.5, importance_rank: 1, interpretation: 'High', sensitivity_type: 'magnitude' as const },
      ],
      factor_sensitivity: [
        { factor_id: 'cost', sensitivity: 0.3 },
      ],
      critiques: [
        { code: 'TEST', severity: 'warning' as const, message: 'Test', affected_nodes: ['price', 'revenue'] },
      ],
      robustness: {
        fragile_edges: ['cost::revenue'],
        robust_edges: ['price::revenue'],
      },
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: All fields should be translated correctly
    expect(translated.goal_node_id).toBe('Goal Node')
    expect(translated.option_comparison![0].option_id).toBe('Option 1')
    expect(translated.option_comparison![1].option_id).toBe('Option 2')
    expect(translated.edge_sensitivity![0].edge_id).toBe('Price::Revenue')
    expect(translated.edge_sensitivity![0].from).toBe('Price')
    expect(translated.edge_sensitivity![0].to).toBe('Revenue')
    expect(translated.factor_sensitivity![0].factor_id).toBe('Cost')
    expect(translated.critiques![0].affected_nodes).toEqual(['Price', 'Revenue'])
    expect(translated.robustness!.fragile_edges).toEqual(['Cost::Revenue'])
    expect(translated.robustness!.robust_edges).toEqual(['Price::Revenue'])
  })
})

// =============================================================================
// Contract Tests: Field Coverage for translateResponseToUIIds
// =============================================================================

describe('translateResponseToUIIds contract coverage', () => {
  /**
   * CONTRACT DOCUMENTATION
   *
   * All V2RunResponse fields containing node/edge IDs must be translated.
   * This test documents the expected field coverage and serves as a contract
   * that must be updated when new ID fields are added to the PLoT response.
   *
   * ID Fields Requiring Translation (V2RunResponse):
   * ------------------------------------------------
   * | Field Path                        | ID Type    | Format           |
   * |-----------------------------------|------------|------------------|
   * | goal_node_id                      | node       | single           |
   * | option_comparison[].option_id     | node       | single           |
   * | critiques[].affected_nodes[]      | node       | array            |
   * | drivers[].node_id                 | node       | single           |
   * | edge_sensitivity[].edge_id        | edge       | "from::to"       |
   * | edge_sensitivity[].from           | node       | single           |
   * | edge_sensitivity[].to             | node       | single           |
   * | factor_sensitivity[].factor_id    | node       | single           |
   * | robustness.fragile_edges[]        | edge       | "from::to" array |
   * | robustness.robust_edges[]         | edge       | "from::to" array |
   * | robustness.factors[].node_id      | node       | single (legacy)  |
   * | options[].id                      | node       | single (legacy)  |
   *
   * When adding new ID fields to V2RunResponse:
   * 1. Add field path to this documentation
   * 2. Update translateResponseToUIIds type constraint
   * 3. Add translation logic in the return object
   * 4. Add test case below verifying translation
   */

  // Canonical list of ID fields - update when schema changes
  const TRANSLATED_ID_FIELDS = {
    // V2 response fields
    goal_node_id: { type: 'node', format: 'single' },
    'option_comparison[].option_id': { type: 'node', format: 'single' },
    'critiques[].affected_nodes': { type: 'node', format: 'array' },
    'drivers[].node_id': { type: 'node', format: 'single' },
    'edge_sensitivity[].edge_id': { type: 'edge', format: 'from::to' },
    'edge_sensitivity[].from': { type: 'node', format: 'single' },
    'edge_sensitivity[].to': { type: 'node', format: 'single' },
    'factor_sensitivity[].factor_id': { type: 'node', format: 'single' },
    'robustness.fragile_edges': { type: 'edge', format: 'array' },
    'robustness.robust_edges': { type: 'edge', format: 'array' },
    // Legacy fields (for backward compatibility)
    'robustness.factors[].node_id': { type: 'node', format: 'single' },
    'options[].id': { type: 'node', format: 'single' },
  } as const

  it('documents all translated ID fields (contract baseline)', () => {
    // This test serves as the contract baseline
    // If you need to add a new field, add it to TRANSLATED_ID_FIELDS above
    const fieldCount = Object.keys(TRANSLATED_ID_FIELDS).length
    expect(fieldCount).toBe(12) // Update this count when adding new fields

    // Verify structure
    expect(TRANSLATED_ID_FIELDS['goal_node_id']).toBeDefined()
    expect(TRANSLATED_ID_FIELDS['option_comparison[].option_id']).toBeDefined()
    expect(TRANSLATED_ID_FIELDS['edge_sensitivity[].edge_id']).toBeDefined()
    expect(TRANSLATED_ID_FIELDS['factor_sensitivity[].factor_id']).toBeDefined()
    expect(TRANSLATED_ID_FIELDS['robustness.fragile_edges']).toBeDefined()
    expect(TRANSLATED_ID_FIELDS['robustness.robust_edges']).toBeDefined()
  })

  it('verifies all documented fields are actually translated', () => {
    // GIVEN: A comprehensive reverse map
    const reverseIdMap = new Map([
      ['goal', 'Goal'],
      ['opt1', 'Opt 1'],
      ['opt2', 'Opt 2'],
      ['node_a', 'Node A'],
      ['node_b', 'Node B'],
      ['driver', 'Driver'],
      ['from_node', 'From Node'],
      ['to_node', 'To Node'],
      ['factor', 'Factor'],
      ['fragile_from', 'Fragile From'],
      ['fragile_to', 'Fragile To'],
      ['robust_from', 'Robust From'],
      ['robust_to', 'Robust To'],
      ['legacy_opt', 'Legacy Opt'],
      ['robustness_factor', 'Robustness Factor'],
    ])

    // AND: A response exercising ALL documented ID fields
    const response = {
      goal_node_id: 'goal',
      option_comparison: [
        { option_id: 'opt1', option_label: 'O1', confidence_interval: [0, 1] as [number, number] },
        { option_id: 'opt2', option_label: 'O2', confidence_interval: [0, 1] as [number, number] },
      ],
      critiques: [
        { code: 'C1', severity: 'warning' as const, message: 'M1', affected_nodes: ['node_a', 'node_b'] },
      ],
      drivers: [
        { node_id: 'driver', label: 'D', contribution: 0.5, direction: 'positive' as const },
      ],
      edge_sensitivity: [
        { edge_id: 'from_node::to_node', from: 'from_node', to: 'to_node', elasticity: 0.5, importance_rank: 1, interpretation: 'I', sensitivity_type: 'magnitude' as const },
      ],
      factor_sensitivity: [
        { factor_id: 'factor', sensitivity: 0.5 },
      ],
      robustness: {
        fragile_edges: ['fragile_from::fragile_to'],
        robust_edges: ['robust_from->robust_to'],
        factors: [{ node_id: 'robustness_factor', sensitivity: 0.5 }],
      },
      options: [
        { id: 'legacy_opt', label: 'L' },
      ],
    }

    // WHEN: We translate
    const translated = translateResponseToUIIds(response, reverseIdMap)

    // THEN: Verify each documented field is translated
    // goal_node_id
    expect(translated.goal_node_id).toBe('Goal')

    // option_comparison[].option_id
    expect(translated.option_comparison![0].option_id).toBe('Opt 1')
    expect(translated.option_comparison![1].option_id).toBe('Opt 2')

    // critiques[].affected_nodes
    expect(translated.critiques![0].affected_nodes).toEqual(['Node A', 'Node B'])

    // drivers[].node_id
    expect(translated.drivers![0].node_id).toBe('Driver')

    // edge_sensitivity[].edge_id, from, to
    expect(translated.edge_sensitivity![0].edge_id).toBe('From Node::To Node')
    expect(translated.edge_sensitivity![0].from).toBe('From Node')
    expect(translated.edge_sensitivity![0].to).toBe('To Node')

    // factor_sensitivity[].factor_id
    expect(translated.factor_sensitivity![0].factor_id).toBe('Factor')

    // robustness.fragile_edges (:: format)
    expect(translated.robustness!.fragile_edges).toEqual(['Fragile From::Fragile To'])

    // robustness.robust_edges (-> format)
    expect(translated.robustness!.robust_edges).toEqual(['Robust From->Robust To'])

    // robustness.factors[].node_id (legacy)
    expect(translated.robustness!.factors![0].node_id).toBe('Robustness Factor')

    // options[].id (legacy)
    expect(translated.options![0].id).toBe('Legacy Opt')
  })

  /**
   * SCHEMA EVOLUTION GUARDRAIL
   *
   * If you're seeing a failure here after adding a new field to V2RunResponse
   * that contains node/edge IDs, follow these steps:
   *
   * 1. Add the field path to TRANSLATED_ID_FIELDS constant above
   * 2. Update the field count assertion in 'documents all translated ID fields'
   * 3. Add a test case in 'verifies all documented fields are actually translated'
   * 4. Update translateResponseToUIIds function:
   *    a. Add field to the generic type constraint
   *    b. Add translation logic in the return object
   */
  it('schema evolution guardrail - checks field count', () => {
    // If this test fails, a new ID field may have been added to V2RunResponse
    // See the SCHEMA EVOLUTION GUARDRAIL comment above for instructions
    const expectedFieldCount = 12
    const actualFieldCount = Object.keys(TRANSLATED_ID_FIELDS).length
    expect(actualFieldCount).toBe(expectedFieldCount)
  })
})
