/**
 * ⭐⭐ THE PRODUCER NAMES THE TECHNIQUE, AND THE SHELF COULD NOT HEAR IT.
 *
 * ── WHAT THE PRODUCER ACTUALLY SENDS, off capture `0db2eb0a` (20 Sep 2026) ──
 * Two coaching blocks, two different decision-science techniques, ONE code:
 *
 *   signal_code CALIBRATION_PROMPT · claim DSK-T-001 · protocol DSK-P-001
 *     title "Pre-mortem and prospective hindsight prompt"
 *   signal_code CALIBRATION_PROMPT · claim DSK-T-002 · protocol DSK-P-002
 *     title "Outside view and reference class forecasting prompt"
 *
 * ⛔ SO `signal_code` CANNOT DISCRIMINATE THEM, and the technique's name lives
 * only in the TITLE — prose, which this estate forbids parsing (the
 * `GOAL_ANCESTOR_DATA_GAP` lesson: an id that appears only inside a message is
 * not a carrier). `dsk_claim_provenance.claim_id` is the one producer-authored
 * IDENTITY that says which move a block is.
 *
 * ── WHY IT MATTERS ON THE RUN THAT MATTERS ─────────────────────────────────
 * Measured across both real captures: on a run whose leader is WITHHELD, the
 * engine's own cards are gated off almost entirely and these producer blocks
 * are the only coaching the panel has. Without the claim id the methods shelf
 * lists all seven techniques unconditioned — the pre-#1797 behaviour, on
 * exactly the run #1797 was meant to help.
 *
 * ── THE FIELD DIED IN THE MAPPER, one field over from a fix already made ───
 * `GuidanceItem` carries `dsk_claim_id`; `toStrengthenPhase3Item` dropped it.
 * That file's own comment records the identical history for `signal_code`:
 * *"It survived `deriveGuidance` onto `GuidanceItem` and then died HERE,
 * unmapped."*
 */
import { describe, it, expect } from 'vitest'
import { methodForRecommendation, methodIdsRaisedBy } from '../recommendationMethod'
import { toStrengthenPhase3Item } from '../../strengthen/buildRecommendations'
import type { GuidanceItem } from '../../../../canvas/stores/guidanceStore'

/**
 * ⚠ A RECORD, NOT A FIXTURE. These are the ids and codes the product actually
 * received on the dated capture above, and they are APPEND-ONLY: if the
 * producer's vocabulary changes, add a row, never edit one.
 */
const AS_RECEIVED_0DB2EB0A = [
  { claim: 'DSK-T-001', code: 'CALIBRATION_PROMPT', method: 'pre_mortem' },
  { claim: 'DSK-T-002', code: 'CALIBRATION_PROMPT', method: 'outside_view' },
] as const

const phase3Rec = (claim?: string, code?: string) => ({
  id: 'strengthen:phase3:block_1',
  ...(code === undefined ? {} : { signalCode: code }),
  ...(claim === undefined ? {} : { dskClaimId: claim }),
})

describe('the producer\'s claim id resolves a technique', () => {
  it.each(AS_RECEIVED_0DB2EB0A)(
    'claim $claim → $method',
    ({ claim, code, method }) => {
      const m = methodForRecommendation('strengthen:phase3:b', code, undefined, claim)
      expect(m?.id).toBe(method)
    },
  )

  /**
   * ⛔⛔ THE DISCRIMINATING PAIR, and it is the whole argument for using the
   * claim id rather than the code. Both blocks carry `CALIBRATION_PROMPT`. If
   * the resolver were reading the code, these two would return the SAME method
   * — and a shelf saying "this run raised a pre-mortem" about an outside-view
   * prompt is worse than saying nothing.
   */
  it('two blocks with the SAME signal_code resolve to DIFFERENT methods', () => {
    const a = methodForRecommendation('strengthen:phase3:a', 'CALIBRATION_PROMPT', undefined, 'DSK-T-001')
    const b = methodForRecommendation('strengthen:phase3:b', 'CALIBRATION_PROMPT', undefined, 'DSK-T-002')
    expect(a?.id).not.toBe(b?.id)
    expect([a?.id, b?.id]).toEqual(['pre_mortem', 'outside_view'])
  })

  /**
   * ⛔ FAILS CLOSED. The table is hand-maintained over a producer vocabulary
   * whose full membership has not been observed, so an unlisted id must resolve
   * to NOTHING and the block raises no method — exactly today's behaviour.
   * Guessing a mapping is the fabrication this panel exists to prevent.
   */
  it('an unrecognised claim id resolves to no method', () => {
    expect(methodForRecommendation('strengthen:phase3:x', undefined, undefined, 'DSK-T-999')).toBeNull()
    expect(methodForRecommendation('strengthen:phase3:x', undefined, undefined, '')).toBeNull()
    expect(methodForRecommendation('strengthen:phase3:x', undefined, undefined, 'dsk-t-001')).toBeNull()
  })

  /**
   * ⚠ PRECEDENCE. The claim id is the SPECIFIC carrier; a recommendation-id
   * prefix is more specific still and must keep winning, or an engine card that
   * already knows its technique would be overridden by a producer passthrough.
   */
  it('a recommendation-id prefix still wins over the claim id', () => {
    const m = methodForRecommendation('strengthen:robustness', undefined, undefined, 'DSK-T-002')
    expect(m?.id).toBe('pre_mortem')
  })
})

describe('the shelf can now see what the run raised', () => {
  it('two producer blocks raise two methods', () => {
    const raised = methodIdsRaisedBy([
      phase3Rec('DSK-T-001', 'CALIBRATION_PROMPT'),
      phase3Rec('DSK-T-002', 'CALIBRATION_PROMPT'),
    ])
    expect([...raised].sort()).toEqual(['outside_view', 'pre_mortem'])
  })

  /**
   * ⛔ THE BEFORE STATE, PINNED. Without the claim id the same two blocks raise
   * NOTHING — which is what shipped, and what made the grouping inert on the
   * withheld run. If this ever stops being empty the argument for the whole
   * change has changed and someone should notice.
   */
  it('CONTRAST: the same blocks WITHOUT the claim id raise nothing', () => {
    const raised = methodIdsRaisedBy([
      phase3Rec(undefined, 'CALIBRATION_PROMPT'),
      phase3Rec(undefined, 'CALIBRATION_PROMPT'),
    ])
    expect([...raised]).toEqual([])
  })
})

describe('the mapper carries the field it used to drop', () => {
  const guidance = (extra: Record<string, unknown>): GuidanceItem =>
    ({
      item_id: 'b1',
      title: 'Pre-mortem and prospective hindsight prompt',
      source: 'decision_review',
      priority: 30,
      primary_action: { type: 'discuss', prompt: 'x' },
      ...extra,
    }) as unknown as GuidanceItem

  it('dsk_claim_id survives onto the engine item', () => {
    expect(toStrengthenPhase3Item(guidance({ dsk_claim_id: 'DSK-T-001' })).dskClaimId).toBe('DSK-T-001')
  })

  /**
   * ⚠ ABSENT STAYS ABSENT — the passthrough rule every producer-owned field on
   * this mapper follows. An invented id would attribute a technique to a block
   * the producer never grounded.
   */
  it('absent stays absent, never invented', () => {
    expect(toStrengthenPhase3Item(guidance({})).dskClaimId).toBeUndefined()
    expect(toStrengthenPhase3Item(guidance({ dsk_claim_id: '' })).dskClaimId).toBeUndefined()
  })
})
