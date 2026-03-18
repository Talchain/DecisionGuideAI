// P1 Polish: Dynamic ELK import for code-splitting (Task F)
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'
import { Node, Edge } from '@xyflow/react'
import { NODE_REGISTRY } from '../domain/nodes'

interface LayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'
  spacing?: number
  layerSpacing?: number
  preserveLocked?: boolean
}

// Available canvas dimensions based on fixed chrome:
//   left sidebar: 48px, right dock collapsed: 40px
//   top bar: 57px, canvas toolbar: 72px
//   1440x900 reference viewport
const CANVAS_WIDTH = 1352
const CANVAS_HEIGHT = 771
const FIT_VIEW_PADDING = 0.2 // must match fitView call in ReactFlowGraph.tsx

export async function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const {
    direction = 'DOWN',
    spacing = 80,
    layerSpacing,
    preserveLocked = true
  } = options

  const effectiveNodeSpacing = Math.max(20, spacing)
  const effectiveLayerSpacing = Math.max(30, layerSpacing ?? spacing * 1.5)

  const sizePaddingX = 24
  const sizePaddingY = 16

  const getNodeDimensions = (node: Node): { width: number; height: number } => {
    const measured = (node as any).measured as { width?: number; height?: number } | undefined

    const fallbackType = (node.type ?? (node.data as any)?.kind) as keyof typeof NODE_REGISTRY | undefined
    const defaultSize = fallbackType && NODE_REGISTRY[fallbackType]
      ? NODE_REGISTRY[fallbackType].defaultSize
      : { width: 220, height: 100 }

    const rawWidth = measured?.width ?? node.width ?? defaultSize.width
    const rawHeight = measured?.height ?? node.height ?? defaultSize.height

    const width = Math.max(40, Math.round(rawWidth) + sizePaddingX)
    const height = Math.max(40, Math.round(rawHeight) + sizePaddingY)

    return { width, height }
  }

  // Separate locked and unlocked nodes.
  //
  // Tradeoff: ELK's `layered` algorithm does not support pinning individual
  // nodes in place. The alternative (`elk.fixed`) requires pre-specified
  // positions for all nodes and does not do hierarchical routing.  We therefore
  // lay out only the unlocked subgraph, then return locked nodes at their
  // original positions.  This means unlocked nodes are positioned relative to
  // each other, not relative to any locked anchors.  For the typical use case
  // (re-layout after draft insertion, where no nodes are locked) this is
  // correct.  For edit-after-lock workflows the result may be spatially
  // disconnected from locked nodes; that is an accepted tradeoff until ELK
  // adds first-class fixed-node support in the layered algorithm.
  const unlocked = preserveLocked
    ? nodes.filter(n => (n.data as any)?.locked !== true)
    : nodes

  if (unlocked.length === 0) {
    return { nodes, edges }
  }

  // P1 Polish: Lazy-load ELK only when needed (code-splitting)
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default
  const elk = new ELK()

  // Convert to ELK format
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(effectiveNodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(effectiveLayerSpacing),
      // Minimise edge crossings between layers
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      // Compact, balanced placement of nodes within each layer
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      // Preserve insertion order where layout is otherwise equivalent,
      // giving predictable and stable results across re-layouts
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // Edge clearance: prevent edges running too close to nodes or each other
      'elk.spacing.edgeNode': '40',
      'elk.spacing.edgeEdge': '20',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
    },
    children: unlocked.map(node => {
      const { width, height } = getNodeDimensions(node)
      return {
        id: node.id,
        width,
        height,
      }
    }),
    edges: edges
      .filter(e =>
        unlocked.some(n => n.id === e.source) &&
        unlocked.some(n => n.id === e.target)
      )
      .map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      } as ElkExtendedEdge)),
  }

  // Run layout
  const layout = await elk.layout(elkGraph)

  // Map positions back to nodes
  const positionMap = new Map<string, { x: number; y: number }>()
  layout.children?.forEach(child => {
    if (child.x !== undefined && child.y !== undefined) {
      positionMap.set(child.id, { x: child.x, y: child.y })
    }
  })

  // Adaptive scaling: if the laid-out graph is much smaller than the available
  // canvas, scale positions outward from the graph centre so the graph fills
  // the space rather than clustering in a tight ball.  Large graphs are left
  // alone — fitView zoom handles those.
  applyAdaptiveScale(positionMap)

  // Update unlocked nodes with new positions
  const updatedNodes = nodes.map(node => {
    const newPos = positionMap.get(node.id)
    if (newPos && !((node.data as any)?.locked === true)) {
      return {
        ...node,
        position: newPos,
      }
    }
    return node
  })

  return { nodes: updatedNodes, edges }
}

/**
 * If the ELK-computed graph bounding box is much smaller than the available
 * canvas (< 60% in both axes), scale all positions outward from the graph
 * centre so the graph makes better use of available space.
 *
 * Scale is capped at 2× to avoid absurd spacing on very small graphs.
 * Skipped for single-node graphs (nothing to spread).
 */
function applyAdaptiveScale(
  positionMap: Map<string, { x: number; y: number }>
): void {
  if (positionMap.size < 2) return

  const positions = Array.from(positionMap.values())

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of positions) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const graphW = maxX - minX
  const graphH = maxY - minY

  // Effective canvas area after fitView padding is subtracted
  const effectiveW = CANVAS_WIDTH * (1 - FIT_VIEW_PADDING * 2)
  const effectiveH = CANVAS_HEIGHT * (1 - FIT_VIEW_PADDING * 2)

  // Only scale up when the graph is meaningfully smaller than the canvas in
  // both dimensions simultaneously.  If it's already wide or already tall,
  // the overall layout is fine and fitView zoom handles the rest.
  if (graphW >= effectiveW * 0.6 || graphH >= effectiveH * 0.6) return

  const scaleX = graphW > 0 ? (effectiveW * 0.8) / graphW : 1
  const scaleY = graphH > 0 ? (effectiveH * 0.8) / graphH : 1

  // Use the smaller scale so both axes stay proportional and neither exceeds
  // the canvas. Cap at 2× to prevent absurd spacing on 2–3 node graphs.
  const scale = Math.min(scaleX, scaleY, 2.0)
  if (scale <= 1.05) return // skip trivial no-op adjustments

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  for (const [id, pos] of positionMap) {
    positionMap.set(id, {
      x: cx + (pos.x - cx) * scale,
      y: cy + (pos.y - cy) * scale,
    })
  }
}
