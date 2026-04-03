// P1 Polish: Dynamic ELK import for code-splitting (Task F)
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'
import { Node, Edge } from '@xyflow/react'
import { NODE_REGISTRY } from '../domain/nodes'

// Node types mapped to semantic tiers (0 = top in DOWN layout).
// Nodes whose type is not in this map are placed in tier 2 (factor tier).
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

// Node width constraints for viewport-constrained sizing.
const MIN_NODE_W = 140  // BaseNode minWidth
const MAX_NODE_W = 260  // NODE_REGISTRY maximum — wider to reduce text wrapping on intervention chips
const MIN_GAP    = 50   // Minimum horizontal gap between nodes in same tier

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

  const sizePaddingX = 24
  const sizePaddingY = 16

  // ---------------------------------------------------------------------------
  // Step 1 — Separate locked and unlocked nodes
  // ---------------------------------------------------------------------------
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
    return { nodes, edges, layoutNodeWidth: MAX_NODE_W }
  }

  // ---------------------------------------------------------------------------
  // Step 2 — Assign nodes to tiers and compute per-tier node widths
  // ---------------------------------------------------------------------------
  const tierOf = (node: Node): number => {
    const kind = (node.type ?? (node.data as any)?.kind) as string | undefined
    return kind !== undefined && TIER_BY_KIND[kind] !== undefined
      ? TIER_BY_KIND[kind]
      : 2 // default to factor tier
  }

  // Count nodes per tier (only unlocked nodes participate in layout)
  const tierCounts = new Map<number, number>()
  for (const node of unlocked) {
    const t = tierOf(node)
    tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1)
  }

  // Available width = canvas width minus 15% breathing room for fitView padding
  // and visual margins. This matches the brief's 85% factor.
  const availableWidth = canvasSize.width * 0.85

  const isDownLayout = direction === 'DOWN'

  // Per-tier ELK box width: each tier gets its own width based on its node count.
  // tierElkBoxW maps tier number → elkBoxW (content + padding) for that tier.
  // tierNeedsMultiRow maps tier number → nodesPerRow (or null if no split needed).
  const tierElkBoxW = new Map<number, number>()
  const tierNeedsMultiRow = new Map<number, number | null>()

  const effectiveGap = Math.max(MIN_GAP, effectiveNodeSpacing)

  const computeTierWidth = (count: number): { elkBoxW: number; nodesPerRow: number | null } => {
    if (!isDownLayout || count <= 1) {
      return {
        elkBoxW: MAX_NODE_W + sizePaddingX,
        nodesPerRow: null,
      }
    }
    const unclamped = Math.floor((availableWidth - (count - 1) * effectiveGap) / count)
    if (unclamped >= MIN_NODE_W + sizePaddingX) {
      return {
        elkBoxW: Math.min(MAX_NODE_W + sizePaddingX, unclamped),
        nodesPerRow: null,
      }
    }
    // Too many nodes: clamp to MIN_NODE_W and use multi-row splitting
    const boxW = MIN_NODE_W + sizePaddingX
    const npr = Math.max(1, Math.floor((availableWidth + effectiveGap) / (boxW + effectiveGap)))
    return { elkBoxW: boxW, nodesPerRow: npr }
  }

  for (const [tier, count] of tierCounts) {
    const { elkBoxW: tw, nodesPerRow: npr } = computeTierWidth(count)
    tierElkBoxW.set(tier, tw)
    tierNeedsMultiRow.set(tier, npr)
  }

  // Global gap: ELK applies a single node-to-node spacing globally.
  // Matches effectiveGap used in tier width computation.
  const gap = effectiveGap

  // Content width returned to callers — use the median tier width for the
  // layoutNodeWidth hint (individual nodes get their tier-specific width).
  const allTierWidths = [...tierElkBoxW.values()].sort((a, b) => a - b)
  const nodeW = allTierWidths[Math.floor(allTierWidths.length / 2)] - sizePaddingX

  // ---------------------------------------------------------------------------
  // Step 3 — Run ELK with uniform node width
  // ---------------------------------------------------------------------------
  const getNodeDimensions = (node: Node): { width: number; height: number } => {
    const measured = (node as any).measured as { width?: number; height?: number } | undefined

    const fallbackType = (node.type ?? (node.data as any)?.kind) as keyof typeof NODE_REGISTRY | undefined
    const defaultSize = fallbackType && NODE_REGISTRY[fallbackType]
      ? NODE_REGISTRY[fallbackType].defaultSize
      : { width: 220, height: 100 }

    // Use per-tier elkBoxW so each tier sizes to its own node count.
    const tier = tierOf(node)
    const tierW = tierElkBoxW.get(tier) ?? (MAX_NODE_W + sizePaddingX)

    const rawHeight = measured?.height ?? node.height ?? defaultSize.height
    const height = Math.max(40, Math.round(rawHeight) + sizePaddingY)

    return { width: tierW, height }
  }

  // P1 Polish: Lazy-load ELK only when needed (code-splitting)
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default
  const elk = new ELK()

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      // Use the solved gap directly (not max with effectiveNodeSpacing) so the
      // constraint solve and ELK's actual spacing are consistent.
      'elk.spacing.nodeNode': String(gap),
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
      return { id: node.id, width, height }
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
  // Step 4 — Map ELK positions back; apply multi-row splitting if needed
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

  // Apply multi-row splitting for any tier that needs it
  const tierAssignments = new Map<number, string[]>()
  for (const node of unlocked) {
    const t = tierOf(node)
    if (!tierAssignments.has(t)) tierAssignments.set(t, [])
    tierAssignments.get(t)!.push(node.id)
  }

  const anyTierNeedsSplit = [...tierNeedsMultiRow.values()].some(v => v !== null)
  if (anyTierNeedsSplit) {
    applyTierRowSplitting(
      positionMap,
      sizeMap,
      tierAssignments,
      tierNeedsMultiRow,
      tierElkBoxW,
      gap,
      effectiveLayerSpacing
    )
  }

  // ---------------------------------------------------------------------------
  // Step 5 — Parent-centring post-processing pass
  // ---------------------------------------------------------------------------
  // After ELK computes positions, nudge each node toward the centroid of its
  // parent nodes (in the tier above). This corrects left-clustering of shared
  // factors and improves visual balance. Applied iteratively with damping.
  if (isDownLayout) {
    // Build adjacency: for each node, which nodes in the tier above connect to it?
    const parentsByNode = new Map<string, string[]>()
    const nodeIdToTier = new Map<string, number>()
    for (const node of unlocked) {
      nodeIdToTier.set(node.id, tierOf(node))
    }
    for (const edge of edges) {
      const srcTier = nodeIdToTier.get(edge.source)
      const tgtTier = nodeIdToTier.get(edge.target)
      if (srcTier !== undefined && tgtTier !== undefined && tgtTier > srcTier) {
        if (!parentsByNode.has(edge.target)) parentsByNode.set(edge.target, [])
        parentsByNode.get(edge.target)!.push(edge.source)
      }
    }

    const DAMPING = 0.5
    const MAX_PASSES = 3

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let anyNudge = false

      // Process tiers in order (skip tiers 0 and 1 — decision/options are well-placed
      // by ELK and nudging them causes cascading compaction).
      const sortedTiers = Array.from(tierAssignments.keys()).sort((a, b) => a - b)
      for (const tier of sortedTiers) {
        if (tier <= 1) continue
        const nodeIds = tierAssignments.get(tier)
        if (!nodeIds) continue

        // Nudge each node toward its parent centroid (most beneficial for shared
        // factors connected to multiple option nodes).
        for (const nodeId of nodeIds) {
          const parents = parentsByNode.get(nodeId)
          if (!parents || parents.length === 0) continue

          const parentCentres = parents
            .map(pid => {
              const px = positionMap.get(pid)?.x
              if (px === undefined) return undefined
              const pw = sizeMap.get(pid)?.width ?? (tierElkBoxW.get(nodeIdToTier.get(pid) ?? 0) ?? MAX_NODE_W + sizePaddingX)
              return px + pw / 2
            })
            .filter((cx): cx is number => cx !== undefined)
          if (parentCentres.length === 0) continue

          const parentCentreCentroid = parentCentres.reduce((a, b) => a + b, 0) / parentCentres.length
          const pos = positionMap.get(nodeId)
          if (!pos) continue

          const nodeElkW = sizeMap.get(nodeId)?.width ?? (tierElkBoxW.get(tier) ?? MAX_NODE_W + sizePaddingX)
          const nodeCentreX = pos.x + nodeElkW / 2
          const deviation = parentCentreCentroid - nodeCentreX

          if (Math.abs(deviation) > gap) {
            const nudge = deviation * DAMPING
            positionMap.set(nodeId, { x: pos.x + nudge, y: pos.y })
            anyNudge = true
          }
        }

        // Collision resolution within the tier (per visual row): push apart
        // overlapping nodes. Group by Y so multi-row tiers are handled correctly.
        const rowGroups = new Map<number, string[]>()
        for (const id of nodeIds) {
          const y = Math.round(positionMap.get(id)?.y ?? 0)
          if (!rowGroups.has(y)) rowGroups.set(y, [])
          rowGroups.get(y)!.push(id)
        }

        for (const rowNodeIds of rowGroups.values()) {
          if (rowNodeIds.length < 2) continue
          for (let subPass = 0; subPass < 5; subPass++) {
            let anyCollision = false
            const tierNodeIds = [...rowNodeIds].sort((a, b) => {
              const ax = positionMap.get(a)?.x ?? 0
              const bx = positionMap.get(b)?.x ?? 0
              return ax - bx
            })

            for (let i = 0; i < tierNodeIds.length - 1; i++) {
              const aId = tierNodeIds[i]
              const bId = tierNodeIds[i + 1]
              const aPos = positionMap.get(aId)
              const bPos = positionMap.get(bId)
              if (!aPos || !bPos) continue

              const aW = sizeMap.get(aId)?.width ?? (tierElkBoxW.get(tier) ?? MAX_NODE_W + sizePaddingX)
              const minDist = aW + gap
              const actualDist = bPos.x - aPos.x

              if (actualDist < minDist) {
                const overlap = minDist - actualDist
                const halfPush = overlap / 2
                positionMap.set(aId, { x: aPos.x - halfPush, y: aPos.y })
                positionMap.set(bId, { x: bPos.x + halfPush, y: bPos.y })
                anyCollision = true
              }
            }
            if (!anyCollision) break
          }
        }
      }

      if (!anyNudge) break
    }

    // Final collision resolution pass across all tiers — guarantees no overlaps
    // remain after all nudging is complete. Group nodes by Y-row so that
    // multi-row tiers only resolve collisions within the same visual row.
    const finalSortedTiers = Array.from(tierAssignments.keys()).sort((a, b) => a - b)
    for (const tier of finalSortedTiers) {
      const nodeIds = tierAssignments.get(tier)
      if (!nodeIds || nodeIds.length < 2) continue

      // Group nodes by Y position (same visual row)
      const rowGroups = new Map<number, string[]>()
      for (const id of nodeIds) {
        const y = Math.round(positionMap.get(id)?.y ?? 0)
        if (!rowGroups.has(y)) rowGroups.set(y, [])
        rowGroups.get(y)!.push(id)
      }

      for (const rowNodeIds of rowGroups.values()) {
        if (rowNodeIds.length < 2) continue

        for (let subPass = 0; subPass < 10; subPass++) {
          let anyCollision = false
          const sorted = [...rowNodeIds].sort((a, b) => {
            const ax = positionMap.get(a)?.x ?? 0
            const bx = positionMap.get(b)?.x ?? 0
            return ax - bx
          })

          for (let i = 0; i < sorted.length - 1; i++) {
            const aId = sorted[i]
            const bId = sorted[i + 1]
            const aPos = positionMap.get(aId)
            const bPos = positionMap.get(bId)
            if (!aPos || !bPos) continue

            const aW = sizeMap.get(aId)?.width ?? (tierElkBoxW.get(tier) ?? MAX_NODE_W + sizePaddingX)
            const minDist = aW + gap
            const actualDist = bPos.x - aPos.x

            if (actualDist < minDist) {
              const overlap = minDist - actualDist
              const halfPush = overlap / 2
              positionMap.set(aId, { x: aPos.x - halfPush, y: aPos.y })
              positionMap.set(bId, { x: bPos.x + halfPush, y: bPos.y })
              anyCollision = true
            }
          }
          if (!anyCollision) break
        }
      }
    }
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

  return { nodes: updatedNodes, edges, layoutNodeWidth: nodeW }
}

// ---------------------------------------------------------------------------
// Multi-row tier splitting
// ---------------------------------------------------------------------------
// After ELK places nodes in a single wide row per tier, reposition tiers that
// need multi-row splitting into sub-rows.  Each tier has its own nodesPerRow
// threshold based on its per-tier width.  ELK's crossing-minimisation order
// is preserved (nodes sorted by ELK x-position before splitting).
// Lower tiers are pushed down to prevent overlap with the expanded tier.
function applyTierRowSplitting(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  tierAssignments: Map<number, string[]>,
  tierNodesPerRow: Map<number, number | null>,
  tierElkBoxW: Map<number, number>,
  gap: number,
  layerSpacing: number
): void {
  // Sub-row vertical spacing: tighter than between-tier spacing
  const subRowSpacing = Math.round(layerSpacing * 0.6)

  // Process tiers in order so that Y-offset accumulation is correct
  const sortedTiers = Array.from(tierAssignments.keys()).sort((a, b) => a - b)

  // Track extra Y added to each tier's base so lower tiers are pushed down
  // when upper tiers expand into multiple rows.
  let cumulativeExtraY = 0

  for (const tier of sortedTiers) {
    const nodeIds = tierAssignments.get(tier)!
    const nodesPerRow = tierNodesPerRow.get(tier) ?? null

    // Apply any accumulated Y shift from expanded tiers above
    if (cumulativeExtraY > 0) {
      for (const id of nodeIds) {
        const p = positionMap.get(id)
        if (p) positionMap.set(id, { x: p.x, y: p.y + cumulativeExtraY })
      }
    }

    // Only split tiers that have a multi-row threshold and exceed it
    if (nodesPerRow === null || nodeIds.length <= nodesPerRow) continue

    // Sort by ELK x-position to preserve crossing-minimisation order
    const sorted = [...nodeIds].sort((a, b) => {
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      return ax - bx
    })

    // Build rows: use the computed nodesPerRow that fits within availableWidth
    const rows: string[][] = []
    for (let i = 0; i < sorted.length; i += nodesPerRow) {
      rows.push(sorted.slice(i, i + nodesPerRow))
    }

    // Base Y for this tier (already shifted by cumulativeExtraY above)
    const baseY = positionMap.get(sorted[0])?.y ?? 0
    // Node height from first node's size
    const nodeH = sizeMap.get(sorted[0])?.height ?? 116

    // ELK box width for this tier
    const elkW = tierElkBoxW.get(tier) ?? (sizeMap.get(sorted[0])?.width ?? 220)

    // Reposition each node into its row, centred horizontally
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const rowWidth = row.length * elkW + (row.length - 1) * gap
      const startX = -(rowWidth / 2)
      const rowY = baseY + r * (nodeH + subRowSpacing)

      for (let i = 0; i < row.length; i++) {
        positionMap.set(row[i], {
          x: startX + i * (elkW + gap),
          y: rowY,
        })
      }
    }

    // Extra height added by this tier's row expansion
    const extraH = (rows.length - 1) * (nodeH + subRowSpacing)
    cumulativeExtraY += extraH
  }
}
