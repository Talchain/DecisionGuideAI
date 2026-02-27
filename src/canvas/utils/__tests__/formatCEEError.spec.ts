import { describe, it, expect } from 'vitest'
import { formatCEEError, isCEEUnavailable } from '../formatCEEError'
import { CEEError } from '../../../adapters/cee/client'

describe('formatCEEError', () => {
  // ------- CEE_VALIDATION_FAILED -------
  describe('CEE_VALIDATION_FAILED', () => {
    it('returns isValidationFailed for CEE_VALIDATION_FAILED code', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
        fieldErrors: [{ field: 'brief', code: 'too_small', message: 'Too short' }],
      })
      const result = formatCEEError(error)
      expect(result.isValidationFailed).toBe(true)
    })

    it('returns friendly title for brief too_small', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
        fieldErrors: [{ field: 'brief', code: 'too_small', message: 'Too short' }],
      })
      const result = formatCEEError(error)
      expect(result.title).toBe('Your brief needs a bit more detail')
      expect(result.message).toContain('Add more context')
    })

    it('returns generic friendly message for non-brief field errors', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
        fieldErrors: [{ field: 'model', code: 'invalid', message: 'Invalid model' }],
      })
      const result = formatCEEError(error)
      expect(result.isValidationFailed).toBe(true)
      expect(result.title).toContain('didn\u2019t look right')
    })

    it('returns generic message when no fieldErrors present', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
      })
      const result = formatCEEError(error)
      expect(result.isValidationFailed).toBe(true)
      expect(result.title).toContain('didn\u2019t look right')
    })

    it('handles field_errors (snake_case variant)', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
        field_errors: [{ field: 'brief', code: 'too_small', message: 'Too short' }],
      })
      const result = formatCEEError(error)
      expect(result.isValidationFailed).toBe(true)
      expect(result.title).toBe('Your brief needs a bit more detail')
    })

    it('handles nested details.fieldErrors', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
        details: {
          fieldErrors: [{ field: 'brief', code: 'too_small', message: 'Too short' }],
        },
      })
      const result = formatCEEError(error)
      expect(result.isValidationFailed).toBe(true)
      expect(result.title).toBe('Your brief needs a bit more detail')
    })

    it('includes guidance text', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
        fieldErrors: [{ field: 'brief', code: 'too_small', message: 'Too short' }],
      })
      const result = formatCEEError(error)
      expect(result.guidance).toBeTruthy()
    })

    it('includes debugInfo', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
      }, 'corr-123')
      const result = formatCEEError(error)
      expect(result.debugInfo).toContain('corr-123')
    })

    it('does not include raw error codes in user-facing message', () => {
      const error = new CEEError('Validation failed', 400, {
        code: 'CEE_VALIDATION_FAILED',
        fieldErrors: [{ field: 'brief', code: 'too_small', message: 'Too short' }],
      })
      const result = formatCEEError(error)
      expect(result.title).not.toContain('CEE_VALIDATION_FAILED')
      expect(result.title).not.toContain('too_small')
      expect(result.message).not.toContain('CEE_VALIDATION_FAILED')
      expect(result.message).not.toContain('fieldErrors')
    })
  })

  // ------- Existing branches still work -------
  describe('existing error branches', () => {
    it('detects unavailable (404)', () => {
      const error = new CEEError('Not found', 404)
      const result = formatCEEError(error)
      expect(result.isUnavailable).toBe(true)
    })

    it('detects unavailable (503)', () => {
      const error = new CEEError('Service unavailable', 503)
      const result = formatCEEError(error)
      expect(result.isUnavailable).toBe(true)
    })

    it('detects timeout (408)', () => {
      const error = new CEEError('Request timeout', 408)
      const result = formatCEEError(error)
      expect(result.isTimeout).toBe(true)
    })

    it('detects timeout (504)', () => {
      const error = new CEEError('Gateway timeout', 504)
      const result = formatCEEError(error)
      expect(result.isTimeout).toBe(true)
    })

    it('detects graph invalid', () => {
      const error = new CEEError('Graph invalid', 400, {
        code: 'CEE_GRAPH_INVALID',
        reason: 'structural_failure',
      })
      const result = formatCEEError(error)
      expect(result.isGraphInvalid).toBe(true)
    })

    it('detects empty draft', () => {
      const error = new CEEError('Empty', 400, {
        reason: 'empty_draft',
      })
      const result = formatCEEError(error)
      expect(result.title).toBe('Empty draft')
    })

    it('detects empty graph', () => {
      const error = new CEEError('Empty', 400, {
        reason: 'empty_graph',
      })
      const result = formatCEEError(error)
      expect(result.title).toBe('Empty draft')
    })

    it('handles generic CEEError', () => {
      const error = new CEEError('Something broke', 500)
      const result = formatCEEError(error)
      expect(result.message).toBe('Something broke')
      expect(result.debugInfo).toBeTruthy()
    })

    it('handles non-CEEError network failure', () => {
      const error = new Error('Failed to fetch')
      const result = formatCEEError(error)
      expect(result.isUnavailable).toBe(true)
    })

    it('handles plain Error', () => {
      const error = new Error('Unknown error')
      const result = formatCEEError(error)
      expect(result.message).toBe('Unknown error')
    })
  })
})

describe('isCEEUnavailable', () => {
  it('returns true for CEEError with status 404', () => {
    expect(isCEEUnavailable(new CEEError('Not found', 404))).toBe(true)
  })

  it('returns true for CEEError with status 503', () => {
    expect(isCEEUnavailable(new CEEError('Unavailable', 503))).toBe(true)
  })

  it('returns false for CEEError with status 400', () => {
    expect(isCEEUnavailable(new CEEError('Bad request', 400))).toBe(false)
  })

  it('returns true for network failure Error', () => {
    expect(isCEEUnavailable(new Error('Failed to fetch'))).toBe(true)
  })

  it('returns false for generic Error', () => {
    expect(isCEEUnavailable(new Error('Something else'))).toBe(false)
  })
})
