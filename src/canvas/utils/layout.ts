// P1 Polish: Dynamic ELK import for code-splitting (Task F)
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'
import { Node, Edge } from '@xyflow/react'
import { NODE_REGISTRY } from '../domain/nodes'

// Node types mapped to semantic tiers (0 = top in DOWN layout).
// Nodes whose type is not in this map are placed in tier 2 (factor tier).
// Used as ELK partition indices so ELK enforces tier ordering natively.
export const TIER_BY_KIND: Record<string, number> = {
  decision: 0,
  option:   1,
  factor:   2,
  action:   2,
  constraint: 2,
  outcome:  3,
  risk:     4,
  goal:     5,
}

export interface CanvasSize {
  width: number
  height: number
}

// Fallback canvas size (1440×900 viewport minus fixed chrome).
// Used when the caller does not supply actual runtime dimensions.
const FALLBACK_CANVAS: CanvasSize = { width: 1300, height: 750 }

// Per-node-type DOM maxWidth (must match the maxWidth prop each component
// passes to BaseNode). This is the single source of truth for node width —
// ELK receives these so its positions match what the DOM renders.
const DOM_MAX_WIDTH: Record<string, number> = {
  decision: 320, goal: 300, option: 240, risk: 240,
  outcome: 220, factor: 200, action: 200, constraint: 200,
}

const MIN_GAP    = 30   // Minimum horizontal gap between nodes in same tier
const sizePaddingX = 24
const sizePaddingY = 16

interface LayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'
  spacing?: number
  layerSpacing?: number
  preserveLocked?: boolean
}

export async function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
  canvasSize: CanvasSize = FALLBACK_CANVAS
): Promise<{ nodes: Node[]; edges: Edge[]; layoutNodeWidth: number }> {
  const {
    direction = 'DOWN',
    spacing = 60,
    layerSpacing,
    preserveLocked = true
  } = options

  const effectiveNodeSpacing = Math.max(20, spacing)
  const effectiveLayerSpacing = Math.max(30, layerSpacing ?? spacing * 1.5)

  // ---------------------------------------------------------------------------
  // Step 1 — Separate locked and unlocked nodes
  // ---------------------------------------------------------------------------
  const unlocked = preserveLocked
    ? nodes.filter(n => (n.data as any)?.locked !== true)
    : nodes

  if (unlocked.length === 0) {
    return { nodes, edges, layoutNodeWidth: 200 }
  }

  // ---------------------------------------------------------------------------
  // Step 2 — Compute available width (panel-aware)
  // ---------------------------------------------------------------------------
  // The OutputsDock is position:fixed (overlays the canvas, not a flex-sibling),
  // so .react-flow's width does not exclude it — we subtract it here.
  // No breathing factor: fitView(padding: 0.2) handles visual margins.
  const panelEl = typeof document !== 'undefined'
    ? document.querySelector('[data-testid="outputs-dock"]') as HTMLElement | null
    : null
  const panelWidth = panelEl?.getBoundingClientRect().width ?? 0
  const availableWidth = Math.max(0, canvasSize.width - panelWidth)

  const isDownLayout = direction === 'DOWN'

  // ---------------------------------------------------------------------------
  // Step 3 — Determine per-node ELK width from DOM maxWidth
  // ---------------------------------------------------------------------------
  const tierOf = (node: Node): number => {
    const kind = (node.type ?? (node.data as any)?.kind) as string | undefined
    return kind !== undefined && TIER_BY_KIND[kind] !== undefined
      ? TIER_BY_KIND[kind]
      : 2
  }

  const getNodeElkWidth = (node: Node): number => {
    const kind = (node.type ?? (node.data as any)?.kind) as string | undefined
    const domMax = DOM_MAX_WIDTH[kind ?? ''] ?? 200
    return domMax + sizePaddingX
  }

  const getNodeDimensions = (node: Node): { width: number; height: number } => {
    const measured = (node as any).measured as { width?: number; height?: number } | undefined
    const fallbackType = (node.type ?? (node.data as any)?.kind) as keyof typeof NODE_REGISTRY | undefined
    const defaultSize = fallbackType && NODE_REGISTRY[fallbackType]
      ? NODE_REGISTRY[fallbackType].defaultSize
      : { width: 220, height: 100 }

    const width = getNodeElkWidth(node)
    const rawHeight = measured?.height ?? node.height ?? defaultSize.height
    const height = Math.max(40, Math.round(rawHeight) + sizePaddingY)

    return { width, height }
  }

  // Compute multi-row threshold per tier based on the widest node in that tier
  const tierMaxElkW = new Map<number, number>()
  const tierCounts = new Map<number, number>()
  for (const node of unlocked) {
    const t = tierOf(node)
    tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1)
    const w = getNodeElkWidth(node)
    tierMaxElkW.set(t, Math.max(tierMaxElkW.get(t) ?? 0, w))
  }

  // Determine which tiers need multi-row splitting
  const gap = Math.max(MIN_GAP, effectiveNodeSpacing)
  const tierNodesPerRow = new Map<number, number | null>()
  for (const [tier, count] of tierCounts) {
    const maxW = tierMaxElkW.get(tier) ?? 224
    const fitsInRow = count * maxW + (count - 1) * gap <= availableWidth
    if (fitsInRow || !isDownLayout) {
      tierNodesPerRow.set(tier, null)
    } else {
      const npr = Math.max(1, Math.floor((availableWidth + gap) / (maxW + gap)))
      tierNodesPerRow.set(tier, npr)
    }
  }

  // Median DOM width for the layoutNodeWidth hint returned to callers
  const allDomWidths = unlocked.map(n => {
    const kind = (n.type ?? (n.data as any)?.kind) as string | undefined
    return DOM_MAX_WIDTH[kind ?? ''] ?? 200
  }).sort((a, b) => a - b)
  const layoutNodeWidth = allDomWidths[Math.floor(allDomWidths.length / 2)]

  // ---------------------------------------------------------------------------
  // Step 4 — Run ELK with partition constraints for tier ordering
  // ---------------------------------------------------------------------------
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default
  const elk = new ELK()

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(gap),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(effectiveLayerSpacing),
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.spacing.edgeNode': '40',
      'elk.spacing.edgeEdge': '20',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
      // Partition mode: enforce tier ordering so ELK respects TIER_BY_KIND
      'elk.partitioning.activate': 'true',
    },
    children: unlocked.map(node => {
      const { width, height } = getNodeDimensions(node)
      const tier = tierOf(node)
      return {
        id: node.id,
        width,
        height,
        layoutOptions: {
          'elk.partitioning.partition': String(tier),
        },
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

  const layout = await elk.layout(elkGraph)

  // ---------------------------------------------------------------------------
  // Step 5 — Map ELK positions back; apply multi-row splitting if needed
  // ---------------------------------------------------------------------------
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

  // Multi-row splitting for tiers that exceed available width
  const anyNeedsSplit = [...tierNodesPerRow.values()].some(v => v !== null)
  if (anyNeedsSplit) {
    const tierAssignments = new Map<number, string[]>()
    for (const node of unlocked) {
      const t = tierOf(node)
      if (!tierAssignments.has(t)) tierAssignments.set(t, [])
      tierAssignments.get(t)!.push(node.id)
    }
    applyTierRowSplitting(
      positionMap,
      sizeMap,
      tierAssignments,
      tierNodesPerRow,
      tierMaxElkW,
      gap,
      effectiveLayerSpacing
    )
  }

  // ---------------------------------------------------------------------------
  // Step 6 — Apply positions to nodes
  // ---------------------------------------------------------------------------
  const updatedNodes = nodes.map(node => {
    const newPos = positionMap.get(node.id)
    if (newPos && !((node.data as any)?.locked === true)) {
      return { ...node, position: newPos }
    }
    return node
  })

  return { nodes: updatedNodes, edges, layoutNodeWidth }
}

// ---------------------------------------------------------------------------
// Multi-row tier splitting
// ---------------------------------------------------------------------------
function applyTierRowSplitting(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  tierAssignments: Map<number, string[]>,
  tierNodesPerRow: Map<number, number | null>,
  tierMaxElkW: Map<number, number>,
  gap: number,
  layerSpacing: number
): void {
  // Sub-row spacing must be at least as large as the inter-node gap so that
  // overlap checks (which use gap/2 margin) don't flag sub-rows as overlapping.
  const subRowSpacing = Math.max(gap, Math.round(layerSpacing * 0.6))
  const sortedTiers = Array.from(tierAssignments.keys()).sort((a, b) => a - b)
  let cumulativeExtraY = 0

  for (const tier of sortedTiers) {
    const nodeIds = tierAssignments.get(tier)!
    const nodesPerRow = tierNodesPerRow.get(tier) ?? null

    if (cumulativeExtraY > 0) {
      for (const id of nodeIds) {
        const p = positionMap.get(id)
        if (p) positionMap.set(id, { x: p.x, y: p.y + cumulativeExtraY })
      }
    }

    if (nodesPerRow === null || nodeIds.length <= nodesPerRow) continue

    const sorted = [...nodeIds].sort((a, b) => {
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      return ax - bx
    })

    const rows: string[][] = []
    for (let i = 0; i < sorted.length; i += nodesPerRow) {
      rows.push(sorted.slice(i, i + nodesPerRow))
    }

    const baseY = positionMap.get(sorted[0])?.y ?? 0
    const nodeH = sizeMap.get(sorted[0])?.height ?? 116
    const elkW = tierMaxElkW.get(tier) ?? (sizeMap.get(sorted[0])?.width ?? 224)

    // Centre rows on the tier's ELK centroid
    const tierCentroidX = sorted.reduce((sum, id) => {
      const p = positionMap.get(id)
      const w = sizeMap.get(id)?.width ?? elkW
      return sum + (p?.x ?? 0) + w / 2
    }, 0) / sorted.length

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const rowWidth = row.length * elkW + (row.length - 1) * gap
      const startX = tierCentroidX - rowWidth / 2
      const rowY = baseY + r * (nodeH + subRowSpacing)

      for (let i = 0; i < row.length; i++) {
        positionMap.set(row[i], {
          x: startX + i * (elkW + gap),
          y: rowY,
        })
      }
    }

    const extraH = (rows.length - 1) * (nodeH + subRowSpacing)
    cumulativeExtraY += extraH
  }
}
