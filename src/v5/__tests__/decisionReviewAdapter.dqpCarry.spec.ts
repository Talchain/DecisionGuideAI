/**
 * decisionReviewAdapter — the `decision_quality_prompts` CARRY (ROADMAP 2.466).
 *
 * WHY. The walk-train postdeploy audit (2026-08-04) proved a three-layer
 * dark-ship: every live analysis turn carries cited decision-quality prompts
 * inside `blocks[].enrichment.decision_review`, but the live V5 path dropped
 * them at THIS boundary — `DecisionReview030` projected only the five prose
 * orphans, and `decision_quality_prompts` (classified enricher-owned) never
 * reached `runMeta`. The results surface a tester actually sees therefore
 * showed none of the product's science-grounded key questions.
 *
 * The fix is a RAW VERBATIM CARRY: `DecisionReview030.decision_quality_prompts`
 * holds the wire entries untouched, for the results-surface key-question card
 * to map via the single mapping site (`utils/decisionQualityPrompts`). It is a
 * carry, not a projection-render: the key stays in `V0_30_ENRICHER_OWNED_KEYS`
 * and the decision-review card's non-duplication guard keeps its meaning.
 *
 * Fixtures are the same two verbatim live captures the wire030 suite pins
 * (r1/r3, CEE 76d2e1c) — see that file's header for why they are never
 * "refreshed".
 */
import { describe, it, expect } from 'vitest'
import {
  readDecisionReviewWireState,
  V0_30_ENRICHER_OWNED_KEYS,
  V0_30_PROJECTED_KEYS,
  type DecisionReview030,
} from '../decisionReviewAdapter'
import r1Block from './fixtures/live-decision-review-0_30.r1-cee-76d2e1c.json'
import r3Block from './fixtures/live-decision-review-0_30.r3-cee-76d2e1c.json'

function enrichmentOf(block: unknown): Record<string, unknown> {
  return (block as Record<string, unknown>).enrichment as Record<string, unknown>
}

function v030Of(enrichment: Record<string, unknown>): DecisionReview030 {
  const state = readDecisionReviewWireState(enrichment)
  if (state.kind !== 'v0_30') {
    throw new Error(`expected v0_30, got ${state.kind}`)
  }
  return state.review
}

/** A minimal well-formed 0.30 payload builder for the policy cases. */
function payloadWith(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    decision_review: {
      narrative_summary: 'Some live prose.',
      produced_at: '2026-08-04T13:56:03.240Z',
      ...overrides,
    },
  }
}

describe('DecisionReview030 carries decision_quality_prompts VERBATIM (2.466)', () => {
  it('r1: the single cited prompt rides through byte-identical, DSK-T-003 id intact', () => {
    const wire = enrichmentOf(r1Block).decision_review as Record<string, unknown>
    const review = v030Of(enrichmentOf(r1Block))
    // Identity-bound: same array CONTENT as the wire, not a lookalike.
    expect(review.decision_quality_prompts).toEqual(wire.decision_quality_prompts)
    expect(review.decision_quality_prompts).toHaveLength(1)
    const entry = review.decision_quality_prompts[0] as Record<string, unknown>
    expect(entry.dsk_claim_id).toBe('DSK-T-003')
    expect(entry.dsk_protocol_id).toBe('DSK-P-003')
    expect(entry.evidence_strength).toBe('medium')
    expect(entry.principle).toBe('Consider-the-opposite as a debiasing strategy')
  })

  it('r3: BOTH entries carried in wire order — [0] uncited (no dsk_claim_id), [1] DSK-T-002/strong', () => {
    const wire = enrichmentOf(r3Block).decision_review as Record<string, unknown>
    const review = v030Of(enrichmentOf(r3Block))
    expect(review.decision_quality_prompts).toEqual(wire.decision_quality_prompts)
    expect(review.decision_quality_prompts).toHaveLength(2)
    const [uncited, cited] = review.decision_quality_prompts as Array<Record<string, unknown>>
    // The honest-absence case is REAL on the live wire and must survive the
    // carry untouched — no default id, no inferred strength.
    expect(uncited.dsk_claim_id).toBeUndefined()
    expect(uncited.evidence_strength).toBeUndefined()
    expect(cited.dsk_claim_id).toBe('DSK-T-002')
    expect(cited.evidence_strength).toBe('strong')
  })
})

describe('carry policy — lenient, and deliberately NOT the A1 strictness', () => {
  // Rationale (documented at the field): refusing the WHOLE payload over a
  // wrong-typed DQP container would vaporise five sibling prose fields that
  // other surfaces already render, to alarm about a key whose sole consumer
  // (the results key-question card) fails soft by simply not rendering.
  it('absent key → empty array, payload still v0_30', () => {
    const review = v030Of(payloadWith({}))
    expect(review.decision_quality_prompts).toEqual([])
  })

  it('explicit null → empty array, payload still v0_30', () => {
    const review = v030Of(payloadWith({ decision_quality_prompts: null }))
    expect(review.decision_quality_prompts).toEqual([])
  })

  it('wrong-typed container → empty array, payload still v0_30 (NOT malformed)', () => {
    const state = readDecisionReviewWireState(
      payloadWith({ decision_quality_prompts: 'not-an-array' }),
    )
    expect(state.kind).toBe('v0_30')
    if (state.kind === 'v0_30') {
      expect(state.review.decision_quality_prompts).toEqual([])
    }
  })

  it('a DQP-only payload does NOT flip hasProse — completeness semantics unchanged', () => {
    // produced_at + DQP passes the content-key shape gate, but DQP is not one
    // of the five prose fields; useResultCompleteness's
    // `decision_review_unavailable` behaviour must not change under the carry.
    const state = readDecisionReviewWireState({
      decision_review: {
        produced_at: '2026-08-04T13:56:03.240Z',
        decision_quality_prompts: [{ question: 'Q?', principle: 'P' }],
      },
    })
    expect(state.kind).toBe('v0_30')
    if (state.kind === 'v0_30') {
      expect(state.review.hasProse).toBe(false)
      expect(state.review.decision_quality_prompts).toHaveLength(1)
    }
  })
})

describe('classification lists untouched by the carry (block-card guard keeps meaning)', () => {
  it('decision_quality_prompts remains ENRICHER-OWNED; both halves keep their pinned sizes', () => {
    expect(V0_30_ENRICHER_OWNED_KEYS).toContain('decision_quality_prompts')
    expect(V0_30_PROJECTED_KEYS).not.toContain('decision_quality_prompts')
    expect(V0_30_ENRICHER_OWNED_KEYS).toHaveLength(5)
    expect(V0_30_PROJECTED_KEYS).toHaveLength(5)
  })
})
