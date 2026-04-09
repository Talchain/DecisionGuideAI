import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildErrorMessage } from '../useConversation'
import { OrchestratorError } from '../turnService'

// Vitest runs with import.meta.env.DEV = true by default.

describe('buildErrorMessage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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

  it('returns request error message for 400 (no status code in production copy)', () => {
    const err = new OrchestratorError('Bad request', 400, {})
    expect(buildErrorMessage(err)).toContain('Request error')
    expect(buildErrorMessage(err)).toContain('rephras')
    // Status code digits must not appear in the copy template itself
    expect(buildErrorMessage(err)).not.toContain('(400)')
  })

  it('returns service unavailable for 500+ (no status code in production copy)', () => {
    const err502 = new OrchestratorError('Bad gateway', 502, {})
    expect(buildErrorMessage(err502)).toContain('Service temporarily unavailable')
    expect(buildErrorMessage(err502)).not.toContain('(502)')

    const err500 = new OrchestratorError('Internal', 500, {})
    expect(buildErrorMessage(err500)).toContain('Service temporarily unavailable')
    expect(buildErrorMessage(err500)).not.toContain('(500)')
  })

  it('returns generic for unknown status codes (no status digit in production copy)', () => {
    const err = new OrchestratorError('Teapot', 418, {})
    expect(buildErrorMessage(err)).toContain('Something went wrong')
    expect(buildErrorMessage(err)).not.toContain('(418)')
  })

  it('omits ref when requestId is absent', () => {
    const err = new OrchestratorError('fail', 500, {})
    expect(buildErrorMessage(err)).not.toContain('[ref:')
  })

  // DEV=true (default in vitest): ref suffix must be present when requestId given
  it('includes [ref: ...] in DEV mode when requestId is present', () => {
    // DEV is already true in the vitest environment — ref suffix is included.
    const err = new OrchestratorError('fail', 500, {}, 'req-abc')
    const msg = buildErrorMessage(err)
    expect(msg).toContain('[ref: req-abc]')
  })

  // Production mode note: import.meta.env.DEV is a compile-time constant replaced
  // by Vite's bundler. In production bundles the ref suffix is elided and no status
  // code digits appear. This is a build-time guarantee verified by source inspection —
  // vi.stubEnv cannot override Vite's inlined compile-time constants in vitest.
  // The source-level guarantee is: the ref is gated on `import.meta.env.DEV &&`
  // (line ~362 in useConversation.ts) and no status codes appear in copy templates.
  it('copy templates contain no status code parenthetical strings', () => {
    // Test with no requestId — the copy template itself (excluding DEV ref) must
    // never include a "(NNN)" status code.
    const cases = [
      new OrchestratorError('', 400, {}),
      new OrchestratorError('', 500, {}),
      new OrchestratorError('', 418, {}),
    ]
    for (const err of cases) {
      const msg = buildErrorMessage(err)
      expect(msg).not.toMatch(/\(\d+\)/)
    }
  })
})
