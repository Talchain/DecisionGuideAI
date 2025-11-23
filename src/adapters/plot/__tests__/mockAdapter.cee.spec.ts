import { describe, it, expect } from 'vitest'
import { plot as mockPlot } from '../mockAdapter'
import type { RunRequest, ReportV1, ErrorV1 } from '../types'

/**
 * Deterministic CEE behaviour tests for mock adapter streaming
 */

describe('mockAdapter.stream – CEE states by seed', () => {
  const templateId = 'pricing-v1'

  const runStream = (seed: number) => {
    const request: RunRequest = {
      template_id: templateId,
      seed,
    }

    return new Promise<{
      response_id: string
      report: ReportV1
      ceeReview: any
      ceeTrace: any
      ceeError: any
    }>((resolve, reject) => {
      let timeout: number | undefined

      const cancel = mockPlot.stream.run(request, {
        onHello: () => {},
        onTick: () => {},
        onDone: (data: any) => {
          if (timeout !== undefined) {
            clearTimeout(timeout)
          }
          resolve(data)
        },
        onError: (error: ErrorV1) => {
          if (timeout !== undefined) {
            clearTimeout(timeout)
          }
          reject(new Error(`mockAdapter error: ${error.code} ${error.error}`))
        },
      })

      // Safety timeout so tests don't hang
      timeout = setTimeout(() => {
        cancel()
        reject(new Error('mockAdapter.stream timeout'))
      }, 7000) as unknown as number
    })
  }

  it('emits ready CEE state when seed % 3 === 0 (ceeReview present, no ceeError)', async () => {
    const seed = 3 // 3 % 3 === 0

    const result = await runStream(seed)

    expect(result.ceeReview).toBeTruthy()
    expect(result.ceeReview.story?.headline).toBe('Mock Decision Review')
    expect(result.ceeError).toBeNull()
  })

  it('emits empty CEE state when seed % 3 === 1 (no review, no error)', async () => {
    const seed = 4 // 4 % 3 === 1

    const result = await runStream(seed)

    expect(result.ceeReview).toBeNull()
    expect(result.ceeError).toBeNull()
  })

  it('emits error CEE state when seed % 3 === 2 (ceeError present, no review)', async () => {
    const seed = 5 // 5 % 3 === 2

    const result = await runStream(seed)

    expect(result.ceeReview).toBeNull()
    expect(result.ceeError).toBeTruthy()
    expect(result.ceeError.code).toBe('CEE_TEMPORARY')
    expect(result.ceeError.suggestedAction).toBe('retry')
    expect(result.ceeError.traceId).toBe(`mock-trace-${seed}`)
  })
})
