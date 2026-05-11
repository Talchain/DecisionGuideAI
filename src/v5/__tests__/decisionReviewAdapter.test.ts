import { describe, it, expect } from 'vitest'
import { extractDecisionReview } from '../decisionReviewAdapter'

const validDR = {
  intent: 'selection',
  analysis_state: 'ran',
  readiness: {
    level: 'ready',
    headline: 'You are ready to decide.',
    factors: [{ label: 'Goal clear', status: 'ok' }],
  },
  blocks: [
    {
      id: 'recommendation',
      status: 'ok',
      source: 'cee',
      summary: 'Option A recommended.',
      priority: 1,
    },
  ],
}

describe('extractDecisionReview', () => {
  it('returns null for undefined enrichment', () => {
    expect(extractDecisionReview(undefined)).toBeNull()
  })

  it('returns null when enrichment has no decision_review key', () => {
    expect(extractDecisionReview({ something_else: 'x' })).toBeNull()
  })

  it('returns null when decision_review is not an object', () => {
    expect(extractDecisionReview({ decision_review: 'string' })).toBeNull()
    expect(extractDecisionReview({ decision_review: [] })).toBeNull()
    expect(extractDecisionReview({ decision_review: null })).toBeNull()
  })

  it('returns a valid payload when shape is well-formed', () => {
    const r = extractDecisionReview({ decision_review: validDR })
    expect(r).not.toBeNull()
    expect(r?.intent).toBe('selection')
    expect(r?.readiness?.level).toBe('ready')
    expect(r?.blocks).toHaveLength(1)
  })

  it('returns null for invalid intent', () => {
    expect(
      extractDecisionReview({ decision_review: { ...validDR, intent: 'bogus' } }),
    ).toBeNull()
  })

  it('returns null for invalid analysis_state', () => {
    expect(
      extractDecisionReview({ decision_review: { ...validDR, analysis_state: 'bogus' } }),
    ).toBeNull()
  })

  it('returns null for invalid readiness.level', () => {
    expect(
      extractDecisionReview({
        decision_review: { ...validDR, readiness: { ...validDR.readiness, level: 'nope' } },
      }),
    ).toBeNull()
  })

  it('returns null when blocks is not an array', () => {
    expect(
      extractDecisionReview({ decision_review: { ...validDR, blocks: 'not-array' } }),
    ).toBeNull()
  })

  it('returns null when any block is missing required fields', () => {
    expect(
      extractDecisionReview({
        decision_review: {
          ...validDR,
          blocks: [{ id: 'x', status: 'ok' /* missing source, summary, priority */ }],
        },
      }),
    ).toBeNull()
  })

  it('preserves extra keys via index signature', () => {
    const r = extractDecisionReview({
      decision_review: { ...validDR, meta: { produced_at: '2026-04-21' } },
    })
    expect(r).not.toBeNull()
    expect((r as Record<string, unknown>).meta).toEqual({ produced_at: '2026-04-21' })
  })
})
