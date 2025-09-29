import { describe, it, expect } from 'vitest'
import { validateReportV1 } from '../reportSchema'

describe('report schema fail', () => {
  it('rejects wrong version', () => {
    const bad = {
      version: 2,
      seed: 1,
      route: 'critique',
      startedAt: '2025-09-23T18:00:00.000Z',
      finishedAt: '2025-09-23T18:00:01.000Z',
      totals: {},
      steps: [],
      meta: {},
      sections: [],
    }
    const v = validateReportV1(bad)
    expect(v.ok).toBe(false)
  })

  it('rejects when sections is missing', () => {
    const bad: any = {
      version: 1,
      seed: 1,
      route: 'critique',
      startedAt: '2025-09-23T18:00:00.000Z',
      finishedAt: '2025-09-23T18:00:01.000Z',
      totals: {},
      steps: [],
      meta: {},
    }
    const v = validateReportV1(bad)
    expect(v.ok).toBe(false)
  })

  it('rejects when meta is missing', () => {
    const bad: any = {
      version: '1',
      seed: 1,
      route: 'critique',
      startedAt: '2025-09-23T18:00:00.000Z',
      finishedAt: '2025-09-23T18:00:01.000Z',
      totals: {},
      steps: [],
      sections: [],
    }
    const v = validateReportV1(bad)
    expect(v.ok).toBe(false)
  })
})
