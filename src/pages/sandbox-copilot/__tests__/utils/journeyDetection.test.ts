import { describe, it, expect } from 'vitest'
import {
  determineJourneyStage,
  findBlockers,
  isGraphRunnable,
  type GraphData,
  type JourneyContext,
} from '../../utils/journeyDetection'

// Test helpers
function createMockGraph(options: {
  nodeCount?: number
  edgeCount?: number
  hasOutcome?: boolean
  hasDecision?: boolean
}): GraphData {
  const { nodeCount = 0, edgeCount = 0, hasOutcome = true, hasDecision = true } = options

  const nodes = []
  for (let i = 0; i < nodeCount; i++) {
    let type = 'factor'
    if (i === 0 && hasOutcome) type = 'outcome'
    else if (i === 1 && hasDecision) type = 'decision'

    nodes.push({
      id: `node-${i}`,
      type,
      data: { label: `Node ${i}`, type },
      position: { x: 0, y: 0 },
    })
  }

  const edges = []
  for (let i = 0; i < edgeCount && i < nodeCount - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      source: `node-${i}`,
      target: `node-${i + 1}`,
    })
  }

  return { nodes, edges }
}

describe('journeyDetection', () => {
  describe('determineJourneyStage', () => {
    it('detects empty stage when no nodes exist', () => {
      const context: JourneyContext = {
        graph: { nodes: [], edges: [] },
      }
      expect(determineJourneyStage(context)).toBe('empty')
    })

    it('detects building stage for incomplete graph', () => {
      const graph = createMockGraph({ nodeCount: 3, edgeCount: 2 })
      const context: JourneyContext = { graph }
      expect(determineJourneyStage(context)).toBe('building')
    })

    it('detects pre-run-blocked when missing outcome node', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: false,
        hasDecision: true,
      })
      const context: JourneyContext = { graph }
      expect(determineJourneyStage(context)).toBe('pre-run-blocked')
    })

    it('detects pre-run-blocked when missing decision node', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: true,
        hasDecision: false,
      })
      const context: JourneyContext = { graph }
      expect(determineJourneyStage(context)).toBe('pre-run-blocked')
    })

    it('detects pre-run-ready when graph is complete', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: true,
        hasDecision: true,
      })
      const context: JourneyContext = { graph }
      expect(determineJourneyStage(context)).toBe('pre-run-ready')
    })

    it('detects post-run when results are available', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: true,
        hasDecision: true,
      })
      const results = { status: 'complete' as const, report: {} }
      const context: JourneyContext = { graph, results }
      expect(determineJourneyStage(context)).toBe('post-run')
    })

    it('detects inspector when element is selected', () => {
      const graph = createMockGraph({ nodeCount: 5, edgeCount: 4 })
      const context: JourneyContext = {
        graph,
        selectedElement: 'node-1',
      }
      expect(determineJourneyStage(context)).toBe('inspector')
    })

    it('detects compare mode when enabled', () => {
      const graph = createMockGraph({ nodeCount: 5, edgeCount: 4 })
      const context: JourneyContext = {
        graph,
        compareMode: true,
      }
      expect(determineJourneyStage(context)).toBe('compare')
    })

    it('prioritizes inspector over compare mode', () => {
      const graph = createMockGraph({ nodeCount: 5, edgeCount: 4 })
      const context: JourneyContext = {
        graph,
        selectedElement: 'node-1',
        compareMode: true,
      }
      expect(determineJourneyStage(context)).toBe('inspector')
    })
  })

  describe('findBlockers', () => {
    it('returns empty array for valid graph', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: true,
        hasDecision: true,
      })
      expect(findBlockers(graph)).toEqual([])
    })

    it('detects missing outcome node', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: false,
        hasDecision: true,
      })
      const blockers = findBlockers(graph)
      expect(blockers).toContain('Missing outcome node')
    })

    it('detects missing decision node', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: true,
        hasDecision: false,
      })
      const blockers = findBlockers(graph)
      expect(blockers).toContain('Missing decision node')
    })

    it('detects missing edges when multiple nodes exist', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 0,
        hasOutcome: true,
        hasDecision: true,
      })
      const blockers = findBlockers(graph)
      expect(blockers).toContain('No edges connecting nodes')
    })

    it('does not require edges for single node', () => {
      const graph = createMockGraph({
        nodeCount: 1,
        edgeCount: 0,
        hasOutcome: true,
        hasDecision: false,
      })
      const blockers = findBlockers(graph)
      expect(blockers).not.toContain('No edges connecting nodes')
    })

    it('can detect multiple blockers', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 0,
        hasOutcome: false,
        hasDecision: false,
      })
      const blockers = findBlockers(graph)
      expect(blockers.length).toBeGreaterThan(1)
      expect(blockers).toContain('Missing outcome node')
      expect(blockers).toContain('Missing decision node')
    })
  })

  describe('isGraphRunnable', () => {
    it('returns true for valid graph', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: true,
        hasDecision: true,
      })
      expect(isGraphRunnable(graph)).toBe(true)
    })

    it('returns false for empty graph', () => {
      const graph = { nodes: [], edges: [] }
      expect(isGraphRunnable(graph)).toBe(false)
    })

    it('returns false for graph with blockers', () => {
      const graph = createMockGraph({
        nodeCount: 5,
        edgeCount: 4,
        hasOutcome: false,
        hasDecision: true,
      })
      expect(isGraphRunnable(graph)).toBe(false)
    })
  })
})
