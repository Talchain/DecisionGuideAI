import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCEEDraft } from '../useCEEDraft'
import * as ceeModule from '../../adapters/cee/client'

vi.mock('../../adapters/cee/client', () => {
  const draftModel = vi.fn<[], Promise<any>>()

  class CEEError extends Error {
    status: number
    details?: unknown
    correlationId?: string

    constructor(message: string, status: number, details?: unknown, correlationId?: string) {
      super(message)
      this.name = 'CEEError'
      this.status = status
      this.details = details
      this.correlationId = correlationId
    }
  }

  class CEEClient {
    draftModel = draftModel
  }

  return {
    CEEClient,
    CEEError,
    __mock: {
      draftModel,
    },
  }
})

const getMock = () => (ceeModule as unknown as { __mock: { draftModel: ReturnType<typeof vi.fn> } }).__mock

describe('useCEEDraft', () => {
  beforeEach(() => {
    const { draftModel } = getMock()
    draftModel.mockReset()
  })

  it('returns data on successful draft and clears guidance and rate limit', async () => {
    const { draftModel } = getMock()

    const response = {
      quality_overall: 8,
      nodes: [{ id: 'n1', label: 'Decision', type: 'factor', uncertainty: 0.2 }],
      edges: [],
      draft_warnings: {
        structural: [],
        completeness: [],
      },
    }

    draftModel.mockResolvedValueOnce(response)

    const { result } = renderHook(() => useCEEDraft())

    await act(async () => {
      await result.current.draft('Test decision')
    })

    expect(result.current.data).toEqual(response)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.guidance).toBeNull()
    expect(result.current.retryAfterSeconds).toBeNull()
  })

  it('treats empty drafts as errors and surfaces default guidance', async () => {
    const { draftModel } = getMock()

    draftModel.mockResolvedValueOnce({
      quality_overall: 5,
      nodes: [],
      edges: [],
      draft_warnings: {
        structural: [],
        completeness: [],
      },
    })

    const { result } = renderHook(() => useCEEDraft())

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.draft('Too vague')
      } catch (error) {
        thrown = error
      }
    })

    expect(thrown).toBeInstanceOf((ceeModule as any).CEEError)
    expect(result.current.data).toBeNull()
    expect(result.current.error).not.toBeNull()
    expect(result.current.guidance).not.toBeNull()
    expect(result.current.guidance?.level).toBe('needs_clarification')
    expect(result.current.guidance?.questions.length).toBeGreaterThanOrEqual(3)
    expect(result.current.retryAfterSeconds).toBeNull()

    const ceeError = result.current.error as any
    expect(ceeError.status).toBe(400)
    expect(ceeError.details?.code).toBe('CEE_GRAPH_INVALID')
    expect(ceeError.details?.reason).toBe('empty_graph')
  })

  it('maps CEE_GRAPH_INVALID empty_graph backend error into guidance', async () => {
    const { draftModel } = getMock()
    const { CEEError } = ceeModule as any

    const backendError = new CEEError('Draft graph is empty; unable to construct model', 400, {
      code: 'CEE_GRAPH_INVALID',
      details: {
        reason: 'empty_graph',
        node_count: 0,
        edge_count: 0,
      },
      trace: { request_id: 'cee-trace-123' },
    })

    draftModel.mockRejectedValueOnce(backendError)

    const { result } = renderHook(() => useCEEDraft())

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.draft('Too vague')
      } catch (error) {
        thrown = error
      }
    })

    expect(thrown).toBe(backendError)
    expect(result.current.error).toBe(backendError)
    expect(result.current.guidance).not.toBeNull()
    expect(result.current.guidance?.level).toBe('needs_clarification')
    expect(result.current.guidance?.questions.length).toBeGreaterThanOrEqual(3)
    expect(result.current.retryAfterSeconds).toBeNull()
  })

  it('merges suggested questions and hint from backend details into guidance', async () => {
    const { draftModel } = getMock()
    const { CEEError } = ceeModule as any

    const backendError = new CEEError('Preflight failed', 400, {
      level: 'needs_clarification',
      suggested_questions: ['Question A', 'Question B'],
      hint: 'Please add more detail about your options.',
    })

    draftModel.mockRejectedValueOnce(backendError)

    const { result } = renderHook(() => useCEEDraft())

    await act(async () => {
      try {
        await result.current.draft('Incomplete brief')
      } catch {
        // expected
      }
    })

    expect(result.current.guidance).not.toBeNull()
    expect(result.current.guidance?.questions).toEqual(['Question A', 'Question B'])
    expect(result.current.guidance?.hint).toContain('Please add more detail')
  })

  it('captures retryAfterSeconds when status is 429 and details include retry_after_seconds', async () => {
    const { draftModel } = getMock()
    const { CEEError } = ceeModule as any

    const backendError = new CEEError('Too Many Requests', 429, {
      retry_after_seconds: 10,
    })

    draftModel.mockRejectedValueOnce(backendError)

    const { result } = renderHook(() => useCEEDraft())

    await act(async () => {
      try {
        await result.current.draft('Rate limited')
      } catch {
        // expected
      }
    })

    expect(result.current.retryAfterSeconds).toBe(10)
    expect(result.current.error).not.toBeNull()
  })
})
