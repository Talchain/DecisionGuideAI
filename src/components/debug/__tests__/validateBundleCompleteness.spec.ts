/**
 * validateBundleCompleteness Tests
 */

import { describe, it, expect } from 'vitest'
import {
  validateBundleCompleteness,
  type BundleCompletenessInput,
} from '../utils/validateBundleCompleteness'

function makeInput(overrides: Partial<BundleCompletenessInput> = {}): BundleCompletenessInput {
  return {
    payloads: {
      plot_request: { graph: {} },
      plot_response: { analysis_status: 'computed' },
      isl_response: { option_comparison: [] },
      cee_response: { analysis_ready: {} },
      ...overrides.payloads,
    },
    request_id: overrides.request_id ?? 'req-123',
    request_id_chain: overrides.request_id_chain ?? null,
  }
}

describe('validateBundleCompleteness', () => {
  it('returns complete when all required components present', () => {
    const result = validateBundleCompleteness(makeInput())

    expect(result.complete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('reports missing isl_response', () => {
    const result = validateBundleCompleteness(makeInput({
      payloads: {
        plot_request: { graph: {} },
        plot_response: { analysis_status: 'computed' },
        isl_response: undefined,
      },
    }))

    expect(result.complete).toBe(false)
    expect(result.missing).toContain('isl_response')
  })

  it('reports missing plot_request and plot_response', () => {
    const result = validateBundleCompleteness(makeInput({
      payloads: {
        plot_request: undefined,
        plot_response: undefined,
        isl_response: { option_comparison: [] },
      },
    }))

    expect(result.complete).toBe(false)
    expect(result.missing).toContain('plot_request')
    expect(result.missing).toContain('plot_response')
  })

  it('reports missing request_id when neither request_id nor chain present', () => {
    const result = validateBundleCompleteness({
      payloads: {
        plot_request: { graph: {} },
        plot_response: { analysis_status: 'computed' },
        isl_response: { option_comparison: [] },
      },
      request_id: null,
      request_id_chain: null,
    })

    expect(result.complete).toBe(false)
    expect(result.missing).toContain('request_id')
  })

  it('considers complete when request_id is null but chain.ui_generated is present', () => {
    const result = validateBundleCompleteness({
      payloads: {
        plot_request: { graph: {} },
        plot_response: { analysis_status: 'computed' },
        isl_response: { option_comparison: [] },
      },
      request_id: null,
      request_id_chain: { ui_generated: 'chain-req-456' },
    })

    expect(result.complete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('reports all missing when payloads are empty', () => {
    const result = validateBundleCompleteness({
      payloads: {},
      request_id: null,
      request_id_chain: null,
    })

    expect(result.complete).toBe(false)
    expect(result.missing).toEqual(['plot_request', 'plot_response', 'isl_response', 'request_id'])
  })
})
