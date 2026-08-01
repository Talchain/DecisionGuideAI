/**
 * phase3Pacing — F16: pacing computation for phase-3 coaching/review card
 * floods in a single conversation turn (COACHING-REVIEW-UI-BRIEF §3
 * progressive disclosure; ratified renderer target).
 *
 * A single run response can land 10–15 phase-3 blocks (observed live:
 * 5 review_card + 4 coaching + 1 evidence). Pacing lives at the RENDER
 * layer: the message/store keeps ALL blocks (nothing is mutated at ingest),
 * and InlineBlocks consults this pure helper to decide which phase-3 cards
 * default to expanded and which sit behind the single count affordance.
 *
 * Rules (ratified):
 *   - The first PHASE3_DEFAULT_EXPANDED phase-3 cards (producer order —
 *     composePhase3BridgedBlocks has already applied priority_rank
 *     ordering) render by default.
 *   - Every later phase-3 card collapses behind ONE affordance, placed at
 *     the position of the first collapsed card so reading order is
 *     preserved exactly on reveal.
 *   - Non-phase-3 blocks are untouched: they keep their own legacy per-turn
 *     budget, counted WITHOUT the phase-3 cards (the pacing group is the
 *     phase-3 budget — always, not only while pacing is active; see the
 *     dead-band note in InlineBlocks, ROADMAP 2.211-②).
 */
import { DRAFT_BIAS_SIGNAL_CARD_CAP } from './types'
import type { ConversationBlock } from './types'

/** The four typed phase-3 conversation block kinds (Track C slices 1+2). */
export const PHASE3_CARD_TYPES: ReadonlySet<ConversationBlock['type']> = new Set([
  'v5_review_card',
  'v5_coaching',
  'v5_evidence',
  'v5_exercise',
] as const)

/**
 * Ratified default-expanded cap: at most 6 phase-3 cards open by default.
 *
 * ROADMAP 2.211-② (founder ruling, 1 Aug) raised this from 3 to 6. The
 * live walk proved rank ≠ visibility: the selected-lens exercise card ranks
 * correctly (2.211 §2 put it directly after the review cards — see
 * EXERCISE_RANK_AFTER_REVIEW_CARDS in useConversation.ts) yet still sat
 * behind `Show N more`, because a collapsed card renders `null` and is not
 * in the DOM at all. Measured phase-3 counts on the walk's analysis turns
 * were 8, 8, 8, 11, 13, 14 — so a cap of 3 collapsed everything below the
 * third card on every single turn.
 *
 * The Show-more affordance is deliberately KEPT: the ruling raises the
 * default, it does not remove pacing.
 */
export const PHASE3_DEFAULT_EXPANDED = 6

export interface Phase3Pacing {
  /** True when the turn carries more phase-3 cards than the default cap. */
  pacingActive: boolean
  /** Total phase-3 cards on the turn. */
  phase3Count: number
  /** How many phase-3 cards are behind the affordance when collapsed. */
  collapsedCount: number
  /** Block indices (into the original array) collapsed by default. */
  collapsedIndices: ReadonlySet<number>
  /** Original index of the first collapsed card — where the affordance renders. */
  affordanceIndex: number
  /**
   * Indices of the bias-signal coaching cards that are exempt from BOTH
   * visibility budgets — the first DRAFT_BIAS_SIGNAL_CARD_CAP only.
   * Computed once here and read by InlineBlocks' legacy budget too, so the
   * two budgets cannot disagree about which cards are exempt.
   */
  biasSignalExemptIndices: ReadonlySet<number>
}

export function isPhase3CardBlock(block: ConversationBlock): boolean {
  return PHASE3_CARD_TYPES.has(block.type)
}

/**
 * THE bias-signal-coaching predicate — one definition, every surface
 * (pacing, the legacy budget, the renderer's card variant, and the draft
 * bridge's producer-wins check) goes through it (/simplify item 1).
 */
export function isBiasSignalCoachingBlock(block: ConversationBlock): boolean {
  return block.type === 'v5_coaching' && block.coaching_kind === 'bias_signal'
}

/**
 * Review-folds C1: bias-signal coaching cards are exempt from BOTH
 * visibility budgets, so per the ratified #356 acceptance they render by
 * default. /simplify item 5 makes the ≤2 cap they cite STRUCTURAL rather
 * than merely cited: only the FIRST DRAFT_BIAS_SIGNAL_CARD_CAP of them are
 * exempt, and any beyond that fall through to the normal budget/pacing
 * path.
 *
 * Why that matters: the cap used to live only in the UI draft bridge
 * (buildDraftBiasSignalBlocks), which deliberately stands down when CEE
 * emits real bias coaching. Producer blocks match the same predicate, so a
 * producer turn carrying 12 bias signals was exempt from both budgets and
 * capped by nothing — 12 uncollapsed cards. No behaviour change on today's
 * live path, where the bridge already emits at most 2.
 */
function computeBiasSignalExemptIndices(
  blocks: readonly ConversationBlock[],
): ReadonlySet<number> {
  const exempt = new Set<number>()
  for (let i = 0; i < blocks.length && exempt.size < DRAFT_BIAS_SIGNAL_CARD_CAP; i++) {
    if (isBiasSignalCoachingBlock(blocks[i])) exempt.add(i)
  }
  return exempt
}

/** Pure pacing computation over a turn's full block list. */
export function computePhase3Pacing(blocks: readonly ConversationBlock[]): Phase3Pacing {
  const biasSignalExemptIndices = computeBiasSignalExemptIndices(blocks)
  const phase3Indices: number[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (isPhase3CardBlock(blocks[i]) && !biasSignalExemptIndices.has(i)) phase3Indices.push(i)
  }
  if (phase3Indices.length <= PHASE3_DEFAULT_EXPANDED) {
    return {
      pacingActive: false,
      phase3Count: phase3Indices.length,
      collapsedCount: 0,
      collapsedIndices: new Set(),
      affordanceIndex: -1,
      biasSignalExemptIndices,
    }
  }
  const collapsed = phase3Indices.slice(PHASE3_DEFAULT_EXPANDED)
  return {
    pacingActive: true,
    phase3Count: phase3Indices.length,
    collapsedCount: collapsed.length,
    collapsedIndices: new Set(collapsed),
    affordanceIndex: collapsed[0],
    biasSignalExemptIndices,
  }
}
