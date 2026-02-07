/**
 * Payload Redaction Tests
 *
 * Tests for neverTruncateKeys and truncation attribution.
 */

import { describe, it, expect } from 'vitest'
import { redactPayload } from '../payloadRedaction'

describe('redactPayload', () => {
  describe('neverTruncateKeys', () => {
    it('exempts specified keys from string truncation', () => {
      const payload = {
        pipeline: {
          llm_raw: {
            text: 'A'.repeat(2000), // Exceeds maxStringLength
          },
        },
      }

      const redacted = redactPayload(payload, {
        maxStringLength: 1000,
        maxDepth: 8,
        neverTruncateKeys: ['text'],
      }) as any

      // 'text' key should NOT be truncated
      expect(redacted.pipeline.llm_raw.text).toBe('A'.repeat(2000))
    })

    it('still truncates non-exempt keys', () => {
      const payload = {
        description: 'B'.repeat(2000),
        pipeline: {
          llm_raw: {
            text: 'A'.repeat(2000),
          },
        },
      }

      const redacted = redactPayload(payload, {
        maxStringLength: 1000,
        maxDepth: 8,
        neverTruncateKeys: ['text'],
      }) as any

      // 'description' should be truncated
      expect(redacted.description).toContain('truncated_by: bundle_redaction')
      expect(redacted.description).toContain('2000 chars total')
      // 'text' should NOT be truncated
      expect(redacted.pipeline.llm_raw.text).toBe('A'.repeat(2000))
    })

    it('applies safety cap to exempt keys when they exceed neverTruncateMaxLength', () => {
      const payload = {
        pipeline: {
          llm_raw: {
            text: 'X'.repeat(500), // Exceeds the custom safety cap of 300
          },
        },
      }

      const redacted = redactPayload(payload, {
        maxStringLength: 100,
        maxDepth: 8,
        neverTruncateKeys: ['text'],
        neverTruncateMaxLength: 300, // Custom low safety cap for testing
      }) as any

      expect(redacted.pipeline.llm_raw.text).toContain('truncated_by: bundle_redaction_safety_cap')
      expect(redacted.pipeline.llm_raw.text).toContain('500 chars total')
      // Should be capped at 300 chars + truncation message
      expect(redacted.pipeline.llm_raw.text.startsWith('X'.repeat(300))).toBe(true)
    })
  })

  describe('truncation attribution', () => {
    it('includes truncated_by: bundle_redaction in truncation message', () => {
      const payload = { message: 'C'.repeat(600) }

      const redacted = redactPayload(payload, {
        maxStringLength: 500,
      }) as any

      expect(redacted.message).toContain('[truncated_by: bundle_redaction, 600 chars total]')
    })
  })
})
