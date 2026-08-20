/**
 * THE ANTI-RECURRENCE GUARD for the narrative channel (UX gate 4b).
 *
 * ## What went wrong, and why a guard belongs here
 *
 * UI #785 routes the analysis narrative onto one channel by asking whether the
 * turn delivers it as a typed card. That predicate keys on the block type
 * `v5_review_card`, while CEE emits `review_card` — and a reader comparing
 * those two literals concludes, reasonably and WRONGLY, that the predicate is
 * dead on every real turn. It is not: `adaptTypedReviewCardBlock`
 * (`src/v5/phase3TypedBlocks.ts`) sits between them, accepting the wire type
 * and re-emitting the UI type with `card_kind` carried through verbatim.
 *
 * The two names are separated by a TRANSLATION BOUNDARY, not by drift. But
 * nothing executable said so, so the question had to be re-derived by hand —
 * and the honest reading of the source in isolation is the wrong one. That is
 * what this file fixes: it makes the boundary assert itself.
 *
 * ## Why this is DERIVED and not a hand-listed mirror
 *
 * The UI cannot read CEE's source at test time. What it CAN read is the thing
 * BOTH services are bound to: the shared contract. CEE does not merely happen
 * to send `review_card` — it VALIDATES every narrative card it emits against
 * `ReviewCardBlockSchema` before sending it
 * (`olumi-assistants-service` `src/orchestrator-v5/compose/phase3-blocks.ts`
 * :2555, `validateProseAndSchemaOrDrop(ReviewCardBlockSchema, candidate, …)`).
 * Both repos pin `file:./vendor/talchain-schemas-0.48.0.tgz`, and the two
 * vendored tarballs are byte-identical (SHA-256
 * `02f78afc8e554fc498c00e26ae555524da36516ebe632a253f8147bb8055805a`,
 * compared 2026-08-20).
 *
 * So the contract is a genuine shared derivation point, not a copy: every
 * literal below is READ OUT of the schema at run time. If CEE renames the
 * block type or the narrative kind, it must change the contract to keep
 * emitting — and this file REDs. If the UI's constant drifts, this file REDs.
 * Nothing here is a list a human must remember to update (trap 12).
 *
 * What derivation CANNOT prove is that the contract is RIGHT — only that both
 * ends still agree with it (trap 12d). The corpus in
 * `InlineBlocks.narrativeChannel.spec.tsx` is the other half: it measures real
 * captured payloads. Neither guard supersedes the other; both ship.
 */

import { describe, expect, it } from 'vitest'
import { ReviewCardBlockSchema } from '@talchain/schemas/boundary'
import { maximalReviewCardBlock } from '@talchain/schemas/fixtures'
import { adaptTypedReviewCardBlock } from '../../../v5/phase3TypedBlocks'
import {
  NARRATIVE_REVIEW_CARD_KIND,
  turnDeliversNarrativeAsTypedCard,
} from '../messageComposition'
import type { ConversationBlock } from '../types'

/** The wire type CEE must send, read out of the contract it validates against. */
const CONTRACT_WIRE_TYPE = ReviewCardBlockSchema.shape.type.value

/** The kind vocabulary the contract admits, read out of the contract. */
const CONTRACT_CARD_KINDS: readonly string[] = ReviewCardBlockSchema.shape.card_kind.options

describe('narrative channel — the producer/consumer boundary asserts itself', () => {
  it('the contract still admits the narrative kind the UI gates on', () => {
    // If CEE renamed the kind, it would have to change the contract to keep
    // validating — and this is the assertion that notices.
    expect(CONTRACT_CARD_KINDS).toContain(NARRATIVE_REVIEW_CARD_KIND)
  })

  it('the UI adapter accepts exactly the wire type the contract defines', () => {
    // Positive: the contract's own type is accepted.
    const accepted = adaptTypedReviewCardBlock({
      ...maximalReviewCardBlock,
      type: CONTRACT_WIRE_TYPE,
      card_kind: NARRATIVE_REVIEW_CARD_KIND,
    })
    expect(accepted).not.toBeNull()

    // Contrast control (trap 13e): the probe discriminates rather than
    // accepting anything at all. A neighbouring type is refused.
    const refused = adaptTypedReviewCardBlock({
      ...maximalReviewCardBlock,
      type: 'coaching',
      card_kind: NARRATIVE_REVIEW_CARD_KIND,
    })
    expect(refused).toBeNull()
  })

  /**
   * THE LOAD-BEARING ONE. A card that is legal for CEE to emit — proven legal
   * by the contract's own validator, not by assertion — must survive the
   * adapter and be RECOGNISED by the gate. This is the whole producer →
   * translation → consumer chain, executed.
   *
   * Break any link (CEE's type, the contract's kind, the adapter's accepted
   * type, the adapter's `card_kind` passthrough, the gate's constant) and this
   * goes RED.
   */
  it('a contract-valid narrative card survives the adapter and satisfies the gate', () => {
    const wireCard = {
      ...maximalReviewCardBlock,
      card_kind: NARRATIVE_REVIEW_CARD_KIND,
      body: 'The producer narrative, carried whole.',
    }

    // The producer's own gate: this is emittable by CEE.
    const parsed = ReviewCardBlockSchema.safeParse(wireCard)
    expect(parsed.success).toBe(true)

    // The translation the two names are separated by.
    const adapted = adaptTypedReviewCardBlock(wireCard)
    expect(adapted).not.toBeNull()
    expect(adapted?.card_kind).toBe(NARRATIVE_REVIEW_CARD_KIND)

    // The consumer recognises it.
    expect(turnDeliversNarrativeAsTypedCard([adapted as ConversationBlock])).toBe(true)
  })

  /**
   * The negative half of the same chain (trap 22b). The gate must not fire on
   * a review card of a DIFFERENT contract kind — otherwise it would suppress
   * the narrative paragraph in turns that never carried a narrative card, and
   * the paragraph would be deleted rather than de-duplicated.
   */
  it('a contract-valid card of another kind does NOT satisfy the gate', () => {
    const otherKind = CONTRACT_CARD_KINDS.find((k) => k !== NARRATIVE_REVIEW_CARD_KIND)
    expect(otherKind).toBeDefined()

    const wireCard = { ...maximalReviewCardBlock, card_kind: otherKind }
    expect(ReviewCardBlockSchema.safeParse(wireCard).success).toBe(true)

    const adapted = adaptTypedReviewCardBlock(wireCard)
    expect(adapted).not.toBeNull()
    expect(turnDeliversNarrativeAsTypedCard([adapted as ConversationBlock])).toBe(false)
  })
})
