// P1 Polish: Dynamic ELK import for code-splitting (Task F)
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'
import { Node, Edge } from '@xyflow/react'
import { NODE_REGISTRY } from '../domain/nodes'

// Node types mapped to semantic tiers (0 = top in DOWN layout).
// Nodes whose type is not in this map are placed in tier 2 (factor tier).
const TIER_BY_KIND: Record<string, number> = {
  decision: 0,
  option:   1,
  factor:   2,
  action:   2,
  constraint: 2,
  outcome:  3,
  risk:     3,
  goal:     4,
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
// Exported so BaseNode can share the same upper bound for its pre-layout /
// expanded-node fallback, keeping the ELK constraint solve and the rendered
// width aligned when `layoutNodeWidth` has not yet been populated.
export const MAX_NODE_W = 320  // NODE_REGISTRY maximum — wider to reduce text wrapping on intervention chips and multi-line titles
const MIN_GAP    = 30   // Minimum horizontal gap between nodes in same tier

// Post-layout safety gap (px) used by applyCollisionGuard. Smaller than MIN_GAP:
// this only fires when ELK / multi-row splitting leaves two nodes closer than
// this threshold, which should be rare. It is deliberately not a spacing preference
// — ELK's nodeNode spacing is authoritative for aesthetics.
const COLLISION_GAP = 20

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

  // Available width = canvas width minus 15% breathing room for fitView padding
  // and visual margins. This matches the brief's 85% factor.
  const availableWidth = canvasSize.width * 0.85

  // Width + horizontal-stride policy (DOWN layouts):
  //   1. If the widest tier can fit in one row at MIN_NODE_W or wider, every
  //      node renders at MAX_NODE_W. The tier may overflow the viewport — the
  //      user can pan. The unclamped solve is used only as a feasibility check,
  //      not as the rendered width.
  //   2. If even MIN_NODE_W cannot fit one row, fall back to MIN_NODE_W and
  //      multi-row split.
  //   3. Inter-node gap is a single fixed value (effectiveNodeSpacing) for
  //      every tier — narrower tiers do NOT spread to fill the widest-tier
  //      footprint. After ELK runs, applyUniformStride re-snaps each
  //      single-row tier to a strict elkBoxW + gap stride and centres every
  //      tier on a shared global anchor so adjacent tiers stack vertically
  //      aligned (see helper for details).
  //
  // The unclamped feasibility formula is:
  //   N * elkBoxW + (N-1) * MIN_GAP <= availableWidth
  //   elkBoxW = (availableWidth - (N-1) * MIN_GAP) / N
  //
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
      // Pin every node to MAX_NODE_W and use a fixed inter-node gap. The tier
      // may overflow the viewport (user can pan); narrower tiers stay tightly
      // packed instead of spreading to match the widest tier's footprint.
      elkBoxW = MAX_NODE_W + sizePaddingX
      gap = effectiveNodeSpacing
    } else {
      // Extreme case: even at MIN_NODE_W the row cannot fit. Multi-row split
      // is preferred over an unbounded overflow because the node count is
      // high enough that a single panning row becomes hard to navigate. Gap
      // stays uniform with the rest of the layout.
      elkBoxW = MIN_NODE_W + sizePaddingX
      nodesPerRow = Math.max(1, Math.floor((availableWidth + effectiveNodeSpacing) / (elkBoxW + effectiveNodeSpacing)))
      gap = effectiveNodeSpacing
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

  // Build tier assignments once — used by both multi-row splitting (when it
  // fires) and the uniform-stride pass below.
  const tierAssignments = new Map<number, string[]>()
  for (const node of unlocked) {
    const t = tierOf(node)
    if (!tierAssignments.has(t)) tierAssignments.set(t, [])
    tierAssignments.get(t)!.push(node.id)
  }

  // Apply multi-row splitting when a tier has more nodes than fit in one row
  if (nodesPerRow !== null) {
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

  // Uniform-stride pass: ELK NETWORK_SIMPLEX placement may spread nodes
  // unevenly within a tier to align edges with adjacent tiers (e.g. on K(N,M)
  // bipartite topologies). Re-snap every single-row tier to exactly
  // elkBoxW + gap stride and align tiers on a shared global anchor so they
  // stack vertically aligned. Multi-row tiers were already laid out at uniform
  // stride per row by applyTierRowSplitting, so we skip them here.
  if (isDownLayout) {
    applyUniformStride(positionMap, sizeMap, tierAssignments, elkBoxW, gap, nodesPerRow)
  }

  // Final safety pass: resolve any residual same-row collisions.
  // ELK + multi-row splitting normally space nodes at `gap` px, but rounding or
  // mismatches between the solver's assumed width and ELK's box can still leave
  // two neighbours closer than `COLLISION_GAP`. This is a cheap belt-and-braces
  // fix — a single left-to-right push sweep with one cascade catch.
  applyCollisionGuard(positionMap, sizeMap, elkBoxW)

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

// ---------------------------------------------------------------------------
// Uniform horizontal stride
// ---------------------------------------------------------------------------
// ELK NETWORK_SIMPLEX placement may produce uneven within-tier spacing when
// it spreads nodes to align with edges in adjacent tiers (e.g. K(N,M)
// bipartite fan-outs). Re-snap each single-row tier to evenly-spaced
// positions while preserving ELK's left-to-right ordering (which encodes its
// crossing-minimisation result). All tiers are centred on a single global
// anchor (the mean ELK X-centre across every unlocked node) so adjacent
// tiers stay vertically aligned regardless of their individual node counts.
// Multi-row tiers are skipped because applyTierRowSplitting has already laid
// them out at uniform stride per row.
function applyUniformStride(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  tierAssignments: Map<number, string[]>,
  elkBoxW: number,
  gap: number,
  nodesPerRow: number | null,
): void {
  const stride = elkBoxW + gap

  // Global anchor: mean X-centre across every node currently in positionMap.
  // Falls back to 0 (matches ELK's typical layout origin) when the map is
  // empty, which only happens on degenerate input.
  let totalCentre = 0
  let counted = 0
  for (const id of positionMap.keys()) {
    const p = positionMap.get(id)
    if (!p) continue
    const w = sizeMap.get(id)?.width ?? elkBoxW
    totalCentre += p.x + w / 2
    counted += 1
  }
  const globalCentre = counted > 0 ? totalCentre / counted : 0

  for (const nodeIds of tierAssignments.values()) {
    if (nodeIds.length < 2) continue
    // Tiers that have already been multi-row split are uniformly spaced per
    // row by applyTierRowSplitting — leave them alone.
    if (nodesPerRow !== null && nodeIds.length > nodesPerRow) continue

    // Sort by current X so we preserve ELK's crossing-minimisation order.
    const sorted = [...nodeIds].sort((a, b) => {
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      return ax - bx
    })

    const tierWidth = sorted.length * elkBoxW + (sorted.length - 1) * gap
    const startX = globalCentre - tierWidth / 2

    for (let i = 0; i < sorted.length; i++) {
      const p = positionMap.get(sorted[i])
      if (!p) continue
      positionMap.set(sorted[i], { x: startX + i * stride, y: p.y })
    }
  }
}

// ---------------------------------------------------------------------------
// Post-layout collision prevention
// ---------------------------------------------------------------------------

/**
 * Group node ids by their Y coordinate with a small tolerance.
 *
 * Nodes within `tolerance` px of an existing anchor are grouped together.
 * The anchor is the first Y value seen for the group (order-dependent, but
 * this matches how ELK emits coordinates: nodes in the same tier share
 * essentially identical Y values, typically within sub-pixel distance).
 *
 * @param nodeIds     Candidate node ids to group.
 * @param positionMap Source of each node's current position. Missing entries
 *                    are treated as y=0.
 * @param tolerance   Maximum Y difference (px) that still counts as the same
 *                    row. Defaults to 10 to absorb ELK rounding noise.
 * @returns Map keyed by the anchor Y; each value is the list of ids in that
 *          row in the order they were encountered.
 */
export function groupByYRow(
  nodeIds: string[],
  positionMap: Map<string, { x: number; y: number }>,
  tolerance = 10,
): Map<number, string[]> {
  const groups = new Map<number, string[]>()
  const anchors: number[] = []
  for (const id of nodeIds) {
    const y = positionMap.get(id)?.y ?? 0
    let matched = false
    for (const anchor of anchors) {
      if (Math.abs(y - anchor) <= tolerance) {
        groups.get(anchor)!.push(id)
        matched = true
        break
      }
    }
    if (!matched) {
      anchors.push(y)
      groups.set(y, [id])
    }
  }
  return groups
}

/** Single-pass horizontal collision guard. Pushes overlapping same-row nodes apart by COLLISION_GAP. */
export function applyCollisionGuard(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  elkBoxW: number,
): void {
  const allIds = Array.from(positionMap.keys())
  if (allIds.length < 2) return

  const rows = groupByYRow(allIds, positionMap)
  const widthOf = (id: string): number => sizeMap.get(id)?.width ?? elkBoxW

  for (const rowIds of rows.values()) {
    if (rowIds.length < 2) continue

    // Sort by current X; sort is O(n log n) but n ≤ ~12 so negligible.
    const sorted = [...rowIds].sort((a, b) => {
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      return ax - bx
    })

    // Up to 2 sweeps: first fixes immediate collisions, second catches any
    // cascade introduced by the first (rare but cheap to handle).
    for (let sweep = 0; sweep < 2; sweep++) {
      let moved = false
      for (let i = 1; i < sorted.length; i++) {
        const left = sorted[i - 1]
        const right = sorted[i]
        const leftPos = positionMap.get(left)
        const rightPos = positionMap.get(right)
        if (!leftPos || !rightPos) continue

        const leftRight = leftPos.x + widthOf(left)
        const actualGap = rightPos.x - leftRight
        if (actualGap < COLLISION_GAP) {
          positionMap.set(right, {
            x: leftRight + COLLISION_GAP,
            y: rightPos.y,
          })
          moved = true
        }
      }
      // Short-circuit if the sweep produced no changes.
      if (!moved) break
    }
  }
}
