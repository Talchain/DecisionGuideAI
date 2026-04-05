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
const MIN_GAP    = 30   // Minimum horizontal gap between nodes in same tier

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
  // Step 2 — Assign nodes to tiers and compute viewport-constrained node width
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
  const maxTierCount = Math.max(...tierCounts.values())

  // Available width = (canvas − panel overlay) × 0.85 breathing room for fitView.
  // The OutputsDock is position:fixed (overlays the canvas), so canvasSize.width
  // does not exclude it. We subtract it here, then apply the 85% factor.
  const panelEl = typeof document !== 'undefined'
    ? document.querySelector('[data-testid="outputs-dock"]') as HTMLElement | null
    : null
  const panelWidth = panelEl?.getBoundingClientRect().width ?? 0
  const availableWidth = Math.max(0, (canvasSize.width - panelWidth) * 0.85)

  // Solve for ELK box width (content + padding) and gap so the widest tier fits.
  //
  // ELK receives elkBoxW = nodeW + sizePaddingX per node.
  // ELK places N nodes with gap spacing between them:
  //   N * elkBoxW + (N-1) * gap <= availableWidth
  //   elkBoxW = (availableWidth - (N-1) * MIN_GAP) / N
  //
  // We solve for elkBoxW directly so the actual ELK footprint matches the budget.
  // nodeW (content width exposed to callers) = elkBoxW - sizePaddingX.
  //
  // When direction != DOWN the widest-tier constraint applies to the X axis for
  // DOWN layouts only.  For other directions we skip the constraint and use
  // the default spacing.  Multi-row splitting is also DOWN-only (see below).
  const isDownLayout = direction === 'DOWN'

  let elkBoxW: number
  let gap: number
  let nodesPerRow: number | null = null

  if (isDownLayout && maxTierCount > 1) {
    const unclampedElkBoxW = Math.floor((availableWidth - (maxTierCount - 1) * MIN_GAP) / maxTierCount)

    if (unclampedElkBoxW >= MIN_NODE_W + sizePaddingX) {
      // Normal case: all nodes fit in one row at the computed width
      elkBoxW = Math.min(MAX_NODE_W + sizePaddingX, unclampedElkBoxW)
      gap = maxTierCount > 1
        ? Math.max(MIN_GAP, Math.floor((availableWidth - maxTierCount * elkBoxW) / (maxTierCount - 1)))
        : effectiveNodeSpacing
    } else {
      // Too many nodes: clamp to MIN_NODE_W and use multi-row splitting
      elkBoxW = MIN_NODE_W + sizePaddingX
      nodesPerRow = Math.max(1, Math.floor((availableWidth + MIN_GAP) / (elkBoxW + MIN_GAP)))
      gap = nodesPerRow > 1
        ? Math.max(MIN_GAP, Math.floor((availableWidth - nodesPerRow * elkBoxW) / (nodesPerRow - 1)))
        : MIN_GAP
    }
  } else {
    // Non-DOWN layout or single-node tier: use default sizing
    elkBoxW = Math.min(MAX_NODE_W + sizePaddingX, Math.max(MIN_NODE_W + sizePaddingX,
      maxTierCount > 1
        ? Math.floor((availableWidth - (maxTierCount - 1) * MIN_GAP) / maxTierCount)
        : MAX_NODE_W + sizePaddingX
    ))
    gap = effectiveNodeSpacing
  }

  // Content width returned to callers (what the node renders at)
  const nodeW = elkBoxW - sizePaddingX

  // ---------------------------------------------------------------------------
  // Step 3 — Run ELK with uniform node width
  // ---------------------------------------------------------------------------
  const getNodeDimensions = (node: Node): { width: number; height: number } => {
    const measured = (node as any).measured as { width?: number; height?: number } | undefined

    const fallbackType = (node.type ?? (node.data as any)?.kind) as keyof typeof NODE_REGISTRY | undefined
    const defaultSize = fallbackType && NODE_REGISTRY[fallbackType]
      ? NODE_REGISTRY[fallbackType].defaultSize
      : { width: 220, height: 100 }

    // Use computed elkBoxW for width so ELK uses the exact same footprint
    // assumed in the constraint solve.
    // For height, keep the measured/default value.
    const rawHeight = measured?.height ?? node.height ?? defaultSize.height
    const height = Math.max(40, Math.round(rawHeight) + sizePaddingY)

    return { width: elkBoxW, height }
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

  // ---------------------------------------------------------------------------
  // Step 4b — Separate risk nodes from outcome nodes if ELK merged them
  // ---------------------------------------------------------------------------
  // ELK may place outcomes and risks on the same layer because they have
  // similar edge-distance from the root. When this happens, shift all risk
  // nodes one layerSpacing below the lowest outcome, and push goals down
  // by the same delta. Only fires when at least one risk shares a Y with
  // an outcome (within 10px tolerance).
  if (isDownLayout) {
    const outcomeNodeIds = unlocked.filter(n => tierOf(n) === 3).map(n => n.id)
    const riskNodeIds = unlocked.filter(n => tierOf(n) === 4).map(n => n.id)
    const goalNodeIds = unlocked.filter(n => tierOf(n) === 5).map(n => n.id)

    if (outcomeNodeIds.length > 0 && riskNodeIds.length > 0) {
      const outcomeYs = outcomeNodeIds.map(id => positionMap.get(id)?.y ?? 0)
      const riskYs = riskNodeIds.map(id => positionMap.get(id)?.y ?? 0)

      // Check if any risk shares a Y with any outcome (within 10px)
      const needsShift = riskYs.some(ry =>
        outcomeYs.some(oy => Math.abs(ry - oy) <= 10)
      )

      if (needsShift) {
        const maxOutcomeY = Math.max(...outcomeYs)
        const maxOutcomeH = Math.max(
          ...outcomeNodeIds.map(id => sizeMap.get(id)?.height ?? 116)
        )
        // Place all risks on a single row below the lowest outcome
        const newRiskY = maxOutcomeY + maxOutcomeH + effectiveLayerSpacing
        const oldMinRiskY = Math.min(...riskYs)
        const delta = newRiskY - oldMinRiskY

        for (const id of riskNodeIds) {
          const pos = positionMap.get(id)
          if (pos) positionMap.set(id, { x: pos.x, y: newRiskY })
        }
        for (const id of goalNodeIds) {
          const pos = positionMap.get(id)
          if (pos) positionMap.set(id, { x: pos.x, y: pos.y + delta })
        }
      }
    }
  }

  // Apply multi-row splitting when a tier has more nodes than fit in one row
  if (nodesPerRow !== null) {
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
      nodesPerRow,
      nodeW,
      gap,
      effectiveLayerSpacing
    )
  }

  // ---------------------------------------------------------------------------
  // Step 5 — Apply positions to nodes
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
// exceed `nodesPerRow` into multiple sub-rows.  ELK's crossing-minimisation
// order is preserved (nodes sorted by ELK x-position before splitting).
// Lower tiers are pushed down to prevent overlap with the expanded tier.
function applyTierRowSplitting(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  tierAssignments: Map<number, string[]>,
  nodesPerRow: number,
  nodeW: number,
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

    // Apply any accumulated Y shift from expanded tiers above
    if (cumulativeExtraY > 0) {
      for (const id of nodeIds) {
        const p = positionMap.get(id)
        if (p) positionMap.set(id, { x: p.x, y: p.y + cumulativeExtraY })
      }
    }

    // Only split tiers that exceed nodesPerRow
    if (nodeIds.length <= nodesPerRow) continue

    // Sort by ELK x-position to preserve crossing-minimisation order
    const sorted = [...nodeIds].sort((a, b) => {
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      return ax - bx
    })

    // Build rows
    const rows: string[][] = []
    for (let i = 0; i < sorted.length; i += nodesPerRow) {
      rows.push(sorted.slice(i, i + nodesPerRow))
    }

    // Base Y for this tier (already shifted by cumulativeExtraY above)
    const baseY = positionMap.get(sorted[0])?.y ?? 0
    // Node height from first node's size
    const nodeH = sizeMap.get(sorted[0])?.height ?? 116

    // ELK box width for this tier — derive from sizeMap (ELK returns the exact
    // elkBoxW we gave it, so this is nodeW + sizePaddingX).  Using the ELK
    // width (not the caller's content nodeW) keeps stride and row centering
    // consistent with what ELK assumed when it placed the nodes.
    const elkW = sizeMap.get(sorted[0])?.width ?? nodeW

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
