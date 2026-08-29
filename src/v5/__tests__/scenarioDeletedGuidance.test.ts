import { describe, it, expect } from 'vitest'
import type { BoundaryError } from '@talchain/schemas/boundary'
import { resolveGuidance } from '../failureTypeRetryability'

/**
 * `scenario_deleted` — the FOURTH `scenario_preflight` reason.
 *
 * CEE refuses a turn that would resurrect a deleted scenario and names the
 * reason precisely so the UI can tell it apart. Derived at the CEE bytes
 * (`src/orchestrator/route-v2-preflight.ts:393-486`, staging tip e7b9bc45):
 * the envelope keeps the existing code/boundary/validator and varies only
 * `details.reason`, carrying `details.recovery.{suggestion,hints}` plus the
 * flat `details.recovery_suggestion` mirror.
 *
 * Until this row existed the reason fell through to the server-fault line,
 * "Something on our side isn't working — your message was fine. Please try
 * again in a moment." BOTH halves are false here: the refusal is CORRECT, so
 * nothing on our side is broken, and the wait it prescribes can never succeed
 * because the scenario is gone. That false sentence rendering IS the harm
 * these tests assert against — not the absence of a map key.
 *
 * Every assertion below is keyed on the `scenario_deleted` envelope by
 * IDENTITY, so removing a DIFFERENT reason's row cannot turn this spec red.
 */
describe('resolveGuidance — scenario_deleted refusal reads truthfully', () => {
  const SERVER_FAULT_COPY =
    "Something on our side isn't working — your message was fine. Please try again in a moment."

  const DELETED_COPY =
    "This decision has been deleted, so nothing more can be saved to it — nothing you typed was the problem. Start a new decision, or open a different one from your list."

  /** The envelope as CEE emits it, recovery block included (the live wire). */
  const deletedErr = (): BoundaryError => ({
    error: 'INGRESS_CONTRACT_VIOLATION',
    boundary: 'B1',
    direction: 'ingress',
    validator: 'scenario_preflight',
    details: {
      reason: 'scenario_deleted',
      scenario_id: 'a9224aba-5a15-47b7-8b67-e913fa8f2a14',
      recovery: {
        suggestion:
          'This decision has been deleted, so nothing further can be saved to it. ' +
          'If you did not delete it yourself, it was deleted in another tab or window.',
        hints: [
          'Trying again will not restore it.',
          'Start a new decision, or open a different one from your list.',
        ],
      },
      recovery_suggestion:
        'This decision has been deleted, so nothing further can be saved to it. ' +
        'If you did not delete it yourself, it was deleted in another tab or window.',
    },
    request_id: 'req_scenario_deleted',
    retryable: false,
  })

  /**
   * The same refusal with the recovery block absent — the shape a consumer
   * sees if CEE is mid-deploy or the block is stripped. The guidance line is
   * then the ONLY copy the user gets, so it must stand alone and be true.
   */
  const deletedErrBare = (): BoundaryError => ({
    error: 'INGRESS_CONTRACT_VIOLATION',
    boundary: 'B1',
    direction: 'ingress',
    validator: 'scenario_preflight',
    details: {
      reason: 'scenario_deleted',
      scenario_id: 'a9224aba-5a15-47b7-8b67-e913fa8f2a14',
    },
    request_id: 'req_scenario_deleted_bare',
    retryable: false,
  })

  it('THE HARM: does not render the false server-fault copy', () => {
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', deletedErr())).not.toBe(SERVER_FAULT_COPY)
  })

  it('THE HARM, recovery-stripped envelope: still not the server-fault copy', () => {
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', deletedErrBare())).not.toBe(
      SERVER_FAULT_COPY,
    )
  })

  it('does not blame our side — the refusal is correct', () => {
    const g = resolveGuidance('INGRESS_CONTRACT_VIOLATION', deletedErr())
    expect(g).not.toMatch(/our side/i)
    expect(g).not.toMatch(/isn't working/i)
  })

  it('prescribes no retry and no wait — neither can ever succeed', () => {
    for (const err of [deletedErr(), deletedErrBare()]) {
      const g = resolveGuidance('INGRESS_CONTRACT_VIOLATION', err)
      expect(g).not.toMatch(/try again/i)
      expect(g).not.toMatch(/in a moment/i)
      expect(g).not.toMatch(/retry/i)
    }
  })

  it('does not tell the user to rephrase — the message was never the problem', () => {
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', deletedErr())).not.toMatch(/rephrase/i)
  })

  it('names what happened and an action that can actually work', () => {
    const g = resolveGuidance('INGRESS_CONTRACT_VIOLATION', deletedErr())
    expect(g).toMatch(/deleted/i)
    expect(g).toMatch(/start a new decision/i)
  })

  it('is the exact copy, bound by identity (both envelope shapes agree)', () => {
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', deletedErr())).toBe(DELETED_COPY)
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', deletedErrBare())).toBe(DELETED_COPY)
  })
})
