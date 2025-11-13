/**
 * Template preview generator - renders mini SVG layouts
 * P0-5: Deterministic layout for template cards (150x100px)
 */

import type { BlueprintNode, BlueprintEdge } from '../../templates/blueprints/types'

const PREVIEW_WIDTH = 150
const PREVIEW_HEIGHT = 100
const NODE_RADIUS = 6
const PADDING = 12

interface LayoutNode {
  id: string
  x: number
  y: number
  label: string
}

interface LayoutEdge {
  source: string
  target: string
}

/**
 * Simple force-directed layout for small graphs
 * Deterministic based on node count and structure
 */
function computeLayout(nodes: BlueprintNode[], edges: BlueprintEdge[]): LayoutNode[] {
  const nodeCount = nodes.length

  if (nodeCount === 0) return []

  // Single node - center it
  if (nodeCount === 1) {
    return [{
      id: nodes[0].id,
      x: PREVIEW_WIDTH / 2,
      y: PREVIEW_HEIGHT / 2,
      label: nodes[0].label
    }]
  }

  // Build adjacency map for edge connectivity
  const adjacency = new Map<string, Set<string>>()
  for (const node of nodes) {
    adjacency.set(node.id, new Set())
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  }

  // Find root node (node with no incoming edges, or first node)
  const hasIncoming = new Set<string>()
  for (const edge of edges) {
    hasIncoming.add(edge.target)
  }

  const rootNode = nodes.find(n => !hasIncoming.has(n.id)) || nodes[0]

  // Simple hierarchical layout: BFS from root
  const layoutNodes: LayoutNode[] = []
  const visited = new Set<string>()
  const levels: string[][] = []

  // BFS to assign levels
  const queue: Array<{ id: string; level: number }> = [{ id: rootNode.id, level: 0 }]
  visited.add(rootNode.id)

  while (queue.length > 0) {
    const { id, level } = queue.shift()!

    if (!levels[level]) levels[level] = []
    levels[level].push(id)

    const neighbors = adjacency.get(id) || new Set()
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        queue.push({ id: neighborId, level: level + 1 })
      }
    }
  }

  // Add any unconnected nodes to the last level
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (levels.length === 0) levels.push([])
      levels[levels.length - 1].push(node.id)
    }
  }

  // Calculate positions
  const levelHeight = (PREVIEW_HEIGHT - 2 * PADDING) / Math.max(1, levels.length - 1)

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]
    const levelWidth = (PREVIEW_WIDTH - 2 * PADDING) / Math.max(1, level.length - 1)

    for (let j = 0; j < level.length; j++) {
      const nodeId = level[j]
      const node = nodes.find(n => n.id === nodeId)!

      const x = level.length === 1
        ? PREVIEW_WIDTH / 2
        : PADDING + j * levelWidth

      const y = levels.length === 1
        ? PREVIEW_HEIGHT / 2
        : PADDING + i * levelHeight

      layoutNodes.push({
        id: nodeId,
        x,
        y,
        label: node.label
      })
    }
  }

  return layoutNodes
}

/**
 * Generate SVG preview as data URL
 * Returns a deterministic SVG based on template structure
 */
export function generateTemplatePreview(nodes: BlueprintNode[], edges: BlueprintEdge[]): string {
  const layoutNodes = computeLayout(nodes, edges)

  // Build node ID to position map
  const nodeMap = new Map<string, { x: number; y: number }>()
  for (const node of layoutNodes) {
    nodeMap.set(node.id, { x: node.x, y: node.y })
  }

  // Render SVG
  const edgePaths = edges
    .map(edge => {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source || !target) return ''
      return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="#CBD5E1" stroke-width="1.5" stroke-linecap="round" />`
    })
    .join('\n')

  const nodeCircles = layoutNodes
    .map(node => {
      return `<circle cx="${node.x}" cy="${node.y}" r="${NODE_RADIUS}" fill="#3B82F6" stroke="#1E40AF" stroke-width="1.5" />`
    })
    .join('\n')

  const svg = `<svg width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" fill="#F8FAFC" />
  ${edgePaths}
  ${nodeCircles}
</svg>`

  // Convert to data URL
  const encoded = encodeURIComponent(svg)
  return `data:image/svg+xml,${encoded}`
}
