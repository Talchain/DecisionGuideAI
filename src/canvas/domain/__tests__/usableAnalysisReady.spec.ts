/**
 * A REFUSAL IS NOT A READINESS ASSESSMENT.
 *
 * `analysis_ready.status === 'blocked'` is CEE refusing. It is not a verdict a
 * consumer asking "what is ready?" may act on. Two carriers exist and only the
 * second is the reason this selector has to exist:
 *
 *   ARM A  empty carrier (`options: []`) — already rejected upstream.
 *   ARM B  IDENTITY-PRESERVING carrier — non-empty `options` and `goal_node_id`,
 *          deliberately preserved by CEE so a refusal can still name the model
 *          it refused about. This one is ACCEPTED and stored.
 *
 * ARM B is why a truthiness or `options.length` check is not enough: on a
 * refusal those are populated, so every consumer keyed on "are there options?"
 * silently reads a refusal as readiness.
 *
 * ⚠ THE STORED FIELD IS DELIBERATELY NOT NARROWED. `ceeAnalysisReady` really
 * does hold `status: 'blocked'` at runtime, so typing it as un-blockable would
 * be a false claim enforced by the compiler on every reader EXCEPT the writer
 * that produces the value. The narrowing lives here, in a derived read, which
 * has no storage and therefore cannot drift from the field.
 */
import { describe, it, expect } from 'vitest'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'
import {
  ANALYSIS_READY_STATUSES,
  ANALYSIS_READY_STATUS_UNSUPPLIED,
} from '../../../adapters/cee/types'
import { selectUsableAnalysisReady, isUsableAnalysisReady, isBlockedCarrier } from '../usableAnalysisReady'

const IDENTITY_BEARING_REFUSAL = {
  status: 'blocked',
  blocked_reason: 'MISSING_OPTION_VALUE',
  goal_node_id: 'goal-1',
  options: [{ id: 'opt-a', label: 'Option A', interventions: {} }],
} as unknown as CEEAnalysisReady

const READY = {
  status: 'ready',
  goal_node_id: 'goal-1',
  options: [{ id: 'opt-a', label: 'Option A', interventions: {} }],
} as unknown as CEEAnalysisReady

describe('selectUsableAnalysisReady', () => {
  it('PRECONDITION: the refusal fixture is ARM B — populated exactly where a naive guard looks', () => {
    // Pins the fixture's own discriminating power (trap 13b). If this stops
    // holding, the test below would pass for the wrong reason.
    expect(IDENTITY_BEARING_REFUSAL.status).toBe('blocked')
    expect(IDENTITY_BEARING_REFUSAL.options.length).toBeGreaterThan(0)
    expect(IDENTITY_BEARING_REFUSAL.goal_node_id).not.toBe('')
  })

  it('withholds an identity-bearing refusal', () => {
    expect(selectUsableAnalysisReady(IDENTITY_BEARING_REFUSAL)).toBeNull()
  })

  it('passes a ready payload through UNCHANGED — same object identity, nothing rebuilt', () => {
    expect(selectUsableAnalysisReady(READY)).toBe(READY)
  })

  it('withholds null and undefined without inventing a payload', () => {
    expect(selectUsableAnalysisReady(null)).toBeNull()
    expect(selectUsableAnalysisReady(undefined)).toBeNull()
  })

  it('an ABSENT status is not a refusal — defensive only; the store cannot hold this', () => {
    // ⚠ SCOPE, STATED: this shape does NOT occur at runtime. `applyV5State`
    // substitutes the unsupplied sentinel for an absent status, so this asserts
    // defensive behaviour for a payload that never reaches the store — it is
    // NOT evidence about the producer's domain. The test that is about the
    // producer is the sentinel case above.
    const noStatus = { goal_node_id: 'g', options: [] } as unknown as CEEAnalysisReady
    expect(selectUsableAnalysisReady(noStatus)).toBe(noStatus)
  })

  it('EXHAUSTIVE PARTITION — derived from ANALYSIS_READY_STATUSES, not hand-listed', () => {
    // ⚠ THE HAND-WRITTEN LIST THIS REPLACES PASSED 11/11 AGAINST A SYNTHETIC
    // SIXTH STATUS. A corpus enumerated by hand cannot observe a member the
    // producer adds; deriving from the producer's own tuple means a new status
    // arrives in this test automatically and must be classified deliberately.
    expect(ANALYSIS_READY_STATUSES.length).toBeGreaterThan(1)
    let withheld = 0
    for (const status of ANALYSIS_READY_STATUSES) {
      const p = { ...READY, status } as unknown as CEEAnalysisReady
      const out = selectUsableAnalysisReady(p)
      if (status === 'blocked') {
        expect(out, `status=${status} must be withheld`).toBeNull()
        withheld += 1
      } else {
        expect(out, `status=${status} must survive`).toBe(p)
      }
    }
    // Exactly one member of the producer's vocabulary is a refusal. If a future
    // status is also a refusal this REDs, which is the point.
    expect(withheld).toBe(1)
  })

  it('THE UNSUPPLIED SENTINEL SURVIVES — and it is the shape that actually occurs', () => {
    // ⚠ `applyV5State.ts:262` writes `typeof obj.status === 'string' ? obj.status
    // : 'unknown'`, so the store NEVER holds an absent status — an absent one
    // becomes this sentinel. An earlier version of this spec pinned the ABSENT
    // shape (which the producer cannot emit) and never tested this one: a mutant
    // collapsing the sentinel into refusal passed 11/11 GREEN.
    const p = { ...READY, status: ANALYSIS_READY_STATUS_UNSUPPLIED } as unknown as CEEAnalysisReady
    expect(selectUsableAnalysisReady(p)).toBe(p)
    expect(isUsableAnalysisReady(p)).toBe(true)
  })

  it('BOTH BLOCKED CARRIERS are withheld — exhaustive over PRODUCERS, not just over the status union', () => {
    // ⚠ EXHAUSTIVENESS OVER THE STATUS UNION IS NOT EXHAUSTIVENESS OVER THE
    // CARRIERS THAT PRODUCE A STATUS. Two producers emit `status: 'blocked'`
    // (derived at the CEE bytes, recorded at analysisRefusalNotice.ts:39-55):
    //   REFUSAL — non-empty `blocked_reason`; CEE refused.
    //   LEGACY  — NO `blocked_reason`; a freshness carrier from a legacy reload,
    //             which says nothing about a refusal.
    // For THIS question both are withheld: neither is a verdict to act on. A
    // corpus that sent only the refusal carrier would certify a predicate that
    // mishandles the other.
    const refusal = { status: 'blocked', blocked_reason: 'MISSING_OPTION_VALUE',
                      goal_node_id: 'goal-1', options: [{ id: 'o', label: 'O', interventions: {} }] } as unknown as CEEAnalysisReady
    const legacy = { status: 'blocked', goal_node_id: '', options: [], bias_findings: [] } as unknown as CEEAnalysisReady

    // Pin that the two fixtures genuinely differ on the canonical discriminator,
    // or this test would be sending one carrier twice.
    expect('blocked_reason' in (refusal as object)).toBe(true)
    expect('blocked_reason' in (legacy as object)).toBe(false)

    expect(selectUsableAnalysisReady(refusal)).toBeNull()
    expect(selectUsableAnalysisReady(legacy)).toBeNull()
    expect(isBlockedCarrier(refusal)).toBe(true)
    expect(isBlockedCarrier(legacy)).toBe(true)
  })

  it('isUsableAnalysisReady discriminates on status alone, not on shape', () => {
    // Same shape, different status — so a shape-keyed guard could not tell these
    // apart, and this asserts the discriminator is the status.
    const emptyButReady = { status: 'ready', goal_node_id: '', options: [] } as unknown as CEEAnalysisReady
    const fullButBlocked = IDENTITY_BEARING_REFUSAL
    expect(isUsableAnalysisReady(emptyButReady)).toBe(true)
    expect(isUsableAnalysisReady(fullButBlocked)).toBe(false)
  })
})
