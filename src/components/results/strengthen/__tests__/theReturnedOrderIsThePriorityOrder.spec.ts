/**
 * ⭐⭐ THE ARRAY COMES BACK IN PRIORITY ORDER — asserted on the RETURN VALUE,
 * never on a copy this file sorted first.
 *
 * ── THE DEFECT THIS EXISTS FOR, MEASURED ───────────────────────────────────
 *     adaptivePriority: 'evaluate'
 *     RETURNED ["strengthen:success-measure@0", "strengthen:flip:e1@-9900"]
 *
 * `ADAPTIVE_MATCH_BOOST` had subtracted 10,000 from the matching rec —
 * overwhelmingly the highest priority in the set — and it came back at index 1.
 * `priority` was consumed only by the dedupe; the array was in builder push
 * order. The boost's own comment says matching recs "float above every other
 * band". They floated nowhere.
 *
 * ── ⚠⚠ WHY THE EXISTING GUARD COULD NOT SEE IT ─────────────────────────────
 * `buildRecommendations.spec.ts:459` — "adaptive priority: a producer stage
 * signal floats matching-helpType recs to the top" — asserts it like this:
 *
 *     const boosted = buildRecommendations({ ...input, adaptivePriority:
 *       'evaluate' }).sort((a, b) => a.priority - b.priority)
 *     expect(boosted[0].id).toBe('strengthen:flip:e1')
 *
 * **The test supplied the very step the consumer was missing.** It proves the
 * NUMBER changed and is structurally incapable of observing whether the ORDER
 * did. That guard is correct about what it asserts and stays; this file asserts
 * the other half (CLAUDE.md trap 13d — an invariant written with the same blind
 * spot as the code it tests).
 *
 * ── ⚠ WHY IT SURVIVED: IT WORKED ON ONE SURFACE ────────────────────────────
 * The Analysis tab reads through `strengthenStore`, which sorts on the way in
 * (`strengthenStore.ts:397`). The Reasoning tab renders the return value
 * directly (`useAnalysisNewViewModel.ts:134`) and `AnalysisNewTabBody`'s
 * `glancePrimary` takes `interventions[0]` as THE ONE ACT the panel promotes.
 * So the producer's stage signal steered the tab Paul's scope ruling excludes,
 * and was inert on the tab he uses.
 */
import { describe, expect, it } from 'vitest'
import { buildRecommendations } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'

const base: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  flipThresholds: null,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

/** Two recs of different help types, so a boost has something to reorder. */
const twoKinds: StrengthenInputs = {
  ...base,
  goalThreshold: null, // clarify rec, priority 0
  fragileEdges: [{ edgeId: 'e1', factorLabel: 'X', switchProbability: 0.5 }], // evaluate rec
}

describe('the returned order IS the priority order', () => {
  it('PRECONDITION: the fixture really does produce two recs of different priority', () => {
    const out = buildRecommendations(twoKinds)
    expect(out.length, 'two recs are needed for an ordering claim to mean anything').toBeGreaterThanOrEqual(2)
    expect(
      new Set(out.map((r) => r.priority)).size,
      'they must differ in priority, or any order satisfies the rule',
    ).toBeGreaterThan(1)
  })

  it('is sorted ascending by priority, WITHOUT the caller sorting it', () => {
    for (const [name, input] of [
      ['unboosted ladder', twoKinds],
      ['boosted', { ...twoKinds, adaptivePriority: 'evaluate' as const }],
    ] as const) {
      const out = buildRecommendations(input)
      const priorities = out.map((r) => r.priority)
      expect(
        priorities,
        `${name}: the array the Reasoning tab renders must already be in priority order — ` +
          `it takes interventions[0] as the one act it promotes`,
      ).toEqual([...priorities].sort((a, b) => a - b))
    }
  })

  /**
   * ⭐ THE DISCRIMINATING PAIR. Sortedness alone passes when the boost does
   * nothing (a ladder is already sorted). Only the pair proves the boost
   * reaches the ORDER: same input, one field apart, different leader.
   */
  it('DISCRIMINATOR: the boost changes WHICH rec leads, not just its number', () => {
    const ladder = buildRecommendations(twoKinds)
    const boosted = buildRecommendations({ ...twoKinds, adaptivePriority: 'evaluate' })

    expect(ladder[0]!.id, 'unboosted, the ladder leads with the foundation rec').toBe(
      'strengthen:success-measure',
    )
    expect(boosted[0]!.id, 'boosted, the matching help type leads').toBe('strengthen:flip:e1')
    expect(
      ladder[0]!.id === boosted[0]!.id,
      'if these ever agree, the boost has stopped reaching the order and this file is inert',
    ).toBe(false)
  })

  /**
   * ⚠ STABILITY, PINNED ON THE BAND THAT DEPENDS ON IT. Equal priorities must
   * keep the order the builder produced.
   *
   * ⚠ MY FIRST ATTEMPT USED TWO FRAGILE EDGES AND ITS OWN PRECONDITION KILLED
   * IT — only the TOP edge becomes a rec (`buildRecommendations.ts:578` sorts
   * and takes one), so there was never a second rec to be stable about. The
   * phase-3 band is the real case: it is sorted into `priority` by producer
   * `priorityRank` at :417, so the final sort must not disturb it.
   */
  it('is STABLE: the producer-ranked phase-3 band keeps its order', () => {
    const out = buildRecommendations({
      ...base,
      phase3Items: [
        { id: 'blk_1', title: 'Confirm this assumption', actionIntent: 'confirm_factor', actionLabel: 'Confirm it', targetIds: ['node_x'], priorityRank: 1 },
        { id: 'blk_2', title: 'Check your framing', targetIds: [], priorityRank: 2 },
      ],
    } as StrengthenInputs)
    const phase3 = out.filter((r) => r.id.startsWith('strengthen:phase3:'))
    expect(phase3.length, 'PRECONDITION: both producer rows must be promoted').toBe(2)
    expect(
      phase3.map((r) => r.id),
      'the producer\'s ascending priorityRank must survive the final sort',
    ).toEqual(['strengthen:phase3:blk_1', 'strengthen:phase3:blk_2'])
  })
})
