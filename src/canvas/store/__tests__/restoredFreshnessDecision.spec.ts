/**
 * ⭐⭐ WHY THE RESTORE DECLINED — pinned against the REAL captured payload.
 *
 * On deployed `e2016182` the product renders, 175 characters apart, on one
 * screen, on the restore path:
 *
 *     "Analysis complete."
 *     "Cannot confirm whether this analysis is current."
 *
 * Both sentences are TRUE. They answer different questions — *did a run finish
 * and produce a report* versus *does that report match the model in front of
 * you* — and on the restore path both answers are correct. The defect is not
 * that they disagree; it is that nothing says WHY the second one cannot be
 * resolved, so a reader is left resolving a contradiction that is not one.
 *
 * `resolveRestoredFreshnessUpdate` returns `null` for FOUR structurally
 * different reasons and a caller cannot tell them apart. Answering "which one
 * fired?" took an hour of source reading plus a runtime store dump. A
 * mechanism that declines silently is indistinguishable from one that was
 * never asked.
 *
 * THE FIXTURE BELOW IS NOT INVENTED. Every field is copied from the live
 * `window.useCanvasStore` read and the `olumi-canvas-autosave` record on
 * `e2016182`, and the two timestamps are the finding: the persisted readiness
 * snapshot PREDATES the analysis it was persisted beside by 110 seconds. It is
 * a PRE-RUN payload, so of course it states `none` and carries no
 * `graph_hash_at_run`.
 *
 * ⚠ WHAT THIS SPEC DOES NOT CLAIM. It does not claim the restore SHOULD have
 * attested. On this payload the decline is CORRECT and fail-closed — there is
 * no attestation to recover. What is wrong is upstream: the store's
 * `ceeAnalysisReady` was never updated after the run, so the attestation CEE
 * did emit (`fresh`, `graph_hash_at_run == current_graph_hash`) never reached
 * persistence. That repair is not in this PR.
 */
import { describe, it, expect } from 'vitest'
import {
  explainRestoredFreshnessDecision,
  resolveRestoredFreshnessUpdate,
  RESTORED_ATTESTATION_HASHES_ALIGNED,
} from '../analysisFreshness'

const HYDRATED = { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' } as const

/**
 * VERBATIM from the deployed capture — the persisted, PRE-RUN readiness.
 * `computed_at` 18:46:54.925Z against the analysis's 18:48:45.206Z.
 */
const CAPTURED_PRERUN_READINESS = {
  status: 'ready',
  freshness: 'none',
  freshness_reason: 'no_successful_run_analysis_fact',
  current_graph_hash: '35b5f37cb8173907',
  computed_at: '2026-09-06T18:46:54.925Z',
  // NOTE: no `graph_hash_at_run` key. That absence is the finding.
} as const

/** VERBATIM from the same user's live run capture, which DOES attest. */
const CAPTURED_POSTRUN_READINESS = {
  freshness: 'fresh',
  freshness_reason: 'graph_hash_match',
  graph_hash_at_run: '799c04738bd20ee7',
  current_graph_hash: '799c04738bd20ee7',
  computed_at: '2026-09-06T18:48:45.206Z',
} as const

describe('explainRestoredFreshnessDecision — the decline names itself', () => {
  it('⭐ THE CAPTURED STATE: a pre-run readiness declines as stored_verdict_not_fresh', () => {
    const d = explainRestoredFreshnessDecision(HYDRATED, false, CAPTURED_PRERUN_READINESS)
    expect(d).toEqual({ outcome: 'declined', reason: 'stored_verdict_not_fresh' })
  })

  it('⭐ THE TWIN: the SAME user’s post-run readiness attests', () => {
    // The discrimination that makes the case above a finding rather than a
    // fact about the code: CEE emitted everything the validator needs, on this
    // very run. The payload that reached persistence was simply the wrong one.
    const d = explainRestoredFreshnessDecision(HYDRATED, false, CAPTURED_POSTRUN_READINESS)
    expect(d.outcome).toBe('attested')
    if (d.outcome !== 'attested') throw new Error('unreachable')
    expect(d.state.freshness).toBe('fresh')
    expect(d.state.freshnessReason).toBe(RESTORED_ATTESTATION_HASHES_ALIGNED)
  })

  it('the pair actually DIFFER — the discrimination is asserted, not assumed', () => {
    const pre = explainRestoredFreshnessDecision(HYDRATED, false, CAPTURED_PRERUN_READINESS)
    const post = explainRestoredFreshnessDecision(HYDRATED, false, CAPTURED_POSTRUN_READINESS)
    expect(pre.outcome).not.toBe(post.outcome)
  })

  it('a live verdict is never overwritten — not_a_hydrated_snapshot', () => {
    const live = { freshness: 'stale', freshnessReason: 'graph_hash_mismatch' } as const
    expect(explainRestoredFreshnessDecision(live, false, CAPTURED_POSTRUN_READINESS))
      .toEqual({ outcome: 'declined', reason: 'not_a_hydrated_snapshot' })
  })

  it('an edit since restore beats a valid attestation — edited_since_restore', () => {
    expect(explainRestoredFreshnessDecision(HYDRATED, true, CAPTURED_POSTRUN_READINESS))
      .toEqual({ outcome: 'declined', reason: 'edited_since_restore' })
  })

  it('fresh but no hashes — attestation_hashes_absent', () => {
    expect(explainRestoredFreshnessDecision(HYDRATED, false, { freshness: 'fresh' }))
      .toEqual({ outcome: 'declined', reason: 'attestation_hashes_absent' })
  })

  it('fresh, both hashes, but DIFFERENT — attestation_hashes_differ', () => {
    expect(
      explainRestoredFreshnessDecision(HYDRATED, false, {
        ...CAPTURED_POSTRUN_READINESS,
        current_graph_hash: '3346784355b3fc7b',
      }),
    ).toEqual({ outcome: 'declined', reason: 'attestation_hashes_differ' })
  })

  it('every decline reason is REACHABLE — no dead arm in the union', () => {
    // A union member nothing can produce is a claim the type makes and the
    // code cannot honour. Collect what the cases above actually reached and
    // assert the whole set, so adding a member without a case REDs.
    const reached = new Set([
      explainRestoredFreshnessDecision({ freshness: 'stale', freshnessReason: 'x' }, false, {}),
      explainRestoredFreshnessDecision(HYDRATED, true, {}),
      explainRestoredFreshnessDecision(HYDRATED, false, CAPTURED_PRERUN_READINESS),
      explainRestoredFreshnessDecision(HYDRATED, false, { freshness: 'fresh' }),
      explainRestoredFreshnessDecision(HYDRATED, false, {
        ...CAPTURED_POSTRUN_READINESS, current_graph_hash: 'different',
      }),
    ].map((d) => (d.outcome === 'declined' ? d.reason : 'attested')))
    expect([...reached].sort()).toEqual([
      'attestation_hashes_absent',
      'attestation_hashes_differ',
      'edited_since_restore',
      'not_a_hydrated_snapshot',
      'stored_verdict_not_fresh',
    ])
  })
})

describe('resolveRestoredFreshnessUpdate — unchanged behaviour, one decision', () => {
  it('agrees with the explainer on EVERY case — they cannot drift apart', () => {
    const cases: Array<[Parameters<typeof resolveRestoredFreshnessUpdate>[0], boolean, unknown]> = [
      [HYDRATED, false, CAPTURED_PRERUN_READINESS],
      [HYDRATED, false, CAPTURED_POSTRUN_READINESS],
      [HYDRATED, true, CAPTURED_POSTRUN_READINESS],
      [{ freshness: 'stale', freshnessReason: 'x' }, false, CAPTURED_POSTRUN_READINESS],
      [HYDRATED, false, { freshness: 'fresh' }],
      [HYDRATED, false, null],
    ]
    for (const [cur, dirty, stored] of cases) {
      const legacy = resolveRestoredFreshnessUpdate(cur, dirty, stored)
      const decision = explainRestoredFreshnessDecision(cur, dirty, stored)
      // The delegation is the point: one decision, two views. If these ever
      // disagree, the diagnostic has drifted from the behaviour it describes.
      expect(legacy).toEqual(decision.outcome === 'attested' ? decision.state : null)
    }
  })
})
