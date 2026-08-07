/**
 * The M1 REST branch of `readDecisionReviewWireState` — ONLY that branch.
 *
 * ⚠ THE SUBJECT OF THIS FILE USED TO BE AN EXPORT CALLED `extractDecisionReview`
 * AND IT NO LONGER EXISTS. It was a one-line projection of
 * `readDecisionReviewWireState` with zero production callers, and these specs
 * were the only thing keeping it alive — the shape of dead code that reads as
 * live. It is now the local `extractM1Review` below: same projection, same
 * coverage of the M1 validator, but reached through the public API every real
 * caller uses, so this file can no longer be the reason an export survives.
 *
 * ⚠ READ THIS BEFORE TRUSTING A GREEN RUN OF THIS FILE (ROADMAP 2.154).
 *
 * `validDR` below is a HAND-WRITTEN MIRROR of the M1 REST shape
 * (`intent`/`analysis_state`/`readiness`/`blocks`). **Nothing emits that shape
 * into a V5 turn's block enrichment** — derived at the bytes at both upstream
 * tips: PLoT `3d13e0ac` never writes a `decision_review` key at all (complete
 * manifest), and CEE `2180702` (#758) has exactly two writers of the wire key,
 * the 0.30 enricher and a `null` patch. The shape is still live elsewhere —
 * CEE serves it from `POST /assist/v1/review` — but not here.
 *
 * So this file passing means *the M1 validator still validates M1 input*. It
 * did NOT, and cannot, tell anyone that the adapter worked on a live turn. For
 * months it was green while the adapter returned `null` on every single live
 * analysis and five prose fields worth a real ~8-9s gpt-4.1 call were dropped.
 * That is the trap: a fixture that mirrors a retired shape certifies a dead
 * path, and the greener it looks the longer the dead path survives.
 *
 * ⭐ THE LIVE-SHAPE COVERAGE IS `decisionReviewAdapter.wire030.spec.ts`, whose
 * fixtures are verbatim captured production bytes rather than anything written
 * by hand. If you are adding coverage for what CEE actually sends, add it
 * there. Do not "modernise" `validDR` into the 0.30 shape — this file's job is
 * to hold the inert M1 branch honest, and the last assertion below pins the
 * one fact that matters about it: it does not fire on the live payload.
 */
import { describe, it, expect } from 'vitest'
import type { CeeDecisionReviewPayloadV1 } from '../../types/cee'
import { readDecisionReviewWireState } from '../decisionReviewAdapter'
import r1Block from './fixtures/live-decision-review-0_30.r1-cee-76d2e1c.json'

/**
 * The projection the deleted `extractDecisionReview` export performed, kept
 * local to the one file that wanted it: "the M1 payload, or null if this wire
 * state is anything else". Local on purpose — see the header.
 */
function extractM1Review(
  enrichment: Record<string, unknown> | undefined,
): CeeDecisionReviewPayloadV1 | null {
  const state = readDecisionReviewWireState(enrichment)
  return state.kind === 'm1' ? state.review : null
}

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

describe('the M1 REST branch (inert on live payloads)', () => {
  it('returns null for undefined enrichment', () => {
    expect(extractM1Review(undefined)).toBeNull()
  })

  it('returns null when enrichment has no decision_review key', () => {
    expect(extractM1Review({ something_else: 'x' })).toBeNull()
  })

  it('returns null when decision_review is not an object', () => {
    expect(extractM1Review({ decision_review: 'string' })).toBeNull()
    expect(extractM1Review({ decision_review: [] })).toBeNull()
    expect(extractM1Review({ decision_review: null })).toBeNull()
  })

  it('returns a valid payload when shape is well-formed', () => {
    const r = extractM1Review({ decision_review: validDR })
    expect(r).not.toBeNull()
    expect(r?.intent).toBe('selection')
    expect(r?.readiness?.level).toBe('ready')
    expect(r?.blocks).toHaveLength(1)
  })

  it('returns null for invalid intent', () => {
    expect(
      extractM1Review({ decision_review: { ...validDR, intent: 'bogus' } }),
    ).toBeNull()
  })

  it('returns null for invalid analysis_state', () => {
    expect(
      extractM1Review({ decision_review: { ...validDR, analysis_state: 'bogus' } }),
    ).toBeNull()
  })

  it('returns null for invalid readiness.level', () => {
    expect(
      extractM1Review({
        decision_review: { ...validDR, readiness: { ...validDR.readiness, level: 'nope' } },
      }),
    ).toBeNull()
  })

  it('returns null when blocks is not an array', () => {
    expect(
      extractM1Review({ decision_review: { ...validDR, blocks: 'not-array' } }),
    ).toBeNull()
  })

  it('returns null when any block is missing required fields', () => {
    expect(
      extractM1Review({
        decision_review: {
          ...validDR,
          blocks: [{ id: 'x', status: 'ok' /* missing source, summary, priority */ }],
        },
      }),
    ).toBeNull()
  })

  it('preserves extra keys via index signature', () => {
    const r = extractM1Review({
      decision_review: { ...validDR, meta: { produced_at: '2026-04-21' } },
    })
    expect(r).not.toBeNull()
    expect((r as Record<string, unknown>).meta).toEqual({ produced_at: '2026-04-21' })
  })

  /**
   * ⭐ The fact that makes every assertion above legible. Without it, this
   * file reads as "the adapter works" — which is what it read as while the
   * live path was 100% dead. This is the ONE assertion here made against real
   * captured production bytes.
   */
  it('returns null on the LIVE 0.30 payload — this branch is not the live path', () => {
    const enrichment = (r1Block as unknown as { enrichment: Record<string, unknown> }).enrichment
    expect(enrichment.decision_review).toBeTruthy()
    expect(extractM1Review(enrichment)).toBeNull()
  })
})
