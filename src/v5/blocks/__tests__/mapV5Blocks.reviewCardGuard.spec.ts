/**
 * mapV5Blocks — `review_card` live-path invariant guard.
 *
 * Live-path contract (verified Phase 0 / 2026-05-21):
 *   - V5 OlumiResponseSchema is strict; `review_card` is NOT a valid V5
 *     block kind. Phase 3 sidecar blocks (`review_card`, `coaching`,
 *     `evidence`, `exercise`) are split out by the parser BEFORE
 *     `mapV5Blocks` runs and routed to GuidanceStore via
 *     `extractPhase3FromV5Response`.
 *   - As a defence-in-depth check, this test forces a `review_card`-shaped
 *     block past the type system and asserts the mapper does NOT emit a
 *     `ConversationBlock` of type `'review_card'`. If a future refactor
 *     ever routes `review_card` into `message.blocks[]`, the AI panel
 *     would suddenly start rendering Phase 3 cards in chat (alongside the
 *     existing GuidanceStore surface). This test catches that regression.
 *
 * The current mapper's `default` branch produces `v5_unsupported` for any
 * unknown kind, so the assertion is "type !== 'review_card'", not a
 * specific positive shape — we are guarding the invariant, not the
 * fallback's exact form.
 */
import { describe, it, expect } from 'vitest'

import { mapV5Block, mapV5Blocks } from '../mapV5Blocks'

describe('mapV5Blocks — review_card invariant', () => {
  it('mapV5Block never produces a ConversationBlock of type "review_card"', () => {
    // Force a Phase 3 review_card shape past the strict V5 block union.
    // In live code the parser would split this into the additive sidecar
    // before the mapper sees it; the cast simulates the "what if a refactor
    // bypassed the split?" failure mode.
    const phase3ReviewCardShape = {
      type: 'review_card',
      title: 'A leads under most paths',
      body: 'Confidence is fair; review the top driver before committing.',
      variant: 'info',
    } as unknown as Parameters<typeof mapV5Block>[0]

    const result = mapV5Block(phase3ReviewCardShape)

    // The mapper may return null or a v5_unsupported fallback — either is
    // acceptable. The invariant is that it does NOT emit a review_card
    // ConversationBlock that would land in message.blocks[] and surface
    // inside the chat panel.
    expect(result?.type).not.toBe('review_card')
  })

  it('mapV5Blocks batch never produces a ConversationBlock of type "review_card"', () => {
    const blocks = [
      { type: 'analysis_result', summary: 'A leads.', leading_option_id: 'opt-a' },
      {
        type: 'review_card',
        title: 'A leads',
        body: 'Confidence is fair.',
        variant: 'info',
      },
    ] as unknown as Parameters<typeof mapV5Blocks>[0]

    const out = mapV5Blocks(blocks)

    // The legitimate analysis_result still maps correctly.
    expect(out.some(b => b.type === 'v5_analysis_result')).toBe(true)
    // The review_card-shaped block must NEVER surface as a review_card
    // ConversationBlock.
    expect(out.some(b => b.type === 'review_card')).toBe(false)
  })
})
