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
 *
 * ⭐ S4 UPDATE (24 Sep 2026). Experience Design has since ruled the packing
 * itself: rows above a fixed count wrap (`MAX_CARDS_PER_ROW`), the card width is
 * a fair share of the budget floored at legibility, and the row-end prompt's
 * slot is inside the budget. That is still a CONSTANT policy — nothing here
 * reads the viewport — so R1 holds. Gap 7 (25 Sep 2026) moved the count from
 * five to four, so no row is wider than four cards and a prompt (1424 units),
 * against 1740 for five and 2544 for an eight-card row before S4: see
 * `MAX_CARDS_PER_ROW` and `laptopFit.arithmetic.spec.ts`.
 */
// P1 Polish: Dynamic ELK import for code-splitting (Task F)
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js'

type ElkModule = typeof import('elkjs/lib/elk.bundled.js')
let elkModule: Promise<ElkModule> | null = null
/**
 * ELK, fetched once and kept. A FAILED fetch is not kept, so the next call
 * tries again rather than replaying the rejection. `usePreloadLayoutEngine`
 * calls this at canvas mount so the engine is in memory before a deploy can
 * retire its chunk (#70 5841781894).
 */
export function loadLayoutEngine(): Promise<ElkModule> {
  if (!elkModule) {
    elkModule = import('elkjs/lib/elk.bundled.js').catch((err: unknown) => {
      elkModule = null
      throw err
    })
  }
  return elkModule
}
import { Node, Edge } from '@xyflow/react'
import { NODE_REGISTRY } from '../domain/nodes'
import {
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  DEFAULT_NODE_HEIGHT,
  COLLISION_GAP,
  CANVAS_MARGIN,
  TIER_BY_KIND,
  cardWidthCapForTier,
  LAYOUT_NODE_GAP,
  LAYOUT_LAYER_GAP,
  MAX_CARDS_PER_ROW,
  NODE_LAYOUT_MIN_W,
  REPEATED_CARD_W,
  ROW_BUDGET_W,
  ROW_PROMPT_W,
  rowPromptKindsFor,
  rowPromptColumnHeight,
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

function kindOfNode(node: Node): string | undefined {
  return (node.type ?? (node.data as Record<string, unknown> | undefined)?.kind) as string | undefined
}

function tierOccupancyOf(unlocked: Node[]): Map<number, number> {
  const occ = new Map<number, number>()
  for (const n of unlocked) {
    const t = tierOf(n)
    occ.set(t, (occ.get(t) ?? 0) + 1)
  }
  return occ
}

function kindsByTierOf(unlocked: Node[]): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>()
  for (const n of unlocked) {
    const kind = kindOfNode(n)
    if (kind === undefined) continue
    const t = tierOf(n)
    const set = out.get(t)
    if (set) set.add(kind)
    else out.set(t, new Set([kind]))
  }
  return out
}

/**
 * ⭐⭐ S4 — HOW MANY CARDS GO ON EACH SUB-ROW OF A TIER (Experience Design, #63
 * 5806207128 / 5806266691: "Rows above 5 cards wrap into balanced sub-rows under
 * ONE left label … 6→3+3, 7→4+3, 8→4+4, 9→5+4 … 10→5+5"). Gap 7 moved the cap
 * to four for the 1280 acceptance frame (see `MAX_CARDS_PER_ROW`): 5→3+2 … 9→3+3+3.
 *
 * `ceil(n / MAX_CARDS_PER_ROW)` rows, sizes differing by at most one, the larger
 * rows FIRST — so reading order runs left to right, then down, and the final
 * sub-row (where the row-end prompt stands) is never the longer one.
 *
 * ⚠ A COUNT, NOT A WIDTH. The retired single-row gate compared a fair share
 * against a threshold, so a type-ramp change could move a tier between packings;
 * a count cannot.
 */
export function balancedRowSizes(count: number, maxPerRow: number = MAX_CARDS_PER_ROW): number[] {
  if (!(count > 0) || !(maxPerRow > 0)) return []
  const rows = Math.ceil(count / maxPerRow)
  const base = Math.floor(count / rows)
  const remainder = count % rows
  return Array.from({ length: rows }, (_, r) => (r < remainder ? base + 1 : base))
}

/**
 * The width, in box units, a tier's row-end prompt takes at the end of its final
 * sub-row: the ordinary gap before it, then the prompt. The prompt has no ELK
 * padding of its own, so the visible gap before it equals the visible gap
 * between two cards (`LAYOUT_PADDING_X + gap`).
 */
function promptSlotWidth(promptKinds: readonly string[], gap: number): number {
  return promptKinds.length > 0 ? gap + ROW_PROMPT_W : 0
}

/**
 * ⭐⭐ THE CARD WIDTH FOR ONE TIER — the single authority, called by `layoutGraph`
 * (which places on it), {@link solveLayoutCardWidths} (which tells the card what
 * to draw at) and {@link solveLayoutNodeWidth}. Two copies of this arithmetic is
 * exactly the hand-maintained mirror that once made a card render at one width
 * and lay out at another.
 *
 * ED S4: "A card is never wider than its row's fair share of the row budget."
 * The fair share is taken for the tier's WIDEST sub-row of `k` cards, with the
 * row-end prompt slot inside the budget:
 *
 *     share = floor((ROW_BUDGET_W − promptSlot − (k−1)·gap) / k) − padding   (was CANONICAL_LAYOUT_WIDTH, 1482, until 30 Sep)
 *     width = max(REPEATED_CARD_W, min(tier cap, share))   (REPEATED_CARD_W ≥ NODE_LAYOUT_MIN_W)
 *
 * ⚠ LEGIBILITY WINS OVER THE BUDGET, in that order and on purpose: a share below
 * the floor would draw a card narrower than its widest title word at the
 * counter-scale bound, which is the mid-word-break defect #758 shipped. With
 * today's constants the share never binds on a repeated tier (its cap IS the
 * floor); a four-card row with its prompt (1424) sits inside the budget, which
 * a five-card row (1740) did not — see `laptopFit.arithmetic.spec.ts`.
 *
 * ⭐ A SPLIT ROW KEEPS FULL CARD WIDTH. The retired gate dropped every card on
 * the board to `NODE_LAYOUT_MIN_W` as soon as any tier split; here a tier's width
 * depends only on its own widest sub-row.
 */
function tierCardWidth(
  tier: number,
  widestSubRow: number,
  promptKinds: readonly string[],
  gap: number,
  subRowCount: number = 1,
): number {
  const k = Math.max(1, widestSubRow)
  const rowShare =
    Math.floor((ROW_BUDGET_W - promptSlotWidth(promptKinds, gap) - (k - 1) * gap) / k) -
    LAYOUT_PADDING_X
  // ⭐ A WRAPPED TIER ALSO HAS A BRICK-SHIFTED COURSE (`brickRowOffsets`): one course
  // starts half a stride in, so its right edge is (k + ½)·box + (k − ½)·gap. With
  // the flat 248 card that never reached the budget. Once cards take their fair
  // share (30 Sep), the 4+4 factor tier's shifted course ran 111 units past the
  // 1280 frame (right edge 1767 against 1656), so the share must fit that course too.
  const brickShare =
    subRowCount > 1
      ? Math.floor((ROW_BUDGET_W - (k - 0.5) * gap) / (k + 0.5)) - LAYOUT_PADDING_X
      : Number.POSITIVE_INFINITY
  const share = Math.min(rowShare, brickShare)
  // ⚠ THE FLOOR IS THE REPEATED-CARD WIDTH, not `NODE_LAYOUT_MIN_W` (27 Sep 2026).
  // They were the same number (260) until the landing text ceiling put the
  // legibility floor (190.88) under the ED repeated-card target (248); a floor
  // below the repeated width let a wide gap bind the share on a repeated tier —
  // breaking S4's one reachable width and letting `solveLayoutNodeWidth` and this
  // disagree (`layoutNodeWidthDerivation.spec.ts`). `REPEATED_CARD_W` is
  // max(target, NODE_LAYOUT_MIN_W), so legibility still wins over the budget.
  return Math.max(REPEATED_CARD_W, Math.min(cardWidthCapForTier(tier), share))
}

interface TierPlan {
  /** Cards per sub-row, top to bottom (one entry when the tier does not wrap). */
  readonly rowSizes: readonly number[]
  /** The prompt kinds standing at the end of the final sub-row, in stack order. */
  readonly promptKinds: readonly string[]
  /** The width every card in this tier draws at. */
  readonly cardW: number
}

/**
 * ⭐ ONE PLAN PER TIER — a pure function of the tier occupancies, the kinds
 * present, the direction and the gap, every one of which already survives a
 * reload. That is why the width is DERIVED on restore rather than persisted
 * (see {@link solveRestoredCardWidths}).
 *
 * Row wrapping and prompt slots are DOWN-only, as the old splitting was: in the
 * other directions a "row" is not a horizontal line and there is no row end.
 */
function planTiers(unlocked: Node[], isDownLayout: boolean, gap: number): Map<number, TierPlan> {
  const occupancy = tierOccupancyOf(unlocked)
  const kinds = kindsByTierOf(unlocked)
  const plans = new Map<number, TierPlan>()
  for (const [tier, count] of occupancy) {
    const rowSizes = isDownLayout ? balancedRowSizes(count) : [count]
    const promptKinds = isDownLayout ? rowPromptKindsFor(tier, kinds.get(tier) ?? new Set()) : []
    plans.set(tier, {
      rowSizes,
      promptKinds,
      cardW: tierCardWidth(tier, Math.max(...rowSizes), promptKinds, gap, rowSizes.length),
    })
  }
  return plans
}

/** The width a tier's cards draw at, falling back to a one-card plan for a tier
 *  with no unlocked members (it still needs a width for its locked or future
 *  cards). */
function cardWidthFromPlan(plans: Map<number, TierPlan>, tier: number, gap: number): number {
  return plans.get(tier)?.cardW ?? tierCardWidth(tier, 1, [], gap)
}

/** The tier every kind the layout does not name falls into — `tierOf`'s default. */
const UNKNOWN_KIND_TIER = 2

/**
 * ⭐⭐ THE WIDTH A CARD MUST RENDER AT FOR A GIVEN GRAPH'S POSITIONS TO BE RIGHT —
 * the single width, for a kind the per-kind record does not name.
 *
 * `layoutGraph` places nodes on a stride computed from the card widths and
 * reports them back so `BaseNode` can size the card to match. That handshake is
 * SESSION-ONLY (`layoutStore.setLayoutNodeWidth` does not persist), so on RELOAD
 * the width has to be re-derived — and it can be, because it is not independent
 * information: it is a pure function of the graph, the direction and
 * `preserveLocked`, all of which survive a reload.
 *
 * S4: it is the width of the tier an unknown kind lands in (`tierOf` defaults to
 * tier 2), which is the repeated-card width. `layoutNodeWidthDerivation.spec.ts`
 * re-runs the agreement with `layoutGraph` across directions and tier sizes.
 */
export function solveLayoutNodeWidth(
  nodes: Node[],
  options: { direction?: LayoutDirection; preserveLocked?: boolean; spacing?: number } = {},
): number {
  const { direction = 'DOWN', preserveLocked = true, spacing = LAYOUT_NODE_GAP } = options
  const unlocked = preserveLocked ? nodes.filter(isUnlocked) : nodes
  if (unlocked.length === 0) return REPEATED_CARD_W
  const gap = Math.max(LAYOUT_NODE_GAP, spacing)
  return cardWidthFromPlan(planTiers(unlocked, direction === 'DOWN', gap), UNKNOWN_KIND_TIER, gap)
}

/**
 * ⭐⭐ THE WIDTH EACH KIND OF CARD MUST DRAW AT for this graph's positions to be
 * right — the per-kind sibling of {@link solveLayoutNodeWidth}, and derived for
 * the same reason it is: the width is NOT independent information.
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
  const plans = planTiers(unlocked, direction === 'DOWN', gap)
  const widths: Record<string, number> = {}
  for (const kind of Object.keys(TIER_BY_KIND)) {
    widths[kind] = cardWidthFromPlan(plans, TIER_BY_KIND[kind], gap)
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
 * is measured from the saved positions: per tier, the dominant (median)
 * centre-to-centre distance between adjacent cards sharing a row, minus the gap
 * the layout guarantees — never less than the card floor (see the loop below
 * for why it is not the smallest pair, F1). Reusing the rule rather than inventing a second one is deliberate —
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
    /**
     * ⛔⛔ RETURN THE ANSWER, DO NOT FALL THROUGH — corrected 16 Sep 2026 on
     * Codex's P2 against #1617, which was my own fix for its P2 against #1608.
     *
     * The first cut read `if (overlap) return true` and then fell through to the
     * no-evidence `return true` below. So where heights were KNOWN and PROVED no
     * overlap, the answer was still "same row": genuinely separate sub-rows were
     * merged and their cards shrank for nothing. Measured by the reviewer —
     * 100px cards at y 300 / 1000 / 1700 shared a row and went 440 -> 336.
     *
     * ⭐ When both heights are known there IS evidence, so the honest answer is
     * the measurement, in both directions. The conservative `true` below is for
     * ABSENCE of evidence — it was never meant to override evidence that exists.
     *
     * ⚠ AND MY OWN SUITE COULD NOT SEE IT, for the third time in this family:
     * every fixture either carried no heights, or carried heights that DID
     * overlap. "Known heights, genuinely separate" was the one case I never
     * wrote, and it is exactly the case the fall-through broke.
     */
    return ay < by + bh && by < ay + ah
  }
  /**
   * ⛔ WITHOUT HEIGHTS — and ONLY without them — TREAT THEM AS ONE ROW, rather
   * than falling back to a tolerance that can UNDER-group.
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
  /**
   * ⛔⛔ THE TIER'S STRIDE IS THE ONE ITS LAYOUT USED — THE DOMINANT ADJACENT
   * STRIDE — NOT THE CLOSEST PAIR ON THE BOARD (canvas audit edit-structure/F1,
   * 27 Sep 2026, reproduced on the served build).
   *
   * This read the MINIMUM over every same-row pair. One card the user moved
   * 90 units towards its neighbour (`build-vs-buy`, stride 296 -> 206) then
   * capped EVERY factor at 182, drawn at the 191 floor; the narrower cards
   * wrapped taller and two cards the user never touched overlapped the row
   * below. Narrowing is not the free, safe direction the notes on `shareARow`
   * assume: a narrower card is a TALLER card, and a taller card crosses the
   * next row.
   *
   * ⭐ Each card contributes the stride to its nearest same-row neighbour on the
   * right, and the tier takes the MEDIAN of those (the upper middle on an even
   * count). A layout places a row on one stride, so a board it wrote — however
   * old, however narrow — still reads as that stride and is still bounded by it.
   * A minority of hand-moved pairs cannot set it, in either direction; their
   * overlap is the user's own, local and visible. An even split (a three-card
   * row with one card moved) resolves to the WIDER stride for the reason above:
   * the narrow reading shrinks the whole kind, the wide one touches one pair.
   *
   * ⚠ A TIER WITH ONE SAME-ROW PAIR CANNOT TELL A HAND MOVE FROM A NARROW LAYOUT
   * — the pair is all the evidence there is, so it still bounds. Stated, not
   * solved: a two-card row whose cards are pushed together narrows both.
   */
  for (const [tier, group] of byTier) {
    const adjacent: number[] = []
    for (let i = 0; i < group.length; i++) {
      const xi = group[i].position?.x ?? 0
      let nearest = Number.POSITIVE_INFINITY
      for (let j = 0; j < group.length; j++) {
        if (j === i) continue
        const dx = (group[j].position?.x ?? 0) - xi
        // Right-hand neighbours only, so each adjacent pair is counted once. A
        // zero stride is two cards at the same x — already degenerate, and not
        // evidence about how much width the row can afford.
        if (dx <= 0 || dx >= nearest) continue
        if (!shareARow(group[i], group[j])) continue
        nearest = dx
      }
      if (nearest !== Number.POSITIVE_INFINITY) adjacent.push(nearest)
    }
    if (adjacent.length === 0) continue
    adjacent.sort((a, b) => a - b)
    strideByTier.set(tier, adjacent[Math.floor(adjacent.length / 2)])
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
    //
    // ⛔ AND A POSITIVE CAP BELOW `NODE_LAYOUT_MIN_W` IS NOT A WIDTH EITHER — it is
    // narrower than `BaseNode`'s own CSS `minWidth`, so no card can ever draw it
    // (F1 published 182 and 124; both drew at 191). The answer is the narrowest
    // width a card CAN draw, never the fresh one: on a board laid out at a narrow
    // stride the floor is the least overlap available without moving anything,
    // and the fresh width would widen every pair. What changes is only that the
    // published record now says what is on screen — `BaseNode` bounds the title's
    // measure by it, and a record 9 units narrower than the card mis-measured it.
    const cap = stride - gap
    bounded[kind] = cap > 0 ? Math.min(fresh[kind], Math.max(cap, NODE_LAYOUT_MIN_W)) : fresh[kind]
  }
  return bounded
}

/**
 * ⭐⭐ NO OVERLAP BEATS AN OLD STRIDE — A RESTORED ROW TOO TIGHT FOR THE NARROWEST
 * CARD IS RE-SPREAD (Canvas owner, 27 Sep 2026, canvas/landing-text-cap).
 *
 * `solveRestoredCardWidths` can narrow a card only as far as `NODE_LAYOUT_MIN_W`,
 * the card's own CSS floor. The landing text cap raised that floor 190.88 →
 * 221.12, so a board saved before 17 Aug at a 196 stride (140 cards, 56 gap)
 * overlaps by 25.12 on reopen however narrow the record says the card is — no
 * width repairs it. The owner's rule, which relaxes "never move a node" for this
 * one case:
 *
 *   - a row whose saved stride — the MEDIAN adjacent stride, the width solver's
 *     own reading — is below `NODE_LAYOUT_MIN_W` + the sibling gap is re-spread
 *     to the minimum workable stride (that sum, rounded up to a whole unit), in
 *     its saved card order, every y kept;
 *   - a row whose saved stride fits stays exactly as saved, hand-moved cards in
 *     it included (their overlap is the user's own, local and visible — F1).
 *
 * ⛔ ONLY THE CARDS THAT ARE TOO TIGHT MOVE, EACH RUN ABOUT ITS MEDIAN CARD
 * (Delivery Lead, #2235 r1). The first cut spread the WHOLE row about the
 * midpoint of its first and last card, so one card the user had dragged 2,000
 * units off the end dragged the row's centre with it: the DL's probe (four
 * cards at a 196 stride, one at x 2,600) moved the tight cards +808 to +958 and
 * pulled the far card back across the board. Now the row is cut at every
 * adjacent step that already clears the floor + gap, so a card that far off is
 * its own run and is left where the user put it. Each run of two or more cards
 * is spread about its MEDIAN card (its middle pair's midpoint on an even
 * count), so an odd card at one end cannot shift it, and no card moves further
 * than the floor requires. Where a spread run would now come within the floor
 * of its neighbour run, the two are merged and spread as one, until no two runs
 * crowd each other — so the result never overlaps and never reorders.
 *   The TRIGGER is unchanged, and deliberately so: it is still the median stride
 * of the whole row. An outlier cannot push a row UNDER the floor (a far card
 * only adds one wide step), and reading a row with one card dragged close as
 * "sub-floor" would re-spread a fitting row the user arranged, which F1 forbids.
 *
 * ⚠ WHAT IT WILL NOT MOVE:
 *   - A row without height evidence on every card. A row is `shareARow`'s
 *     answer, and with no heights its safe answer is "same tier, same row" —
 *     safe for a width, wrong for a position: it merges two sub-rows, which a
 *     re-spread would interleave. `useRestoredLayoutWidth` calls this only once
 *     every card is measured, so this is the residue, not the norm.
 *   - A row holding a locked card, while `preserveLocked` is on.
 *   - A card with no same-row neighbour (the Question, the Goal): it cannot
 *     overlap one.
 *   - A card already clear of both neighbours by the floor + gap, unless a
 *     spread neighbour run grows into it.
 *
 * ⚠ IT PLANS AND WRITES NOTHING. `planSubFloorRespread` returns the new x of
 * each card that moves, and nothing else; `respreadSubFloorRows` applies it and
 * returns the SAME array when no card moves, and the same node object for every
 * card it does not move. A re-spread row reads as fitting on the next restore,
 * so the rule applies once.
 */
export function planSubFloorRespread(
  nodes: ReadonlyArray<Node>,
  options: { preserveLocked?: boolean; spacing?: number } = {},
): ReadonlyMap<string, number> {
  const { preserveLocked = true, spacing = LAYOUT_NODE_GAP } = options
  const gap = Math.max(LAYOUT_NODE_GAP, spacing)
  const need = NODE_LAYOUT_MIN_W + gap
  const workable = Math.ceil(need)
  const measured = (n: Node) => {
    const h = (n as { measured?: { height?: number } }).measured?.height
    return typeof h === 'number' && h > 0
  }
  const byTier = new Map<number, Node[]>()
  for (const n of nodes) {
    // A hidden card is not drawn, so it neither overlaps nor is measured.
    if ((n as { hidden?: boolean }).hidden === true) continue
    const tier = tierOf(n)
    const group = byTier.get(tier)
    if (group === undefined) byTier.set(tier, [n])
    else group.push(n)
  }
  const movedX = new Map<string, number>()
  for (const group of byTier.values()) {
    // Rows = cards joined by `shareARow`, transitively (a staggered row is one row).
    const rowOf = group.map((_, i) => i)
    const find = (i: number): number => (rowOf[i] === i ? i : (rowOf[i] = find(rowOf[i])))
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (shareARow(group[i], group[j])) rowOf[find(i)] = find(j)
      }
    }
    const rows = new Map<number, Node[]>()
    group.forEach((n, i) => {
      const r = rows.get(find(i))
      if (r === undefined) rows.set(find(i), [n])
      else r.push(n)
    })
    for (const row of rows.values()) {
      if (row.length < 2 || !row.every(measured)) continue
      if (preserveLocked && !row.every(isUnlocked)) continue
      // Saved order: by x, ties kept in array order (`sort` is stable).
      const ordered = [...row].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))
      const xs = ordered.map((n) => n.position?.x ?? 0)
      const steps = xs.slice(1).map((x, i) => x - xs[i])
      const sortedSteps = [...steps].sort((a, b) => a - b)
      // The upper middle on an even count, as `solveRestoredCardWidths` reads it.
      if (sortedSteps[Math.floor(sortedSteps.length / 2)] >= need) continue

      // Runs of cards too tight for the floor, cut at every step that clears it.
      const runs: Array<{ from: number; to: number }> = []
      let from = 0
      steps.forEach((step, i) => {
        if (step >= need) {
          runs.push({ from, to: i })
          from = i + 1
        }
      })
      runs.push({ from, to: xs.length - 1 })
      // A lone card keeps its saved x; a run is spread about its median card.
      const place = (run: { from: number; to: number }): number[] => {
        const members = xs.slice(run.from, run.to + 1)
        if (members.length === 1) return members
        const k = members.length
        const median = k % 2 === 1 ? members[(k - 1) / 2] : (members[k / 2 - 1] + members[k / 2]) / 2
        return members.map((_, i) => median + (i - (k - 1) / 2) * workable)
      }
      // Merge any two neighbouring runs the spread has brought within the floor.
      for (let r = 0; r + 1 < runs.length; ) {
        const left = place(runs[r])
        const right = place(runs[r + 1])
        if (right[0] - left[left.length - 1] < need) {
          runs.splice(r, 2, { from: runs[r].from, to: runs[r + 1].to })
          r = Math.max(0, r - 1) // the merged run may now crowd the run before it
        } else {
          r += 1
        }
      }
      for (const run of runs) {
        place(run).forEach((x, i) => {
          const n = ordered[run.from + i]
          if (x !== (n.position?.x ?? 0)) movedX.set(n.id, x)
        })
      }
    }
  }
  return movedX
}

/**
 * Apply `planSubFloorRespread`'s x values: x only, and only for the cards named.
 * Returns the SAME array when no card changes, and the same object for every
 * card that does not. Also the functional write `useRestoredLayoutWidth` makes
 * against the store's CURRENT nodes, so a write that landed after its render is
 * kept (Delivery Lead, #2235 r1).
 */
export function applyRespreadX<T extends Node>(nodes: T[], movedX: ReadonlyMap<string, number>): T[] {
  if (movedX.size === 0) return nodes
  let changed = false
  const next = nodes.map((n) => {
    const x = movedX.get(n.id)
    if (x === undefined || x === n.position?.x) return n
    changed = true
    return { ...n, position: { ...n.position, x } }
  })
  return changed ? next : nodes
}

export function respreadSubFloorRows(
  nodes: Node[],
  options: { preserveLocked?: boolean; spacing?: number } = {},
): Node[] {
  return applyRespreadX(nodes, planSubFloorRespread(nodes, options))
}

/**
 * Lay out a decision graph using ELK + the deterministic semantic pipeline.
 *
 * Pipeline (DOWN layouts):
 *   1. Filter locked nodes (their saved positions are returned untouched).
 *   2. Plan each tier against the CANONICAL (viewport-free) budget: its card
 *      width, its balanced sub-rows and its row-end prompt slot (`planTiers`).
 *   3. Run ELK with each tier's box width and the resolved `gap`.
 *   4. Wrap every tier above `MAX_CARDS_PER_ROW` into balanced sub-rows.
 *   5. Override ELK's Y with deterministic canonical tier rows, reserving the
 *      prompt column's height on each family's final sub-row.
 *   6. Place each tier as one block centred on the graph spine (median of
 *      decision + option centres; goal excluded), sub-rows left-aligned and the
 *      prompt slot at the end of the final sub-row.
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
  /**
   * ⭐ v3.1 LANDING COMPOSITION (WS1, 26 Sep 2026): THE ROW GAP IS ONE CONSTANT.
   * The persisted `layerSpacing` (48 comfortable / 30 compact) could only ever
   * RAISE this — the density toggle that wrote it is gone (A19) — so a stale
   * per-browser setting was the one thing still able to change the canonical
   * row stride (R1: the shared model's shape has no per-user input). The
   * option is accepted and ignored; `LAYOUT_LAYER_GAP` is the gap.
   */
  const effectiveLayerSpacing = LAYOUT_LAYER_GAP

  const unlocked = preserveLocked ? nodes.filter(isUnlocked) : nodes

  if (unlocked.length === 0) {
    return { nodes, edges, layoutNodeWidth: REPEATED_CARD_W, layoutCardWidths: {} }
  }

  // I.3 perf: O(E) edge filtering via Set instead of O(E*V) double `.some` scan.
  const unlockedIds = new Set<string>()
  for (const n of unlocked) unlockedIds.add(n.id)

  const isDownLayout = direction === 'DOWN'
  const gap = effectiveNodeSpacing

  /**
   * ⭐⭐ S4 — ONE PLAN PER TIER (Experience Design, #63 5806207128 / 5806266691).
   * Repeated cards at `REPEATED_CARD_W`, the Question and the Goal at most
   * `ANCHOR_CARD_MAX_W`, rows above `MAX_CARDS_PER_ROW` wrapped into balanced
   * sub-rows, and the row-end prompt's slot reserved at the end of each family's
   * final sub-row. `planTiers` is the SAME code `solveLayoutCardWidths` and
   * `solveLayoutNodeWidth` run, so the restore path cannot drift from this one.
   *
   * ⚠ THIS SUPERSEDES the per-tier widening of 15 Sep ("a tier may use width the
   * board is already paying for") — ED: that was permission, not a requirement
   * to keep options at ~300–430px. See `CARD_W_CAP_BY_TIER`.
   */
  const plans = planTiers(unlocked, isDownLayout, gap)
  const cardWOf = (tier: number): number => cardWidthFromPlan(plans, tier, gap)
  const tierBoxW = (tier: number): number => cardWOf(tier) + LAYOUT_PADDING_X
  /** The box a width-less stray falls back to — the repeated card's. */
  const fallbackBoxW = REPEATED_CARD_W + LAYOUT_PADDING_X

  /**
   * The row-end prompt's reservation, per tier: WIDTH at the end of the final
   * sub-row (inside the row budget, ED S4) and HEIGHT for the frontier column —
   * so a shared Outcome + Risk column of two stacked prompts can never hang
   * into the gap above the Goal. Height is in box units, like every card
   * (`+ LAYOUT_PADDING_Y`).
   */
  const promptSlotByTier = new Map<number, number>()
  const promptRowFloorByTier = new Map<number, number>()
  for (const [tier, plan] of plans) {
    if (plan.promptKinds.length === 0) continue
    promptSlotByTier.set(tier, promptSlotWidth(plan.promptKinds, gap))
    promptRowFloorByTier.set(tier, rowPromptColumnHeight(plan.promptKinds.length) + LAYOUT_PADDING_Y)
  }

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

  const ELK = (await loadLayoutEngine()).default
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

  if (isDownLayout) {
    applyTierRowSplitting(positionMap, sizeMap, tierAssignments, MAX_CARDS_PER_ROW, fallbackBoxW, gap, effectiveLayerSpacing, splitterCreatedTiers, inTierCausalDepth(tierAssignments, edges))
    normaliseTierRows(positionMap, sizeMap, tierAssignments, effectiveLayerSpacing, splitterCreatedTiers, promptRowFloorByTier)
    placeTierRowsOnSpine(positionMap, sizeMap, unlocked, tierAssignments, fallbackBoxW, gap, promptSlotByTier)
    // X is final only now, so this is the first point the consequence row can be
    // ordered against where its factors actually stand.
    orderConsequenceRowsByUpstream(positionMap, sizeMap, tierAssignments, edges, fallbackBoxW)
  }

  applyCollisionGuard(positionMap, sizeMap, fallbackBoxW)
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
        position: { x: rescueIndex * (fallbackBoxW + LAYOUT_PADDING_X), y: maxY + fallbackBoxW },
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
    layoutCardWidths[kind] = cardWOf(TIER_BY_KIND[kind])
  }

  return { nodes: updatedNodes, edges, layoutNodeWidth: cardWOf(UNKNOWN_KIND_TIER), layoutCardWidths }
}

// ---------------------------------------------------------------------------
// Multi-row tier splitting (balanced via exact-remainder distribution)
// ---------------------------------------------------------------------------
/**
 * ⭐ S4: EVERY TIER WITH MORE THAN `maxPerRow` CARDS WRAPS, ON ITS OWN COUNT.
 *
 * The retired gate split with ONE board-wide `nodesPerRow`, and only once the
 * WIDEST tier failed the single-row test — so an eight-card factor row stayed on
 * one 2544-unit line. Now each tier is judged by its own count, and the sizes
 * come from {@link balancedRowSizes} (6→3+3, 7→4+3, …), the same function the
 * width plan reads, so the widest sub-row the width was solved for is the one
 * that is actually built.
 *
 * ORDER: cards are dealt left to right, top row first, in (in-tier causal depth,
 * then ELK's crossing-minimised x, then id) order. The X written here is
 * provisional — `placeTierRowsOnSpine` owns X; this owns which sub-row a card is
 * on and its provisional Y.
 *
 * ⭐ A CAUSE IS NEVER DEALT BELOW ITS EFFECT (27 Sep 2026, Paul's MRR model,
 * served e8ba18e6). Dealing on x alone put "Pro paying subscribers" in the
 * factor band's FIRST row and "Monthly new Pro subscribers", which drives it, in
 * the second, so the link ran UP into the bottom of its target. `depthOf` is the
 * longest same-tier path to each card (`inTierCausalDepth`); dealing on it first
 * means every same-tier link runs down or across, never up. Row SIZES are
 * unchanged (`balancedRowSizes`), so no card, row or width is added.
 */
function applyTierRowSplitting(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  tierAssignments: Map<number, string[]>,
  maxPerRow: number,
  fallbackBoxW: number,
  gap: number,
  layerSpacing: number,
  splitterCreatedTiers?: Set<number>,
  depthOf?: ReadonlyMap<string, number>,
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

    const sizes = balancedRowSizes(nodeIds.length, maxPerRow)
    if (sizes.length <= 1) continue

    // Record that this tier was deliberately split into multiple rows so
    // normaliseTierRows can preserve those rows. Without this signal, it
    // would treat any intra-tier ELK Y variation as a sub-row split, which
    // staggers options when measured node heights differ.
    splitterCreatedTiers?.add(tier)

    const sorted = [...nodeIds].sort((a, b) => {
      const ad = depthOf?.get(a) ?? 0
      const bd = depthOf?.get(b) ?? 0
      if (ad !== bd) return ad - bd
      const ax = positionMap.get(a)?.x ?? 0
      const bx = positionMap.get(b)?.x ?? 0
      if (ax !== bx) return ax - bx
      return a < b ? -1 : a > b ? 1 : 0
    })

    const rows: string[][] = []
    let cursor = 0
    for (const size of sizes) {
      rows.push(sorted.slice(cursor, cursor + size))
      cursor += size
    }

    const baseY = positionMap.get(sorted[0])?.y ?? 0
    const nodeH = sizeMap.get(sorted[0])?.height ?? (DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y)
    const elkW = sizeMap.get(sorted[0])?.width ?? fallbackBoxW

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
 * The longest path to each card over links whose BOTH ends sit in the same tier
 * (0 = no same-tier cause). Read by `applyTierRowSplitting` so a cause is never
 * dealt into a lower sub-row than its effect. Bounded relaxation (at most the
 * tier's size in passes), so a same-tier cycle cannot loop; its members keep
 * whatever depth the bound reached, and the x order decides among them.
 * Pure. Exported for unit testing.
 */
export function inTierCausalDepth(
  tierAssignments: ReadonlyMap<number, readonly string[]>,
  edges: ReadonlyArray<{ source: string; target: string }>,
): Map<string, number> {
  const tierOfId = new Map<string, number>()
  for (const [tier, ids] of tierAssignments) for (const id of ids) tierOfId.set(id, tier)
  const depth = new Map<string, number>()
  for (const id of tierOfId.keys()) depth.set(id, 0)
  const inTier = edges.filter(
    (e) => e.source !== e.target && tierOfId.has(e.source) && tierOfId.get(e.source) === tierOfId.get(e.target),
  )
  if (inTier.length === 0) return depth
  let maxTierSize = 0
  for (const ids of tierAssignments.values()) maxTierSize = Math.max(maxTierSize, ids.length)
  for (let pass = 0; pass < maxTierSize; pass++) {
    let changed = false
    for (const e of inTier) {
      const next = (depth.get(e.source) ?? 0) + 1
      if (next > (depth.get(e.target) ?? 0) && next < maxTierSize) {
        depth.set(e.target, next)
        changed = true
      }
    }
    if (!changed) break
  }
  return depth
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
  /**
   * ⭐ S4: the minimum box height of a tier's FINAL sub-row — the row-end
   * prompt column standing at its end. A shared Outcome + Risk column of two
   * stacked prompts can be taller than the cards beside it; without this floor
   * it would hang into the gap and under the next family's label. Absent means
   * no prompt, so no floor.
   */
  finalSubRowFloorByTier?: ReadonlyMap<number, number>,
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
    const finalFloor = finalSubRowFloorByTier?.get(tier) ?? 0
    if (finalFloor > lastSubMaxH) lastSubMaxH = finalFloor
    const tierBottomY = lastSubY + lastSubMaxH
    cumulativeY = tierBottomY + effectiveLayerSpacing
  }
}

/**
 * Re-snap each tier's rows to their own stride and centre the tier on the graph
 * spine.
 *
 * Spine X = median centre of decision (tier 0) + option (tier 1) nodes.
 * Goal is excluded because ELK may place it far right under asymmetric
 * edges, which would pull the spine off-centre. Degenerate fallback: median
 * X of all unlocked node centres.
 *
 * ⭐⭐ S4: A TIER IS PLACED AS ONE BLOCK. Its block is its widest sub-row, where
 * the final sub-row's width includes the row-end prompt slot (ED S4: prompts
 * "stay at the row end … inside the row budget"). The block is centred on the
 * spine and every sub-row starts at the block's left edge, so a wrapped family
 * reads as one paragraph under ONE left label — columns line up, order runs left
 * to right then down, and the prompt stands at the end of the last line.
 * Centring the block rather than the cards is also the narrower board: hanging
 * the prompt off a centred row would widen the board by half a slot per side it
 * is not on.
 *
 * ⚠ THE STRIDE IS THE ROW'S OWN WIDTHS, NOT ONE GLOBAL BOX — tiers carry
 * different widths (the Question and Goal are wider), so a uniform stride would
 * overlap a wide row and gap a narrow one.
 */
function placeTierRowsOnSpine(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  unlocked: Node[],
  tierAssignments: Map<number, string[]>,
  fallbackBoxW: number,
  gap: number,
  promptSlotByTier: ReadonlyMap<number, number>,
): void {
  const widthOf = (id: string): number => sizeMap.get(id)?.width ?? fallbackBoxW
  const centreOf = (id: string): number | undefined => {
    const p = positionMap.get(id)
    return p === undefined ? undefined : p.x + widthOf(id) / 2
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

  const rowWidth = (row: readonly string[]): number => {
    let w = Math.max(0, row.length - 1) * gap
    for (const id of row) w += widthOf(id)
    return w
  }

  for (const [tier, ids] of tierAssignments) {
    const placed = ids.filter((id) => positionMap.has(id))
    if (placed.length === 0) continue
    const subRows = [...groupByYRow(placed, positionMap).values()]
    const slot = promptSlotByTier.get(tier) ?? 0
    const rowOffsets = brickRowOffsets(subRows, rowWidth, widthOf, gap, slot)
    let blockW = 0
    subRows.forEach((row, i) => {
      const w = rowOffsets[i]! + rowWidth(row) + (i === subRows.length - 1 ? slot : 0)
      if (w > blockW) blockW = w
    })
    const left = graphSpineX - blockW / 2
    subRows.forEach((row, i) => {
      let x = left + rowOffsets[i]!
      for (const id of row) {
        const p = positionMap.get(id)
        if (!p) continue
        positionMap.set(id, { x, y: p.y })
        x += widthOf(id) + gap
      }
    })
  }
}

/**
 * ⭐⭐ v3.1 WS1 #10 (26 Sep 2026): A WRAPPED FAMILY IS LAID IN BRICK COURSES.
 *
 * With every sub-row starting at the block's left edge, the cards of one course
 * stood directly under the cards of the course above, so every edge leaving the
 * upper course — or entering the lower one from the row above — ran through a
 * card that was not its endpoint. Measured at the landing zoom before this
 * change: 11 (pricing), 21 (market-entry), 20 (vendor-selection), 20
 * (build-vs-buy) and 16 (headcount) edges passed under a non-endpoint card,
 * against 1 of 17 on the v3.1 prototype, whose families never wrap.
 *
 * Alternate courses are shifted by HALF A STRIDE, so each card of one course
 * sits under a GAP of the course next to it and the near-vertical leads of the
 * edges (`StyledEdge`: at most 30 units of vertical lead-in and lead-out) pass
 * between cards. Which courses shift is chosen to keep the family's block
 * narrowest (the final course carries the row-end prompt): e.g. 4+4 shifts the
 * FIRST course (block 1424, not 1582), 3+2 the second (950, not 1074) — so no
 * family is wider than its unshifted block's budget (`CANONICAL_LAYOUT_WIDTH`).
 *
 * Reading order is unchanged (left to right, then down) and the family still
 * sits under ONE band label at the board's left column. A tier that does not
 * wrap gets `[0]` — no change.
 */
function brickRowOffsets(
  subRows: readonly (readonly string[])[],
  rowWidth: (row: readonly string[]) => number,
  widthOf: (id: string) => number,
  gap: number,
  promptSlot: number,
): number[] {
  if (subRows.length <= 1) return subRows.map(() => 0)
  const first = subRows[0]![0]
  const half = first === undefined ? 0 : (widthOf(first) + gap) / 2
  const blockOf = (offsets: number[]): number =>
    subRows.reduce((w, row, i) => Math.max(w, offsets[i]! + rowWidth(row) + (i === subRows.length - 1 ? promptSlot : 0)), 0)
  const oddShifted = subRows.map((_, i) => (i % 2 === 1 ? half : 0))
  const evenShifted = subRows.map((_, i) => (i % 2 === 0 ? half : 0))
  return blockOf(evenShifted) < blockOf(oddShifted) ? evenShifted : oddShifted
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

/** The outcome/risk row — read off the one tier map, never restated. */
const CONSEQUENCE_TIER = TIER_BY_KIND.outcome

/**
 * How many pairs of links cross between one row and the cards on ONE side of
 * it: two links cross when their row ends and their far ends are in opposite
 * left-to-right order. Links sharing an end never count.
 */
function rowLinkCrossings(links: ReadonlyArray<readonly [string, string]>, x: (id: string) => number): number {
  let n = 0
  for (let i = 0; i < links.length; i++) {
    const [r1, o1] = links[i]!
    for (let j = i + 1; j < links.length; j++) {
      const [r2, o2] = links[j]!
      if (r1 === r2 || o1 === o2) continue
      if ((x(r1) - x(r2)) * (x(o1) - x(o2)) < 0) n++
    }
  }
  return n
}

/**
 * ⭐ THE CONSEQUENCE ROW READS IN THE ORDER OF THE CARDS IT HANGS FROM
 * (Paul's staging test, 28 Sep 2026; build-vs-buy, served 662afcfd).
 *
 * ELK's crossing pass orders the outcome/risk row against the factor layer AS
 * ELK LAID IT OUT. `applyTierRowSplitting` then deals an eight-card factor band
 * into two brick courses and `placeTierRowsOnSpine` re-places every X, so the
 * order ELK chose is tuned to positions that no longer exist. On build-vs-buy
 * the links into the consequence row crossed 33 times where 16 is the fewest
 * any order reaches, drawn as a tangle of near-horizontal runs above the row.
 *
 * Once X is final, each consequence row is re-seated by the barycentre of its
 * links from above (the mean centre-x of each card's far ends; a card with none
 * keys on its own centre; ties keep the current order).
 *
 * ⭐ IT IS A PERMUTATION OF THE ROW'S OWN SLOTS, the argument
 * `seatNodesIntoRankedSlots` makes: the multiset of positions is unchanged, so
 * no card can land on another and no row, width or height moves. A row whose
 * cards differ in width is left alone, because swapping unequal footprints is
 * not a permutation.
 *
 * ⚠ IT IS APPLIED ONLY WHEN IT STRICTLY REDUCES CROSSINGS (links above plus
 * links below). Barycentre is a heuristic and can be worse than the order it
 * replaces (the spec holds a 6 → 7 case), so this step can only remove
 * crossings, never add them. Nor may it lengthen the links that run between
 * two cards of the same row (Paul's pa_vs_ai: risks into "Delegation quality").
 */
export function orderConsequenceRowsByUpstream(
  positionMap: Map<string, { x: number; y: number }>,
  sizeMap: Map<string, { width: number; height: number }>,
  tierAssignments: Map<number, string[]>,
  edges: ReadonlyArray<{ source: string; target: string }>,
  fallbackBoxW: number,
): void {
  const tierIds = (tierAssignments.get(CONSEQUENCE_TIER) ?? []).filter((id) => positionMap.has(id))
  if (tierIds.length < 2) return
  const inTier = new Set(tierIds)
  const widthOf = (id: string) => sizeMap.get(id)?.width ?? fallbackBoxW
  const centreOf = (id: string) => positionMap.get(id)!.x + widthOf(id) / 2

  for (const ids of groupByYRow(tierIds, positionMap).values()) {
    if (ids.length < 2) continue
    const w0 = widthOf(ids[0]!)
    if (ids.some((id) => Math.abs(widthOf(id) - w0) > 0.5)) continue
    const rowY = positionMap.get(ids[0]!)!.y
    const inRow = new Set(ids)

    const above: Array<[string, string]> = []
    const below: Array<[string, string]> = []
    const within: Array<[string, string]> = []
    for (const e of edges) {
      if (inRow.has(e.source) && inRow.has(e.target)) {
        within.push([e.source, e.target])
        continue
      }
      const [rowEnd, farEnd] = inRow.has(e.target) ? [e.target, e.source] : inRow.has(e.source) ? [e.source, e.target] : [null, null]
      if (rowEnd === null || farEnd === null || inTier.has(farEnd) || !positionMap.has(farEnd)) continue
      ;(positionMap.get(farEnd)!.y < rowY ? above : below).push([rowEnd, farEnd])
    }
    if (above.length === 0) continue

    const barycentre = new Map<string, number>()
    for (const id of ids) {
      const far = above.filter(([r]) => r === id).map(([, f]) => centreOf(f))
      barycentre.set(id, far.length > 0 ? far.reduce((s, v) => s + v, 0) / far.length : centreOf(id))
    }
    const slots = ids.map((id) => positionMap.get(id)!)
    const proposed = [...ids].sort(
      (a, b) => barycentre.get(a)! - barycentre.get(b)! || ids.indexOf(a) - ids.indexOf(b),
    )
    const seat = new Map(proposed.map((id, i) => [id, slots[i]!]))
    const xNow = (id: string) => centreOf(id)
    const xThen = (id: string) => (seat.has(id) ? seat.get(id)!.x + w0 / 2 : centreOf(id))
    const before = rowLinkCrossings(above, xNow) + rowLinkCrossings(below, xNow)
    const after = rowLinkCrossings(above, xThen) + rowLinkCrossings(below, xThen)
    if (after >= before) continue
    // A link between two cards of this row (a risk into an outcome) runs along
    // the row; the reorder may not stretch those runs to buy fewer crossings.
    const runLength = (x: (id: string) => number) => within.reduce((s, [a, b]) => s + Math.abs(x(a) - x(b)), 0)
    if (runLength(xThen) > runLength(xNow)) continue
    for (const [id, slot] of seat) positionMap.set(id, { x: slot.x, y: slot.y })
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
