import { describe, it, expect, vi } from 'vitest'
import { FAILURE_USER_TEXT } from '@talchain/schemas/boundary'
import type { BoundaryError, FailureTypeLiteral } from '@talchain/schemas/boundary'
import {
  isRetryable,
  checkRetryableAgreement,
  extractReason,
  resolveGuidance,
  resolveRetryable,
  resolveFailureBaseCopy,
} from '../failureTypeRetryability'

describe('isRetryable — exhaustive over FailureTypeLiteral', () => {
  it.each([
    ['UPSTREAM_TIMEOUT', true],
    ['UPSTREAM_UNAVAILABLE', true],
    ['LLM_UNAVAILABLE', true],
    ['INTERNAL_ERROR', true],
    ['INGRESS_CONTRACT_VIOLATION', false],
    ['EGRESS_CONTRACT_VIOLATION', false],
    ['FEATURE_NOT_ENABLED', false],
    ['TURN_BUDGET_EXCEEDED', false],
  ] as const)('%s → retryable=%s', (code, expected) => {
    expect(isRetryable(code)).toBe(expected)
  })
})

describe('checkRetryableAgreement — DEV warning on disagreement', () => {
  const baseErr: BoundaryError = {
    error: 'UPSTREAM_TIMEOUT',
    boundary: 'B4',
    direction: 'egress',
    validator: 'x',
    details: {},
    request_id: 'req_1',
    retryable: true,
  }

  it('no warning when server and client agree', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    checkRetryableAgreement(baseErr)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('warns when server disagrees with client (only in DEV)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Client says UPSTREAM_TIMEOUT is retryable; server says false.
    checkRetryableAgreement({ ...baseErr, retryable: false })
    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0][0]).toContain('retryable disagreement')
    } else {
      expect(spy).not.toHaveBeenCalled()
    }
    spy.mockRestore()
  })
})

describe('extractReason — surfaces details.reason when it is a non-empty string', () => {
  const baseErr: BoundaryError = {
    error: 'INTERNAL_ERROR',
    boundary: 'B3',
    direction: 'egress',
    validator: 'x',
    details: {},
    request_id: 'req_1',
    retryable: true,
  }

  it('returns empty string when err is undefined', () => {
    expect(extractReason(undefined)).toBe('')
  })

  it('returns empty string when details.reason is missing', () => {
    expect(extractReason(baseErr)).toBe('')
  })

  it('returns empty string when details.reason is not a string', () => {
    expect(extractReason({ ...baseErr, details: { reason: 42 } })).toBe('')
    expect(extractReason({ ...baseErr, details: { reason: null } })).toBe('')
    expect(extractReason({ ...baseErr, details: { reason: {} } })).toBe('')
  })

  it('returns empty string when details.reason is whitespace', () => {
    expect(extractReason({ ...baseErr, details: { reason: '   ' } })).toBe('')
  })

  it('returns trimmed reason when present', () => {
    expect(
      extractReason({ ...baseErr, details: { reason: '  plot run exceeded 120s ' } }),
    ).toBe('plot run exceeded 120s')
  })
})

describe('resolveGuidance — shared guidance resolver', () => {
  it.each([
    ['UPSTREAM_TIMEOUT'],
    ['UPSTREAM_UNAVAILABLE'],
    ['LLM_UNAVAILABLE'],
    ['INTERNAL_ERROR'],
  ] as const)('retryable code %s returns empty guidance (Try again chip covers UX)', (code) => {
    expect(resolveGuidance(code)).toBe('')
  })

  // ⚠ DELIBERATE PIN CHANGE (ROADMAP 2.472): INGRESS_CONTRACT_VIOLATION left
  // this table on purpose. Its old row pinned "always /rephrase/i" — the exact
  // untruth 2.472 removes (a server-side key failure told the user to rephrase,
  // witnessed live 4 Aug). Its guidance is now taxonomy-branched and pinned in
  // the dedicated describe block below; the rephrase copy survives ONLY as the
  // input-shaped / fail-safe branch.
  it.each([
    ['EGRESS_CONTRACT_VIOLATION', /validated/i],
    ['FEATURE_NOT_ENABLED', /not yet available/i],
    ['TURN_BUDGET_EXCEEDED', /turn limit/i],
  ] as const)('non-retryable code %s returns guidance matching %s', (code, pattern) => {
    const g = resolveGuidance(code)
    expect(g.length).toBeGreaterThan(0)
    expect(g).toMatch(pattern)
  })
})

// ---------------------------------------------------------------------------
// ROADMAP 2.472 — INGRESS_CONTRACT_VIOLATION guidance branches on the wire's
// own taxonomy (validator / details.reason) instead of blaming the user's
// wording for every violation.
//
// Witnessed defect (4 Aug outage, capture at
// PHASE0-EVIDENCE-2026-07-28/rewalk-2459b-raw/run2-rewalk-wire.json): CEE
// refused the turn with validator 'scenario_preflight',
// details.reason 'scenario_ownership_unverifiable', retryable:false — a
// server-side ownership-oracle failure — and the UI said "Please rephrase
// your message and try again."
//
// Class → copy contract (validator vocabulary derived at CEE staging tip
// ac62fd4d — see PR body):
//   server-state validators (scenario_preflight, turn_commit,
//   chip_click_dispatch, draft_graph_pipeline, edit_graph_pipeline) or a
//   details.reason in the producer's scenario_ownership* family → server-fault
//   copy · user_jwt → sign-in copy · input-shaped validators
//   (OrchestratorTurnPayload, V5RequestExtensions), unknown validators, and
//   absent taxonomy → the rephrase copy (fail-safe: never crash, never blank).
// ---------------------------------------------------------------------------
describe('resolveGuidance — INGRESS_CONTRACT_VIOLATION wire-taxonomy branching (2.472)', () => {
  const SERVER_FAULT_COPY =
    "Something on our side isn't working — your message was fine. Please try again in a moment."
  const REPHRASE_COPY = 'Please rephrase your message and try again.'
  // The auth class (user_jwt / sign_in_required) moved to its own describe
  // block below when the extension was ratified — its copy constant lives
  // there, not here.

  /** Byte-for-byte the BoundaryError CEE served during the witnessed outage
   *  (rewalk run2; run1 identical modulo ids). Identity-bound: this object is
   *  the witnessed wire shape, not a value-predicate stand-in. */
  const WITNESSED_OUTAGE_ERROR: BoundaryError = {
    error: 'INGRESS_CONTRACT_VIOLATION',
    boundary: 'B1',
    direction: 'ingress',
    validator: 'scenario_preflight',
    details: {
      reason: 'scenario_ownership_unverifiable',
      scenario_id: 'c261b74a-c7ce-4aad-96ca-04f0fdfd0fce',
    },
    request_id: 'd3daf877-2adb-4dde-babf-daa7d7a30d0b',
    retryable: false,
  }

  const ingressErr = (validator: string, reason?: string): BoundaryError => ({
    error: 'INGRESS_CONTRACT_VIOLATION',
    boundary: 'B1',
    direction: 'ingress',
    validator,
    details: reason === undefined ? {} : { reason },
    request_id: 'req_2472',
    retryable: false,
  })

  it('the witnessed outage wire shape gets the server-fault copy, verbatim', () => {
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', WITNESSED_OUTAGE_ERROR)).toBe(
      SERVER_FAULT_COPY,
    )
  })

  // ⚠ PIN CORRECTED (review F1): this list previously asserted ALL THREE
  // scenario_preflight reasons → server-fault copy. That was wrong for two of
  // them and the test agreed with the code because I wrote it from my own
  // classification instead of the producer's semantics (trap 13b — a guard
  // agreeing with itself). Only the oracle-down reason is a server fault; the
  // access-denied pair is routed in its own describe block below.
  it.each([
    ['scenario_preflight', 'scenario_ownership_unverifiable'],
    ['turn_commit', 'state_commit_failed_or_turn_runtime_failure'],
    ['turn_commit', 'graph_write_conflict'],
    ['chip_click_dispatch', 'chip_click_suggest_options_handler_failed'],
    ['draft_graph_pipeline', 'draft_graph_commit_failed'],
    ['edit_graph_pipeline', 'edit_graph_pipeline_threw'],
  ] as const)(
    'server-state validator %s (reason %s) → server-fault copy',
    (validator, reason) => {
      expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', ingressErr(validator, reason))).toBe(
        SERVER_FAULT_COPY,
      )
    },
  )

  it('a scenario_ownership* reason under an unrecognised validator still → server-fault copy', () => {
    expect(
      resolveGuidance(
        'INGRESS_CONTRACT_VIOLATION',
        ingressErr('some_future_validator', 'scenario_ownership_unverifiable'),
      ),
    ).toBe(SERVER_FAULT_COPY)
  })

  it('a genuine input-shaped violation keeps the rephrase copy (positive control)', () => {
    // OrchestratorTurnPayload is the B1 Zod validator over the turn body,
    // which DOES carry the user's `message` — rephrasing can genuinely help,
    // so this is the least-wrong copy and stays.
    expect(
      resolveGuidance(
        'INGRESS_CONTRACT_VIOLATION',
        ingressErr('OrchestratorTurnPayload', 'turn_id must be a UUID v4'),
      ),
    ).toBe(REPHRASE_COPY)
  })

  // ⚠ PIN CORRECTED (review F3): V5RequestExtensions used to be asserted here
  // as a rephrase positive control. It validates ONLY app-constructed state —
  // `graph_state`, `analysis_state`, `user_id`, `selected_elements`
  // (request-extensions.ts:8) — and carries NO user text at all, so telling
  // the user to rephrase their message is categorically false: the UI built
  // the bad request, not them.
  it('V5RequestExtensions → server-fault copy: those fields carry no user text', () => {
    expect(
      resolveGuidance('INGRESS_CONTRACT_VIOLATION', ingressErr('V5RequestExtensions')),
    ).toBe(SERVER_FAULT_COPY)
    expect(
      resolveGuidance(
        'INGRESS_CONTRACT_VIOLATION',
        ingressErr('V5RequestExtensions', 'graph_state.nodes must be an array'),
      ),
    ).not.toMatch(/rephrase/i)
  })

  it('absent taxonomy FAILS SAFE to the rephrase copy (no error object)', () => {
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION')).toBe(REPHRASE_COPY)
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', undefined)).toBe(REPHRASE_COPY)
  })

  it('unknown validator + unknown reason FAILS SAFE to the rephrase copy', () => {
    expect(
      resolveGuidance('INGRESS_CONTRACT_VIOLATION', ingressErr('brand_new_validator', 'novel_reason')),
    ).toBe(REPHRASE_COPY)
  })

  it('malformed taxonomy fields never crash and fail safe to rephrase', () => {
    const malformed = {
      ...ingressErr('x'),
      validator: 42,
      details: { reason: { nested: true } },
    } as unknown as BoundaryError
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', malformed)).toBe(REPHRASE_COPY)
    const nullDetails = { ...ingressErr('x'), details: null } as unknown as BoundaryError
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', nullDetails)).toBe(REPHRASE_COPY)
  })

  it('the error object changes nothing for retryable codes (early return holds)', () => {
    expect(
      resolveGuidance('INTERNAL_ERROR', ingressErr('scenario_preflight', 'anything')),
    ).toBe('')
  })

  it('other non-retryable codes ignore the taxonomy (INGRESS-only branch)', () => {
    expect(
      resolveGuidance('FEATURE_NOT_ENABLED', ingressErr('scenario_preflight')),
    ).toMatch(/not yet available/i)
  })
})

// ---------------------------------------------------------------------------
// ROADMAP 2.472 — F1 (review blocker): `scenario_preflight` carries a
// THREE-member reason union and they do NOT share a copy. Branching on the
// validator alone collapsed them into "our side is broken, try again in a
// moment", which for the two access-denied reasons is false in BOTH halves
// AND prescribes an action that can never work — a worse failure than the
// bug this lane set out to fix.
//
// Semantics read at the CEE bytes (`build-turn-context.ts:1183-1234`,
// `:1326`, `:1339`, staging tip ac62fd4d), which state the branches
// explicitly:
//   - caller ABSENT on an owned scenario → IDOR fail-closed →
//     `scenario_requires_authenticated_owner`  ⇒ SIGN IN
//   - caller is a DIFFERENT user → cross-tenant attempt →
//     `scenario_owned_by_other_user`           ⇒ NO ACCESS
//   - ownership oracle unavailable →
//     `scenario_ownership_unverifiable`        ⇒ OUR FAULT
// CEE's admission NAMES the reason precisely so the UI can distinguish them.
// ---------------------------------------------------------------------------
describe('resolveGuidance — scenario_preflight reason union routes three ways (2.472 F1)', () => {
  const SERVER_FAULT_COPY =
    "Something on our side isn't working — your message was fine. Please try again in a moment."
  const SIGN_IN_COPY =
    "You'll need to sign in to continue — nothing was wrong with your message. Please sign in, then send it again."
  const NO_ACCESS_COPY =
    "This decision belongs to someone else, so you can't make changes to it — nothing you typed was the problem. Ask its owner to share it with you if you need access."

  const preflightErr = (reason: string): BoundaryError => ({
    error: 'INGRESS_CONTRACT_VIOLATION',
    boundary: 'B1',
    direction: 'ingress',
    validator: 'scenario_preflight',
    details: { reason, scenario_id: 'a9224aba-5a15-47b7-8b67-e913fa8f2a14' },
    request_id: 'req_f1',
    retryable: false,
  })

  it('scenario_ownership_unverifiable (the WITNESSED shape) → server-fault copy', () => {
    expect(
      resolveGuidance('INGRESS_CONTRACT_VIOLATION', preflightErr('scenario_ownership_unverifiable')),
    ).toBe(SERVER_FAULT_COPY)
  })

  it('scenario_requires_authenticated_owner → SIGN-IN copy, never server-fault', () => {
    const g = resolveGuidance(
      'INGRESS_CONTRACT_VIOLATION',
      preflightErr('scenario_requires_authenticated_owner'),
    )
    expect(g).toBe(SIGN_IN_COPY)
    expect(g).not.toBe(SERVER_FAULT_COPY)
    expect(g).not.toMatch(/rephrase/i)
  })

  it('scenario_owned_by_other_user → NO-ACCESS copy, never server-fault, never sign-in', () => {
    const g = resolveGuidance(
      'INGRESS_CONTRACT_VIOLATION',
      preflightErr('scenario_owned_by_other_user'),
    )
    expect(g).toBe(NO_ACCESS_COPY)
    expect(g).not.toBe(SERVER_FAULT_COPY)
    expect(g).not.toBe(SIGN_IN_COPY)
    expect(g).not.toMatch(/rephrase/i)
  })

  it('the three reasons produce THREE DISTINCT strings (the collapse this fix removes)', () => {
    const copies = [
      'scenario_ownership_unverifiable',
      'scenario_requires_authenticated_owner',
      'scenario_owned_by_other_user',
    ].map((r) => resolveGuidance('INGRESS_CONTRACT_VIOLATION', preflightErr(r)))
    expect(new Set(copies).size).toBe(3)
  })

  it('neither access-denied copy prescribes a futile wait-and-retry', () => {
    for (const reason of ['scenario_requires_authenticated_owner', 'scenario_owned_by_other_user']) {
      const g = resolveGuidance('INGRESS_CONTRACT_VIOLATION', preflightErr(reason))
      expect(g).not.toMatch(/try again in a moment/i)
      expect(g).not.toMatch(/isn't working/i)
    }
  })

  it('the no-access copy blames nobody and names a real next step', () => {
    const g = resolveGuidance('INGRESS_CONTRACT_VIOLATION', preflightErr('scenario_owned_by_other_user'))
    expect(g).toMatch(/nothing you typed was the problem/i)
    expect(g).toMatch(/share it with you/i)
    expect(g).not.toMatch(/you (failed|forgot|should have)|your (mistake|error)/i)
  })

  it('an UNKNOWN future preflight reason falls back to server-fault, never to blame', () => {
    const g = resolveGuidance('INGRESS_CONTRACT_VIOLATION', preflightErr('scenario_some_future_reason'))
    expect(g).toBe(SERVER_FAULT_COPY)
    expect(g).not.toMatch(/rephrase/i)
  })
})

// ---------------------------------------------------------------------------
// ROADMAP 2.472 — auth class (RATIFIED scope extension, 5 Aug).
//
// SOURCE OF THE WIRE SHAPE: **CEE source bytes**, not a live capture —
// `olumi-assistants-service/src/orchestrator/user-identity.ts`
// `buildSignInRequiredError()` read at staging tip
// `ac62fd4d3a3a8657b4bcb58e64b0e91a1454f59f`. (Contrast the
// scenario_preflight class above, which has BOTH source bytes and two
// independent live captures. This class is byte-derived only; no capture in
// PHASE0-EVIDENCE contains a user_jwt refusal. Stated so the evidence grade
// is not overclaimed.)
//
// The producer's own comment declares the contract:
//   "The stable UI mapping key is `details.code === 'sign_in_required'`
//    (+ `details.recoverable: true`); `details.auth_reason` carries the
//    refusal cause … `retryable: false` — retrying the same request
//    unchanged cannot succeed; recovery is signing in."
// So the gate below keys on `details.code` FIRST (the producer's declared
// stable key), with `validator === 'user_jwt'` as a secondary signal.
//
// auth_reason is the closed union at user-identity.ts:64-68:
//   missing_token | invalid_token | expired_token | verification_unavailable
// The first three are genuinely "sign in". The FOURTH is not: if the
// verifier itself is unavailable, instructing the user to sign in prescribes
// an action that cannot work — the same defect class 2.472 exists to kill —
// so it routes to the server-fault copy.
// ---------------------------------------------------------------------------
describe('resolveGuidance — auth class: sign-in copy, and the verifier-down carve-out (2.472)', () => {
  const SERVER_FAULT_COPY =
    "Something on our side isn't working — your message was fine. Please try again in a moment."
  const SIGN_IN_COPY =
    "You'll need to sign in to continue — nothing was wrong with your message. Please sign in, then send it again."

  /** Byte-for-byte `buildSignInRequiredError(reason, requestId)` at ac62fd4d. */
  const signInRequiredError = (
    authReason: 'missing_token' | 'invalid_token' | 'expired_token' | 'verification_unavailable',
  ): BoundaryError => ({
    error: 'INGRESS_CONTRACT_VIOLATION',
    boundary: 'B1',
    direction: 'ingress',
    validator: 'user_jwt',
    details: {
      reason: 'sign_in_required',
      code: 'sign_in_required',
      recoverable: true,
      auth_reason: authReason,
    },
    request_id: 'req_signin_2472',
    retryable: false,
  })

  it.each(['missing_token', 'invalid_token', 'expired_token'] as const)(
    'auth_reason %s → sign-in copy, verbatim (never rephrase, never server-fault)',
    (authReason) => {
      const g = resolveGuidance('INGRESS_CONTRACT_VIOLATION', signInRequiredError(authReason))
      expect(g).toBe(SIGN_IN_COPY)
      expect(g).not.toMatch(/rephrase/i)
      expect(g).not.toBe(SERVER_FAULT_COPY)
    },
  )

  it('auth_reason verification_unavailable → server-fault copy: signing in cannot fix a downed verifier', () => {
    expect(
      resolveGuidance('INGRESS_CONTRACT_VIOLATION', signInRequiredError('verification_unavailable')),
    ).toBe(SERVER_FAULT_COPY)
  })

  it("keys on the producer's declared stable key: details.code alone routes it, even under an unrecognised validator", () => {
    const renamedValidator = {
      ...signInRequiredError('expired_token'),
      validator: 'user_jwt_v2_renamed',
    }
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', renamedValidator)).toBe(SIGN_IN_COPY)
  })

  it('validator user_jwt alone routes it when details.code is absent (secondary signal)', () => {
    const noCode: BoundaryError = {
      error: 'INGRESS_CONTRACT_VIOLATION',
      boundary: 'B1',
      direction: 'ingress',
      validator: 'user_jwt',
      details: { reason: 'sign_in_required' },
      request_id: 'req_no_code',
      retryable: false,
    }
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', noCode)).toBe(SIGN_IN_COPY)
  })

  it('an unknown future auth_reason still gets the sign-in copy (fail safe WITHIN the class)', () => {
    const future = {
      ...signInRequiredError('expired_token'),
      details: { reason: 'sign_in_required', code: 'sign_in_required', auth_reason: 'novel_cause' },
    } as unknown as BoundaryError
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', future)).toBe(SIGN_IN_COPY)
  })

  it('malformed auth fields never crash and stay in the sign-in class', () => {
    const malformed = {
      ...signInRequiredError('expired_token'),
      details: { code: 'sign_in_required', auth_reason: { nested: true } },
    } as unknown as BoundaryError
    expect(resolveGuidance('INGRESS_CONTRACT_VIOLATION', malformed)).toBe(SIGN_IN_COPY)
  })

  // Condition 4 of the ratification, asserted as a property of the string
  // rather than trusted to review: no blame, and an explicit next action.
  it('the sign-in copy blames nobody and names what to DO', () => {
    const g = resolveGuidance('INGRESS_CONTRACT_VIOLATION', signInRequiredError('expired_token'))
    // Says what to do.
    expect(g).toMatch(/sign in/i)
    expect(g).toMatch(/send it again|try again/i)
    // Explicitly exonerates the message.
    expect(g).toMatch(/nothing was wrong with your message/i)
    // Blames nobody: no "you failed/forgot/must", no rephrase instruction.
    expect(g).not.toMatch(/rephrase|you (failed|forgot|did|should have)|invalid|your (mistake|error)/i)
  })
})

// ---------------------------------------------------------------------------
// Codex F6 — server-authoritative retryability + retry-consistent base copy
// ---------------------------------------------------------------------------

describe('resolveRetryable — server marker authoritative, table covers absence', () => {
  it('server false beats a client-retryable code', () => {
    expect(resolveRetryable('INTERNAL_ERROR', false)).toBe(false)
    expect(resolveRetryable('UPSTREAM_TIMEOUT', false)).toBe(false)
  })

  it('server true beats a client-non-retryable code', () => {
    expect(resolveRetryable('INGRESS_CONTRACT_VIOLATION', true)).toBe(true)
    expect(resolveRetryable('TURN_BUDGET_EXCEEDED', true)).toBe(true)
  })

  it('absence falls back to the client table', () => {
    expect(resolveRetryable('INTERNAL_ERROR', undefined)).toBe(true)
    expect(resolveRetryable('FEATURE_NOT_ENABLED', undefined)).toBe(false)
  })
})

describe('resolveFailureBaseCopy — copy agrees with the retry decision', () => {
  it('returns the canonical text verbatim when retry is offered', () => {
    expect(resolveFailureBaseCopy('INTERNAL_ERROR', true)).toBe(
      'Something went wrong on our side. Please retry.',
    )
  })

  it('drops the retry-instruction sentence when the affordance is withheld', () => {
    expect(resolveFailureBaseCopy('INTERNAL_ERROR', false)).toBe(
      'Something went wrong on our side.',
    )
    expect(resolveFailureBaseCopy('INGRESS_CONTRACT_VIOLATION', false)).toBe(
      'We could not process that request.',
    )
    expect(resolveFailureBaseCopy('LLM_UNAVAILABLE', false)).toBe(
      'The model is temporarily unavailable.',
    )
    expect(resolveFailureBaseCopy('TURN_BUDGET_EXCEEDED', false)).toBe(
      'That took longer than we allow for a single turn.',
    )
  })

  it('copy without a retry instruction passes through unchanged (fail open)', () => {
    expect(resolveFailureBaseCopy('FEATURE_NOT_ENABLED', false)).toBe(
      'This feature is not enabled in your environment.',
    )
    expect(resolveFailureBaseCopy('UPSTREAM_UNAVAILABLE', false)).toBe(
      'An upstream service is temporarily unavailable.',
    )
  })
})

// ---------------------------------------------------------------------------
// DERIVED guard — the strip must hold for EVERY code in the vendored table,
// not for a hand-listed three. The strip used to be three exact-suffix
// literals mirroring sentence endings inside @talchain/schemas; a re-vendor
// that rephrased a code would silently no-op the strip (fail open) and no
// test would notice. This derives the expectation from the table itself.
// ---------------------------------------------------------------------------
describe('resolveFailureBaseCopy — DERIVED over the whole vendored table', () => {
  const CODES = Object.keys(FAILURE_USER_TEXT) as FailureTypeLiteral[]

  it('has a non-trivial table to iterate (positive control)', () => {
    // An empty/absent table would make every assertion below vacuous.
    expect(CODES.length).toBeGreaterThanOrEqual(8)
    expect(
      CODES.filter(c => /retry|try\s+again/i.test(FAILURE_USER_TEXT[c])).length,
    ).toBeGreaterThan(0)
  })

  it('leaves NO retry language in any code once the affordance is withheld', () => {
    const survivors = CODES.filter(code =>
      /retry|try\s+again/i.test(resolveFailureBaseCopy(code, false)),
    )
    expect(survivors).toEqual([])
  })

  it('never empties the copy, and never alters it when retry IS offered', () => {
    for (const code of CODES) {
      expect(resolveFailureBaseCopy(code, false).length).toBeGreaterThan(0)
      expect(resolveFailureBaseCopy(code, true)).toBe(FAILURE_USER_TEXT[code])
    }
  })
})

// The drift-simulation counterpart (a re-vendor that rephrases the retry
// instruction) lives in failureTypeRetryability.drift.spec.ts — it needs a
// module mock, and vi.mock is hoisted file-wide, which would corrupt the
// verbatim-copy expectations above.
