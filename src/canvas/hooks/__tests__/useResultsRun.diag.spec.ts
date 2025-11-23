import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsRun } from '../useResultsRun'
import { useCanvasStore } from '../../store'
import * as plotAdapter from '../../../adapters/plot'

// Mock plot adapter so streaming path is always available
vi.mock('../../../adapters/plot', () => ({
  plot: {
    stream: {
      run: vi.fn(),
    },
    run: vi.fn(),
  },
}))

const getMockStreamRun = () => {
  const anyPlot = plotAdapter as any
  return vi.mocked(anyPlot.plot.stream.run as any)
}

describe('useResultsRun diagnostics wiring', () => {
  beforeEach(() => {
    // Reset runMeta before each test
    useCanvasStore.getState().setRunMeta({
      diagnostics: undefined,
      correlationIdHeader: undefined,
      degraded: undefined,
    })

    // Clear mock implementations
    getMockStreamRun().mockReset()
  })

  it('captures diagnostics metadata into runMeta on streaming completion', async () => {
    const mockStreamRun = getMockStreamRun()

    mockStreamRun.mockImplementation((_request: any, handlers: any) => {
      // Simulate normal streaming lifecycle
      handlers.onHello?.({ response_id: 'run-1' })
      handlers.onTick?.({ index: 1 })

      const report = {
        schema: 'report.v1',
        meta: {
          seed: 42,
          response_id: 'run-1',
          elapsed_ms: 100,
        },
        model_card: {
          response_hash: 'hash-1',
          response_hash_algo: 'sha256',
          normalized: true as const,
        },
        results: {
          conservative: 10,
          likely: 20,
          optimistic: 30,
          units: 'count' as const,
        },
        confidence: {
          level: 'medium' as const,
          why: 'test',
        },
        drivers: [],
      }

      handlers.onDone?.({
        response_id: 'run-1',
        report,
        diagnostics: {
          resumes: 2,
          trims: 1,
          recovered_events: 3,
          correlation_id: 'corr-1',
        },
        correlationIdHeader: 'hdr-1',
        degraded: true,
      })

      return () => {}
    })

    const { result } = renderHook(() => useResultsRun())

    await result.current.run({ template_id: 'tpl-1', seed: 42 } as any)

    const runMeta = useCanvasStore.getState().runMeta

    expect(runMeta.correlationIdHeader).toBe('hdr-1')
    expect(runMeta.degraded).toBe(true)
    expect(runMeta.diagnostics).toEqual({
      resumes: 2,
      trims: 1,
      recovered_events: 3,
      correlation_id: 'corr-1',
    })
  })

  it('captures CEE metadata into runMeta when present on completion', async () => {
    const mockStreamRun = getMockStreamRun()

    mockStreamRun.mockImplementation((_request: any, handlers: any) => {
      const report = {
        schema: 'report.v1',
        meta: {
          seed: 99,
          response_id: 'run-2',
          elapsed_ms: 120,
        },
        model_card: {
          response_hash: 'hash-2',
          response_hash_algo: 'sha256',
          normalized: true as const,
        },
        results: {
          conservative: 5,
          likely: 15,
          optimistic: 25,
          units: 'count' as const,
        },
        confidence: {
          level: 'high' as const,
          why: 'cee-test',
        },
        drivers: [],
      }

      handlers.onDone?.({
        response_id: 'run-2',
        report,
        diagnostics: undefined,
        correlationIdHeader: 'hdr-2',
        degraded: false,
        ceeReview: {
          story: {
            headline: 'CEE story',
            key_drivers: [],
            next_actions: [],
          },
          journey: {
            is_complete: true,
            missing_envelopes: [],
          },
        },
        ceeTrace: {
          requestId: 'req-123',
          degraded: false,
          timestamp: '2025-11-20T18:30:00Z',
        },
        ceeError: {
          code: 'CEE_TEMP',
          retryable: false,
          traceId: 'trace-123',
          suggestedAction: 'fail',
        },
      } as any)

      return () => {}
    })

    const { result } = renderHook(() => useResultsRun())

    await result.current.run({ template_id: 'tpl-2', seed: 99 } as any)

    const runMeta = useCanvasStore.getState().runMeta

    expect(runMeta.ceeReview?.story?.headline).toBe('CEE story')
    expect(runMeta.ceeTrace?.requestId).toBe('req-123')
    expect(runMeta.ceeError?.suggestedAction).toBe('fail')
  })
})
