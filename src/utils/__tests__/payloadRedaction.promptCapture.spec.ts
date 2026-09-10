/**
 * `_prompt_capture` — the served system prompt must reach the debug bundle WHOLE.
 *
 * CEE returns `_prompt_capture` as a top-level key on a cold draft turn,
 * carrying the VERBATIM served system prompt. Measured on staging
 * 2026-09-10: 61,199 bytes. Two independent clips stood between that and
 * the exported bundle:
 *
 *   1. `system_prompt` was not on `neverTruncateKeys`, so the walker cut it
 *      at `maxStringLength` (1000) and stamped `[truncated_by:
 *      bundle_redaction, ...]`.
 *   2. Allowlisting alone is NOT enough — every exempt key shares one
 *      `neverTruncateMaxLength` ceiling, default 8000
 *      (`DEBUG_LLM_RAW_MAX_CHARS`). A 61k prompt would still be cut, at 8k,
 *      stamped `[truncated_by: bundle_redaction_safety_cap, ...]`.
 *
 * `payloadRedaction` is a REDACTION layer: its default-truncate behaviour is
 * a privacy control, not a formatting choice. The fix therefore raises the
 * ceiling for THIS KEY ONLY, via `neverTruncateKeyMaxLength`. The negative
 * pins below are what prove that — without them this suite is
 * indistinguishable from one written against a disabled redactor.
 */

import { describe, it, expect } from 'vitest'
import {
  redactPayload,
  DEBUG_BUNDLE_REDACTION_OPTIONS,
  DEBUG_LLM_RAW_MAX_CHARS,
} from '../payloadRedaction'

/** The byte count measured at the CEE wire on 2026-09-10. */
const MEASURED_PROMPT_CHARS = 61_199

/** Marker the `maxStringLength` path stamps. Note the trailing comma — it is
 *  what distinguishes this marker from the safety-cap one. */
const MAX_STRING_MARKER = '[truncated_by: bundle_redaction,'
/** Marker the `neverTruncateMaxLength` safety-cap path stamps. */
const SAFETY_CAP_MARKER = 'bundle_redaction_safety_cap'

function buildPromptCapturePayload() {
  const systemPrompt = 'S'.repeat(MEASURED_PROMPT_CHARS)
  return {
    systemPrompt,
    body: {
      assistant_text: 'A'.repeat(MEASURED_PROMPT_CHARS),
      // An ORDINARY long string, not on any allowlist. The negative pin.
      notes: 'N'.repeat(MEASURED_PROMPT_CHARS),
      _prompt_capture: [
        {
          system_prompt: systemPrompt,
          system_prompt_chars: MEASURED_PROMPT_CHARS,
          system_prompt_sha256: 'f'.repeat(64),
          prompt_version: 'v21',
          prompt_hash: 'a'.repeat(40),
          resolved_model: 'claude-sonnet-4-5',
          resolution_source: 'registry',
          provider: 'anthropic',
          instance_id: 'srv-abc123',
          user_content_chars: 412,
          user_content_sha256: 'b'.repeat(64),
        },
      ],
    },
  }
}

function redactBody() {
  const { systemPrompt, body } = buildPromptCapturePayload()
  const out = redactPayload(body, DEBUG_BUNDLE_REDACTION_OPTIONS) as any
  return { systemPrompt, out, captured: out._prompt_capture[0].system_prompt as string }
}

describe('_prompt_capture reaches the debug bundle whole', () => {
  it('carries the 61,199-char system_prompt through the export redactor at FULL length', () => {
    const { systemPrompt, captured } = redactBody()
    // Bound by exact length, not by presence: a test asserting presence
    // passes on a clipped string.
    expect(captured.length).toBe(MEASURED_PROMPT_CHARS)
    expect(captured).toBe(systemPrompt)
  })

  it('does not clip system_prompt at maxStringLength (proves the ALLOWLIST binding)', () => {
    const { captured } = redactBody()
    expect(captured).not.toContain(MAX_STRING_MARKER)
  })

  it('does not clip system_prompt at the shared safety cap (proves the PER-KEY CEILING binding)', () => {
    const { captured } = redactBody()
    expect(captured).not.toContain(SAFETY_CAP_MARKER)
  })

  it('keeps the shape-only detection surface exportable', () => {
    const { out } = redactBody()
    const cap = out._prompt_capture[0]
    expect(cap.system_prompt_chars).toBe(MEASURED_PROMPT_CHARS)
    expect(cap.system_prompt_sha256).toBe('f'.repeat(64))
    expect(cap.user_content_chars).toBe(412)
    expect(cap.user_content_sha256).toBe('b'.repeat(64))
    expect(cap.prompt_version).toBe('v21')
    expect(cap.resolved_model).toBe('claude-sonnet-4-5')
    expect(cap.resolution_source).toBe('registry')
    expect(cap.provider).toBe('anthropic')
    expect(cap.instance_id).toBe('srv-abc123')
  })

  // ---- NEGATIVE PINS: these are what prove the change NARROWED, not widened.

  it('NEGATIVE PIN: an ordinary long string in the same payload is STILL truncated', () => {
    const { out } = redactBody()
    expect(out.notes).toContain(MAX_STRING_MARKER)
    expect(out.notes.length).toBeLessThan(2000)
  })

  it('NEGATIVE PIN: assistant_text is STILL capped at the shared 8000 ceiling', () => {
    const { out } = redactBody()
    expect(DEBUG_LLM_RAW_MAX_CHARS).toBe(8000)
    expect(out.assistant_text).toContain(SAFETY_CAP_MARKER)
    expect(out.assistant_text.length).toBeLessThan(MEASURED_PROMPT_CHARS)
  })

  it('NEGATIVE PIN: the global default options are untouched — no key escapes truncation there', () => {
    const { body } = buildPromptCapturePayload()
    const out = redactPayload(body) as any
    // DEFAULT_OPTIONS has neverTruncateKeys: [] and maxDepth 3.
    const captured = JSON.stringify(out)
    expect(captured).not.toContain('S'.repeat(2000))
  })
})
