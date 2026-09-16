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
  cardWidthCapForTier,
  LAYOUT_NODE_GAP,
  LAYOUT_LAYER_GAP,
} from './nodeLayoutConstants'

interface LayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'
  spacing?: number
  layerSpacing?: number
  preserveLocked?: boolean
  /**
   * ⭐ HEIGHT AT THE COUNTER-SCALE BOUND, per node id — see
   * `utils/measureNodeHeightsAtLabelBound.ts` for the defect and the numbers.
   *
   * `node.measured.height` is the card's height AT THE CURRENT VIEWPORT ZOOM
   * (canvas type tokens multiply by `--canvas-label-scale`), so a stride
   * computed from it is correct at exactly one zoom and wrong at every other
   * zoom in the band — measured ×2.05 between zoom 1.0 and 0.5. This override
   * carries the height at `MAX_LABEL_COUNTER_SCALE`, which is the tallest the
   * card can ever be, so the stride clears it at EVERY zoom.
   *
   * ⚠ A MISSING ENTRY MEANS "NO BETTER INFORMATION", NOT ZERO. `getNodeDimensions`
   * falls through to the existing precedence, so jsdom, SSR and any node that
   * is not mounted behave exactly as before.
   */
  heightAtLabelBound?: Map<string, number>
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

function tierOccupancyOf(unlocked: Node[]): Map<number, number> {
  const occ = new Map<number, number>()
  for (const n of unlocked) {
    const t = tierOf(n)
    occ.set(t, (occ.get(t) ?? 0) + 1)
  }
  return occ
}

/**
 * ⭐⭐ THE ELK BOX WIDTH FOR ONE TIER — the single authority, called by BOTH
 * `layoutGraph` (which places on it) and {@link solveLayoutCardWidths} (which
 * tells the card what to draw at). Two copies of this arithmetic is exactly the
 * hand-maintained mirror that made the previous attempt render at one width and
 * lay out at another.
 *
 * The bound is `widestRowW`: the board is already as wide as its widest tier's
 * row, so a tier with fewer cards has slack against that width BY CONSTRUCTION
 * and spending it cannot make the board wider. The widest tier is at the bound
 * and keeps today's width exactly.
 */
function tierBoxWidth(
  tier: number,
  occupancy: Map<number, number>,
  elkBoxW: number,
  splits: boolean,
  gap: number,
  maxTierCount: number,
): number {
  // The row-packing regime already clamped the box to `NODE_LAYOUT_MIN_W`
  // because the tier does not fit on one row. Widening a card whose tier is
  // being wrapped makes the wrap worse, so the rule is off here entirely.
  if (splits) return elkBoxW
  const widestRowW = maxTierCount * elkBoxW + Math.max(0, maxTierCount - 1) * gap
  const count = Math.max(1, occupancy.get(tier) ?? 1)
  const shareOfWidestRow = count > 1
    ? Math.floor((widestRowW - (count - 1) * gap) / count)
    : widestRowW
  const cap = cardWidthCapForTier(tier) + LAYOUT_PADDING_X
  // ⛔ NEVER NARROWER THAN TODAY. The three character budgets that cut text
  // inside these cards were derived against `NODE_CARD_MAX_W`; a narrower box
  // would silently re-open the truncation they exist to close.
  return Math.max(elkBoxW, Math.min(cap, shareOfWidestRow))
}

/**
 * ⭐⭐ THE WIDTH EACH KIND OF CARD MUST DRAW AT for this graph's positions to be
 * right — the per-kind sibling of {@link solveLayoutNodeWidth}, and derived for
 * the same reason it is: the width is NOT independent information.
 *
 * It is a pure function of the tier occupancies, the direction, `preserveLocked`
 * and the node spacing — every one of which already survives a reload (the
 * nodes in the autosave; `direction`, `respectLocked` and `nodeSpacing` in the
 * layout store's persisted options). So it is ALREADY persisted, implicitly and
 * exactly, and storing a copy beside its own inputs would be the mirror this
 * estate keeps paying for (trap 12). Deriving also repairs every model saved
 * before this change, with no migration.
 *
 * ⚠ IT RETURNS CARD WIDTHS, NOT BOX WIDTHS — `LAYOUT_PADDING_X` is already
 * subtracted, so the value is directly what `BaseNode` renders at. Getting that
 * wrong by one padding is how a card ends up flush against its neighbour.
 */
export function solveLayoutCardWidths(
  nodes: Node[],
  options: { direction?: LayoutDirection; preserveLocked?: boolean; spacing?: number } = {},
): Record<string, number> {
  const { direction = 'DOWN', preserveLocked = true, spacing = LAYOUT_NODE_GAP } = options
  const unlocked = preserveLocked ? nodes.filter(isUnlocked) : nodes
  if (unlocked.length === 0) return {}
  const gap = Math.max(LAYOUT_NODE_GAP, spacing)
  const maxTierCount = maxTierCountOf(unlocked)
  const { elkBoxW, splits } = planLayoutBox(maxTierCount, direction === 'DOWN')
  const occupancy = tierOccupancyOf(unlocked)
  const widths: Record<string, number> = {}
  for (const kind of Object.keys(TIER_BY_KIND)) {
    widths[kind] =
      tierBoxWidth(TIER_BY_KIND[kind], occupancy, elkBoxW, splits, gap, maxTierCount) -
      LAYOUT_PADDING_X
  }
  return widths
}

/**
 * ⭐⭐ THE WIDTHS A RESTORED BOARD CAN ACTUALLY AFFORD — bounded by the stride
 * its own SAVED POSITIONS leave, not by the row a fresh layout would build.
 *
 * ⛔⛔ THE DEFECT THIS CLOSES, AND IT WAS FOUND BY AN INDEPENDENT REVIEW (Codex,
 * 16 Sep 2026) AFTER I HAD ALREADY SHIPPED THE FIX IT BREAKS.
 *
 * `useRestoredLayoutWidth` exists to NARROW a restored card to match the stride
 * beneath it: cards laid out at 230px came back at the 320px maximum and
 * overlapped. Per-tier widths inverted that direction — `solveLayoutCardWidths`
 * can return a width WIDER than the uniform one a saved board was laid out at,
 * so the very hook that repaired overlap began to cause it.
 *
 * Executed contrast, old `layoutGraph` composed with the candidate solver —
 * 3 options / 5 factors, old uniform width **336**, options at x **416 / 808 /
 * 1200**:
 *
 *     saved gap        56px
 *     restored at 440  gap becomes  -48px      ← a 48px overlap, on reopen
 *
 * ⭐ AND THE HOOK'S OWN HEADER STATES THIS FAILURE ONE CASE EARLIER. Explaining
 * why a layout that has run must win, it says a derived width against unmoved
 * positions *"would cause the very overlap it exists to remove"*. The per-kind
 * limb was added four lines below that paragraph without applying its reasoning
 * to itself — the remedy scoped to the instance while its sibling sat in the
 * same function, under a header that had already named the mechanism.
 *
 * ⭐ THE RULE IS THE ONE THE FRESH PATH ALREADY USES, POINTED AT THE RIGHT BOARD.
 * `tierBoxWidth` lets a tier spend only its share of the widest row the board
 * ALREADY has. Here the board that already exists is the SAVED one, so the bound
 * is measured from the saved positions: per tier, the smallest centre-to-centre
 * distance between adjacent cards sharing a row, minus the gap the layout
 * guarantees. Reusing the rule rather than inventing a second one is deliberate —
 * two rules for one question is how the two authorities in this hook disagreed.
 *
 * ⚠ A TIER WITH NO TWO CARDS IN ONE ROW IS NOT BOUNDED, AND THAT IS THE POINT,
 * NOT AN OVERSIGHT. Stride is only measurable where there is a same-row
 * neighbour — and a card with no same-row neighbour cannot overlap one. So the
 * decision and goal tiers (one card each on every shipped starter) keep their
 * full widened width, which is where most of the visible gain was. The bound
 * bites exactly where overlap is possible and nowhere else.
 *
 * ⚠ AND IT IS A BOUND, NOT A REVERT. A board saved AFTER the per-tier change
 * carries the wider stride in its own positions, so the measurement returns the
 * wider cap and the widths land unchanged. An old board keeps its old width
 * until something lays it out again.
 *
 * ⛔ NOTHING MOVES. This returns widths only. The hook's standing promise — *"it
 * changes how wide a card DRAWS; it never moves a node"* — is why locked and
 * manually-placed nodes are safe, and re-laying out on load was rejected for that
 * reason long before this defect. Repairing width by rewriting position would
 * trade a bounded overlap for silently discarding a user's own arrangement.
 */
/**
 * ⛔⛔ TWO CARDS SHARE A ROW WHEN THEIR Y VALUES ARE CLOSE, NOT WHEN THEY ARE
 * EQUAL — and the first version of this file got that wrong.
 *
 * Found by independent review (Codex, 16 Sep 2026) on the first cut of
 * `solveRestoredCardWidths`, which grouped rows by `Math.round(y)`. Its words,
 * and they are the right summary: **"exact-y absence is not non-overlap."**
 * Cards at y 300 / 301 / 302 fell into three single-member rows, no stride was
 * measurable, the bound lifted, and the board overlapped by 48px — including a
 * genuinely locked middle card, which is the one that cannot move out of the way.
 *
 * ⛔ AND THE CODEBASE ALREADY SAID SO, IN THIS FILE. `normaliseTierRows` speaks
 * of *"preserving ELK's incidental intra-tier Y variation (caused by measured
 * node-height differences)"* — i.e. same-row cards are expected NOT to share an
 * exact y. An exact-equality grouping was refuted by a comment a few hundred
 * lines below it.
 *
 * ⛔⛔ AND THE TOLERANCE THAT USED TO SIT HERE IS GONE — 16 Sep 2026, on Codex's
 * P2 against #1608. It read `|Δy| < round(LAYOUT_LAYER_GAP * 0.6)` = 43px, argued
 * from the smallest separation two genuine sub-rows can have.
 *
 * **That argument only covers INCIDENTAL variation** — a few pixels from differing
 * card heights. It does not cover a MANUAL stagger, which has no bound at all: a
 * reader who drags a card 60px down within its row makes it read as a row of its
 * own, the bound lifts, and the cards overlap. Same 48px, arrived at a third way.
 *
 * ⭐ SO THE ANSWER WITH NO HEIGHT EVIDENCE IS THE SAFE ONE, NOT THE PLAUSIBLE ONE:
 * same tier, same row. The two mistakes are not symmetric, and that decides it —
 * treating two rows as one TIGHTENS the cap (cards draw narrower, nothing
 * overlaps); treating one row as two LIFTS it, which is the defect this function
 * exists to close.
 *
 * ⚠ The cost is real: a tier genuinely split across sub-rows, with no heights, is
 * capped by its closest horizontal neighbour across those rows. Narrower cards on
 * a board that would otherwise overlap. `useRestoredLayoutWidth` now also waits
 * for at least one measured height before using this at all, so the no-height
 * path is the residue rather than the norm.
 */
function shareARow(a: Node, b: Node): boolean {
  const ay = a.position?.y ?? 0
  const by = b.position?.y ?? 0
  // ⭐ FIRST, THE DIRECT EVIDENCE: do the two cards actually overlap vertically?
  // Where heights are known this answers the question outright and needs no
  // tolerance at all — and it closes the gap the tolerance alone leaves, which
  // is two same-row cards whose heights differ by more than `rowEps`.
  const ah = (a as { measured?: { height?: number } }).measured?.height
  const bh = (b as { measured?: { height?: number } }).measured?.height
  if (typeof ah === 'number' && ah > 0 && typeof bh === 'number' && bh > 0) {
    if (ay < by + bh && by < ay + ah) return true
  }
  /**
   * ⛔ WITHOUT HEIGHTS, TREAT THEM AS ONE ROW — do not fall back to a tolerance
   * that can UNDER-group.
   *
   * Codex's P2 on #1608: a hand-dragged row staggered further than the tolerance
   * reads as separate rows, the bound lifts, and the cards overlap. The tolerance
   * was the right answer for INCIDENTAL variation (a few pixels from differing
   * card heights); it is the wrong answer for a MANUAL stagger, which has no
   * bound at all.
   *
   * ⭐ The two mistakes are not symmetric, and that decides this. Treating two
   * rows as one TIGHTENS the cap — cards draw narrower, nothing overlaps.
   * Treating one row as two LIFTS it — the defect. With no height evidence there
   * is nothing to discriminate on, so the answer is the safe one, not the
   * plausible one.
   *
   * ⚠ The cost is real and bounded: a tier genuinely split across sub-rows, with
   * no heights, is capped by its closest horizontal neighbour across those rows.
   * That draws narrower cards on a board that would otherwise overlap. The caller
   * also now waits for measurement before using this at all
   * (`useRestoredLayoutWidth`), so this path is the residue rather than the norm.
   */
  return true
}

export function solveRestoredCardWidths(
  nodes: Node[],
  options: { direction?: LayoutDirection; preserveLocked?: boolean; spacing?: number } = {},
): Record<string, number> {
  const fresh = solveLayoutCardWidths(nodes, options)
  // ⚠ `preserveLocked` is deliberately NOT read here, only forwarded above. The
  // stride is measured over EVERY node (see below), so destructuring it would be
  // an unused binding — and the typecheck gate says so, which is how the first
  // draft of this function was caught.
  const { spacing = LAYOUT_NODE_GAP } = options
  const gap = Math.max(LAYOUT_NODE_GAP, spacing)
  // ⚠ The bound is measured over EVERY node, including locked ones. A locked
  // card is still a same-row neighbour to collide with, so excluding it here
  // would measure a stride the board does not actually have.
  const strideByTier = new Map<number, number>()
  const byTier = new Map<number, Node[]>()
  for (const n of nodes) {
    const tier = tierOf(n)
    const group = byTier.get(tier)
    if (group === undefined) byTier.set(tier, [n])
    else group.push(n)
  }
  for (const [tier, group] of byTier) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (!shareARow(group[i], group[j])) continue
        const stride = Math.abs((group[i].position?.x ?? 0) - (group[j].position?.x ?? 0))
        // A zero stride is two cards at the same x — already degenerate, and not
        // evidence about how much width the row can afford.
        if (stride <= 0) continue
        const seen = strideByTier.get(tier)
        if (seen === undefined || stride < seen) strideByTier.set(tier, stride)
      }
    }
  }
  if (strideByTier.size === 0) return fresh
  const bounded: Record<string, number> = {}
  for (const kind of Object.keys(fresh)) {
    const stride = strideByTier.get(TIER_BY_KIND[kind])
    if (stride === undefined) {
      bounded[kind] = fresh[kind]
      continue
    }
    // Never widen a card past what its own saved row leaves it.
    //
    // ⚠ The invariant that makes this safe is `cap <= stride`, which holds for
    // ANY non-negative gap — so a saved board laid out at a different spacing
    // than the one persisted today is still bounded, merely less tightly.
    //
    // ⚠ A non-positive cap is not a width, it is an unusable measurement (two
    // cards closer together than the gap). Fall through to the fresh answer and
    // leave that board to the single-width limb, rather than returning a zero
    // that every consumer would have to special-case.
    const cap = stride - gap
    bounded[kind] = cap > 0 ? Math.min(fresh[kind], cap) : fresh[kind]
  }
  return bounded
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
): Promise<{
  nodes: Node[]
  edges: Edge[]
  layoutNodeWidth: number
  /** Card width per node KIND — what `BaseNode` must draw at. See
   *  {@link solveLayoutCardWidths}; `{}` means "no better information". */
  layoutCardWidths: Record<string, number>
}> {
  const {
    direction = 'DOWN',
    // ⭐⭐ DEFAULT HORIZONTAL NODE-NODE SPACING — 15 → 32 (12 Sep 2026).
    //
    // The old chain read 60 → 30 → 20 → 15, every step a REDUCTION, and its own
    // note conceded the rendered gap never actually moved below the Math.max
    // floor of 20. That chain was driven by the same pressure as the 12px type:
    // squeeze the model so a camera capped at 100% would appear to fill the
    // pane. With the fit now able to scale a valid box, spacing is free to be a
    // design decision again.
    //
    // 32 is 4 units of the 8pt grid the rest of the product uses, and it is the
    // first value at which two max-width cards read as separate objects rather
    // than a seam. Both the value and the floor move together so the constant
    // and the rendered gap cannot disagree the way they did before.
    spacing = LAYOUT_NODE_GAP,
    layerSpacing,
    preserveLocked = true,
    heightAtLabelBound,
  } = options

  /**
   * ⭐⭐ FLOORS RAISED WITH THE DEFAULTS (12 Sep 2026): 20 → 32 and 30 → 72.
   *
   * The 30px layer floor was the single biggest contributor to the "squashed"
   * reading — tiers sat 30 units apart while the cards between them were up to
   * 320 wide, so the graph had no vertical rhythm at all and every edge ran a
   * near-vertical 30px hop. 72 is 9 units of the 8pt grid and gives a tier
   * separation proportionate to the cards, which is what makes the causal
   * direction legible at a glance rather than something you trace.
   *
   * ⚠ THE FLOORS ARE KEPT, NOT REMOVED. They are what stop a caller passing a
   * value that collapses the graph; `COLLISION_GAP` (20) still governs overlap
   * repair independently, and is deliberately left below the node floor so it
   * remains a last-resort separation rather than a second spacing authority.
   */
  const effectiveNodeSpacing = Math.max(LAYOUT_NODE_GAP, spacing)
  const effectiveLayerSpacing = Math.max(LAYOUT_LAYER_GAP, layerSpacing ?? spacing * 1.5)

  const unlocked = preserveLocked ? nodes.filter(isUnlocked) : nodes

  if (unlocked.length === 0) {
    return { nodes, edges, layoutNodeWidth: NODE_CARD_MAX_W, layoutCardWidths: {} }
  }

  // I.3 perf: O(E) edge filtering via Set instead of O(E*V) double `.some` scan.
  const unlockedIds = new Set<string>()
  for (const n of unlocked) unlockedIds.add(n.id)

  const maxTierCount = maxTierCountOf(unlocked)
  /**
   * ⭐⭐ A TIER MAY USE WIDTH THE BOARD IS ALREADY PAYING FOR.
   *
   * Paul, 15 Sep: *"They don't all have to be the same width. There are always
   * less options, and there's more in it, so making them wider would make
   * sense. I also think the question or initial node and the nodes can be a lot
   * wider."* The measurement agrees — median characters per card, on the
   * `pricing-model` starter:
   *
   *     option 250 · factor 141 · decision 122 · goal 102 · risk 86 · outcome 73
   *
   * An option carried 3.4x an outcome's content in an identical 336px box.
   *
   * ⭐ THE BOUND IS DERIVED, NOT CHOSEN, AND THAT IS THE WHOLE ARGUMENT. The
   * board is already as wide as its WIDEST row. A tier with fewer cards in it
   * has slack against that width by construction, so letting it spend the slack
   * costs the board nothing — there is nothing wider for it to become. A tier
   * already AT the bound (the widest one, by definition) keeps exactly today's
   * width, so no graph gets wider and none of the existing row arithmetic moves.
   *
   * ⚠ AND IT IS OFF ENTIRELY IN THE ROW-PACKING REGIME (`splits`). There the
   * box is already clamped to `NODE_LAYOUT_MIN_W` because the tier does not fit
   * on one row; widening a card whose tier is being wrapped would make the wrap
   * worse. `splits` is read, never re-derived from the width — see
   * `planLayoutBox`.
   */
  const tierOccupancy = tierOccupancyOf(unlocked)

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

  const tierBoxW = (tier: number): number =>
    tierBoxWidth(tier, tierOccupancy, elkBoxW, splits, gap, maxTierCount)

  const getNodeDimensions = (node: Node): { width: number; height: number } => {
    const measured = (node as unknown as { measured?: { width?: number; height?: number } }).measured

    const fallbackType = (node.type ?? (node.data as Record<string, unknown> | undefined)?.kind) as keyof typeof NODE_REGISTRY | undefined
    const defaultSize = fallbackType && NODE_REGISTRY[fallbackType]
      ? NODE_REGISTRY[fallbackType].defaultSize
      : { width: 220, height: DEFAULT_NODE_HEIGHT }

    // ⭐ THE BOUND FIRST, and only then the live measurement. See
    // `heightAtLabelBound` on `LayoutOptions`: `measured.height` is the height
    // at TODAY'S ZOOM, and the row stride computed from it is wrong at every
    // other zoom. A node absent from the map falls through to the existing
    // precedence unchanged — absence is "no better information", never zero.
    const bound = heightAtLabelBound?.get(node.id)
    const rawHeight = (typeof bound === 'number' && bound > 0 ? bound : undefined)
      ?? measured?.height ?? node.height ?? defaultSize.height
    const height = Math.max(40, Math.round(rawHeight) + LAYOUT_PADDING_Y)

    const width = tierBoxW(tierOf(node))
    return { width, height }
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

  // ⭐ ONE derivation, not two. The render width comes from the SAME
  // `tierBoxWidth` the ELK children were built with, so the card cannot draw at
  // a width the placement did not allow for.
  const layoutCardWidths: Record<string, number> = {}
  for (const kind of Object.keys(TIER_BY_KIND)) {
    layoutCardWidths[kind] = tierBoxW(TIER_BY_KIND[kind]) - LAYOUT_PADDING_X
  }

  return { nodes: updatedNodes, edges, layoutNodeWidth: nodeW, layoutCardWidths }
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

  const allIds = [...positionMap.keys()]
  const rows = groupByYRow(allIds, positionMap)

  /**
   * ⚠ THE STRIDE IS THE ROW'S OWN WIDTHS, NOT ONE GLOBAL BOX. This read
   * `rowIds.length * elkBoxW` and advanced by a constant `elkBoxW + gap`, which
   * is correct only while every card on the board is identically wide. Tiers
   * now carry different widths (see `tierBoxWidth`), so a uniform stride would
   * leave a wide row's cards overlapping and a narrow row's gapped. Summing the
   * actual widths reduces EXACTLY to the old arithmetic when they are uniform,
   * which is why the 83 existing geometry pins still hold.
   */
  for (const rowIds of rows.values()) {
    if (rowIds.length === 0) continue
    let rowWidth = (rowIds.length - 1) * gap
    for (const id of rowIds) rowWidth += widthOf(id)
    let x = graphSpineX - rowWidth / 2
    for (const id of rowIds) {
      const p = positionMap.get(id)
      if (!p) continue
      positionMap.set(id, { x, y: p.y })
      x += widthOf(id) + gap
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
