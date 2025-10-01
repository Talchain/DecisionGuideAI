import { describe, it, expect } from 'vitest'
import { validateReportV1 } from '../reportSchema'

describe('report schema additive', () => {
  it('allows unknown extra fields while remaining valid', () => {
    const input: any = {
      version: '1',
      seed: '99',
      route: 'critique',
      startedAt: '2025-09-23T18:00:00.000Z',
      finishedAt: '2025-09-23T18:00:03.000Z',
      totals: { inputTokens: 10, outputTokens: 2 },
      steps: [],
      meta: { region: 'dev' },
      sections: [],
      // unknown extras
      debug: { a: 1 },
      foo: 'bar',
    }
    const v = validateReportV1(input)
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.data.meta).toBeTruthy()
      expect((v as any).data.debug).toBeDefined()
    }
  })
})
