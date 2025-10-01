import { describe, it, expect } from 'vitest'
import { validateReportV1 } from '../reportSchema'

describe('report schema OK', () => {
  it('accepts a minimal valid v1 object', () => {
    const input = {
      version: 1,
      seed: 7,
      route: 'critique',
      startedAt: '2025-09-23T18:00:00.000Z',
      finishedAt: '2025-09-23T18:00:01.000Z',
      totals: { inputTokens: 1 },
      steps: [],
      meta: {},
      sections: [],
    }
    const v = validateReportV1(input)
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.data.route).toBe('critique')
      expect(v.data.version === 1 || v.data.version === '1').toBe(true)
    }
  })
})
