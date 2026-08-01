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
 *   - ONE of those default-expanded slots is RESERVED for the turn's lens
 *     companion card when the composed order would otherwise bury it
 *     (ROADMAP 2.242 — see RESERVED_COMPANION_SLOTS below). The reservation
 *     DISPLACES the last default-expanded slot; it never adds a seventh.
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

/**
 * ROADMAP 2.242 — how many default-expanded slots are RESERVED for the turn's
 * lens companion card. One. It is a reservation WITHIN
 * PHASE3_DEFAULT_EXPANDED, never an addition to it: the companion displaces
 * the last card that would otherwise have been expanded, so the total number
 * of default-expanded phase-3 cards is unchanged on every turn.
 *
 * ## Why the ruling needed this and not a bigger cap
 * Measured over 12 real captured analysis payloads replayed through the
 * shipped pipeline at staging tip `db795411`, the companion card lands at
 * phase-3 position 5-11 — behind the cap on 10 of the 12 — because two card
 * families sort ahead of the entire review-card group it is anchored to:
 * `evidence` (producer ranks 1-3) and the deterministic `strengthen`
 * coaching card (producer rank 15), against review cards at producer ranks
 * 10-73.
 *
 * ⚠ THE COMPANION'S OWN RANK IS UI-INVENTED, NOT THE PRODUCER'S. CEE emits
 * this block with NO `priority_rank` field at all — `buildPreMortemExerciseBlock`
 * (`compose/phase3-blocks.ts`) builds exactly twelve keys, none of them a
 * rank — and appends the companion LAST in its own phase-3 array
 * (`compose.ts`, `return [...built, ...lensCompanions]`). The contract
 * reserves the 200+ band for calibration prompts / exercises (vendored
 * `@talchain/schemas` 0.30.0, `boundary/blocks.js`). The
 * `max(review_card rank) + 0.5` position is invented HERE, in the UI, by
 * `EXERCISE_RANK_AFTER_REVIEW_CARDS` (`useConversation.ts`, ROADMAP 2.211
 * §2) — which HOISTS the card above the coaching band (101-202) it would
 * otherwise sit behind. Calling that "the producer's rank" would be the
 * false-label defect (platform traps 12/14), so it is not called that here.
 *
 * Direction of the correction, stated because it matters: the mistake
 * UNDERSTATED the burial. Under the producer's own positional order the card
 * would be LAST — 16 of 16 on the real capture, not 11. The 2.242 premise is
 * unaffected either way; 11 and 16 are both past a cap of 6.
 *
 * Raising the cap far enough to reach position 11 renders nearly the whole
 * turn, which is what pacing exists to prevent. Reserving one slot is the
 * smallest change that shows the single card the lens selector CHOSE, and it
 * reorders nothing: the composed order is untouched, the card renders exactly
 * where composition put it, it is merely not collapsed.
 */
export const RESERVED_COMPANION_SLOTS = 1

/**
 * THE lens-companion predicate — one definition, every surface.
 *
 * Derived at the CEE bytes (`olumi-assistants-service` tip `6766b540`,
 * `compose/phase3-blocks.ts::buildLensCompanionBlocks`): the companion
 * artefact attached beside the turn's SELECTED lens is typed
 * `readonly ExerciseBlock[]`, and the switch over `LensId` is
 * compile-exhaustive — `pre_mortem` returns exactly one block or none, every
 * other lens returns none. So on the wire "the card the lens selector chose"
 * IS the turn's exercise block, and there is at most one.
 *
 * This function is deliberately narrow (the block TYPE, not a lens id or a
 * `source_handler` string): the UI must not mirror CEE's lens vocabulary — a
 * hand-listed set of lens ids here would drift silently the day CEE adds one
 * (platform trap 12). If a future lens declares a companion of a different
 * block type, this predicate is the single place that has to change, and the
 * reservation below caps the promotion at RESERVED_COMPANION_SLOTS whatever
 * the producer emits.
 */
export function isLensCompanionBlock(block: ConversationBlock): boolean {
  return block.type === 'v5_exercise'
}

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

/**
 * ROADMAP 2.242 — which of a paced turn's phase-3 cards default to expanded.
 *
 * The base rule is unchanged: the first PHASE3_DEFAULT_EXPANDED cards in the
 * order composePhase3BridgedBlocks produced (producer `priority_rank`
 * ascending for every ranked block; the companion's slot in that order is the
 * UI-derived one described on RESERVED_COMPANION_SLOTS above). The
 * reservation is a SWAP inside that set, never a growth of it:
 *
 *   - Only fires when the turn's lens companion card is in the OVERFLOW. A
 *     companion already inside the default set needs no slot, and taking one
 *     for it would displace a card for nothing.
 *   - Displaces the LAST default-expanded card, so the affordance moves one
 *     position earlier and reading order on reveal is still exact.
 *   - Promotes at most RESERVED_COMPANION_SLOTS companions — the first in
 *     composed order. CEE emits at most one; a turn that somehow carried two
 *     must not open a seventh card.
 *
 * Returned as a set (rather than a spliced array) so the caller derives
 * `collapsed` as the exact complement over `phase3Indices` — the two can
 * never disagree about a card's fate, and the ordering of `collapsed` stays
 * ascending by construction, which is what puts the affordance at the first
 * collapsed card.
 *
 * INVARIANT (asserted by the spec, across 468 enumerated shapes): the
 * returned set always has exactly PHASE3_DEFAULT_EXPANDED members when
 * `phase3Indices.length > PHASE3_DEFAULT_EXPANDED`.
 */
function defaultExpandedIndices(
  blocks: readonly ConversationBlock[],
  phase3Indices: readonly number[],
): ReadonlySet<number> {
  const expanded = new Set(phase3Indices.slice(0, PHASE3_DEFAULT_EXPANDED))
  const overflow = phase3Indices.slice(PHASE3_DEFAULT_EXPANDED)
  // A reservation can never exceed the cap it lives inside: without this a
  // mis-set RESERVED_COMPANION_SLOTS would index past the front of the
  // default set, delete nothing, and quietly GROW the expanded count — the
  // one thing the ruling forbids.
  const reservable = Math.min(RESERVED_COMPANION_SLOTS, PHASE3_DEFAULT_EXPANDED)
  let promoted = 0
  for (const i of overflow) {
    if (promoted >= reservable) break
    if (!isLensCompanionBlock(blocks[i])) continue
    // Displace from the END of the default set — the lowest-priority card
    // that was going to be expanded — and only ever one-for-one.
    const displaced = phase3Indices[PHASE3_DEFAULT_EXPANDED - 1 - promoted]
    expanded.delete(displaced)
    expanded.add(i)
    promoted++
  }
  return expanded
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
  const expanded = defaultExpandedIndices(blocks, phase3Indices)
  const collapsed = phase3Indices.filter((i) => !expanded.has(i))
  return {
    pacingActive: true,
    phase3Count: phase3Indices.length,
    collapsedCount: collapsed.length,
    collapsedIndices: new Set(collapsed),
    affordanceIndex: collapsed[0],
    biasSignalExemptIndices,
  }
}
