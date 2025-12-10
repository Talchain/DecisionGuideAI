/**
 * Tests for generateScenarios utility
 * Validates graph splitting by option selection
 */

import { describe, it, expect } from 'vitest'
import { generateScenarios, canGenerateScenarios, type ScenarioGraph } from '../generateScenarios'

describe('generateScenarios', () => {
  const createGraph = (nodes: any[], edges: any[]): ScenarioGraph => ({
    nodes: nodes.map((n, i) => ({
      id: n.id || `n${i}`,
      type: n.type,
      data: { label: n.label || `Node ${i}` },
      position: { x: 0, y: 0 },
      ...n,
    })),
    edges: edges.map((e, i) => ({
      id: e.id || `e${i}`,
      source: e.source,
      target: e.target,
      ...e,
    })),
  })

  describe('canGenerateScenarios', () => {
    it('returns true when graph has 1 decision and 2+ options', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
        ],
        []
      )
      expect(canGenerateScenarios(graph)).toBe(true)
    })

    it('returns false when graph has no decision node', () => {
      const graph = createGraph(
        [
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
        ],
        []
      )
      expect(canGenerateScenarios(graph)).toBe(false)
    })

    it('returns false when graph has multiple decision nodes', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision 1' },
          { id: 'd2', type: 'decision', label: 'Decision 2' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
        ],
        []
      )
      expect(canGenerateScenarios(graph)).toBe(false)
    })

    it('returns false when graph has fewer than 2 options', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
        ],
        []
      )
      expect(canGenerateScenarios(graph)).toBe(false)
    })
  })

  describe('generateScenarios', () => {
    it('throws when graph has no decision node', () => {
      const graph = createGraph(
        [
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
        ],
        []
      )
      expect(() => generateScenarios(graph)).toThrow('Graph must have exactly 1 decision node')
    })

    it('throws when graph has fewer than 2 options', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
        ],
        []
      )
      expect(() => generateScenarios(graph)).toThrow('Graph must have at least 2 option nodes')
    })

    it('generates two scenarios with correct labels', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
        ],
        [
          { source: 'd1', target: 'o1' },
          { source: 'd1', target: 'o2' },
        ]
      )

      const result = generateScenarios(graph)

      expect(result.labels.a).toBe('Option A')
      expect(result.labels.b).toBe('Option B')
    })

    it('scenarioA includes only Option A and excludes Option B', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
          { id: 'out', type: 'outcome', label: 'Outcome' },
        ],
        [
          { source: 'd1', target: 'o1' },
          { source: 'd1', target: 'o2' },
          { source: 'o1', target: 'out' },
          { source: 'o2', target: 'out' },
        ]
      )

      const result = generateScenarios(graph)

      // ScenarioA should have decision, optionA, and outcome (shared)
      const scenarioANodeIds = result.scenarioA.nodes.map(n => n.id)
      expect(scenarioANodeIds).toContain('d1')
      expect(scenarioANodeIds).toContain('o1')
      expect(scenarioANodeIds).not.toContain('o2')
      expect(scenarioANodeIds).toContain('out') // shared downstream
    })

    it('scenarioB includes only Option B and excludes Option A', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
          { id: 'out', type: 'outcome', label: 'Outcome' },
        ],
        [
          { source: 'd1', target: 'o1' },
          { source: 'd1', target: 'o2' },
          { source: 'o1', target: 'out' },
          { source: 'o2', target: 'out' },
        ]
      )

      const result = generateScenarios(graph)

      const scenarioBNodeIds = result.scenarioB.nodes.map(n => n.id)
      expect(scenarioBNodeIds).toContain('d1')
      expect(scenarioBNodeIds).not.toContain('o1')
      expect(scenarioBNodeIds).toContain('o2')
      expect(scenarioBNodeIds).toContain('out')
    })

    it('excludes exclusive downstream nodes from other option', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
          { id: 'exclusive_a', type: 'factor', label: 'Factor for A only' },
          { id: 'exclusive_b', type: 'factor', label: 'Factor for B only' },
        ],
        [
          { source: 'd1', target: 'o1' },
          { source: 'd1', target: 'o2' },
          { source: 'o1', target: 'exclusive_a' },
          { source: 'o2', target: 'exclusive_b' },
        ]
      )

      const result = generateScenarios(graph)

      const scenarioANodeIds = result.scenarioA.nodes.map(n => n.id)
      expect(scenarioANodeIds).toContain('exclusive_a')
      expect(scenarioANodeIds).not.toContain('exclusive_b')

      const scenarioBNodeIds = result.scenarioB.nodes.map(n => n.id)
      expect(scenarioBNodeIds).toContain('exclusive_b')
      expect(scenarioBNodeIds).not.toContain('exclusive_a')
    })

    it('filters edges to only include relevant source/target pairs', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
        ],
        [
          { id: 'e1', source: 'd1', target: 'o1' },
          { id: 'e2', source: 'd1', target: 'o2' },
        ]
      )

      const result = generateScenarios(graph)

      // ScenarioA edges should only include d1->o1, not d1->o2
      const scenarioAEdgeIds = result.scenarioA.edges.map(e => e.id)
      expect(scenarioAEdgeIds).toContain('e1')
      expect(scenarioAEdgeIds).not.toContain('e2')
    })

    it('returns allOptions with id and label for UI selection', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
          { id: 'o3', type: 'option', label: 'Option C' },
        ],
        []
      )

      const result = generateScenarios(graph)

      expect(result.allOptions).toHaveLength(3)
      expect(result.allOptions).toContainEqual({ id: 'o1', label: 'Option A' })
      expect(result.allOptions).toContainEqual({ id: 'o2', label: 'Option B' })
      expect(result.allOptions).toContainEqual({ id: 'o3', label: 'Option C' })
    })

    it('allows specifying which options to compare', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
          { id: 'o3', type: 'option', label: 'Option C' },
        ],
        []
      )

      const result = generateScenarios(graph, { optionIds: ['o1', 'o3'] })

      expect(result.labels.a).toBe('Option A')
      expect(result.labels.b).toBe('Option C')
    })

    it('throws when specified option IDs are not found', () => {
      const graph = createGraph(
        [
          { id: 'd1', type: 'decision', label: 'Decision' },
          { id: 'o1', type: 'option', label: 'Option A' },
          { id: 'o2', type: 'option', label: 'Option B' },
        ],
        []
      )

      expect(() =>
        generateScenarios(graph, { optionIds: ['o1', 'o999'] })
      ).toThrow('Specified option IDs not found')
    })

    it('handles nodes with missing labels gracefully', () => {
      const graph: ScenarioGraph = {
        nodes: [
          { id: 'd1', type: 'decision', data: {}, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: {}, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: {}, position: { x: 0, y: 0 } },
        ],
        edges: [],
      }

      const result = generateScenarios(graph)

      expect(result.labels.a).toBe('Option o1')
      expect(result.labels.b).toBe('Option o2')
    })
  })
})
