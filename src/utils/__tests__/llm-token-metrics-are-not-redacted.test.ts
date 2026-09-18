/**
 * ⭐⭐ LLM TOKEN COUNTS ARE METRICS, NOT CREDENTIALS — and the safe-list that
 * says so was written against the WRONG PROVIDER'S VOCABULARY.
 *
 * `sensitiveKeys` contains `token`, matched as a SUBSTRING, so every key ending
 * `_tokens` is caught. `safeKeys` exists precisely to exempt LLM metrics — its
 * own comment says so — but listed only OpenAI's names (`prompt_tokens`,
 * `completion_tokens`, `total_tokens`) while CEE emits Anthropic's.
 *
 * MEASURED on a real support bundle (2026-09-18): all four Anthropic counts
 * appear in `debug_redaction_manifest.redacted` with `reason: "sensitive_key"`.
 *
 * ⛔ WHY THAT MATTERS MORE THAN IT LOOKS. A debug bundle is collected to answer
 * questions about a turn. With these redacted it cannot say how large the
 * context was, whether prompt caching is working, or whether a prompt change
 * grew or shrank the request — so a prompt change cannot be attributed at all.
 * The redactor was destroying the measurement the bundle exists to carry.
 *
 * ⚠ THIS FILE IS THE COMPLETENESS CHECK, AND IT IS THE POINT. `safeKeys` is a
 * hand-maintained list, which is the drift class this estate pays for most. It
 * stays a list deliberately — a `*_tokens` pattern would also un-redact
 * `refresh_tokens`, and the cost of being wrong in a redactor is a leaked
 * credential, not a missing metric. So the list stays explicit and conservative,
 * and THIS TEST makes its staleness loud: add a provider whose counts are not
 * named here and it REDs.
 */

import { describe, expect, it } from 'vitest'

import { redactPayload } from '../payloadRedaction'

/**
 * Every LLM token-count key a producer in this estate emits.
 *
 * Anthropic's four are what CEE's `_diagnostic_trace.llm_calls[]` actually
 * carries — quoted from a live bundle, not from a docstring.
 */
const PRODUCER_TOKEN_COUNT_KEYS = [
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_creation_tokens',
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
] as const

describe('LLM token metrics survive redaction', () => {
  it('every producer token-count key keeps its value', () => {
    const payload: Record<string, unknown> = {}
    for (const k of PRODUCER_TOKEN_COUNT_KEYS) payload[k] = 1234

    const out = redactPayload(payload) as Record<string, unknown>

    for (const k of PRODUCER_TOKEN_COUNT_KEYS) {
      expect(
        out[k],
        `${k} was redacted. It is a COUNT, not a credential — a debug bundle ` +
          'that cannot report context size cannot attribute a prompt change.',
      ).toBe(1234)
    }
  })

  it('POSITIVE CONTROL: genuine credentials are STILL redacted', () => {
    // Without this, the test above would pass identically if redaction had been
    // disabled altogether, or if `redactPayload` became the identity function.
    // The assertion is only meaningful beside a demonstration that the redactor
    // still bites (CLAUDE.md trap 13).
    const out = redactPayload({
      token: 'sk-live-must-not-appear',
      api_key: 'sk-live-must-not-appear',
      authorization: 'Bearer must-not-appear',
      password: 'must-not-appear',
      input_tokens: 99,
    }) as Record<string, unknown>

    expect(out.token).not.toBe('sk-live-must-not-appear')
    expect(out.api_key).not.toBe('sk-live-must-not-appear')
    expect(out.authorization).not.toBe('Bearer must-not-appear')
    expect(out.password).not.toBe('must-not-appear')
    // …and the metric beside them is untouched, which is the whole distinction.
    expect(out.input_tokens).toBe(99)
  })

  it('the singular `_token` family is NOT swept in by this change', () => {
    // The conservative boundary, asserted rather than assumed. A `*_tokens`
    // pattern rule would have caught these too; naming the metrics explicitly
    // is what keeps them out.
    const out = redactPayload({
      access_token: 'must-not-appear',
      refresh_token: 'must-not-appear',
    }) as Record<string, unknown>

    expect(out.access_token).not.toBe('must-not-appear')
    expect(out.refresh_token).not.toBe('must-not-appear')
  })
})
