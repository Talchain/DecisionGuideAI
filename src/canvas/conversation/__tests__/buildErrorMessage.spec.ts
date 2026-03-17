import { describe, it, expect } from 'vitest'
import { buildErrorMessage } from '../useConversation'
import { OrchestratorError } from '../turnService'

describe('buildErrorMessage', () => {
  it('returns generic message for non-OrchestratorError', () => {
    expect(buildErrorMessage(new Error('boom'))).toBe(
      'Something went wrong. Try again or rephrase your message.',
    )
  })

  it('returns generic message for non-error values', () => {
    expect(buildErrorMessage('string error')).toBe(
      'Something went wrong. Try again or rephrase your message.',
    )
    expect(buildErrorMessage(null)).toBe(
      'Something went wrong. Try again or rephrase your message.',
    )
  })

  it('returns auth message for 401', () => {
    const err = new OrchestratorError('Unauthorized', 401, {})
    expect(buildErrorMessage(err)).toContain('Authentication error')
    expect(buildErrorMessage(err)).toContain('refresh')
  })

  it('returns rate-limit message for 429', () => {
    const err = new OrchestratorError('Too many', 429, {})
    expect(buildErrorMessage(err)).toContain('Too many requests')
    expect(buildErrorMessage(err)).toContain('wait')
  })

  it('returns request error message for 400', () => {
    const err = new OrchestratorError('Bad request', 400, {})
    expect(buildErrorMessage(err)).toContain('Request error (400)')
    expect(buildErrorMessage(err)).toContain('rephras')
  })

  it('returns service unavailable for 500+', () => {
    const err502 = new OrchestratorError('Bad gateway', 502, {})
    expect(buildErrorMessage(err502)).toContain('Service temporarily unavailable (502)')

    const err500 = new OrchestratorError('Internal', 500, {})
    expect(buildErrorMessage(err500)).toContain('Service temporarily unavailable (500)')
  })

  it('includes request ID ref when available', () => {
    const err = new OrchestratorError('fail', 500, {}, 'req-123')
    expect(buildErrorMessage(err)).toContain('[ref: req-123]')
  })

  it('omits ref when requestId is absent', () => {
    const err = new OrchestratorError('fail', 500, {})
    expect(buildErrorMessage(err)).not.toContain('[ref:')
  })

  it('returns generic with status for unknown status codes', () => {
    const err = new OrchestratorError('Teapot', 418, {})
    expect(buildErrorMessage(err)).toContain('Something went wrong (418)')
  })
})
