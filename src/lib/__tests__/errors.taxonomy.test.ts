import { describe, it, expect } from 'vitest'
import { mapErrorTypeToAdvice } from '../errors'

// Guardrail: messages are British English phrases and never echo payloads.
describe('Error taxonomy (British English, no payload echo)', () => {
  it('maps known codes to catalogue phrases', () => {
    expect(mapErrorTypeToAdvice('TIMEOUT')).toEqual({ message: 'The request took too long to respond.', primaryAction: 'Try again' })
    expect(mapErrorTypeToAdvice('RETRYABLE')).toEqual({ message: 'A temporary issue occurred.', primaryAction: 'Try again' })
    expect(mapErrorTypeToAdvice('INTERNAL')).toEqual({ message: 'Something went wrong on our side.', primaryAction: 'Try again' })
    expect(mapErrorTypeToAdvice('BAD_INPUT')).toEqual({ message: 'Please check your input and try again.', primaryAction: 'Check input' })
    expect(mapErrorTypeToAdvice('RATE_LIMIT')).toEqual({ message: 'You have reached the limit. Please wait and retry.', primaryAction: 'Wait and retry' })
    expect(mapErrorTypeToAdvice('BREAKER_OPEN')).toEqual({ message: 'The service is temporarily unavailable. Please wait and retry.', primaryAction: 'Wait and retry' })
  })

  it('defaults to a safe, generic phrase and does not echo arbitrary codes', () => {
    const advice = mapErrorTypeToAdvice('PAYLOAD_TOO_LARGE: user secret=12345' as any)
    expect(advice.message).toBe('We could not complete your request.')
    // Ensure no literal payload fragments leak
    expect(advice.message.includes('secret')).toBe(false)
  })
})
