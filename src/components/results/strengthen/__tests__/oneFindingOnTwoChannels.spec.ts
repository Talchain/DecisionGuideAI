/**
 * ONE FINDING THAT ARRIVED ON TWO CHANNELS IS ONE FINDING — AND IT KEEPS BOTH HALVES.
 *
 * ## Witnessed on a real run, bundle `d9c4066c`, 19 Sep 2026
 *
 * The producer emits each load-bearing assumption twice, from the same handler
 * (`decision_review_enricher`) in the same millisecond, with **byte-identical
 * bodies** and complementary halves:
 *
 * ```
 *   review:assumption:1:8ac55f86e2c168ef   rank  71   review_card
 *     "A load-bearing assumption"          no action, no target   ← the explanation
 *   coach:assumption:1:8ac55f86e2c168ef    rank 101   coaching
 *     "An assumption to check"             confirm_factor · [Product Quality]  ← the route
 * ```
 *
 * Three assumptions on that run, so **six rows on screen**: every sentence read
 * twice, and only the second copy of each could be acted on.
 *
 * ⚠ The existing `dedupeKey` is `title + body` and these twins have DIFFERENT
 * TITLES, so it misses them by exactly one field. Its conjunction is right for
 * the case it was written for — one generic headline over distinct bodies is
 * distinct findings — and blind to the mirror case.
 *
 * ## ⛔ MERGING, NOT DROPPING, IS THE WHOLE FIX
 *
 * A plain dedupe keeps the FIRST twin after sorting — the review card, rank 71 —
 * and **silently deletes the action and the target**, leaving an explanation the
 * user cannot act on. These arms pin that it does not.
 */
import { describe, expect, it } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import {
  ADDITIVE_EXTENSIONS_KEY,
  type OlumiResponseWithExtensions,
} from '../../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../../v5/extractPhase3FromV5Response'
import { toStoreGuidanceItem } from '../../../../canvas/conversation/useConversation'
import { buildRecommendations, toStrengthenPhase3Item } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'

const extract = (blocks: Array<Record<string, unknown>>) => {
  const response = {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as unknown as OlumiResponse
  Object.defineProperty(response, ADDITIVE_EXTENSIONS_KEY, {
    value: Object.freeze({ phase3_blocks: blocks }),
    enumerable: false,
    writable: false,
    configurable: false,
  })
  return extractPhase3FromV5Response(response as OlumiResponseWithExtensions)
}

const toItems = (blocks: Array<Record<string, unknown>>) =>
  extract(blocks).guidanceItems.map(toStoreGuidanceItem).map(toStrengthenPhase3Item)

const baseInputs: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  flipThresholds: null,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

/** The assumption text, verbatim from the capture. */
const BODY =
  'The link from Product Quality to churn assumes product gaps are the main mechanism, ' +
  'based on the three churned customers who cited missing integrations.'

/** The explanation half: a review card, no action, no target. Rank band 10-99. */
const reviewCard = (body = BODY): Record<string, unknown> => ({
  block_id: 'blk-review-assumption-1',
  type: 'review_card',
  card_kind: 'assumption',
  title: 'A load-bearing assumption',
  body,
  severity: 'info',
  target_refs: [],
  priority_rank: 71,
  category: 'could_fix',
  signal_code: 'ASSUMPTION_CHECK',
})

/** The route half: coaching, with the action and the target. Rank band 100-199. */
const coachingTwin = (body = BODY): Record<string, unknown> => ({
  block_id: 'blk-coach-assumption-1',
  type: 'coaching',
  coaching_kind: 'assumption_check',
  title: 'An assumption to check',
  body,
  source: 'decision_review',
  target_refs: [{ id: 'cc057894', label: 'Product Quality', kind: 'factor' }],
  priority_rank: 101,
  category: 'could_fix',
  signal_code: 'ASSUMPTION_CHECK',
  action_intent: 'confirm_factor',
  action_label: 'Confirm this assumption',
})

const recsFor = (blocks: Array<Record<string, unknown>>) =>
  buildRecommendations({ ...baseInputs, phase3Items: toItems(blocks) })

const phase3 = (blocks: Array<Record<string, unknown>>) =>
  recsFor(blocks).filter((r) => r.id.startsWith('strengthen:phase3:'))

describe('one finding on two channels', () => {
  it('PRECONDITION: both halves survive extraction, or every arm below is vacuous', () => {
    const items = toItems([reviewCard(), coachingTwin()])
    expect(items, 'the two producer blocks did not both reach the engine').toHaveLength(2)
    // ⚠ The twin-ness is asserted, not assumed: same producer code, same body,
    // and only ONE of them carries the action. If the fixture ever stopped
    // reproducing that shape these tests would pass for the wrong reason.
    expect(new Set(items.map((i) => i.signalCode))).toEqual(new Set(['ASSUMPTION_CHECK']))
    expect(new Set(items.map((i) => i.body))).toEqual(new Set([BODY]))
    expect(items.filter((i) => i.actionLabel != null)).toHaveLength(1)
  })

  it('⛔ renders ONE row, not two', () => {
    expect(
      phase3([reviewCard(), coachingTwin()]),
      'the same sentence twice, 30px apart, is what a user reported',
    ).toHaveLength(1)
  })

  it('⛔ the surviving row KEEPS ITS EXPLANATION, verbatim', () => {
    const [rec] = phase3([reviewCard(), coachingTwin()])
    expect(rec.whyNow, 'the producer body must never be rewritten or dropped').toContain(
      'product gaps are the main mechanism',
    )
  })

  it('⛔ and GAINS the action it had none of — the half a plain dedupe deletes', () => {
    const [rec] = phase3([reviewCard(), coachingTwin()])
    // ⭐ THE ARM THAT DISTINGUISHES A MERGE FROM A DROP. The review card sorts
    // first (rank 71 < 101), so a dedupe keeping the first survivor would leave
    // an explanation with no route — RC4's defect, reached from the other side.
    expect(rec.action?.label, 'the kept row must adopt its twin\'s action').toBe(
      'Confirm this assumption',
    )
  })

  it('⛔ and GAINS the target, so the disagreement and focus controls still work', () => {
    const [rec] = phase3([reviewCard(), coachingTwin()])
    expect(rec.targetId, 'the controls hang off the target; losing it disables them').toBe(
      'cc057894',
    )
  })

  it('keeps the row identity of the half that already sorted first — nothing moves', () => {
    const [rec] = phase3([reviewCard(), coachingTwin()])
    expect(rec.id).toBe('strengthen:phase3:blk-review-assumption-1')
  })

  /**
   * ⭐ THE SINGLE-FINDING CASE, which the review named explicitly. A finding
   * with no twin folds to itself, unchanged — including its action.
   */
  it('⛔ a finding with no twin is untouched', () => {
    const alone = phase3([coachingTwin()])
    expect(alone).toHaveLength(1)
    expect(alone[0].id).toBe('strengthen:phase3:blk-coach-assumption-1')
    expect(alone[0].action?.label).toBe('Confirm this assumption')
    expect(alone[0].targetId).toBe('cc057894')
  })

  it('⛔ a lone review card keeps rendering — this never removes the only copy', () => {
    expect(phase3([reviewCard()])).toHaveLength(1)
  })

  /**
   * ⛔⛔ THE DISCRIMINATING TWIN. Without it, a merge keyed on `signal_code`
   * ALONE would collapse two genuinely different assumptions into one and every
   * arm above would still pass.
   */
  it('⛔ two DIFFERENT findings sharing a signal_code both render', () => {
    const other = 'The model assumes the competitor’s hiring does not shift expectations.'
    const rows = phase3([reviewCard(), coachingTwin(), reviewCard(other), coachingTwin(other)])
    expect(rows, 'distinct bodies are distinct findings, whatever code they share').toHaveLength(2)
    const bodies = rows.map((r) => r.whyNow ?? '')
    expect(bodies.some((b) => b.includes('product gaps'))).toBe(true)
    expect(bodies.some((b) => b.includes('competitor'))).toBe(true)
  })

  /**
   * ⚠ The merge must not fire where identity cannot be established. A block with
   * no `signal_code` has no producer-minted identity, so body equality alone
   * would be the content sniff this design avoids.
   */
  it('⛔ never merges on body alone when the producer minted no code', () => {
    const noCode = (id: string, title: string): Record<string, unknown> => ({
      block_id: id,
      type: 'coaching',
      coaching_kind: 'assumption_check',
      title,
      body: BODY,
      source: 'decision_review',
      freshness: 'fresh',
      priority_rank: 120,
    })
    expect(phase3([noCode('blk-a', 'One'), noCode('blk-b', 'Two')])).toHaveLength(2)
  })
})
