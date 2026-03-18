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
    spacing = 60,
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

  // Map positions and sizes back from ELK output.
  // ELK returns width/height on each child — use them so the adaptive scale
  // step can measure the true footprint rather than just origin-to-origin.
  const positionMap = new Map<string, { x: number; y: number }>()
  const sizeMap = new Map<string, { width: number; height: number }>()
  layout.children?.forEach(child => {
    if (child.x !== undefined && child.y !== undefined) {
      positionMap.set(child.id, { x: child.x, y: child.y })
    }
    if (child.width !== undefined && child.height !== undefined) {
      sizeMap.set(child.id, { width: child.width, height: child.height })
    }
  })

  // Adaptive scaling: if the laid-out graph is much smaller than the available
  // canvas, scale positions outward from the graph centre so the graph fills
  // the space rather than clustering in a tight ball.  Large graphs are left
  // alone — fitView zoom handles those.
  applyAdaptiveScale(positionMap, sizeMap)

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
 * If the ELK-computed graph footprint is much smaller than the available
 * canvas (< 40% in both axes), scale all positions outward from the graph
 * centre so genuinely tiny graphs make better use of available space.
 *
 * Bounds are computed from node origins + their rendered widths/heights so
 * the true footprint is measured rather than just origin-to-origin distance.
 *
 * Scale is capped at 1.5× to avoid over-expanding graphs that ELK already
 * spaced sensibly. Skipped for single-node graphs (nothing to spread).
 *
 * Degenerate axes (graphW or graphH ≈ 0, e.g. a pure vertical chain) are
 * handled independently — a near-zero axis does not block valid expansion on
 * the other axis.
 */
function applyAdaptiveScale(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>
): void {
  if (positionMap.size < 2) return

  // Measure true footprint: origin to far edge (origin + node dimensions).
  // Also track origin-only bounds separately — the scale pivot (centroid) is
  // computed from node origins so that equal-sized nodes scale symmetrically.
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let originMinX = Infinity, originMaxX = -Infinity
  let originMinY = Infinity, originMaxY = -Infinity
  for (const [id, pos] of positionMap) {
    const size = sizeMap.get(id) ?? { width: 0, height: 0 }
    if (pos.x < originMinX) originMinX = pos.x
    if (pos.x > originMaxX) originMaxX = pos.x
    if (pos.y < originMinY) originMinY = pos.y
    if (pos.y > originMaxY) originMaxY = pos.y
    if (pos.x < minX) minX = pos.x
    if (pos.x + size.width > maxX) maxX = pos.x + size.width
    if (pos.y < minY) minY = pos.y
    if (pos.y + size.height > maxY) maxY = pos.y + size.height
  }

  const graphW = maxX - minX
  const graphH = maxY - minY

  // Effective canvas area after fitView padding is subtracted
  const effectiveW = CANVAS_WIDTH * (1 - FIT_VIEW_PADDING * 2)
  const effectiveH = CANVAS_HEIGHT * (1 - FIT_VIEW_PADDING * 2)

  // Only scale up for genuinely tiny graphs (< 40% of canvas in both axes).
  // Graphs that already span 40%+ in either dimension are left at ELK's native
  // spacing — fitView zoom handles fitting them into the viewport.
  if (graphW >= effectiveW * 0.4 || graphH >= effectiveH * 0.4) return

  // Compute per-axis scale toward 60% fill. Degenerate axes (≤ 1px, e.g. a
  // pure vertical chain where all nodes share the same x) contribute 1.0 so
  // they don't block the other axis from scaling.
  const scaleX = graphW > 1 ? (effectiveW * 0.6) / graphW : 1
  const scaleY = graphH > 1 ? (effectiveH * 0.6) / graphH : 1

  // Use the smaller scale so both axes stay proportional and neither exceeds
  // the canvas. Cap at 1.5× to avoid over-expanding graphs with good spacing.
  const scale = Math.min(scaleX, scaleY, 1.5)
  if (scale <= 1.05) return // skip trivial no-op adjustments

  // Pivot around origin centroid (not footprint centroid) so equal-sized nodes
  // scale symmetrically regardless of their individual widths/heights.
  const cx = (originMinX + originMaxX) / 2
  const cy = (originMinY + originMaxY) / 2

  for (const [id, pos] of positionMap) {
    positionMap.set(id, {
      x: cx + (pos.x - cx) * scale,
      y: cy + (pos.y - cy) * scale,
    })
  }
}
