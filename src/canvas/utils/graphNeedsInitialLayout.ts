import type { Node, Edge } from '@xyflow/react'

/**
 * Maximum absolute x or y spread (px) below which a set of unlocked nodes
 * is treated as stacked. Exported so tests and future tuning can read it
 * without duplicating the constant. Three abutting laid-out nodes span
 * hundreds of px (node widths are ~200 px), so 40 is well below any real
 * layout while still detecting visually overlapped origins.
 */
export const STACKED_SPREAD_PX = 40

function isLocked(node: Node): boolean {
  return (node.data as Record<string, unknown> | undefined)?.locked === true
}

function coord(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value
}

export function graphNeedsInitialLayout(nodes: Node[]): boolean {
  const unlocked = nodes.filter((n) => !isLocked(n))
  if (unlocked.length <= 1) return false

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const node of unlocked) {
    const x = coord((node.position as { x?: unknown } | undefined)?.x)
    const y = coord((node.position as { y?: unknown } | undefined)?.y)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const xSpread = maxX - minX
  const ySpread = maxY - minY
  return xSpread < STACKED_SPREAD_PX && ySpread < STACKED_SPREAD_PX
}

function edgeIdentity(edge: Edge): string {
  if (typeof edge.id === 'string' && edge.id.length > 0) return edge.id
  const source = edge.source ?? (edge as { from?: string }).from ?? ''
  const target = edge.target ?? (edge as { to?: string }).to ?? ''
  // Include source/target handles so parallel edges between the same two
  // nodes (via different ports / handles) produce distinct identities.
  const sourceHandle = edge.sourceHandle ?? ''
  const targetHandle = edge.targetHandle ?? ''
  return `${source}:${sourceHandle}->${target}:${targetHandle}`
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash.toString(16)
}

function structuralHash(nodes: Node[], edges: Edge[]): string {
  // JSON.stringify produces a delimiter-safe encoding: array brackets and
  // quoted strings cannot be confused with id content even if an id were
  // ever to contain a comma or pipe.
  const nodeIds = nodes.map((n) => n.id).sort()
  const edgeIds = edges.map(edgeIdentity).sort()
  return fnv1a32(JSON.stringify([nodeIds, edgeIds]))
}

export function getGraphIdentityKey(
  scenarioId: string | null | undefined,
  nodes: Node[],
  edges: Edge[],
): string {
  const hash = structuralHash(nodes, edges)
  if (typeof scenarioId === 'string' && scenarioId.length > 0) {
    return `scenario:${scenarioId}:${hash}`
  }
  return `draft:${hash}`
}
