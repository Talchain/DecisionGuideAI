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

  it.each([
    ['INGRESS_CONTRACT_VIOLATION', /rephrase/i],
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
