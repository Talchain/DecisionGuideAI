import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTemplatesRun } from '../../../../src/routes/templates/hooks/useTemplatesRun'
import * as plotAdapter from '../../../../src/adapters/plot'

vi.mock('../../../../src/adapters/plot', () => ({
  plot: {
    run: vi.fn()
  }
}))

const mockPlot = vi.mocked(plotAdapter.plot)

describe('useTemplatesRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useTemplatesRun())
    
    expect(result.current.loading).toBe(false)
    expect(result.current.result).toBe(null)
    expect(result.current.error).toBe(null)
    expect(result.current.retryAfter).toBe(null)
  })

  it('handles successful run', async () => {
    const mockResult = {
      schema: 'report.v1' as const,
      meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
      model_card: { response_hash: 'hash123', response_hash_algo: 'sha256' as const, normalized: true },
      results: { conservative: 100, likely: 150, optimistic: 200 },
      confidence: { level: 'medium' as const, why: 'test' },
      drivers: []
    }
    
    mockPlot.run.mockResolvedValue(mockResult)
    
    const { result } = renderHook(() => useTemplatesRun())
    
    await act(async () => {
      await result.current.run({ template_id: 'test', seed: 1337 })
    })
    
    expect(result.current.loading).toBe(false)
    expect(result.current.result).toEqual(mockResult)
    expect(result.current.error).toBe(null)
  })

  it('clears error state', () => {
    const { result } = renderHook(() => useTemplatesRun())
    
    act(() => {
      result.current.clearError()
    })
    
    expect(result.current.error).toBe(null)
    expect(result.current.retryAfter).toBe(null)
  })
})
