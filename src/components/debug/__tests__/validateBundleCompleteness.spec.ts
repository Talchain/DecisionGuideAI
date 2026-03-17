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

// =============================================================================
// Optional field coverage (observability audit)
// =============================================================================

describe('validateBundleCompleteness optional fields', () => {
  it('reports optional fields present when plot_response contains them', () => {
    const result = validateBundleCompleteness(makeInput({
      payloads: {
        plot_request: { graph: {} },
        plot_response: {
          analysis_status: 'computed',
          repairs_applied: [],
          constraints_status: 'computed',
          review_status: 'complete',
          critiques: [],
        },
        isl_response: { option_comparison: [] },
      },
    }))

    expect(result.optional_present).toEqual(['repairs_applied', 'constraints_status', 'review_status', 'critiques'])
    expect(result.optional_absent).toEqual([])
  })

  it('reports optional fields absent when plot_response lacks them', () => {
    const result = validateBundleCompleteness(makeInput({
      payloads: {
        plot_request: { graph: {} },
        plot_response: { analysis_status: 'computed' },
        isl_response: { option_comparison: [] },
      },
    }))

    expect(result.optional_present).toEqual([])
    expect(result.optional_absent).toEqual(['repairs_applied', 'constraints_status', 'review_status', 'critiques'])
  })

  it('reports partial optional field coverage', () => {
    const result = validateBundleCompleteness(makeInput({
      payloads: {
        plot_request: { graph: {} },
        plot_response: {
          analysis_status: 'computed',
          critiques: [],
          repairs_applied: [],
        },
        isl_response: { option_comparison: [] },
      },
    }))

    expect(result.optional_present).toEqual(['repairs_applied', 'critiques'])
    expect(result.optional_absent).toEqual(['constraints_status', 'review_status'])
  })

  it('handles null plot_response gracefully for optional fields', () => {
    const result = validateBundleCompleteness(makeInput({
      payloads: {
        plot_request: { graph: {} },
        plot_response: undefined,
        isl_response: { option_comparison: [] },
      },
    }))

    expect(result.optional_present).toEqual([])
    expect(result.optional_absent).toEqual(['repairs_applied', 'constraints_status', 'review_status', 'critiques'])
  })

  it('existing required check still works with optional additions', () => {
    const result = validateBundleCompleteness(makeInput())

    expect(result.complete).toBe(true)
    expect(result.missing).toEqual([])
    // Optional fields are absent from default fixture
    expect(result.optional_absent.length).toBe(4)
  })

  it('missing required keys still detected with optional additions', () => {
    const result = validateBundleCompleteness(makeInput({
      payloads: {
        plot_request: undefined,
        plot_response: {
          analysis_status: 'computed',
          repairs_applied: [],
          critiques: [],
        },
        isl_response: undefined,
      },
    }))

    expect(result.complete).toBe(false)
    expect(result.missing).toContain('plot_request')
    expect(result.missing).toContain('isl_response')
    // Optional still tracked correctly
    expect(result.optional_present).toContain('repairs_applied')
    expect(result.optional_present).toContain('critiques')
  })
})
