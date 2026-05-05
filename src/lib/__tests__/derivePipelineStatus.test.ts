/**
 * Tests for `derivePipelineStatus` (P0 V5 golden-path repair, Wave 5).
 *
 * One case per enum value, plus the precedence properties that prevent
 * a "global success" from ever surfacing when the run gate failed,
 * payloads were missing, or only the UI render succeeded.
 */

import { describe, it, expect } from 'vitest'

import { derivePipelineStatus } from '../derivePipelineStatus'
import type {
  DerivePipelineStatusInputs,
  PipelineStatus,
} from '../derivePipelineStatus'
import type { CEEAnalysisReady } from '../../adapters/cee/types'

function trace(overrides?: Partial<DerivePipelineStatusInputs['trace']>): DerivePipelineStatusInputs['trace'] {
  return {
    status: 200,
    completed: true,
    error: undefined,
    responseHash: 'hash',
    service: 'cee',
    serviceBuild: 'abc1234',
    ...overrides,
  }
}

function ready(overrides?: Partial<CEEAnalysisReady>): CEEAnalysisReady {
  return {
    options: [],
    goal_node_id: 'g',
    status: 'ready',
    ...overrides,
  } as CEEAnalysisReady
}

function inputs(
  overrides?: Partial<DerivePipelineStatusInputs>,
): DerivePipelineStatusInputs {
  return {
    trace: trace(),
    isAnalysisTurn: false,
    ceeAnalysisReady: null,
    recoverableEnvelope: null,
    payloadCaptureDisabled: false,
    ...overrides,
  }
}

describe('derivePipelineStatus — happy path', () => {
  it('200 + non-analysis turn + fresh wire → ui_render_success', () => {
    const result = derivePipelineStatus(
      inputs({ ceeAnalysisReady: ready({ freshness: 'fresh' }) }),
    )
    expect(result).toBe<PipelineStatus>('ui_render_success')
  })

  it('200 + analysis turn + ready status → ui_render_success', () => {
    const result = derivePipelineStatus(
      inputs({ isAnalysisTurn: true, ceeAnalysisReady: ready() }),
    )
    expect(result).toBe('ui_render_success')
  })
})

describe('derivePipelineStatus — proxy_or_network_failure', () => {
  it('trace never completed → proxy_or_network_failure', () => {
    const result = derivePipelineStatus(inputs({ trace: trace({ completed: false }) }))
    expect(result).toBe('proxy_or_network_failure')
  })

  it('status 0 → proxy_or_network_failure', () => {
    const result = derivePipelineStatus(inputs({ trace: trace({ status: 0 }) }))
    expect(result).toBe('proxy_or_network_failure')
  })

  it('5xx → proxy_or_network_failure', () => {
    const result = derivePipelineStatus(inputs({ trace: trace({ status: 502 }) }))
    expect(result).toBe('proxy_or_network_failure')
  })

  it('status undefined → proxy_or_network_failure', () => {
    const result = derivePipelineStatus(
      inputs({ trace: trace({ status: undefined }) }),
    )
    expect(result).toBe('proxy_or_network_failure')
  })
})

describe('derivePipelineStatus — analysis_failed', () => {
  it('200 + analysis turn + analysis_ready.status="needs_user_input" → analysis_failed', () => {
    const result = derivePipelineStatus(
      inputs({
        isAnalysisTurn: true,
        ceeAnalysisReady: ready({ status: 'needs_user_input' }),
      }),
    )
    expect(result).toBe('analysis_failed')
  })

  it('200 + analysis turn + status="needs_user_mapping" → analysis_failed', () => {
    const result = derivePipelineStatus(
      inputs({
        isAnalysisTurn: true,
        ceeAnalysisReady: ready({ status: 'needs_user_mapping' }),
      }),
    )
    expect(result).toBe('analysis_failed')
  })

  it('4xx + recoverable envelope with analysis_failed category → analysis_failed', () => {
    const result = derivePipelineStatus(
      inputs({
        trace: trace({ status: 422 }),
        recoverableEnvelope: { retryable: true, category: 'analysis_failed' },
      }),
    )
    expect(result).toBe('analysis_failed')
  })

  it('4xx + recoverable envelope with plot_timeout category → analysis_failed', () => {
    const result = derivePipelineStatus(
      inputs({
        trace: trace({ status: 422 }),
        recoverableEnvelope: { category: 'plot_timeout' },
      }),
    )
    expect(result).toBe('analysis_failed')
  })
})

describe('derivePipelineStatus — cee_response_received', () => {
  it('4xx + recoverable envelope with non-analysis category → cee_response_received', () => {
    const result = derivePipelineStatus(
      inputs({
        trace: trace({ status: 422 }),
        recoverableEnvelope: { retryable: true, category: 'validation_warning' },
      }),
    )
    expect(result).toBe('cee_response_received')
  })

  it('4xx without envelope → cee_response_received (response landed, not actionable)', () => {
    const result = derivePipelineStatus(inputs({ trace: trace({ status: 400 }) }))
    expect(result).toBe('cee_response_received')
  })
})

describe('derivePipelineStatus — analysis_not_run', () => {
  it('200 + non-analysis turn + freshness="none" → analysis_not_run', () => {
    const result = derivePipelineStatus(
      inputs({
        isAnalysisTurn: false,
        ceeAnalysisReady: ready({ freshness: 'none' }),
      }),
    )
    expect(result).toBe('analysis_not_run')
  })
})

describe('derivePipelineStatus — payload_capture_disabled', () => {
  it('200 success but payload capture disabled → payload_capture_disabled', () => {
    const result = derivePipelineStatus(
      inputs({
        ceeAnalysisReady: ready({ freshness: 'fresh' }),
        payloadCaptureDisabled: true,
      }),
    )
    expect(result).toBe('payload_capture_disabled')
  })

  it('5xx + payload capture disabled → still proxy_or_network_failure (network wins)', () => {
    const result = derivePipelineStatus(
      inputs({
        trace: trace({ status: 503 }),
        payloadCaptureDisabled: true,
      }),
    )
    expect(result).toBe('proxy_or_network_failure')
  })
})

describe('derivePipelineStatus — precedence properties', () => {
  it("network failure cannot be hidden by 'analysis succeeded' wire signal", () => {
    // Property: if the trace says network failure, the wire signal
    // cannot promote it to ui_render_success. Otherwise a debug
    // bundle could falsely report success on a 5xx.
    const result = derivePipelineStatus(
      inputs({
        trace: trace({ status: 503, completed: true }),
        ceeAnalysisReady: ready({ freshness: 'fresh' }),
      }),
    )
    expect(result).toBe('proxy_or_network_failure')
  })

  it('analysis failure cannot be hidden by a 200 status alone', () => {
    // Property: a 200 with analysis_ready.status !== 'ready' on an
    // analysis turn is analysis_failed, never ui_render_success.
    const result = derivePipelineStatus(
      inputs({
        trace: trace({ status: 200 }),
        isAnalysisTurn: true,
        ceeAnalysisReady: ready({ status: 'needs_user_input' }),
      }),
    )
    expect(result).toBe('analysis_failed')
  })

  it('result is deterministic — same inputs give same output', () => {
    const i = inputs({
      isAnalysisTurn: true,
      ceeAnalysisReady: ready(),
    })
    expect(derivePipelineStatus(i)).toBe(derivePipelineStatus(i))
  })
})
