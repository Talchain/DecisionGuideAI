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
 *   - Non-phase-3 blocks are untouched: when pacing is active they keep
 *     their own legacy per-turn budget, counted WITHOUT the phase-3 cards
 *     (the pacing group is the phase-3 budget).
 */
import type { ConversationBlock } from './types'

/** The four typed phase-3 conversation block kinds (Track C slices 1+2). */
export const PHASE3_CARD_TYPES: ReadonlySet<ConversationBlock['type']> = new Set([
  'v5_review_card',
  'v5_coaching',
  'v5_evidence',
  'v5_exercise',
] as const)

/** Ratified default-expanded cap: at most 3 phase-3 cards open by default. */
export const PHASE3_DEFAULT_EXPANDED = 3

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
}

export function isPhase3CardBlock(block: ConversationBlock): boolean {
  return PHASE3_CARD_TYPES.has(block.type)
}

/**
 * Review-folds C1: bias-signal coaching cards are exempt from BOTH
 * visibility budgets — they carry their own ≤2 cap
 * (buildDraftBiasSignalBlocks DRAFT_BIAS_SIGNAL_CARD_CAP), so per the
 * ratified #356 acceptance they ALWAYS render by default. They neither
 * count toward the >3 pacing trigger nor collapse (here), and InlineBlocks
 * excludes them from the legacy per-turn budget too.
 */
export function isBiasSignalCoachingBlock(block: ConversationBlock): boolean {
  return block.type === 'v5_coaching' && block.coaching_kind === 'bias_signal'
}

/** Pure pacing computation over a turn's full block list. */
export function computePhase3Pacing(blocks: readonly ConversationBlock[]): Phase3Pacing {
  const phase3Indices: number[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (isPhase3CardBlock(blocks[i]) && !isBiasSignalCoachingBlock(blocks[i])) phase3Indices.push(i)
  }
  if (phase3Indices.length <= PHASE3_DEFAULT_EXPANDED) {
    return {
      pacingActive: false,
      phase3Count: phase3Indices.length,
      collapsedCount: 0,
      collapsedIndices: new Set(),
      affordanceIndex: -1,
    }
  }
  const collapsed = phase3Indices.slice(PHASE3_DEFAULT_EXPANDED)
  return {
    pacingActive: true,
    phase3Count: phase3Indices.length,
    collapsedCount: collapsed.length,
    collapsedIndices: new Set(collapsed),
    affordanceIndex: collapsed[0],
  }
}
