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
import { extractCeeRecovery, buildFailureRender } from '../ceeRecovery'

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
  const base = 'Service temporarily unavailable. Please try again shortly.'

  it('non-retryable: hides retry and appends the specific recovery suggestion', () => {
    const err = { body: { error: 'CEE_LLM_VALIDATION_FAILED', retryable: false, recovery_suggestion: 'Add one clear goal and two options.' } }
    const out = buildFailureRender(base, err)
    expect(out.showRetry).toBe(false)
    expect(out.content).toContain(base)
    expect(out.content).toContain('Add one clear goal and two options.')
  })

  it('retryable: keeps retry', () => {
    const err = { body: { error: 'CEE_LLM_TIMEOUT', retryable: true } }
    expect(buildFailureRender(base, err).showRetry).toBe(true)
  })

  it('fail closed: absent retryable marker keeps retry (never strand)', () => {
    expect(buildFailureRender(base, new Error('network')).showRetry).toBe(true)
  })

  it('fail closed: absent suggestion keeps the generic copy verbatim', () => {
    const out = buildFailureRender(base, { body: { error: 'CEE_LLM_TIMEOUT', retryable: true } })
    expect(out.content).toBe(base)
  })

  it('suggestion is surfaced even when the failure is retryable', () => {
    const err = { body: { retryable: true, recovery_suggestion: 'You can also simplify the brief.' } }
    const out = buildFailureRender(base, err)
    expect(out.showRetry).toBe(true)
    expect(out.content).toContain('You can also simplify the brief.')
  })
})
