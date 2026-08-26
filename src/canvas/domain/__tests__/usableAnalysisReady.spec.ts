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
import { selectUsableAnalysisReady, isUsableAnalysisReady } from '../usableAnalysisReady'

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

  it('an ABSENT status is not a refusal — silence is not a verdict', () => {
    const noStatus = { goal_node_id: 'g', options: [] } as unknown as CEEAnalysisReady
    expect(selectUsableAnalysisReady(noStatus)).toBe(noStatus)
  })

  it('every non-blocked producer status survives — the selector withholds ONE value, not a mood', () => {
    for (const status of ['ready', 'needs_encoding', 'needs_user_mapping', 'needs_user_input']) {
      const p = { ...READY, status } as unknown as CEEAnalysisReady
      expect(selectUsableAnalysisReady(p), `status=${status}`).toBe(p)
    }
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
