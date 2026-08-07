import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildErrorMessage } from '../useConversation'
import { buildFailureRender } from '../ceeRecovery'
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

/**
 * Non-retry-directive copy variants (A1 brief item 2 follow-up).
 *
 * When the CEE envelope marks a failure `retryable: false` the retry chip is
 * hidden. The copy must then not instruct the user to retry — there is no
 * control to do it with. `canRetry: false` selects the counterpart copy for
 * every retry-directive base.
 *
 * Complete manifest of buildErrorMessage's six return sites:
 *
 *   | case          | canRetry: true (unchanged)                        | canRetry: false                                              |
 *   |---------------|---------------------------------------------------|--------------------------------------------------------------|
 *   | non-Orch      | Something went wrong. Try again or rephrase …     | Something went wrong. Rephrasing your message may help.      |
 *   | 401           | Authentication error. Please refresh and try again| Authentication error. Please refresh the page to continue.   |
 *   | 429           | Too many requests. … wait a moment and try again. | Too many requests. … wait a moment before sending another …  |
 *   | 400           | Request error. Try rephrasing your message.       | (same — no retry directive to remove)                        |
 *   | >= 500        | Service temporarily unavailable. … try again …    | Service temporarily unavailable. … wait a moment before …    |
 *   | default       | Something went wrong. Try again or rephrase …     | Something went wrong. Rephrasing your message may help.      |
 */
describe('buildErrorMessage — non-retry-directive variants (canRetry: false)', () => {
  const NO_RETRY = { canRetry: false } as const

  it('no return site directs a retry when canRetry is false (whole manifest)', () => {
    const cases: unknown[] = [
      new Error('boom'), // non-OrchestratorError
      'string error',
      null,
      new OrchestratorError('Unauthorized', 401, {}),
      new OrchestratorError('Too many', 429, {}),
      new OrchestratorError('Bad request', 400, {}),
      new OrchestratorError('Internal', 500, {}),
      new OrchestratorError('Bad gateway', 502, {}),
      new OrchestratorError('Teapot', 418, {}), // default branch
      new OrchestratorError('No status', undefined as unknown as number, {}),
    ]
    for (const err of cases) {
      expect(buildErrorMessage(err, NO_RETRY)).not.toMatch(/try again/i)
    }
  })

  it('non-OrchestratorError values name an action the user can still take', () => {
    for (const err of [new Error('boom'), 'string error', null]) {
      expect(buildErrorMessage(err, NO_RETRY)).toBe(
        'Something went wrong. Rephrasing your message may help.',
      )
    }
  })

  it('401 asks for a refresh rather than a retry', () => {
    const msg = buildErrorMessage(new OrchestratorError('Unauthorized', 401, {}), NO_RETRY)
    expect(msg).toBe('Authentication error. Please refresh the page to continue.')
  })

  it('429 asks the user to wait rather than to retry', () => {
    const msg = buildErrorMessage(new OrchestratorError('Too many', 429, {}), NO_RETRY)
    expect(msg).toBe('Too many requests. Please wait a moment before sending another message.')
  })

  it('400 copy is unchanged (rephrasing needs no retry control)', () => {
    const err = new OrchestratorError('Bad request', 400, {})
    expect(buildErrorMessage(err, NO_RETRY)).toBe(buildErrorMessage(err))
    expect(buildErrorMessage(err, NO_RETRY)).toBe('Request error. Try rephrasing your message.')
  })

  it('5xx states the outage and names waiting rather than retrying', () => {
    for (const status of [500, 502, 503]) {
      expect(buildErrorMessage(new OrchestratorError('x', status, {}), NO_RETRY)).toBe(
        'Service temporarily unavailable. Please wait a moment before continuing.',
      )
    }
  })

  it('default branch (unknown status) drops the retry directive', () => {
    expect(buildErrorMessage(new OrchestratorError('Teapot', 418, {}), NO_RETRY)).toBe(
      'Something went wrong. Rephrasing your message may help.',
    )
  })

  it('keeps the DEV ref suffix and never leaks a raw status code', () => {
    const err = new OrchestratorError('fail', 500, {}, 'req-abc')
    const msg = buildErrorMessage(err, NO_RETRY)
    expect(msg).toContain('[ref: req-abc]')
    expect(msg).not.toMatch(/\(\d+\)/)
  })

  it('house style: sentence case, no em dashes, no upper-snake codes', () => {
    const cases: unknown[] = [
      new Error('boom'),
      new OrchestratorError('', 401, {}),
      new OrchestratorError('', 429, {}),
      new OrchestratorError('', 400, {}),
      new OrchestratorError('', 500, {}),
      new OrchestratorError('', 418, {}),
    ]
    for (const err of cases) {
      for (const msg of [buildErrorMessage(err), buildErrorMessage(err, NO_RETRY)]) {
        expect(msg).not.toContain('—')
        expect(msg).not.toMatch(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/)
      }
    }
  })

  it('fail open: omitting opts, or canRetry:true, returns today\'s copy exactly', () => {
    const cases: unknown[] = [
      new Error('boom'),
      new OrchestratorError('', 401, {}),
      new OrchestratorError('', 429, {}),
      new OrchestratorError('', 400, {}),
      new OrchestratorError('', 500, {}),
      new OrchestratorError('', 418, {}),
    ]
    for (const err of cases) {
      expect(buildErrorMessage(err, { canRetry: true })).toBe(buildErrorMessage(err))
      expect(buildErrorMessage(err, {})).toBe(buildErrorMessage(err))
    }
    expect(buildErrorMessage(new OrchestratorError('', 500, {}))).toBe(
      'Service temporarily unavailable. Please try again shortly.',
    )
  })
})

/**
 * End-to-end pins for the exact contradiction the adversarial review found:
 * the chip is correctly hidden but the message still tells the user to retry.
 */
describe('buildFailureRender + buildErrorMessage — hidden chip implies no retry directive', () => {
  const render = (err: unknown) =>
    buildFailureRender((canRetry) => buildErrorMessage(err, { canRetry }), err)

  it('5xx marked non-retryable: chip hidden AND copy does not say try again', () => {
    const err = new OrchestratorError('Bad gateway', 502, {
      error: 'CEE_LLM_VALIDATION_FAILED',
      retryable: false,
      recovery_suggestion: 'Add one clear goal and two options.',
    })
    const out = render(err)
    expect(out.showRetry).toBe(false)
    expect(out.content).not.toMatch(/try again/i)
    expect(out.content).toContain('Service temporarily unavailable.')
    expect(out.content).toContain('Add one clear goal and two options.')
  })

  it('generic status marked non-retryable: chip hidden AND copy does not say try again', () => {
    const err = new OrchestratorError('Teapot', 418, { retryable: false })
    const out = render(err)
    expect(out.showRetry).toBe(false)
    expect(out.content).not.toMatch(/try again/i)
    expect(out.content).toBe('Something went wrong. Rephrasing your message may help.')
  })

  it('every status marked non-retryable yields retry-directive-free copy', () => {
    for (const status of [401, 429, 400, 500, 503, 418]) {
      const err = new OrchestratorError('x', status, { retryable: false })
      const out = render(err)
      expect(out.showRetry).toBe(false)
      expect(out.content).not.toMatch(/try again/i)
    }
  })

  it('fail open unchanged: no marker → chip shown and copy byte-identical to today', () => {
    for (const status of [401, 429, 400, 500, 418]) {
      const err = new OrchestratorError('x', status, {})
      const out = render(err)
      expect(out.showRetry).toBe(true)
      expect(out.content).toBe(buildErrorMessage(err))
    }
  })

  it('retryable:true keeps the retry chip and the retry-directive copy', () => {
    const err = new OrchestratorError('Timeout', 504, { retryable: true })
    const out = render(err)
    expect(out.showRetry).toBe(true)
    expect(out.content).toBe('Service temporarily unavailable. Please try again shortly.')
  })
})
