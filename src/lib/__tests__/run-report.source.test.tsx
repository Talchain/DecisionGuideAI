import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchRunReport } from '../runReport'

describe('Run Report source selection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('uses mock fixture when real flag is OFF', async () => {
    vi.mock('../../flags', () => ({
      isRealReportEnabled: () => false,
      isScenariosEnabled: () => false,
    }))

    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (url: any) => {
      const href = String(url)
      if (href.includes('/fixtures/reports/report.v1.example.json')) {
        return {
          ok: true,
          json: async () => ({ seed: 1234, orgId: 'local', userId: 'tester', route: 'critique', traceId: 't', startedAt: '2025-09-23T18:00:00.000Z', finishedAt: '2025-09-23T18:00:05.250Z', totals: {}, steps: [] }),
        } as any
      }
      return { ok: false, json: async () => ({}) } as any
    })

    const r = await fetchRunReport({ sessionId: 'sandbox', org: 'local' })
    expect(r.seed).toBe(1234)

    fetchSpy.mockRestore()
  })

  it('falls back to mock when real flag ON but fetch errors', async () => {
    vi.mock('../../flags', () => ({
      isRealReportEnabled: () => true,
      isScenariosEnabled: () => false,
    }))

    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (url: any) => {
      const href = String(url)
      if (href.includes('/report')) {
        return { ok: false, json: async () => ({}) } as any
      }
      if (href.includes('/fixtures/reports/report.v1.example.json')) {
        return {
          ok: true,
          json: async () => ({ seed: 1234, orgId: 'local', userId: 'tester', route: 'critique', traceId: 't', startedAt: '2025-09-23T18:00:00.000Z', finishedAt: '2025-09-23T18:00:05.250Z', totals: {}, steps: [] }),
        } as any
      }
      return { ok: false, json: async () => ({}) } as any
    })

    const r = await fetchRunReport({ sessionId: 'sandbox', org: 'local' })
    expect(r.seed).toBe(1234)

    fetchSpy.mockRestore()
  })
})
