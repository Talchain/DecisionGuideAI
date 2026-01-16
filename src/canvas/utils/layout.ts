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

export async function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const {
    direction = 'DOWN',
    spacing = 50,
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
      : { width: 180, height: 80 }

    const rawWidth = measured?.width ?? node.width ?? defaultSize.width
    const rawHeight = measured?.height ?? node.height ?? defaultSize.height

    const width = Math.max(40, Math.round(rawWidth) + sizePaddingX)
    const height = Math.max(40, Math.round(rawHeight) + sizePaddingY)

    return { width, height }
  }

  // Separate locked and unlocked nodes
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
