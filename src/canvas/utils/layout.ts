/**
 * ⭐⭐ THE CANONICAL LAYOUT HAS NO RUNTIME INPUT. READ BEFORE ADDING A PARAMETER.
 *
 * FOUNDER RULING R1 (18 Aug 2026, `ARCHITECTURE-BOARD.md` §0-RULINGS):
 *
 * > "Stable model, adaptive attention. The canonical graph layout must not
 * > change because viewport width changes… responsive behaviour happens through
 * > camera/focus/disclosure, not persisted re-layout."
 *
 * This module used to take a `canvasSize` and solve
 * `availableWidth = canvasSize.width * 0.85`. It no longer takes one at all, and
 * the whole authority behind it — `utils/layoutCanvasSize.ts`, the layout store's
 * `canvasSize`/`setCanvasSize`, and the two call sites that measured the pane —
 * is DELETED rather than left plumbed-but-ignored. A silently-ignored input is
 * how the defect comes back: the next lane finds a parameter, sees no harm in
 * honouring it, and the canonical model is a function of the screen again.
 * `availableWidth` is now `CANONICAL_LAYOUT_WIDTH`, a constant whose derivation,
 * band and cliff margins live in `nodeLayoutConstants.ts`.
 *
 * ⚠⚠ FORBIDDEN, all of it for the same reason: deriving the layout budget from
 * the viewport, the `.react-flow` pane rect, `window.innerWidth`, panel state,
 * the current zoom, the fit box (`boxW / LABEL_LEGIBLE_ZOOM` and any relative),
 * or the node count. The fit box is especially attractive — it makes the solver's
 * assumption and the camera's frame agree by construction — and it is especially
 * wrong, because the fit box is a function of PANEL STATE, so the model would
 * re-pack whenever someone opened a conversation.
 *
 * The model is the team's shared reasoning. Adapt the PRESENTATION — camera,
 * focus, "showing N of M" — never the model.
 *
 * ⚠ ONE GENUINE DEFECT IN THIS FILE, NOT FIXED HERE, recorded so it is not lost:
 * the DOWN branch treats `availableWidth` as a budget for deciding
 * single-row-vs-multi-row and then emits a row that OVERRUNS it — a 6-wide tier
 * packs to 2140 units against the 1185 budget, 81% over. R1 rules that a
 * constrained screen is answered by a readable subset with an explicit
 * "showing X of Y" and obvious whole-model access — a PRESENTATION change —
 * never by re-packing. Do not fix it here.
 */
// P1 Polish: Dynamic ELK import for code-splitting (Task F)
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'
import { Node, Edge } from '@xyflow/react'
import { NODE_REGISTRY } from '../domain/nodes'
import {
  NODE_LAYOUT_MIN_W,
  NODE_CARD_MAX_W,
  NODE_SINGLE_ROW_FAIR_SHARE_W,
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  DEFAULT_NODE_HEIGHT,
  MIN_GAP,
  COLLISION_GAP,
  CANONICAL_LAYOUT_WIDTH,
  CANVAS_MARGIN,
  TIER_BY_KIND,
} from './nodeLayoutConstants'

interface LayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'
  spacing?: number
  layerSpacing?: number
  preserveLocked?: boolean
}

type LayoutDirection = NonNullable<LayoutOptions['direction']>

/** Canonical tier of a node. Module-level so ONE implementation serves both
 *  `layoutGraph` and `solveLayoutNodeWidth` (CLAUDE.md trap 12: derive, never
 *  mirror — two copies of this mapping is how the two would drift apart). */
function tierOf(node: Node): number {
  const kind = (node.type ?? (node.data as Record<string, unknown> | undefined)?.kind) as string | undefined
  return kind !== undefined && TIER_BY_KIND[kind] !== undefined ? TIER_BY_KIND[kind] : 2
}

function isUnlocked(node: Node): boolean {
  return (node.data as Record<string, unknown> | undefined)?.locked !== true
}

/** Size of the widest tier — the ONE graph property the card width depends on. */
function maxTierCountOf(unlocked: Node[]): number {
  const tierCounts = new Map<number, number>()
  for (const node of unlocked) {
    const t = tierOf(node)
    tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1)
  }
  return Math.max(...tierCounts.values())
}

/**
 * The ELK box width, and whether this is the row-splitting branch.
 *
 * Extracted so `solveLayoutNodeWidth` below is the SAME code rather than a
 * restatement of it. `splits` is returned rather than re-derived from
 * `elkBoxW`, because the non-DOWN branch can land on `LAYOUT_BOX_MIN_W` too and
 * must NOT split — testing the width would silently widen row splitting to
 * directions that never had it.
 */
function planLayoutBox(maxTierCount: number, isDownLayout: boolean): { elkBoxW: number; splits: boolean } {
  if (isDownLayout && maxTierCount > 1) {
    const unclampedElkBoxW = Math.floor((CANONICAL_LAYOUT_WIDTH - (maxTierCount - 1) * MIN_GAP) / maxTierCount)

    // WHEN the tier splits is a row-packing policy and is deliberately NOT the
    // (label-scale-derived) card floor — see NODE_SINGLE_ROW_FAIR_SHARE_W.
    // Fusing the two moved tiers between branches when the label scale changed,
    // which dragged the pre-existing multi-row overlap defect onto graphs that
    // did not have it.
    if (unclampedElkBoxW >= NODE_SINGLE_ROW_FAIR_SHARE_W + LAYOUT_PADDING_X) {
      return { elkBoxW: NODE_CARD_MAX_W + LAYOUT_PADDING_X, splits: false }
    }
    return { elkBoxW: NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X, splits: true }
  }
  return {
    elkBoxW: Math.min(NODE_CARD_MAX_W + LAYOUT_PADDING_X, Math.max(NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X,
      maxTierCount > 1
        ? Math.floor((CANONICAL_LAYOUT_WIDTH - (maxTierCount - 1) * MIN_GAP) / maxTierCount)
        : NODE_CARD_MAX_W + LAYOUT_PADDING_X
    )),
    splits: false,
  }
}

/**
 * ⭐⭐ THE WIDTH A CARD MUST RENDER AT FOR A GIVEN GRAPH'S POSITIONS TO BE RIGHT.
 *
 * `layoutGraph` places nodes on a stride computed from this width and reports it
 * back so `BaseNode` can size the card to match. That handshake is SESSION-ONLY:
 * `layoutStore.setLayoutNodeWidth` does not persist, so on RELOAD the store
 * reads `null` and `BaseNode.tsx`'s `maxWidth ?? layoutNodeWidth ??
 * NODE_CARD_MAX_W` renders every card at the MAXIMUM. Cards laid out at 230px
 * came back at 320px — 90px wider than the stride their positions were computed
 * for — so same-row neighbours overlapped, permanently (no corrective pass can
 * fire on a restored layout; see `useRestoredLayoutWidth`).
 *
 * ⭐ THE WIDTH IS NOT INDEPENDENT INFORMATION, WHICH IS WHY IT IS DERIVED HERE
 * RATHER THAN PERSISTED. It is a pure function of the widest tier's size, the
 * direction and `preserveLocked` — and nothing else. It does NOT depend on the
 * viewport (founder ruling R1 made the budget a constant), on node spacing, on
 * measured heights, or on the edges. So it is ALREADY persisted, implicitly and
 * exactly, by the nodes themselves. Storing it beside its own inputs would be
 * the hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12),
 * and it would repair nothing already saved.
 *
 * MEASURED, not reasoned: 288 cells (4 directions x widest-tier 1..12 x node
 * spacing {15,40,120} x with/without measured heights) — this function agrees
 * with `layoutGraph`'s own returned `layoutNodeWidth` in 288/288. A naive
 * "always NODE_CARD_MAX_W" predictor disagrees in 198 of the same cells, so the
 * agreement is a discrimination and not a tautology. Reachable values: DOWN
 * {320, 230}; RIGHT/UP/LEFT {320, 261, 230}.
 * `__tests__/layoutNodeWidthDerivation.spec.ts` re-runs that matrix.
 *
 * ⚠ WHAT IT CANNOT KNOW: it answers "what width would TODAY'S solver use for
 * this graph", not "what width was used the day these positions were written".
 * Those differ only if the graph was laid out under a different `direction` /
 * `respectLocked` (both persisted, so they survive a reload) or under different
 * layout CONSTANTS. A constants change already invalidates the stored positions
 * themselves, which no width can repair — see the PR body.
 */
export function solveLayoutNodeWidth(
  nodes: Node[],
  options: { direction?: LayoutDirection; preserveLocked?: boolean } = {},
): number {
  const { direction = 'DOWN', preserveLocked = true } = options
  const unlocked = preserveLocked ? nodes.filter(isUnlocked) : nodes
  if (unlocked.length === 0) return NODE_CARD_MAX_W
  return planLayoutBox(maxTierCountOf(unlocked), direction === 'DOWN').elkBoxW - LAYOUT_PADDING_X
}

/**
 * Lay out a decision graph using ELK + the deterministic semantic pipeline.
 *
 * Pipeline (DOWN layouts):
 *   1. Filter locked nodes (their saved positions are returned untouched).
 *   2. Solve the ELK box width against the CANONICAL (viewport-free) budget.
 *   3. Run ELK with uniform `elkBoxW` and the resolved `gap`.
 *   4. Apply balanced multi-row splitting (when nodesPerRow !== null).
 *   5. Override ELK's Y with deterministic canonical tier rows.
 *   6. Re-snap each row to a uniform stride and centre on the graph spine
 *      (median of decision + option centres; goal excluded).
 *   7. Run the final collision guard for residual same-row overlaps.
 *   8. Translate the unlocked subgraph so its origin sits at
 *      (CANVAS_MARGIN, CANVAS_MARGIN).
 */
export async function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Promise<{ nodes: Node[]; edges: Edge[]; layoutNodeWidth: number }> {
  const {
    direction = 'DOWN',
    // Default horizontal node-node spacing. Reduction chain 60 → 30 → 20 → 15.
    // The Math.max(20, …) floor on line 64 is deliberately retained, so the
    // rendered gap is still 20 px — `spacing=15` documents the intended value
    // but is clamped at runtime. To genuinely render at 15, a future change
    // would need to lower both that floor AND `COLLISION_GAP` (currently 20).
    // 4-node max-width row at NODE_CARD_MAX_W=320: 1556 → 1466 → 1436 → 1436
    // (no change in rendered width at gap=15 because of the floor).
    spacing = 15,
    layerSpacing,
    preserveLocked = true
  } = options

  const effectiveNodeSpacing = Math.max(20, spacing)
  const effectiveLayerSpacing = Math.max(30, layerSpacing ?? spacing * 1.5)

  const unlocked = preserveLocked ? nodes.filter(isUnlocked) : nodes

  if (unlocked.length === 0) {
    return { nodes, edges, layoutNodeWidth: NODE_CARD_MAX_W }
  }

  // I.3 perf: O(E) edge filtering via Set instead of O(E*V) double `.some` scan.
  const unlockedIds = new Set<string>()
  for (const n of unlocked) unlockedIds.add(n.id)

  const maxTierCount = maxTierCountOf(unlocked)

  const availableWidth = CANONICAL_LAYOUT_WIDTH
  const isDownLayout = direction === 'DOWN'

  // ⚠ ONE authority for the box width, shared with `solveLayoutNodeWidth` above
  // so the restore path cannot drift from the layout path. `gap` was assigned
  // `effectiveNodeSpacing` in all three former branches and is hoisted.
  const { elkBoxW, splits } = planLayoutBox(maxTierCount, isDownLayout)
  const gap = effectiveNodeSpacing
  const nodesPerRow: number | null = splits
    ? Math.max(1, Math.floor((availableWidth + effectiveNodeSpacing) / (elkBoxW + effectiveNodeSpacing)))
    : null

  const nodeW = elkBoxW - LAYOUT_PADDING_X

  const getNodeDimensions = (node: Node): { width: number; height: number } => {
    const measured = (node as unknown as { measured?: { width?: number; height?: number } }).measured

    const fallbackType = (node.type ?? (node.data as Record<string, unknown> | undefined)?.kind) as keyof typeof NODE_REGISTRY | undefined
    const defaultSize = fallbackType && NODE_REGISTRY[fallbackType]
      ? NODE_REGISTRY[fallbackType].defaultSize
      : { width: 220, height: DEFAULT_NODE_HEIGHT }

    const rawHeight = measured?.height ?? node.height ?? defaultSize.height
    const height = Math.max(40, Math.round(rawHeight) + LAYOUT_PADDING_Y)

    return { width: elkBoxW, height }
  }

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
    },
    children: unlocked.map(node => {
      const { width, height } = getNodeDimensions(node)
      return { id: node.id, width, height }
    }),
    edges: edges
      .filter(e => unlockedIds.has(e.source) && unlockedIds.has(e.target))
      .map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      } as ElkExtendedEdge)),
  }

  const layout = await elk.layout(elkGraph)

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

  const tierAssignments = new Map<number, string[]>()
  for (const node of unlocked) {
    const t = tierOf(node)
    if (!tierAssignments.has(t)) tierAssignments.set(t, [])
    tierAssignments.get(t)!.push(node.id)
  }

  // Track which tiers `applyTierRowSplitting` deliberately split. Diagnostic
  // 2026-05-07 found that without this signal, `normaliseTierRows` was
  // preserving ELK's incidental intra-tier Y variation (caused by measured
  // node-height differences) as if it were a deliberate sub-row split, which
  // staggered options onto separate rows when no row split was requested.
  const splitterCreatedTiers = new Set<number>()

  if (nodesPerRow !== null) {
    applyTierRowSplitting(positionMap, sizeMap, tierAssignments, nodesPerRow, nodeW, gap, effectiveLayerSpacing, splitterCreatedTiers)
  }

  if (isDownLayout) {
    normaliseTierRows(positionMap, sizeMap, tierAssignments, effectiveLayerSpacing, splitterCreatedTiers)
    centreRowsOnSpine(positionMap, sizeMap, unlocked, elkBoxW, gap)
  }

  applyCollisionGuard(positionMap, sizeMap, elkBoxW)
  applyGlobalTranslation(positionMap)

  // ⭐⭐ NO NODE LEAVES A SUCCESSFUL LAYOUT SILENTLY UNPLACED.
  //
  // The write-back is a Map keyed by id, so a node absent from `positionMap`
  // simply keeps whatever position it arrived with — and a freshly drafted node
  // arrives at `{x:0, y:0}` (`applyDraftResult`'s sole `position` write). The
  // result is a node sitting under the graph's top-left corner, on a layout
  // that reported SUCCESS: no throw, no banner, nothing for the user to act on.
  // Duplicate ids reach the same end by a different route — two nodes read one
  // Map entry and land on one point — and are deduped only in the render memo,
  // so the store keeps both.
  //
  // Both are reported by name rather than repaired blind. Repair is limited to
  // the case with an unambiguous right answer: an unplaced UNLOCKED node is
  // parked in a deterministic row below the laid-out graph, where it is visible
  // and reachable. Duplicates are NOT repositioned — which node "should" win is
  // an identity question this layer does not own, and guessing would move a
  // node the user can see for reasons they cannot.
  const unplaced: string[] = []
  const seenIds = new Set<string>()
  const duplicateIds = new Set<string>()
  for (const node of nodes) {
    if (seenIds.has(node.id)) duplicateIds.add(node.id)
    seenIds.add(node.id)
    const isNodeLocked = (node.data as Record<string, unknown> | undefined)?.locked === true
    if (!isNodeLocked && !positionMap.has(node.id)) unplaced.push(node.id)
  }

  let maxY = 0
  for (const pos of positionMap.values()) if (pos.y > maxY) maxY = pos.y

  const updatedNodes = nodes.map(node => {
    const newPos = positionMap.get(node.id)
    if (newPos && !((node.data as Record<string, unknown> | undefined)?.locked === true)) {
      return { ...node, position: newPos }
    }
    const rescueIndex = unplaced.indexOf(node.id)
    if (rescueIndex >= 0) {
      return {
        ...node,
        position: { x: rescueIndex * (elkBoxW + LAYOUT_PADDING_X), y: maxY + elkBoxW },
      }
    }
    return node
  })

  if (unplaced.length > 0 || duplicateIds.size > 0) {
    console.warn(
      '[CANVAS] layout write-back incomplete:',
      JSON.stringify({
        unplaced_node_ids: unplaced,
        duplicate_node_ids: Array.from(duplicateIds),
        placed: positionMap.size,
        total: nodes.length,
      }),
    )
  }

  return { nodes: updatedNodes, edges, layoutNodeWidth: nodeW }
}

// ---------------------------------------------------------------------------
// Multi-row tier splitting (balanced via exact-remainder distribution)
// ---------------------------------------------------------------------------
function applyTierRowSplitting(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  tierAssignments: Map<number, string[]>,
  nodesPerRow: number,
  nodeW: number,
  gap: number,
  layerSpacing: number,
  splitterCreatedTiers?: Set<number>,
): void {
  const subRowSpacing = Math.round(layerSpacing * 0.6)
  const sortedTiers = Array.from(tierAssignments.keys()).sort((a, b) => a - b)
  let cumulativeExtraY = 0

  for (const tier of sortedTiers) {
    const nodeIds = tierAssignments.get(tier)!

    if (cumulativeExtraY > 0) {
      for (const id of nodeIds) {
        const p = positionMap.get(id)
        if (p) positionMap.set(id, { x: p.x, y: p.y + cumulativeExtraY })
      }
    }

    if (nodeIds.length <= nodesPerRow) continue

    // Record that this tier was deliberately split into multiple rows so
    // normaliseTierRows can preserve those rows. Without this signal, it
    // would treat any intra-tier ELK Y variation as a sub-row split, which
    // staggers options when measured node heights differ.
    splitterCreatedTiers?.add(tier)

    const sorted = [...nodeIds].sort((a, b) => {
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      return ax - bx
    })

    // Exact-remainder distribution: 7@4 → 4+3, 8@4 → 4+4, 10@4 → 4+3+3,
    // 11@4 → 4+4+3 — every adjacent pair differs by ≤ 1.
    const total = sorted.length
    const rowCount = Math.ceil(total / nodesPerRow)
    const base = Math.floor(total / rowCount)
    const remainder = total % rowCount
    const rows: string[][] = []
    let cursor = 0
    for (let r = 0; r < rowCount; r++) {
      const size = r < remainder ? base + 1 : base
      rows.push(sorted.slice(cursor, cursor + size))
      cursor += size
    }

    const baseY = positionMap.get(sorted[0])?.y ?? 0
    const nodeH = sizeMap.get(sorted[0])?.height ?? (DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y)
    const elkW = sizeMap.get(sorted[0])?.width ?? nodeW

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const rowWidth = row.length * elkW + (row.length - 1) * gap
      const startX = -(rowWidth / 2)
      const rowY = baseY + r * (nodeH + subRowSpacing)
      for (let i = 0; i < row.length; i++) {
        positionMap.set(row[i], { x: startX + i * (elkW + gap), y: rowY })
      }
    }

    const extraH = (rows.length - 1) * (nodeH + subRowSpacing)
    cumulativeExtraY += extraH
  }
}

/**
 * Replace ELK's Y positions with canonical tier rows.
 *
 * 1. First occupied tier sits at canonicalY = 0.
 * 2. Each subsequent tier sits at prev.canonicalY + maxHeight(prev) +
 *    effectiveLayerSpacing.
 * 3. Within a tier:
 *    - If `splitterCreatedTiers` reports the tier was deliberately split by
 *      `applyTierRowSplitting`, sub-rows are detected via `groupByYRow` and
 *      placed cumulatively (previous sub-row's max height + subRowSpacing).
 *    - Otherwise the entire tier is collapsed to a single canonical Y
 *      regardless of intra-tier Y variation. ELK can produce intra-tier Y
 *      variation when measured node heights differ — e.g. an option with a
 *      longer label is taller and lands ~17 px above its peers, which
 *      `groupByYRow`'s default 10 px tolerance treats as a sub-row split.
 *      Without the explicit-split signal that variation was being preserved
 *      as a sub-row split, staggering options onto separate rows. The
 *      regression fixture/test for this case lives at
 *      `src/canvas/__tests__/__fixtures__/graph-b-staggering-regression.json`
 *      and `option-staggering fix — full pipeline` in `layout.semantic.spec.ts`.
 *
 * Empty tiers are skipped — no phantom vertical gap. Locked nodes are
 * filtered upstream so their Y is untouched.
 *
 * X is preserved here; centreRowsOnSpine owns X.
 *
 * Exported for unit testing of sub-row cumulative-height behaviour.
 */
export function normaliseTierRows(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  tierAssignments: Map<number, string[]>,
  effectiveLayerSpacing: number,
  splitterCreatedTiers?: Set<number>,
): void {
  const subRowSpacing = Math.round(effectiveLayerSpacing * 0.6)
  const fallbackHeight = DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y

  const heightOf = (id: string): number =>
    sizeMap.get(id)?.height ?? fallbackHeight

  const occupiedTiers = [...tierAssignments.keys()].sort((a, b) => a - b)
  let cumulativeY = 0

  for (let t = 0; t < occupiedTiers.length; t++) {
    const tier = occupiedTiers[t]
    const ids = tierAssignments.get(tier)!

    // Sub-rows are honoured ONLY when the splitter explicitly created them
    // for this tier. Any intra-tier Y delta produced by ELK alone is
    // collapsed to a single canonical row.
    const subRows = splitterCreatedTiers?.has(tier)
      ? groupByYRow(ids, positionMap)
      : new Map<number, string[]>([[positionMap.get(ids[0])?.y ?? 0, ids]])
    const subRowAnchors = [...subRows.keys()]

    let subCumulativeY = cumulativeY
    let lastSubMaxH = 0

    for (let s = 0; s < subRowAnchors.length; s++) {
      const subIds = subRows.get(subRowAnchors[s])!
      if (s > 0) {
        subCumulativeY = subCumulativeY + lastSubMaxH + subRowSpacing
      }
      let subMaxH = 0
      for (const id of subIds) {
        const p = positionMap.get(id)
        if (!p) continue
        positionMap.set(id, { x: p.x, y: subCumulativeY })
        const h = heightOf(id)
        if (h > subMaxH) subMaxH = h
      }
      lastSubMaxH = subMaxH || fallbackHeight
    }

    const lastSubY = subCumulativeY
    const tierBottomY = lastSubY + lastSubMaxH
    cumulativeY = tierBottomY + effectiveLayerSpacing
  }
}

/**
 * Re-snap each row to a uniform `elkBoxW + gap` stride and shift it so its
 * centre aligns with the graph spine.
 *
 * Spine X = median centre of decision (tier 0) + option (tier 1) nodes.
 * Goal is excluded because ELK may place it far right under asymmetric
 * edges, which would pull the spine off-centre. Degenerate fallback: median
 * X of all unlocked node centres.
 */
function centreRowsOnSpine(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  unlocked: Node[],
  elkBoxW: number,
  gap: number,
): void {
  const widthOf = (id: string): number => sizeMap.get(id)?.width ?? elkBoxW
  const centreOf = (id: string): number | undefined => {
    const p = positionMap.get(id)
    return p === undefined ? undefined : p.x + widthOf(id) / 2
  }

  const tierOf = (node: Node): number => {
    const kind = (node.type ?? (node.data as Record<string, unknown> | undefined)?.kind) as string | undefined
    return kind !== undefined && TIER_BY_KIND[kind] !== undefined
      ? TIER_BY_KIND[kind]
      : 2
  }

  const spineKindTiers = new Set([0, 1])
  const spineCentres: number[] = []
  for (const node of unlocked) {
    if (!spineKindTiers.has(tierOf(node))) continue
    const c = centreOf(node.id)
    if (c !== undefined) spineCentres.push(c)
  }

  let graphSpineX: number
  if (spineCentres.length > 0) {
    spineCentres.sort((a, b) => a - b)
    graphSpineX = spineCentres[Math.floor(spineCentres.length / 2)]
  } else {
    const allCentres: number[] = []
    for (const node of unlocked) {
      const c = centreOf(node.id)
      if (c !== undefined) allCentres.push(c)
    }
    allCentres.sort((a, b) => a - b)
    graphSpineX = allCentres.length
      ? allCentres[Math.floor(allCentres.length / 2)]
      : 0
  }

  const stride = elkBoxW + gap
  const allIds = [...positionMap.keys()]
  const rows = groupByYRow(allIds, positionMap)

  for (const rowIds of rows.values()) {
    if (rowIds.length === 0) continue
    const rowWidth = rowIds.length * elkBoxW + (rowIds.length - 1) * gap
    const startX = graphSpineX - rowWidth / 2
    for (let i = 0; i < rowIds.length; i++) {
      const p = positionMap.get(rowIds[i])
      if (!p) continue
      positionMap.set(rowIds[i], { x: startX + i * stride, y: p.y })
    }
  }
}

function applyGlobalTranslation(
  positionMap: Map<string, { x: number; y: number }>,
): void {
  if (positionMap.size === 0) return

  let minX = Infinity
  let minY = Infinity
  for (const p of positionMap.values()) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return

  const offsetX = CANVAS_MARGIN - minX
  const offsetY = CANVAS_MARGIN - minY
  if (offsetX === 0 && offsetY === 0) return

  for (const [id, p] of positionMap) {
    positionMap.set(id, { x: p.x + offsetX, y: p.y + offsetY })
  }
}

/**
 * Group node ids by their Y coordinate with a small tolerance.
 *
 * Output is deterministic: row entries are sorted by anchor Y ascending,
 * and each row's node IDs are sorted by X ascending with the node ID as
 * lexicographic tiebreaker.
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

  const sortedAnchors = [...anchors].sort((a, b) => a - b)
  const sorted = new Map<number, string[]>()
  for (const anchor of sortedAnchors) {
    const ids = groups.get(anchor)!
    const stable = [...ids].sort((a, b) => {
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      if (ax !== bx) return ax - bx
      return a < b ? -1 : a > b ? 1 : 0
    })
    sorted.set(anchor, stable)
  }
  return sorted
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

    const sorted = [...rowIds].sort((a, b) => {
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      return ax - bx
    })

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
      if (!moved) break
    }
  }
}
