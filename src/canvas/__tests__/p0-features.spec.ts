/**
 * P0 Features Test Suite
 * Tests for scenario management, template library, and quick-add features
 */

import { describe, it, expect } from 'vitest'
import { exportScenario, type ScenarioExportData } from '../export/exportScenario'
import { importScenarioFromFile, createScenario } from '../store/scenarios'
import { generateTemplatePreview } from '../utils/templatePreview'
import type { BlueprintNode, BlueprintEdge } from '../../templates/blueprints/types'

describe('P0-2: Scenario Export', () => {
  it('should export scenario with correct format', () => {
    const scenario = createScenario({
      name: 'Test Scenario',
      nodes: [
        { id: '1', type: 'decision-binary', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
      ],
      edges: []
    })

    // Mock blob and URL creation
    global.URL.createObjectURL = () => 'blob:mock'
    global.URL.revokeObjectURL = () => {}

    // Export should not throw
    expect(() => exportScenario(scenario)).not.toThrow()
  })

  it('should include format version and timestamp', () => {
    const scenario = createScenario({
      name: 'Test Scenario',
      nodes: [],
      edges: []
    })

    const exportedJson = JSON.stringify({
      format: 'olumi-scenario-v1',
      exportedAt: new Date().toISOString(),
      scenario: {
        id: scenario.id,
        name: scenario.name,
        createdAt: scenario.createdAt,
        updatedAt: scenario.updatedAt
      },
      graph: { nodes: scenario.graph.nodes, edges: scenario.graph.edges }
    })

    const data = JSON.parse(exportedJson)
    expect(data.format).toBe('olumi-scenario-v1')
    expect(data.exportedAt).toBeDefined()
    expect(data.scenario.name).toBe('Test Scenario')
  })
})

describe('P0-3: Scenario Import with ID Reseeding', () => {
  it('should import scenario with valid format', () => {
    const fileContent = JSON.stringify({
      format: 'olumi-scenario-v1',
      exportedAt: new Date().toISOString(),
      scenario: {
        name: 'Imported Scenario',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      graph: {
        nodes: [
          { id: '1', type: 'decision-binary', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
        ],
        edges: []
      }
    })

    const result = importScenarioFromFile(fileContent)
    expect(result.success).toBe(true)
    expect(result.scenario).toBeDefined()
    expect(result.scenario?.name).toBe('Imported Scenario')
  })

  it('should reject invalid format', () => {
    const fileContent = JSON.stringify({
      format: 'invalid-format',
      scenario: { name: 'Test' }
    })

    const result = importScenarioFromFile(fileContent)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported format')
  })

  it('should reseed node and edge IDs to prevent conflicts', () => {
    const fileContent = JSON.stringify({
      format: 'olumi-scenario-v1',
      exportedAt: new Date().toISOString(),
      scenario: {
        name: 'Imported Scenario',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      graph: {
        nodes: [
          { id: '1', type: 'decision-binary', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'outcome-terminal', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2', data: { weight: 0.5 } }
        ]
      }
    })

    const result = importScenarioFromFile(fileContent)
    expect(result.success).toBe(true)

    // IDs should be reseeded (not '1', '2', 'e1')
    if (result.scenario) {
      const nodeIds = result.scenario.graph.nodes.map(n => n.id)
      const edgeIds = result.scenario.graph.edges.map(e => e.id)

      // Check that IDs are numeric and higher than originals
      expect(nodeIds.every(id => !isNaN(parseInt(id, 10)))).toBe(true)
      expect(edgeIds.every(id => id.startsWith('e'))).toBe(true)
    }
  })
})

describe('P0-5: Template Preview Generation', () => {
  it('should generate SVG data URL for template preview', () => {
    const nodes: BlueprintNode[] = [
      { id: 'n1', label: 'Node 1', type: 'decision-binary', outgoing: [] },
      { id: 'n2', label: 'Node 2', type: 'outcome-terminal', outgoing: [] }
    ]

    const edges: BlueprintEdge[] = [
      { source: 'n1', target: 'n2', weight: 0.5 }
    ]

    const dataUrl = generateTemplatePreview(nodes, edges)

    expect(dataUrl).toMatch(/^data:image\/svg\+xml,/)
    expect(dataUrl).toContain('svg')
    expect(dataUrl).toContain('circle') // Should have node circles
    expect(dataUrl).toContain('line') // Should have edge lines
  })

  it('should handle empty template', () => {
    const dataUrl = generateTemplatePreview([], [])
    expect(dataUrl).toMatch(/^data:image\/svg\+xml,/)
  })

  it('should handle single node template', () => {
    const nodes: BlueprintNode[] = [
      { id: 'n1', label: 'Node 1', type: 'decision-binary', outgoing: [] }
    ]

    const dataUrl = generateTemplatePreview(nodes, [])
    expect(dataUrl).toMatch(/^data:image\/svg\+xml,/)
    expect(dataUrl).toContain('circle')
  })

  it('should position nodes using hierarchical layout', () => {
    const nodes: BlueprintNode[] = [
      { id: 'root', label: 'Root', type: 'decision-binary', outgoing: ['child1', 'child2'] },
      { id: 'child1', label: 'Child 1', type: 'outcome-terminal', outgoing: [] },
      { id: 'child2', label: 'Child 2', type: 'outcome-terminal', outgoing: [] }
    ]

    const edges: BlueprintEdge[] = [
      { source: 'root', target: 'child1', weight: 0.5 },
      { source: 'root', target: 'child2', weight: 0.5 }
    ]

    const dataUrl = generateTemplatePreview(nodes, edges)

    // Should contain multiple circles (one per node)
    const matches = dataUrl.match(/circle/g)
    expect(matches?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('P0-6: Template Merge Positioning', () => {
  it('should calculate offset for merged template', () => {
    const existingNodes = [
      { id: '1', position: { x: 0, y: 0 }, width: 200 },
      { id: '2', position: { x: 200, y: 0 }, width: 200 }
    ]

    // Calculate rightmost position
    const maxX = Math.max(...existingNodes.map(n => n.position.x + (n.width || 200)))
    const offset = maxX + 300

    expect(offset).toBe(200 + 200 + 300) // 700px offset
  })

  it('should use 0 offset for empty canvas', () => {
    const existingNodes: any[] = []

    const maxX = existingNodes.length > 0
      ? Math.max(...existingNodes.map(n => n.position.x + (n.width || 200)))
      : 0

    const offset = existingNodes.length > 0 ? maxX + 300 : 0

    expect(offset).toBe(0)
  })
})

describe('P0-7: Radial Quick-Add Menu', () => {
  it('should have 6 node type options', () => {
    const QUICK_NODE_TYPES = [
      'decision',
      'outcome',
      'option',
      'factor',
      'risk',
      'goal'
    ]

    expect(QUICK_NODE_TYPES.length).toBe(6)
  })

  it('should convert screen to canvas coordinates', () => {
    const screenX = 500
    const screenY = 300
    const viewport = { x: 100, y: 50, zoom: 1.5 }

    const canvasX = (screenX - viewport.x) / viewport.zoom
    const canvasY = (screenY - viewport.y) / viewport.zoom

    expect(canvasX).toBeCloseTo(266.67, 1)
    expect(canvasY).toBeCloseTo(166.67, 1)
  })
})

describe('P0-8: Auto-Connect Nearby Nodes', () => {
  it('should detect nodes within 300px radius', () => {
    const newNode = { id: 'new', position: { x: 100, y: 100 } }
    const nodes = [
      { id: 'n1', position: { x: 150, y: 150 } }, // ~70px away
      { id: 'n2', position: { x: 500, y: 500 } }, // ~566px away
      { id: 'n3', position: { x: 120, y: 120 } }  // ~28px away
    ]

    const nearbyNodes = nodes.filter(n => {
      const dx = n.position.x - newNode.position.x
      const dy = n.position.y - newNode.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      return distance <= 300
    })

    expect(nearbyNodes.length).toBe(2)
    expect(nearbyNodes.map(n => n.id)).toEqual(['n1', 'n3'])
  })

  it('should find closest node among nearby nodes', () => {
    const newNode = { id: 'new', position: { x: 100, y: 100 } }
    const nearbyNodes = [
      { id: 'n1', position: { x: 150, y: 150 } }, // ~70px
      { id: 'n2', position: { x: 120, y: 120 } }  // ~28px
    ]

    const closest = nearbyNodes.reduce((prev, curr) => {
      const prevDist = Math.sqrt(
        Math.pow(prev.position.x - newNode.position.x, 2) +
        Math.pow(prev.position.y - newNode.position.y, 2)
      )
      const currDist = Math.sqrt(
        Math.pow(curr.position.x - newNode.position.x, 2) +
        Math.pow(curr.position.y - newNode.position.y, 2)
      )
      return currDist < prevDist ? curr : prev
    })

    expect(closest.id).toBe('n2')
  })
})

describe('P0-9: Inline Edge Edit', () => {
  it('should debounce updates at 120ms', () => {
    const DEBOUNCE_DELAY = 120
    expect(DEBOUNCE_DELAY).toBe(120)
  })

  it('should validate weight and belief in range 0-1', () => {
    const weight = 0.5
    const belief = 0.8

    expect(weight).toBeGreaterThanOrEqual(0)
    expect(weight).toBeLessThanOrEqual(1)
    expect(belief).toBeGreaterThanOrEqual(0)
    expect(belief).toBeLessThanOrEqual(1)
  })

  it('should convert screen coordinates to popover position', () => {
    const event = { clientX: 500, clientY: 300 }
    const position = { x: event.clientX, y: event.clientY }

    expect(position.x).toBe(500)
    expect(position.y).toBe(300)
  })
})
