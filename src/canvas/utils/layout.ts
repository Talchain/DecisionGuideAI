import ELK, { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'
import { Node, Edge } from '@xyflow/react'

const elk = new ELK()

interface LayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'
  spacing?: number
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
    preserveLocked = true
  } = options

  // Separate locked and unlocked nodes
  const lockedNodes = preserveLocked
    ? nodes.filter(n => (n.data as any)?.locked === true)
    : []
  const unlocked = preserveLocked
    ? nodes.filter(n => (n.data as any)?.locked !== true)
    : nodes

  if (unlocked.length === 0) {
    return { nodes, edges }
  }

  // Convert to ELK format
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(spacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.5),
    },
    children: unlocked.map(node => ({
      id: node.id,
      width: 150,
      height: 80,
    })),
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
