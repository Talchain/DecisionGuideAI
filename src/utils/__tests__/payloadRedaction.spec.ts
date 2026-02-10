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

    it('preserves 5000-char text inside pipeline.llm_raw after redaction', () => {
      const payload = {
        pipeline: {
          llm_raw: {
            text: 'A'.repeat(5000),
          },
        },
      }

      const redacted = redactPayload(payload, {
        maxStringLength: 1000,
        maxDepth: 8,
        neverTruncateKeys: ['text'],
      }) as any

      // Full 5000-char string must be preserved
      expect(redacted.pipeline.llm_raw.text).toBe('A'.repeat(5000))
      expect(redacted.pipeline.llm_raw.text.length).toBe(5000)
      expect(redacted.pipeline.llm_raw.text).not.toContain('truncated_by')
    })

    it('truncates non-exempt long strings normally alongside exempt text', () => {
      const payload = {
        pipeline: {
          llm_raw: {
            text: 'A'.repeat(5000), // exempt
          },
        },
        summary: 'B'.repeat(3000), // NOT exempt
        meta: {
          notes: 'C'.repeat(2000), // NOT exempt
        },
      }

      const redacted = redactPayload(payload, {
        maxStringLength: 1000,
        maxDepth: 8,
        neverTruncateKeys: ['text'],
      }) as any

      // text is preserved
      expect(redacted.pipeline.llm_raw.text).toBe('A'.repeat(5000))
      // summary is truncated
      expect(redacted.summary).toContain('truncated_by: bundle_redaction')
      expect(redacted.summary).toContain('3000 chars total')
      // meta.notes is truncated
      expect(redacted.meta.notes).toContain('truncated_by: bundle_redaction')
      expect(redacted.meta.notes).toContain('2000 chars total')
    })

    it('exempts "text" key at any nesting depth', () => {
      const payload = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  text: 'D'.repeat(5000),
                },
              },
            },
          },
        },
        // Also test a shallow text key
        text: 'E'.repeat(3000),
      }

      const redacted = redactPayload(payload, {
        maxStringLength: 500,
        maxDepth: 10,
        neverTruncateKeys: ['text'],
      }) as any

      // Deep nested text preserved
      expect(redacted.level1.level2.level3.level4.level5.text).toBe('D'.repeat(5000))
      // Shallow text also preserved
      expect(redacted.text).toBe('E'.repeat(3000))
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

  describe('double-redaction regression', () => {
    it('second redactPayload pass without neverTruncateKeys re-truncates preserved text', () => {
      // This test documents WHY diagnostic-bundle must NOT re-redact payloads.
      // Step 1: first pass with neverTruncateKeys preserves text
      const payload = { pipeline: { llm_raw: { text: 'A'.repeat(5000) } } }
      const firstPass = redactPayload(payload, {
        maxStringLength: 1000,
        maxDepth: 8,
        neverTruncateKeys: ['text'],
      }) as any
      expect(firstPass.pipeline.llm_raw.text).toBe('A'.repeat(5000))

      // Step 2: second pass WITHOUT neverTruncateKeys destroys the exemption
      const secondPass = redactPayload(firstPass, {
        maxStringLength: 500,
        maxDepth: 3,
      }) as any
      expect(secondPass.pipeline.llm_raw.text).toContain('truncated_by: bundle_redaction')
      expect(secondPass.pipeline.llm_raw.text).not.toBe('A'.repeat(5000))
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
