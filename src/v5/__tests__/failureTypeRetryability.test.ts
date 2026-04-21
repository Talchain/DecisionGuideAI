import { describe, it, expect, vi } from 'vitest'
import type { BoundaryError } from '@talchain/schemas/boundary'
import {
  isRetryable,
  checkRetryableAgreement,
  extractReason,
  resolveGuidance,
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
