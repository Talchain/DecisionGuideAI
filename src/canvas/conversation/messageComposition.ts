/**
 * messageComposition — THE typed composition layer for an assistant turn's
 * blocks (PX-B, Paul's 15 Aug ruling on response presentation).
 *
 * ## The defect this exists to fix
 *
 * A turn's blocks were governed by TWO overlapping budgets that each decided
 * visibility independently: the legacy per-turn budget (4 non-phase-3 blocks,
 * `MAX_VISIBLE_BLOCKS_PER_TURN`) and the phase-3 pacing group (6
 * default-expanded cards, `PHASE3_DEFAULT_EXPANDED`), plus a bias-signal set
 * exempt from BOTH (2 more). On the phase-3 counts this repo measured live —
 * 8, 8, 8, 11, 13, 14 cards per analysis turn (see phase3Pacing.ts) — that
 * yields up to TWELVE cards stacked under the prose, each its own bordered
 * panel. That is the "panels-within-panels / walls" defect.
 *
 * ## The ruling
 *
 * headline → at most MAX_POINTS prioritised coaching points → clear next
 * action(s) → expandable supporting detail. The product controls what is
 * initially EXPOSED; the producer may still generate as much as it likes.
 *
 * ⚠ THIS SUPERSEDES the default-expanded cap of `PHASE3_DEFAULT_EXPANDED = 6`
 * (ROADMAP 2.211-②, 1 Aug) as the TOP-LEVEL exposure rule. That earlier ruling
 * raised the cap 3→6 because rank ≠ visibility: a collapsed card renders null
 * and the lens-selected card was being buried. The 2.242 companion RESERVATION
 * that answered it is carried forward here (see `reserveCompanion`) rather than
 * dropped — the cap changes, the reason the reservation existed does not.
 *
 * ## Honesty invariants (the load-bearing ones)
 *
 * 1. TOTAL PARTITION. `pinned ∪ points ∪ detail` is exactly the set of input
 *    indices — every block appears in exactly ONE class, none is dropped and
 *    none duplicated. `assertTotalPartition` is exported so the spec binds it.
 *    Demotion is presentational: a demoted block renders through its OWN
 *    existing renderer, byte-for-byte, inside the disclosure.
 * 2. NO FABRICATION. `headline` is only ever the producer's own answer-shape
 *    headline. It is never derived, split, or summarised out of prose — the
 *    same rule answerShape.ts already holds ("never fabricates structure").
 *    A turn with no producer headline gets `headline: null`, NOT an invented one.
 * 3. NO REORDERING. Within every class, blocks keep PRODUCER ORDER. The cap is
 *    applied by taking a prefix, never by sorting: CEE has already applied
 *    `priority_rank`, and a UI-invented rank is exactly the defect
 *    phase3Pacing.ts documents at EXERCISE_RANK_AFTER_REVIEW_CARDS. The one
 *    exception is the companion reservation, which SWAPS one member of the
 *    point set and is bounded to one.
 */
import type { ConversationBlock } from './types'
import { isLensCompanionBlock } from './phase3Pacing'

/**
 * How many coaching points are exposed at top level. Paul's ruling: "max ~3
 * prioritised coaching points". Everything beyond this is DEMOTED to the
 * disclosure body — never dropped.
 */
export const MAX_POINTS = 3

/**
 * How many point slots may be reserved for the turn's lens companion card.
 * Carried forward from ROADMAP 2.242. A reservation INSIDE MAX_POINTS, never
 * an addition to it: the companion displaces the last point, so the number of
 * top-level points is unchanged on every turn.
 */
export const RESERVED_COMPANION_POINTS = 1

/**
 * Blocks that are PINNED to the top level regardless of the point cap.
 *
 * Two families, one rule — "the block IS the response, or the block is the
 * user's consent affordance":
 *   · graph patches and proposals carry accept / dismiss / confirm. Demoting a
 *     consent control into a collapsed disclosure would hide the thing the user
 *     is being asked to agree to, which is a trust regression, not a tidy-up.
 *     (The pre-existing rule "graph_patch proposed blocks always stay visible"
 *     is preserved by this set, not weakened.)
 *   · `v5_analysis_result` is the analysis answer itself on an analysis turn.
 *   · `commentary` renders INLINE — no card, no border, no badge dot (DS v5
 *     §21.2) — so it is not part of the stacking harm and belongs with the body.
 */
export const PINNED_BLOCK_TYPES: ReadonlySet<ConversationBlock['type']> = new Set([
  'graph_patch',
  'v5_graph_patch',
  'proposal',
  'v5_held_proposal',
  'v5_analysis_result',
  'commentary',
] as const)

/**
 * The coaching/review card family — the blocks eligible to be one of the ≤3
 * top-level POINTS.
 *
 * Deliberately the measured flood family (phase3Pacing's PHASE3_CARD_TYPES plus
 * the legacy `review_card`), because that is the family the live counts of
 * 8–14 cards per turn came from. Every other block type is supporting detail by
 * default; that is the ruling's "expandable supporting detail" tier, and it is
 * what turns comparison / premortem / flip_analysis / exercise / framing /
 * brief / fact / evidence from top-level stacking panels into disclosure-level
 * citizens.
 */
export const POINT_CANDIDATE_TYPES: ReadonlySet<ConversationBlock['type']> = new Set([
  'v5_coaching',
  'v5_review_card',
  'v5_evidence',
  'v5_exercise',
  'review_card',
] as const)

/** One block's place in the composition, bound to its source by INDEX (identity, not value). */
export interface CompositionEntry {
  /** Index into the original `blocks` array. The identity a spec binds to. */
  index: number
  /** The source block's own type, carried so a consumer never re-derives it. */
  blockType: ConversationBlock['type']
}

export interface MessageComposition {
  /**
   * The producer's own one-sentence headline, or null. NEVER derived from prose
   * (invariant 2). Supplied by the caller from the answer-shape sidecar.
   */
  headline: string | null
  /** Blocks pinned to the top level — the response itself, and consent affordances. */
  pinned: CompositionEntry[]
  /** At most MAX_POINTS coaching points, in producer order. */
  points: CompositionEntry[]
  /** Everything else, in producer order, rendered inside ONE disclosure. */
  detail: CompositionEntry[]
}

/** Is this block eligible to be one of the top-level points? */
export function isPointCandidate(block: ConversationBlock): boolean {
  return POINT_CANDIDATE_TYPES.has(block.type) && !PINNED_BLOCK_TYPES.has(block.type)
}

/** Is this block pinned to the top level? */
export function isPinnedBlock(block: ConversationBlock): boolean {
  return PINNED_BLOCK_TYPES.has(block.type)
}

/**
 * ROADMAP 2.242, carried forward under the new cap. When the turn's lens
 * companion card falls into the overflow, promote it into the point set by
 * DISPLACING the last point — never by growing the set.
 *
 * Returns the promoted index set. Bounded by RESERVED_COMPANION_POINTS and by
 * MAX_POINTS itself, so a mis-set constant can never grow the exposed count
 * (the same guard `defaultExpandedIndices` carries in phase3Pacing.ts).
 */
function reserveCompanion(
  blocks: readonly ConversationBlock[],
  candidateIndices: readonly number[],
): Set<number> {
  const chosen = new Set(candidateIndices.slice(0, MAX_POINTS))
  const overflow = candidateIndices.slice(MAX_POINTS)
  const reservable = Math.min(RESERVED_COMPANION_POINTS, MAX_POINTS)
  let promoted = 0
  for (const i of overflow) {
    if (promoted >= reservable) break
    if (!isLensCompanionBlock(blocks[i])) continue
    const displaced = candidateIndices[MAX_POINTS - 1 - promoted]
    chosen.delete(displaced)
    chosen.add(i)
    promoted++
  }
  return chosen
}

/**
 * THE composition function. Pure: reads blocks, mutates nothing, returns the
 * partition. The message/store keeps every block exactly as ingested — this
 * decides only what is EXPOSED first, which is the whole point of the ruling.
 */
export function composeMessage(
  blocks: readonly ConversationBlock[],
  headline: string | null = null,
): MessageComposition {
  const entry = (index: number): CompositionEntry => ({ index, blockType: blocks[index].type })

  const candidateIndices: number[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (isPointCandidate(blocks[i])) candidateIndices.push(i)
  }
  const chosenPoints = reserveCompanion(blocks, candidateIndices)

  /**
   * FILL. The cap governs TOTAL top-level exposure, not the coaching family
   * alone — so when a turn carries fewer than MAX_POINTS coaching cards, the
   * remaining slots are filled from the other blocks in producer order.
   *
   * ⚠ Without this the composition had a defect worse than the one it fixes:
   * a turn whose only block is a `fact` (or `framing`, `brief`, `model_receipt`,
   * or an unknown-type fallback card) has NO point candidate, so every block
   * was demoted and the user saw an empty message body above a "Show 1 more"
   * toggle. Capping a flood and hiding a single block are the two opposite
   * harms of one predicate; they cannot share a rule (platform trap 22b), so
   * selection is preference-then-fill, both stages in producer order.
   *
   * Preference, not reordering: coaching cards get first claim on the slots
   * because they are what the ruling calls "prioritised coaching points", and
   * the fill is strictly earliest-first. No UI-invented rank at either stage.
   */
  for (let i = 0; i < blocks.length && chosenPoints.size < MAX_POINTS; i++) {
    if (isPinnedBlock(blocks[i]) || chosenPoints.has(i)) continue
    if (isPointCandidate(blocks[i])) continue // already considered above; overflow stays demoted
    chosenPoints.add(i)
  }

  const pinned: CompositionEntry[] = []
  const points: CompositionEntry[] = []
  const detail: CompositionEntry[] = []

  // ONE pass, ONE decision per block, in producer order — so the three classes
  // cannot disagree about a block's fate and the partition is total by
  // construction rather than by a later reconciliation.
  for (let i = 0; i < blocks.length; i++) {
    if (isPinnedBlock(blocks[i])) pinned.push(entry(i))
    else if (chosenPoints.has(i)) points.push(entry(i))
    else detail.push(entry(i))
  }

  return { headline, pinned, points, detail }
}

/**
 * Invariant 1, as an executable check: the composition is a TOTAL PARTITION of
 * the input indices. Exported so the spec binds the real function rather than
 * re-implementing the rule (a guard that re-states the code agrees with itself
 * — platform trap 13b).
 *
 * Returns null when the partition holds, or a description of the breach.
 */
export function assertTotalPartition(
  blockCount: number,
  composition: MessageComposition,
): string | null {
  const seen = new Set<number>()
  for (const e of [...composition.pinned, ...composition.points, ...composition.detail]) {
    if (seen.has(e.index)) return `index ${e.index} appears in more than one class`
    seen.add(e.index)
  }
  if (seen.size !== blockCount) {
    return `partition covers ${seen.size} of ${blockCount} blocks`
  }
  for (let i = 0; i < blockCount; i++) {
    if (!seen.has(i)) return `index ${i} is in no class`
  }
  return null
}
