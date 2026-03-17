/**
 * Contract Validators Tests
 *
 * Tests for real-time validation of API responses against V3 Platform Contract.
 */

import { describe, it, expect } from 'vitest'
import {
  validateCEEResponse,
  validatePLoTResponse,
  validatePLoTErrorResponse,
  validatePLoTRequest,
  checkCausalPath,
  detectService,
  type ContractValidationResult,
} from '../contract-validators'

describe('Contract Validators', () => {
  describe('validateCEEResponse', () => {
    describe('interventions shape', () => {
      it('passes for valid interventions with number values', () => {
        const response = {
          analysis_ready: {
            options: [
              { id: 'opt1', interventions: { factor_1: 100, factor_2: 200 } },
            ],
          },
        }

        const result = validateCEEResponse(response)

        expect(result.valid).toBe(true)
        const interventionCheck = result.checks.find((c) => c.name === 'interventions shape')
        expect(interventionCheck?.passed).toBe(true)
      })

      it('passes for interventions with object values containing value property', () => {
        const response = {
          analysis_ready: {
            options: [
              {
                id: 'opt1',
                interventions: {
                  factor_1: { value: 100, source: 'brief_extraction' },
                  factor_2: { value: 200, confidence: 0.9 },
                },
              },
            ],
          },
        }

        const result = validateCEEResponse(response)

        expect(result.valid).toBe(true)
      })

      it('fails when intervention value is not a number', () => {
        const response = {
          analysis_ready: {
            options: [
              { id: 'opt1', interventions: { factor_1: 'invalid' } },
            ],
          },
        }

        const result = validateCEEResponse(response)

        expect(result.valid).toBe(false)
        const interventionCheck = result.checks.find((c) => c.name === 'interventions shape')
        expect(interventionCheck?.passed).toBe(false)
        expect(interventionCheck?.path).toContain('interventions.factor_1')
      })

      it('fails when interventions is not an object', () => {
        const response = {
          analysis_ready: {
            options: [
              { id: 'opt1', interventions: [100, 200] },
            ],
          },
        }

        const result = validateCEEResponse(response)

        expect(result.valid).toBe(false)
      })

      it('passes vacuously when no options present', () => {
        const response = { analysis_ready: {} }

        const result = validateCEEResponse(response)

        const interventionCheck = result.checks.find((c) => c.name === 'interventions shape')
        expect(interventionCheck?.passed).toBe(true)
      })
    })

    describe('status enum', () => {
      it('passes for valid status values', () => {
        const validStatuses = ['ready', 'needs_encoding', 'needs_user_mapping', 'needs_user_input']

        for (const status of validStatuses) {
          const response = {
            analysis_ready: { status },
          }

          const result = validateCEEResponse(response)
          const statusCheck = result.checks.find((c) => c.name === 'status enum')
          expect(statusCheck?.passed).toBe(true)
        }
      })

      it('fails for invalid status value', () => {
        const response = {
          analysis_ready: { status: 'invalid_status' },
        }

        const result = validateCEEResponse(response)

        const statusCheck = result.checks.find((c) => c.name === 'status enum')
        expect(statusCheck?.passed).toBe(false)
        expect(statusCheck?.message).toContain('invalid_status')
      })

      it('passes when status is absent', () => {
        const response = { analysis_ready: {} }

        const result = validateCEEResponse(response)

        const statusCheck = result.checks.find((c) => c.name === 'status enum')
        expect(statusCheck?.passed).toBe(true)
      })
    })

    describe('goal_node_id present', () => {
      it('passes when goal_node_id is a non-empty string', () => {
        const response = {
          analysis_ready: { goal_node_id: 'node_1' },
        }

        const result = validateCEEResponse(response)

        const goalCheck = result.checks.find((c) => c.name === 'goal_node_id present')
        expect(goalCheck?.passed).toBe(true)
      })

      it('warns when goal_node_id is missing', () => {
        const response = {
          analysis_ready: { options: [] },
        }

        const result = validateCEEResponse(response)

        const goalCheck = result.checks.find((c) => c.name === 'goal_node_id present')
        expect(goalCheck?.passed).toBe(false)
        expect(goalCheck?.severity).toBe('warning')
      })

      it('warns when goal_node_id is empty string', () => {
        const response = {
          analysis_ready: { goal_node_id: '' },
        }

        const result = validateCEEResponse(response)

        const goalCheck = result.checks.find((c) => c.name === 'goal_node_id present')
        expect(goalCheck?.passed).toBe(false)
        expect(goalCheck?.severity).toBe('warning')
      })
    })

    describe('node kinds valid', () => {
      it('passes for valid node kinds', () => {
        const validKinds = ['goal', 'factor', 'outcome', 'decision', 'risk', 'action', 'option']

        for (const kind of validKinds) {
          const response = {
            nodes: [{ id: 'n1', kind }],
          }

          const result = validateCEEResponse(response)
          const kindCheck = result.checks.find((c) => c.name === 'node kinds valid')
          expect(kindCheck?.passed).toBe(true)
        }
      })

      it('fails for invalid node kind', () => {
        const response = {
          nodes: [{ id: 'n1', kind: 'invalid_kind' }],
        }

        const result = validateCEEResponse(response)

        const kindCheck = result.checks.find((c) => c.name === 'node kinds valid')
        expect(kindCheck?.passed).toBe(false)
        expect(kindCheck?.message).toContain('invalid_kind')
      })

      it('checks graph.nodes structure', () => {
        const response = {
          graph: {
            nodes: [{ id: 'n1', kind: 'invalid_kind' }],
          },
        }

        const result = validateCEEResponse(response)

        const kindCheck = result.checks.find((c) => c.name === 'node kinds valid')
        expect(kindCheck?.passed).toBe(false)
      })
    })

    describe('edge std > 0', () => {
      it('passes when std is positive', () => {
        const response = {
          edges: [{ id: 'e1', strength: { mean: 0.5, std: 0.1 } }],
        }

        const result = validateCEEResponse(response)

        const stdCheck = result.checks.find((c) => c.name === 'edge std > 0')
        expect(stdCheck?.passed).toBe(true)
      })

      it('fails when std is zero', () => {
        const response = {
          edges: [{ id: 'e1', strength: { mean: 0.5, std: 0 } }],
        }

        const result = validateCEEResponse(response)

        const stdCheck = result.checks.find((c) => c.name === 'edge std > 0')
        expect(stdCheck?.passed).toBe(false)
        expect(stdCheck?.message).toContain('> 0')
      })

      it('fails when std is negative', () => {
        const response = {
          edges: [{ id: 'e1', strength: { mean: 0.5, std: -0.1 } }],
        }

        const result = validateCEEResponse(response)

        const stdCheck = result.checks.find((c) => c.name === 'edge std > 0')
        expect(stdCheck?.passed).toBe(false)
      })

      it('handles nested data structure', () => {
        const response = {
          edges: [{ id: 'e1', data: { strength: { std: 0 } } }],
        }

        const result = validateCEEResponse(response)

        const stdCheck = result.checks.find((c) => c.name === 'edge std > 0')
        expect(stdCheck?.passed).toBe(false)
      })
    })

    describe('edge mean in [-1, 1]', () => {
      it('passes when mean is within range', () => {
        const validMeans = [-1, -0.5, 0, 0.5, 1]

        for (const mean of validMeans) {
          const response = {
            edges: [{ id: 'e1', strength: { mean } }],
          }

          const result = validateCEEResponse(response)
          const meanCheck = result.checks.find((c) => c.name === 'edge mean in [-1, 1]')
          expect(meanCheck?.passed).toBe(true)
        }
      })

      it('warns when mean exceeds 1', () => {
        const response = {
          edges: [{ id: 'e1', strength: { mean: 1.5 } }],
        }

        const result = validateCEEResponse(response)

        const meanCheck = result.checks.find((c) => c.name === 'edge mean in [-1, 1]')
        expect(meanCheck?.passed).toBe(false)
        expect(meanCheck?.severity).toBe('warning')
      })

      it('warns when mean is below -1', () => {
        const response = {
          edges: [{ id: 'e1', strength: { mean: -1.5 } }],
        }

        const result = validateCEEResponse(response)

        const meanCheck = result.checks.find((c) => c.name === 'edge mean in [-1, 1]')
        expect(meanCheck?.passed).toBe(false)
      })
    })

    describe('overall validation result', () => {
      it('counts errors and warnings correctly', () => {
        const response = {
          analysis_ready: {
            goal_node_id: '',  // warning
            options: [
              { id: 'opt1', interventions: { factor_1: 'invalid' } },  // error
            ],
          },
          edges: [{ id: 'e1', strength: { mean: 2.0 } }],  // warning
        }

        const result = validateCEEResponse(response)

        expect(result.valid).toBe(false)  // has error
        expect(result.errorCount).toBeGreaterThanOrEqual(1)
        expect(result.warningCount).toBeGreaterThanOrEqual(1)
      })

      it('valid is true when only warnings present', () => {
        const response = {
          analysis_ready: {
            goal_node_id: '',  // warning only
          },
        }

        const result = validateCEEResponse(response)

        expect(result.valid).toBe(true)  // warnings don't block
        expect(result.warningCount).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('validatePLoTResponse', () => {
    describe('analysis_status enum', () => {
      it('passes for valid status values', () => {
        const validStatuses = ['computed', 'partial', 'blocked', 'failed']

        for (const status of validStatuses) {
          const response = {
            analysis_status: status,
            seed_used: 'abc123',
            results: status === 'computed' || status === 'partial' ? [{ outcome: { mean: 0.5 } }] : [],
          }

          const result = validatePLoTResponse(response)
          const statusCheck = result.checks.find((c) => c.name === 'analysis_status enum')
          expect(statusCheck?.passed).toBe(true)
        }
      })

      it('fails when analysis_status is missing', () => {
        const response = { seed_used: 'abc123' }

        const result = validatePLoTResponse(response)

        const statusCheck = result.checks.find((c) => c.name === 'analysis_status enum')
        expect(statusCheck?.passed).toBe(false)
        expect(statusCheck?.message).toContain('missing')
      })

      it('fails for invalid status value', () => {
        const response = {
          analysis_status: 'invalid_status',
          seed_used: 'abc123',
        }

        const result = validatePLoTResponse(response)

        const statusCheck = result.checks.find((c) => c.name === 'analysis_status enum')
        expect(statusCheck?.passed).toBe(false)
      })
    })

    describe('seed_used valid', () => {
      it('passes for valid seed', () => {
        const response = {
          analysis_status: 'computed',
          seed_used: 'unique-seed-123',
          results: [{ outcome: { mean: 0.5 } }],
        }

        const result = validatePLoTResponse(response)

        const seedCheck = result.checks.find((c) => c.name === 'seed_used valid')
        expect(seedCheck?.passed).toBe(true)
      })

      it('fails when seed is missing', () => {
        const response = {
          analysis_status: 'computed',
        }

        const result = validatePLoTResponse(response)

        const seedCheck = result.checks.find((c) => c.name === 'seed_used valid')
        expect(seedCheck?.passed).toBe(false)
      })

      it('fails when seed is "42" (default test seed)', () => {
        const response = {
          analysis_status: 'computed',
          seed_used: '42',
        }

        const result = validatePLoTResponse(response)

        const seedCheck = result.checks.find((c) => c.name === 'seed_used valid')
        expect(seedCheck?.passed).toBe(false)
        expect(seedCheck?.message).toContain('42')
      })

      it('fails when seed is 42 (numeric)', () => {
        const response = {
          analysis_status: 'computed',
          seed_used: 42,
        }

        const result = validatePLoTResponse(response)

        const seedCheck = result.checks.find((c) => c.name === 'seed_used valid')
        expect(seedCheck?.passed).toBe(false)
      })
    })

    describe('results present', () => {
      it('passes when option_comparison is present for computed status', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] }],
        }

        const result = validatePLoTResponse(response)

        const resultsCheck = result.checks.find((c) => c.name === 'results present')
        expect(resultsCheck?.passed).toBe(true)
      })

      it('fails when option_comparison is empty for computed status', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [],
        }

        const result = validatePLoTResponse(response)

        const resultsCheck = result.checks.find((c) => c.name === 'results present')
        expect(resultsCheck?.passed).toBe(false)
      })

      it('passes when option_comparison missing for blocked status', () => {
        const response = {
          analysis_status: 'blocked',
          meta: { seed_used: 'abc123' },
        }

        const result = validatePLoTResponse(response)

        const resultsCheck = result.checks.find((c) => c.name === 'results present')
        expect(resultsCheck?.passed).toBe(true)
      })
    })

    describe('outcome shape', () => {
      it('passes when option_comparison has valid confidence_interval', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [
            { option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] },
            { option_id: 'opt2', option_label: 'Option 2', confidence_interval: [0.4, 0.8] },
          ],
        }

        const result = validatePLoTResponse(response)

        const outcomeCheck = result.checks.find((c) => c.name === 'outcome shape')
        expect(outcomeCheck?.passed).toBe(true)
      })

      it('fails when confidence_interval is missing', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1' }],
        }

        const result = validatePLoTResponse(response)

        const outcomeCheck = result.checks.find((c) => c.name === 'outcome shape')
        expect(outcomeCheck?.passed).toBe(false)
      })

      it('fails when confidence_interval values are not numbers', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: ['invalid', 0.5] }],
        }

        const result = validatePLoTResponse(response)

        const outcomeCheck = result.checks.find((c) => c.name === 'outcome shape')
        expect(outcomeCheck?.passed).toBe(false)
      })
    })

    describe('robustness shape', () => {
      it('passes when robustness has fragile_edges and robust_edges', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] }],
          robustness: { fragile_edges: ['e1', 'e2'], robust_edges: ['e3'] },
        }

        const result = validatePLoTResponse(response)

        const robustnessCheck = result.checks.find((c) => c.name === 'robustness shape')
        expect(robustnessCheck?.passed).toBe(true)
      })

      it('passes when robustness is absent', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] }],
        }

        const result = validatePLoTResponse(response)

        const robustnessCheck = result.checks.find((c) => c.name === 'robustness shape')
        expect(robustnessCheck?.passed).toBe(true)
      })

      it('fails when fragile_edges is not an array', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] }],
          robustness: { fragile_edges: 'invalid', robust_edges: [] },
        }

        const result = validatePLoTResponse(response)

        const robustnessCheck = result.checks.find((c) => c.name === 'robustness shape')
        expect(robustnessCheck?.passed).toBe(false)
      })
    })

    describe('request_id matches', () => {
      it('passes when request IDs match', () => {
        const requestId = 'req-123-abc'
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] }],
          request_id: requestId,
        }

        const result = validatePLoTResponse(response, requestId)

        const requestIdCheck = result.checks.find((c) => c.name === 'request_id matches')
        expect(requestIdCheck?.passed).toBe(true)
      })

      it('warns when request IDs mismatch', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] }],
          request_id: 'response-456',
        }

        const result = validatePLoTResponse(response, 'sent-123')

        const requestIdCheck = result.checks.find((c) => c.name === 'request_id matches')
        expect(requestIdCheck?.passed).toBe(false)
        expect(requestIdCheck?.severity).toBe('warning')
      })

      it('passes when no sentRequestId provided', () => {
        const response = {
          analysis_status: 'computed',
          meta: { seed_used: 'abc123' },
          option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] }],
          request_id: 'some-id',
        }

        const result = validatePLoTResponse(response)

        const requestIdCheck = result.checks.find((c) => c.name === 'request_id matches')
        expect(requestIdCheck?.passed).toBe(true)
      })
    })
  })

  describe('validatePLoTErrorResponse', () => {
    describe('blocked response validation', () => {
      it('passes for valid blocked response with critiques', () => {
        const response = {
          analysis_status: 'blocked',
          status_reason: 'Graph validation failed',
          request_id: 'req-123',
          critiques: [
            { code: 'DISCONNECTED_GRAPH', severity: 'error', message: 'No path to goal' },
          ],
        }

        const result = validatePLoTErrorResponse(response)

        expect(result.valid).toBe(true)
        const statusCheck = result.checks.find((c) => c.name === 'analysis_status is error type')
        expect(statusCheck?.passed).toBe(true)
      })

      it('warns when status_reason is missing', () => {
        const response = {
          analysis_status: 'blocked',
          request_id: 'req-123',
          critiques: [{ code: 'ERROR', severity: 'error' }],
        }

        const result = validatePLoTErrorResponse(response)

        const reasonCheck = result.checks.find((c) => c.name === 'status_reason present')
        expect(reasonCheck?.passed).toBe(false)
        expect(reasonCheck?.severity).toBe('warning')
      })

      it('warns when critiques array is empty for blocked status', () => {
        const response = {
          analysis_status: 'blocked',
          status_reason: 'Validation failed',
          request_id: 'req-123',
          critiques: [],
        }

        const result = validatePLoTErrorResponse(response)

        const critiquesCheck = result.checks.find((c) => c.name === 'critiques present')
        expect(critiquesCheck?.passed).toBe(false)
        expect(critiquesCheck?.severity).toBe('warning')
      })

      it('warns when critique is missing code', () => {
        const response = {
          analysis_status: 'blocked',
          status_reason: 'Validation failed',
          request_id: 'req-123',
          critiques: [{ severity: 'error', message: 'Some error' }],
        }

        const result = validatePLoTErrorResponse(response)

        const codeCheck = result.checks.find((c) => c.name === 'critique has code')
        expect(codeCheck?.passed).toBe(false)
      })

      it('warns when critique has invalid severity', () => {
        const response = {
          analysis_status: 'blocked',
          status_reason: 'Validation failed',
          request_id: 'req-123',
          critiques: [{ code: 'ERROR', severity: 'critical' }],
        }

        const result = validatePLoTErrorResponse(response)

        const severityCheck = result.checks.find((c) => c.name === 'critique has valid severity')
        expect(severityCheck?.passed).toBe(false)
      })
    })

    describe('failed response validation', () => {
      it('passes for valid failed response', () => {
        const response = {
          analysis_status: 'failed',
          status_reason: 'Internal computation error',
          request_id: 'req-456',
        }

        const result = validatePLoTErrorResponse(response)

        expect(result.valid).toBe(true)
      })

      it('does not require critiques for failed status', () => {
        const response = {
          analysis_status: 'failed',
          status_reason: 'Internal error',
          request_id: 'req-789',
        }

        const result = validatePLoTErrorResponse(response)

        // critiques are only required for blocked, not failed
        const critiquesCheck = result.checks.find((c) => c.name === 'critiques present')
        expect(critiquesCheck).toBeUndefined()
      })
    })

    describe('request_id validation', () => {
      it('warns when request_id is missing', () => {
        const response = {
          analysis_status: 'blocked',
          status_reason: 'Validation failed',
          critiques: [{ code: 'ERROR', severity: 'error' }],
        }

        const result = validatePLoTErrorResponse(response)

        const requestIdCheck = result.checks.find((c) => c.name === 'request_id present')
        expect(requestIdCheck?.passed).toBe(false)
        expect(requestIdCheck?.severity).toBe('warning')
      })
    })

    describe('non-object response', () => {
      it('fails for non-object response', () => {
        const result = validatePLoTErrorResponse('not an object')

        expect(result.valid).toBe(false)
        expect(result.errorCount).toBe(1)
      })
    })
  })

  describe('validatePLoTRequest', () => {
    describe('goal_node_id validation', () => {
      it('passes when goal_node_id is present', () => {
        const request = {
          goal_node_id: 'outcome_1',
          options: [{ id: 'opt1', interventions: { factor_1: 100 } }],
          graph: { nodes: [{ id: 'outcome_1' }], edges: [] },
        }

        const result = validatePLoTRequest(request)

        const goalCheck = result.checks.find((c) => c.name === 'goal_node_id present')
        expect(goalCheck?.passed).toBe(true)
      })

      it('fails when goal_node_id is missing', () => {
        const request = {
          options: [{ id: 'opt1', interventions: { factor_1: 100 } }],
          graph: { nodes: [], edges: [] },
        }

        const result = validatePLoTRequest(request)

        expect(result.valid).toBe(false)
        const goalCheck = result.checks.find((c) => c.name === 'goal_node_id present')
        expect(goalCheck?.passed).toBe(false)
      })

      it('fails when goal_node_id is empty string', () => {
        const request = {
          goal_node_id: '',
          options: [],
          graph: { nodes: [], edges: [] },
        }

        const result = validatePLoTRequest(request)

        const goalCheck = result.checks.find((c) => c.name === 'goal_node_id present')
        expect(goalCheck?.passed).toBe(false)
      })
    })

    describe('options validation', () => {
      it('fails when options array is empty', () => {
        const request = {
          goal_node_id: 'outcome_1',
          options: [],
          graph: { nodes: [{ id: 'outcome_1' }], edges: [] },
        }

        const result = validatePLoTRequest(request)

        expect(result.valid).toBe(false)
        const optionsCheck = result.checks.find((c) => c.name === 'options present')
        expect(optionsCheck?.passed).toBe(false)
      })

      it('fails when options is missing', () => {
        const request = {
          goal_node_id: 'outcome_1',
          graph: { nodes: [{ id: 'outcome_1' }], edges: [] },
        }

        const result = validatePLoTRequest(request)

        const optionsCheck = result.checks.find((c) => c.name === 'options present')
        expect(optionsCheck?.passed).toBe(false)
      })
    })

    describe('interventions validation', () => {
      it('passes when all interventions are numbers', () => {
        const request = {
          goal_node_id: 'outcome_1',
          options: [
            { id: 'opt1', interventions: { factor_1: 100, factor_2: 200 } },
            { id: 'opt2', interventions: { factor_1: 50 } },
          ],
          graph: {
            nodes: [{ id: 'factor_1' }, { id: 'factor_2' }, { id: 'outcome_1' }],
            edges: [
              { from: 'factor_1', to: 'outcome_1' },
              { from: 'factor_2', to: 'outcome_1' },
            ],
          },
        }

        const result = validatePLoTRequest(request)

        const interventionsCheck = result.checks.find((c) => c.name === 'interventions are numbers')
        expect(interventionsCheck?.passed).toBe(true)
      })

      it('fails when intervention value is not a number', () => {
        const request = {
          goal_node_id: 'outcome_1',
          options: [{ id: 'opt1', interventions: { factor_1: 'high' } }],
          graph: {
            nodes: [{ id: 'factor_1' }, { id: 'outcome_1' }],
            edges: [{ from: 'factor_1', to: 'outcome_1' }],
          },
        }

        const result = validatePLoTRequest(request)

        expect(result.valid).toBe(false)
        const interventionsCheck = result.checks.find((c) => c.name === 'interventions are numbers')
        expect(interventionsCheck?.passed).toBe(false)
        expect(interventionsCheck?.path).toContain('factor_1')
      })

      it('fails when interventions is not an object', () => {
        const request = {
          goal_node_id: 'outcome_1',
          options: [{ id: 'opt1', interventions: [100, 200] }],
          graph: { nodes: [{ id: 'outcome_1' }], edges: [] },
        }

        const result = validatePLoTRequest(request)

        const interventionsCheck = result.checks.find((c) => c.name === 'interventions are numbers')
        expect(interventionsCheck?.passed).toBe(false)
      })
    })

    describe('graph structure validation', () => {
      it('passes for valid graph structure', () => {
        const request = {
          goal_node_id: 'outcome_1',
          options: [{ id: 'opt1', interventions: { factor_1: 100 } }],
          graph: {
            nodes: [{ id: 'factor_1' }, { id: 'outcome_1' }],
            edges: [{ from: 'factor_1', to: 'outcome_1' }],
          },
        }

        const result = validatePLoTRequest(request)

        const graphCheck = result.checks.find((c) => c.name === 'graph structure valid')
        expect(graphCheck?.passed).toBe(true)
      })

      it('fails when graph is missing', () => {
        const request = {
          goal_node_id: 'outcome_1',
          options: [{ id: 'opt1', interventions: { factor_1: 100 } }],
        }

        const result = validatePLoTRequest(request)

        const graphCheck = result.checks.find((c) => c.name === 'graph structure valid')
        expect(graphCheck?.passed).toBe(false)
      })

      it('fails when graph.nodes is missing', () => {
        const request = {
          goal_node_id: 'outcome_1',
          options: [{ id: 'opt1', interventions: { factor_1: 100 } }],
          graph: { edges: [] },
        }

        const result = validatePLoTRequest(request)

        const graphCheck = result.checks.find((c) => c.name === 'graph structure valid')
        expect(graphCheck?.passed).toBe(false)
      })
    })

    describe('non-object request', () => {
      it('fails for non-object request', () => {
        const result = validatePLoTRequest('not an object')

        expect(result.valid).toBe(false)
        expect(result.errorCount).toBe(1)
      })

      it('fails for null request', () => {
        const result = validatePLoTRequest(null)

        expect(result.valid).toBe(false)
      })
    })
  })

  describe('checkCausalPath', () => {
    describe('connected graphs', () => {
      it('returns hasPath true when direct path exists', () => {
        const graph = {
          nodes: [{ id: 'factor_1' }, { id: 'outcome_1' }],
          edges: [{ from: 'factor_1', to: 'outcome_1' }],
        }
        const options = [{ id: 'opt1', interventions: { factor_1: 100 } }]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(true)
        expect(result.disconnectedNodes).toBeUndefined()
      })

      it('returns hasPath true for multi-hop path', () => {
        const graph = {
          nodes: [{ id: 'factor_1' }, { id: 'mediator' }, { id: 'outcome_1' }],
          edges: [
            { from: 'factor_1', to: 'mediator' },
            { from: 'mediator', to: 'outcome_1' },
          ],
        }
        const options = [{ id: 'opt1', interventions: { factor_1: 100 } }]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(true)
      })

      it('handles source/target edge format', () => {
        const graph = {
          nodes: [{ id: 'factor_1' }, { id: 'outcome_1' }],
          edges: [{ source: 'factor_1', target: 'outcome_1' }],
        }
        const options = [{ id: 'opt1', interventions: { factor_1: 100 } }]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(true)
      })

      it('handles multiple intervention targets with all connected', () => {
        const graph = {
          nodes: [{ id: 'factor_1' }, { id: 'factor_2' }, { id: 'outcome_1' }],
          edges: [
            { from: 'factor_1', to: 'outcome_1' },
            { from: 'factor_2', to: 'outcome_1' },
          ],
        }
        const options = [{ id: 'opt1', interventions: { factor_1: 100, factor_2: 200 } }]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(true)
      })
    })

    describe('disconnected graphs', () => {
      it('returns hasPath false when no path exists', () => {
        const graph = {
          nodes: [{ id: 'factor_1' }, { id: 'factor_2' }, { id: 'outcome_1' }],
          edges: [{ from: 'factor_1', to: 'factor_2' }], // No path to outcome_1
        }
        const options = [{ id: 'opt1', interventions: { factor_1: 100 } }]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(false)
        expect(result.reason).toContain('No path')
        expect(result.disconnectedNodes).toContain('factor_1')
      })

      it('identifies specific disconnected nodes', () => {
        const graph = {
          nodes: [{ id: 'connected' }, { id: 'disconnected' }, { id: 'outcome_1' }],
          edges: [{ from: 'connected', to: 'outcome_1' }],
        }
        const options = [
          { id: 'opt1', interventions: { connected: 100, disconnected: 200 } },
        ]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(false)
        expect(result.disconnectedNodes).toContain('disconnected')
        expect(result.disconnectedNodes).not.toContain('connected')
      })

      it('returns hasPath false when intervention target not in graph', () => {
        const graph = {
          nodes: [{ id: 'factor_1' }, { id: 'outcome_1' }],
          edges: [{ from: 'factor_1', to: 'outcome_1' }],
        }
        const options = [{ id: 'opt1', interventions: { missing_node: 100 } }]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(false)
        expect(result.disconnectedNodes).toContain('missing_node')
      })
    })

    describe('edge cases', () => {
      it('returns hasPath false when goal node not in graph', () => {
        const graph = {
          nodes: [{ id: 'factor_1' }],
          edges: [],
        }
        const options = [{ id: 'opt1', interventions: { factor_1: 100 } }]

        const result = checkCausalPath(graph, options, 'missing_goal')

        expect(result.hasPath).toBe(false)
        expect(result.reason).toContain('Goal node')
      })

      it('returns hasPath false when no intervention targets', () => {
        const graph = {
          nodes: [{ id: 'outcome_1' }],
          edges: [],
        }
        const options = [{ id: 'opt1', interventions: {} }]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(false)
        expect(result.reason).toContain('No intervention targets')
      })

      it('returns hasPath false when graph is undefined', () => {
        const result = checkCausalPath(undefined as any, [], 'outcome_1')

        expect(result.hasPath).toBe(false)
        expect(result.reason).toContain('Missing')
      })

      it('returns hasPath false when options is undefined', () => {
        const graph = { nodes: [], edges: [] }
        const result = checkCausalPath(graph, undefined as any, 'outcome_1')

        expect(result.hasPath).toBe(false)
      })

      it('returns hasPath false when goalNodeId is empty', () => {
        const graph = { nodes: [], edges: [] }
        const options: any[] = []
        const result = checkCausalPath(graph, options, '')

        expect(result.hasPath).toBe(false)
      })

      it('handles edges with missing from/to properties', () => {
        const graph = {
          nodes: [{ id: 'factor_1' }, { id: 'outcome_1' }],
          edges: [{ id: 'e1' }], // Missing from/to
        }
        const options = [{ id: 'opt1', interventions: { factor_1: 100 } }]

        const result = checkCausalPath(graph, options, 'outcome_1')

        expect(result.hasPath).toBe(false)
      })

      it('handles cyclic graphs without infinite loop', () => {
        const graph = {
          nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'goal' }],
          edges: [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'c' },
            { from: 'c', to: 'a' }, // Cycle
            { from: 'c', to: 'goal' },
          ],
        }
        const options = [{ id: 'opt1', interventions: { a: 100 } }]

        const result = checkCausalPath(graph, options, 'goal')

        expect(result.hasPath).toBe(true)
      })
    })
  })

  describe('detectService', () => {
    it('detects CEE endpoints', () => {
      expect(detectService('/bff/cee/draft-graph')).toBe('CEE')
      expect(detectService('/cee/assist')).toBe('CEE')
      expect(detectService('/api/draft-graph')).toBe('CEE')
      expect(detectService('/bff/orchestrate/v1/turn')).toBe('CEE')
    })

    it('detects PLoT endpoints', () => {
      expect(detectService('/bff/plot/v1/run')).toBe('PLoT')
      expect(detectService('/plot/engine')).toBe('PLoT')
      expect(detectService('/api/engine/run')).toBe('PLoT')
      expect(detectService('/v2/run')).toBe('PLoT')
      expect(detectService('/v1/run')).toBe('PLoT')
    })

    it('detects ISL endpoints', () => {
      expect(detectService('/bff/isl/validate')).toBe('ISL')
      expect(detectService('/isl/robustness')).toBe('ISL')
      expect(detectService('/api/validate')).toBe('ISL')
    })

    it('detects BFF endpoints', () => {
      expect(detectService('/bff/health')).toBe('BFF')
      expect(detectService('/bff/version')).toBe('BFF')
    })

    it('returns unknown for unrecognized endpoints', () => {
      expect(detectService('/api/other')).toBe('unknown')
      expect(detectService('/random/path')).toBe('unknown')
    })

    it('is case insensitive', () => {
      expect(detectService('/BFF/CEE/draft-graph')).toBe('CEE')
      expect(detectService('/BFF/PLOT/run')).toBe('PLoT')
    })
  })
})
