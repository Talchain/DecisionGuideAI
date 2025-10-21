import { describe, it, expect } from 'vitest'
import { formatApiError } from '../plotErrors'

describe('PLoT Error Mapping', () => {
  it('formats BAD_INPUT with field', () => {
    expect(formatApiError({ code: 'BAD_INPUT', message: '', field: 'graph' }))
      .toBe('Looks like graph is invalid or missing.')
  })

  it('formats LIMIT_EXCEEDED with details', () => {
    expect(formatApiError({ code: 'LIMIT_EXCEEDED', message: '', field: 'nodes', max: 12 }))
      .toBe('This template exceeds the limit (nodes, max 12).')
  })

  it('formats RATE_LIMITED with retry_after', () => {
    expect(formatApiError({ code: 'RATE_LIMITED', message: '', retry_after: 30 }))
      .toBe('A bit busy. Try again in ~30s.')
  })

  it('formats UNAUTHORIZED', () => {
    expect(formatApiError({ code: 'UNAUTHORIZED', message: '' }))
      .toBe('Sign in again to continue.')
  })

  it('formats SERVER_ERROR', () => {
    expect(formatApiError({ code: 'SERVER_ERROR', message: '' }))
      .toBe('Something went wrong. Please try again.')
  })
})
