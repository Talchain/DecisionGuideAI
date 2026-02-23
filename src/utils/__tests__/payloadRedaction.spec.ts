/**
 * Payload Redaction Tests
 *
 * Tests for neverTruncateKeys and truncation attribution.
 */

import { describe, it, expect } from 'vitest'
import { redactPayload, DEBUG_BUNDLE_REDACTION_OPTIONS } from '../payloadRedaction'

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

    it('keeps typical llm_raw.output_preview payloads untruncated in debug bundle mode', () => {
      const payload = {
        pipeline: {
          llm_raw: {
            output_preview: 'A'.repeat(5000),
          },
        },
      }

      const redacted = redactPayload(payload, DEBUG_BUNDLE_REDACTION_OPTIONS) as any

      expect(redacted.pipeline.llm_raw.output_preview).toHaveLength(5000)
      expect(redacted.pipeline.llm_raw.output_preview).not.toContain('truncated_by: bundle_redaction')
    })

    it('caps llm_raw text-like fields at 8000 chars in debug bundle mode', () => {
      const payload = {
        pipeline: {
          llm_raw: {
            output: 'B'.repeat(9000),
          },
        },
      }

      const redacted = redactPayload(payload, DEBUG_BUNDLE_REDACTION_OPTIONS) as any

      expect(redacted.pipeline.llm_raw.output).toContain('truncated_by: bundle_redaction_safety_cap')
      expect(redacted.pipeline.llm_raw.output).toContain('9000 chars total')
      expect(redacted.pipeline.llm_raw.output.startsWith('B'.repeat(8000))).toBe(true)
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

  describe('neverRedactKeys', () => {
    it('preserves constraint_analysis subtree despite exceeding maxDepth', () => {
      const payload = {
        option_comparison: [
          {
            option_id: 'opt1',
            constraint_analysis: {
              constraints: [
                { node_id: 'n1', prob_satisfied: 0.85, binding: false },
                { node_id: 'n2', prob_satisfied: 0.62, binding: true },
              ],
              joint_probability: 0.55,
            },
          },
        ],
      }

      const redacted = redactPayload(payload, {
        maxDepth: 3,
        neverRedactKeys: ['constraint_analysis'],
      }) as any

      expect(redacted.option_comparison[0].constraint_analysis.joint_probability).toBe(0.55)
      expect(redacted.option_comparison[0].constraint_analysis.constraints).toHaveLength(2)
      expect(redacted.option_comparison[0].constraint_analysis.constraints[0].node_id).toBe('n1')
      expect(redacted.option_comparison[0].constraint_analysis.constraints[1].binding).toBe(true)
    })

    it('preserves observed_state subtree despite exceeding maxDepth', () => {
      const payload = {
        graph: {
          nodes: [
            {
              id: 'factor1',
              kind: 'factor',
              observed_state: {
                value: 0.75,
                std: 0.1,
                baseline: 0.5,
              },
            },
          ],
        },
      }

      const redacted = redactPayload(payload, {
        maxDepth: 3,
        neverRedactKeys: ['observed_state'],
      }) as any

      expect(redacted.graph.nodes[0].observed_state.value).toBe(0.75)
      expect(redacted.graph.nodes[0].observed_state.std).toBe(0.1)
      expect(redacted.graph.nodes[0].observed_state.baseline).toBe(0.5)
    })

    it('preserves goal_constraints array despite exceeding maxDepth', () => {
      const payload = {
        request: {
          body: {
            goal_constraints: [
              { id: 'c1', label: 'Revenue', operator: '>=', value: 1000000 },
              { id: 'c2', label: 'Churn', operator: '<=', value: 0.05 },
            ],
          },
        },
      }

      const redacted = redactPayload(payload, {
        maxDepth: 3,
        neverRedactKeys: ['goal_constraints'],
      }) as any

      expect(redacted.request.body.goal_constraints).toHaveLength(2)
      expect(redacted.request.body.goal_constraints[0].label).toBe('Revenue')
      expect(redacted.request.body.goal_constraints[1].value).toBe(0.05)
    })

    it('still redacts sensitive keys within neverRedactKeys subtrees', () => {
      const payload = {
        option_comparison: [
          {
            constraint_analysis: {
              constraints: [{ node_id: 'n1', api_key: 'sk-secret-123' }],
              joint_probability: 0.8,
            },
          },
        ],
      }

      const redacted = redactPayload(payload, {
        maxDepth: 3,
        neverRedactKeys: ['constraint_analysis'],
        sensitiveKeys: ['api_key'],
      }) as any

      expect(redacted.option_comparison[0].constraint_analysis.constraints[0].api_key).toBe('[REDACTED]')
      expect(redacted.option_comparison[0].constraint_analysis.joint_probability).toBe(0.8)
    })

    it('still applies string truncation within neverRedactKeys subtrees', () => {
      const payload = {
        constraint_analysis: {
          constraints: [
            { node_id: 'n1', label: 'X'.repeat(2000) },
          ],
          joint_probability: 0.8,
        },
      }

      const redacted = redactPayload(payload, {
        maxDepth: 3,
        maxStringLength: 500,
        neverRedactKeys: ['constraint_analysis'],
      }) as any

      expect(redacted.constraint_analysis.constraints[0].label).toContain('truncated_by: bundle_redaction')
      expect(redacted.constraint_analysis.joint_probability).toBe(0.8)
    })

    it('still applies array capping within neverRedactKeys subtrees', () => {
      const payload = {
        constraint_analysis: {
          constraints: Array.from({ length: 50 }, (_, i) => ({
            node_id: `n${i}`,
            prob_satisfied: 0.5,
          })),
          joint_probability: 0.3,
        },
      }

      const redacted = redactPayload(payload, {
        maxDepth: 3,
        maxArrayItems: 10,
        neverRedactKeys: ['constraint_analysis'],
      }) as any

      expect(redacted.constraint_analysis.constraints.__truncated).toBe(true)
      expect(redacted.constraint_analysis.constraints.items).toHaveLength(10)
      expect(redacted.constraint_analysis.constraints.totalCount).toBe(50)
    })

    it('has no effect when neverRedactKeys is empty (default)', () => {
      const payload = {
        deep: { nested: { object: { key: 'value' } } },
      }

      const redacted = redactPayload(payload, {
        maxDepth: 2,
      }) as any

      expect(redacted.deep.nested.__redacted).toBe(true)
    })

    it('preserves exempt key nested under a non-exempt wrapper at max depth', () => {
      // wrapper → constraint_analysis: exempt key is NOT an immediate child of root
      const payload = {
        level1: {
          level2: {
            wrapper: {
              constraint_analysis: {
                constraints: [{ node_id: 'n1', prob_satisfied: 0.9 }],
                joint_probability: 0.7,
              },
              other_field: 'should be redacted at depth',
            },
          },
        },
      }

      const redacted = redactPayload(payload, {
        maxDepth: 3,
        neverRedactKeys: ['constraint_analysis'],
      }) as any

      // exempt key preserved through wrapper
      expect(redacted.level1.level2.wrapper.constraint_analysis.joint_probability).toBe(0.7)
      expect(redacted.level1.level2.wrapper.constraint_analysis.constraints[0].node_id).toBe('n1')
    })

    it('preserves exempt key inside an array of wrapper objects at max depth', () => {
      // array items → wrapper → observed_state
      const payload = {
        results: {
          items: [
            {
              metadata: {
                observed_state: { value: 0.5, std: 0.2 },
              },
            },
          ],
        },
      }

      const redacted = redactPayload(payload, {
        maxDepth: 3,
        neverRedactKeys: ['observed_state'],
      }) as any

      expect(redacted.results.items[0].metadata.observed_state.value).toBe(0.5)
      expect(redacted.results.items[0].metadata.observed_state.std).toBe(0.2)
    })
  })

  describe('DEBUG_BUNDLE_REDACTION_OPTIONS', () => {
    it('preserves constraint_analysis and observed_state in V2 response shape', () => {
      const payload = {
        graph: {
          nodes: [
            {
              id: 'f1',
              kind: 'factor',
              observed_state: { value: 0.75, std: 0.1, baseline: 0.5 },
            },
          ],
        },
        option_comparison: [
          {
            option_id: 'opt1',
            constraint_analysis: {
              constraints: [{ node_id: 'n1', prob_satisfied: 0.85 }],
              joint_probability: 0.55,
            },
          },
        ],
        goal_constraints: [
          { id: 'c1', label: 'Revenue', operator: '>=', value: 1000000 },
        ],
      }

      const redacted = redactPayload(payload, DEBUG_BUNDLE_REDACTION_OPTIONS) as any

      expect(redacted.graph.nodes[0].observed_state.value).toBe(0.75)
      expect(redacted.option_comparison[0].constraint_analysis.joint_probability).toBe(0.55)
      expect(redacted.goal_constraints[0].label).toBe('Revenue')
    })

    it('still redacts API keys and tokens', () => {
      const payload = {
        authorization: 'Bearer sk-secret-key',
        api_key: 'key-12345',
        constraint_analysis: {
          constraints: [{ node_id: 'n1', token: 'secret-token' }],
        },
      }

      const redacted = redactPayload(payload, DEBUG_BUNDLE_REDACTION_OPTIONS) as any

      expect(redacted.authorization).toBe('[REDACTED]')
      expect(redacted.api_key).toBe('[REDACTED]')
      expect(redacted.constraint_analysis.constraints[0].token).toBe('[REDACTED]')
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
