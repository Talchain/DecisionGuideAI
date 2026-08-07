/**
 * CEE failure-recovery reader — unit specs (RED-first).
 *
 * A1 brief item 2 (failure recovery on screen): when a draft/turn fails, CEE
 * puts a *specific recovery suggestion* on the wire and marks the failure
 * retryable/non-retryable. The live conversation catch path (useConversation
 * V4) previously ignored both — it showed generic copy plus an unconditional
 * "Try again" chip even on failures explicitly marked non-retryable.
 *
 * These specs pin the pure reader that fixes that:
 *   (a) surface the specific recovery suggestion alongside the generic copy;
 *   (b) hide the retry affordance when the wire says retryable === false.
 *
 * Fail-closed contract (never strand the user):
 *   - suggestion absent → undefined → caller keeps today's generic copy
 *   - retryable marker absent → undefined → caller keeps retry
 */
import { describe, it, expect } from 'vitest'
import { extractCeeRecovery, buildFailureRender, formatRecoveryHints, isDisplaySafeReason } from '../ceeRecovery'

describe('extractCeeRecovery — retryable marker', () => {
  it('reads a flat 0.18.0 CeeTypedError { retryable:false }', () => {
    expect(extractCeeRecovery({ error: 'CEE_LLM_VALIDATION_FAILED', message: 'x', retryable: false }).retryable).toBe(false)
  })

  it('reads a flat CeeTypedError { retryable:true }', () => {
    expect(extractCeeRecovery({ error: 'CEE_LLM_TIMEOUT', message: 'x', retryable: true }).retryable).toBe(true)
  })

  it('reads the nested spec-v04 shape { error: { code, retryable } }', () => {
    expect(extractCeeRecovery({ error: { code: 'CEE_VALIDATION_FAILED', message: 'x', retryable: false } }).retryable).toBe(false)
  })

  it('reads retryable off an OrchestratorError-like { body }', () => {
    expect(extractCeeRecovery({ body: { error: 'CEE_LLM_TIMEOUT', retryable: false } }).retryable).toBe(false)
  })

  it('reads retryable off a CEEError-like { details }', () => {
    expect(extractCeeRecovery({ details: { retryable: false } }).retryable).toBe(false)
  })

  it('reads retryable off a BFF-wrapped { cee_response }', () => {
    expect(extractCeeRecovery({ cee_response: { retryable: true } }).retryable).toBe(true)
  })

  it('honours the canonical PLoT spelling `retriable`', () => {
    expect(extractCeeRecovery({ error: 'CEE_INTERNAL_ERROR', retriable: false }).retryable).toBe(false)
  })

  it('fails closed: absent marker → undefined (caller keeps retry)', () => {
    expect(extractCeeRecovery({ error: 'CEE_LLM_TIMEOUT', message: 'x' }).retryable).toBeUndefined()
  })

  it('ignores non-boolean retryable values (never coerces)', () => {
    expect(extractCeeRecovery({ retryable: 'false' }).retryable).toBeUndefined()
    expect(extractCeeRecovery({ retryable: 0 }).retryable).toBeUndefined()
  })

  it('returns empty for non-object inputs', () => {
    expect(extractCeeRecovery(null).retryable).toBeUndefined()
    expect(extractCeeRecovery(undefined).retryable).toBeUndefined()
    expect(extractCeeRecovery('boom').retryable).toBeUndefined()
    expect(extractCeeRecovery(new Error('boom')).retryable).toBeUndefined()
  })
})

describe('extractCeeRecovery — recovery suggestion', () => {
  it('reads recovery_suggestion (primary wire name)', () => {
    expect(
      extractCeeRecovery({ error: 'CEE_LLM_VALIDATION_FAILED', retryable: false, recovery_suggestion: 'Add a clear goal and two options, then re-send.' }).suggestion,
    ).toBe('Add a clear goal and two options, then re-send.')
  })

  it('reads suggested_action (matches UI CeeError.suggestedAction normalisation)', () => {
    expect(
      extractCeeRecovery({ error: 'CEE_LLM_VALIDATION_FAILED', retryable: false, suggested_action: 'Shorten your brief to the key decision.' }).suggestion,
    ).toBe('Shorten your brief to the key decision.')
  })

  it('reads the short `recovery` alias', () => {
    expect(extractCeeRecovery({ retryable: false, recovery: 'Try a simpler brief.' }).suggestion).toBe('Try a simpler brief.')
  })

  it('reads the suggestion from a nested spec-v04 error object', () => {
    expect(
      extractCeeRecovery({ error: { code: 'CEE_VALIDATION_FAILED', retryable: false, recovery_suggestion: 'Name one goal.' } }).suggestion,
    ).toBe('Name one goal.')
  })

  it('reads the suggestion off an OrchestratorError-like { body }', () => {
    expect(extractCeeRecovery({ body: { retryable: false, recovery_suggestion: 'Do X.' } }).suggestion).toBe('Do X.')
  })

  it('tolerates camelCase SDK variance (suggestedAction)', () => {
    expect(extractCeeRecovery({ retryable: false, suggestedAction: 'Do Y.' }).suggestion).toBe('Do Y.')
  })

  it('fails closed: absent suggestion → undefined (generic copy)', () => {
    expect(extractCeeRecovery({ error: 'CEE_LLM_TIMEOUT', retryable: true }).suggestion).toBeUndefined()
  })

  it('never renders a raw error code as a suggestion', () => {
    expect(extractCeeRecovery({ error: 'CEE_LLM_TIMEOUT', retryable: true, recovery_suggestion: 'CEE_LLM_TIMEOUT' }).suggestion).toBeUndefined()
    expect(extractCeeRecovery({ retryable: false, suggested_action: 'UPSTREAM_TIMEOUT' }).suggestion).toBeUndefined()
  })

  it('rejects multi-token code dumps (no lowercase letter anywhere)', () => {
    for (const dump of ['UPSTREAM_TIMEOUT: CEE_LLM_TIMEOUT', 'ERR_A, ERR_B', 'CEE_X / CEE_Y', '500 CEE_INTERNAL_ERROR']) {
      expect(extractCeeRecovery({ recovery_suggestion: dump }).suggestion).toBeUndefined()
    }
  })

  it('reject-only: legitimate prose is passed through byte-for-byte, never rewritten', () => {
    // Prose that a naive normaliser would corrupt: em dash, US spelling,
    // capitalised proper noun, an embedded upper-snake identifier. All must
    // survive verbatim — house style on this field is the producer's job.
    const cases = [
      'Add one clear goal and two options, then send again.',
      'Your brief is too long — try naming a single decision.',
      'Analyze fewer options at once.',
      'Ask CEE for a shorter draft.',
      'Set GRAPH_MODE in your brief to a supported value.',
      'OK, but add a goal.',
    ]
    for (const prose of cases) {
      expect(extractCeeRecovery({ recovery_suggestion: prose }).suggestion).toBe(prose)
    }
  })

  it('ignores empty / whitespace-only suggestions and trims real ones', () => {
    expect(extractCeeRecovery({ recovery_suggestion: '   ' }).suggestion).toBeUndefined()
    expect(extractCeeRecovery({ recovery_suggestion: '  Add a goal.  ' }).suggestion).toBe('Add a goal.')
  })

  it('ignores non-string suggestion values', () => {
    expect(extractCeeRecovery({ recovery_suggestion: 42 }).suggestion).toBeUndefined()
    expect(extractCeeRecovery({ recovery_suggestion: { text: 'x' } }).suggestion).toBeUndefined()
  })
})

describe('buildFailureRender — surface (a) recovery + (b) honest retry', () => {
  const RETRY_BASE = 'Service temporarily unavailable. Please try again shortly.'
  const NO_RETRY_BASE = 'Service temporarily unavailable. Please wait a moment before continuing.'

  /**
   * Stand-in for useConversation's buildErrorMessage: retry-directive copy when
   * a retry chip will exist, non-retry-directive copy when it will not.
   */
  const buildBase = (showRetry: boolean): string => (showRetry ? RETRY_BASE : NO_RETRY_BASE)

  /**
   * RETIRED PIN (deliberate). The previous spec here read:
   *
   *   it('non-retryable: hides retry and appends the specific recovery
   *      suggestion', … expect(out.content).toContain(RETRY_BASE) …)
   *
   * with `showRetry` false. That asserted the *retry-directive* base survives
   * into copy rendered with no retry control — i.e. it pinned the defect as
   * intended behaviour. It is replaced by the two specs below, which keep the
   * append behaviour it was really guarding and additionally forbid the retry
   * directive. See buildErrorMessage.spec.ts for the end-to-end copy pins.
   */
  it('non-retryable: hides retry, uses the non-retry-directive base, appends the suggestion', () => {
    const err = { body: { error: 'CEE_LLM_VALIDATION_FAILED', retryable: false, recovery_suggestion: 'Add one clear goal and two options.' } }
    const out = buildFailureRender(buildBase, err)
    expect(out.showRetry).toBe(false)
    expect(out.content).toContain(NO_RETRY_BASE)
    expect(out.content).toContain('Add one clear goal and two options.')
  })

  it('non-retryable: the rendered copy never directs a retry it cannot offer', () => {
    const err = { body: { retryable: false, recovery_suggestion: 'Add one clear goal.' } }
    const out = buildFailureRender(buildBase, err)
    expect(out.showRetry).toBe(false)
    expect(out.content).not.toContain(RETRY_BASE)
    expect(out.content).not.toMatch(/try again/i)
  })

  it('retryable: keeps retry and the retry-directive base', () => {
    const err = { body: { error: 'CEE_LLM_TIMEOUT', retryable: true } }
    const out = buildFailureRender(buildBase, err)
    expect(out.showRetry).toBe(true)
    expect(out.content).toContain(RETRY_BASE)
  })

  it('fail open: absent retryable marker keeps retry AND today\'s copy (never strand)', () => {
    const out = buildFailureRender(buildBase, new Error('network'))
    expect(out.showRetry).toBe(true)
    expect(out.content).toBe(RETRY_BASE)
  })

  it('fail open: absent suggestion keeps the generic copy verbatim', () => {
    const out = buildFailureRender(buildBase, { body: { error: 'CEE_LLM_TIMEOUT', retryable: true } })
    expect(out.content).toBe(RETRY_BASE)
  })

  it('suggestion is surfaced even when the failure is retryable', () => {
    const err = { body: { retryable: true, recovery_suggestion: 'You can also simplify the brief.' } }
    const out = buildFailureRender(buildBase, err)
    expect(out.showRetry).toBe(true)
    expect(out.content).toContain('You can also simplify the brief.')
  })

  it('passes the resolved retry state to the base builder exactly once', () => {
    const seen: boolean[] = []
    const spy = (showRetry: boolean): string => {
      seen.push(showRetry)
      return 'base'
    }
    buildFailureRender(spy, { body: { retryable: false } })
    expect(seen).toEqual([false])

    seen.length = 0
    buildFailureRender(spy, { body: { retryable: true } })
    expect(seen).toEqual([true])
  })
})

// ---------------------------------------------------------------------------
// 0.19.0 nested recovery shape ({ recovery: { hints, suggestion, example? } })
// — the shape the LIVE V5 wire carries at BoundaryError.details.recovery.
// ---------------------------------------------------------------------------

describe('extractCeeRecovery — 0.19.0 nested recovery object', () => {
  const NESTED = {
    hints: ['Name the decision', 'List two options'],
    suggestion: 'Add more detail to your brief, then draft again.',
    example: 'Should we expand to Berlin or Munich next year?',
  }

  it('reads suggestion + hints from a BoundaryError-shaped details.recovery', () => {
    const boundaryError = {
      error: 'INTERNAL_ERROR',
      boundary: 'B1',
      direction: 'egress',
      validator: 'draft_graph_pipeline',
      details: { retryable: false, reason: 'draft_graph_cee_llm_validation_failed', recovery: NESTED },
      request_id: 'req_1',
      retryable: false,
    }
    const out = extractCeeRecovery(boundaryError)
    expect(out.retryable).toBe(false)
    expect(out.suggestion).toBe(NESTED.suggestion)
    expect(out.hints).toEqual(NESTED.hints)
  })

  it('flat recovery_suggestion has priority over the nested suggestion in the same container', () => {
    const out = extractCeeRecovery({
      body: {
        retryable: true,
        recovery_suggestion: 'Flat wins.',
        recovery: { hints: ['a hint here'], suggestion: 'Nested loses.' },
      },
    })
    expect(out.suggestion).toBe('Flat wins.')
    expect(out.hints).toEqual(['a hint here'])
  })

  it('rejects code-like nested suggestions and hints (reject-only guard)', () => {
    const out = extractCeeRecovery({
      body: {
        recovery: {
          hints: ['CEE_LLM_TIMEOUT', '  ', 'keep this real hint'],
          suggestion: 'UPSTREAM_TIMEOUT',
        },
      },
    })
    expect(out.suggestion).toBeUndefined()
    expect(out.hints).toEqual(['keep this real hint'])
  })

  it('non-object recovery values fall back to the legacy string reading', () => {
    const out = extractCeeRecovery({ body: { recovery: 'Just try a shorter brief.' } })
    expect(out.suggestion).toBe('Just try a shorter brief.')
    expect(out.hints).toBeUndefined()
  })
})

describe('isDisplaySafeReason — machine reasons never render, prose does', () => {
  it.each([
    ['draft_graph_cee_llm_validation_failed', false],
    ['draft_graph_cee_timeout', false],
    ['CEE_LLM_TIMEOUT', false],
    ['', false],
    ['   ', false],
    ['turn_id must be a UUID v4', true],
    ['The upstream model returned an empty response', true],
  ])('%s → %s', (value, expected) => {
    expect(isDisplaySafeReason(value)).toBe(expected)
  })
})

describe('formatRecoveryHints + buildFailureRender hint layering', () => {
  it('renders hints as bullet lines', () => {
    expect(formatRecoveryHints(['one', 'two'])).toBe('• one\n• two')
    expect(formatRecoveryHints([])).toBe('')
    expect(formatRecoveryHints(undefined)).toBe('')
  })

  it('buildFailureRender appends suggestion then hints beneath the base copy', () => {
    const out = buildFailureRender(() => 'Base copy.', {
      body: {
        retryable: false,
        recovery: { hints: ['hint one', 'hint two'], suggestion: 'Do the specific thing.' },
      },
    })
    expect(out.showRetry).toBe(false)
    expect(out.content).toBe('Base copy.\n\nDo the specific thing.\n\n• hint one\n• hint two')
  })
})
