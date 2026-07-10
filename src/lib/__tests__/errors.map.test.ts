import { describe, it, expect } from 'vitest'
import { mapErrorTypeToAdvice } from '../../lib/errors'

describe('Error taxonomy mapping (British English)', () => {
  it('maps each known type to message + primary action', () => {
    expect(mapErrorTypeToAdvice('TIMEOUT')).toEqual({ message: 'The request took too long to respond.', primaryAction: 'Try again' })
    expect(mapErrorTypeToAdvice('RETRYABLE')).toEqual({ message: 'A temporary issue occurred.', primaryAction: 'Try again' })
    expect(mapErrorTypeToAdvice('INTERNAL')).toEqual({ message: 'Something went wrong on our side.', primaryAction: 'Try again' })
    expect(mapErrorTypeToAdvice('BAD_INPUT')).toEqual({ message: 'Please check your input and try again.', primaryAction: 'Check input' })
    expect(mapErrorTypeToAdvice('RATE_LIMIT')).toEqual({ message: 'You have reached the limit. Please wait and retry.', primaryAction: 'Wait and retry' })
    expect(mapErrorTypeToAdvice('BREAKER_OPEN')).toEqual({ message: 'The service is temporarily unavailable. Please wait and retry.', primaryAction: 'Wait and retry' })
  })

  it('falls back to a neutral message for unsupported types', () => {
    expect(mapErrorTypeToAdvice('UNKNOWN').message).toContain('could not complete')
  })

  it('mapping uses British English phrasing for retryables', () => {
    const m = mapErrorTypeToAdvice('RETRYABLE')
    expect(m.message).toContain('temporary issue')
    expect(m.primaryAction).toBe('Try again')
  })

  it('RATE_LIMIT recommends wait and retry', () => {
    const m = mapErrorTypeToAdvice('RATE_LIMIT')
    expect(m.primaryAction).toBe('Wait and retry')
  })
})

// ROADMAP 1.54 density wall — the 422 blocker's user copy comes from THIS
// entry, never the producer message (which names engine budget maths).
describe('GRAPH_TOO_COMPLEX (density wall, 1.54)', () => {
  it('maps to honest simplify-your-model copy and never echoes the raw message', () => {
    const err = getUserFriendlyError({
      code: 'GRAPH_TOO_COMPLEX',
      message: '24 causal nodes × 40 causal edges = 960, above the maximum of 600…',
      canRetry: false,
    })
    expect(err.headline).toBe('Model too complex to analyse')
    expect(err.explanation).toMatch(/remove|reduce|simplif/i)
    expect(err.explanation).not.toMatch(/causal nodes|maximum of|×/)
    expect(err.canRetry).toBe(false)
  })
})
