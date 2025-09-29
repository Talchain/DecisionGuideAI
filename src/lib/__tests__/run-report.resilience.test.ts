import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fetchRunReportEnhanced } from '../runReport'

const SAMPLE = {
  version: 1,
  seed: 1234,
  orgId: 'local',
  userId: 'tester',
  route: 'critique',
  traceId: 't',
  startedAt: '2025-09-23T18:00:00.000Z',
  finishedAt: '2025-09-23T18:00:05.250Z',
  totals: {},
  steps: [],
  meta: {},
  sections: [],
}

describe('Run Report resilience', () => {
  beforeEach(() => {
    try { window.localStorage.setItem('feature.runReport', '1') } catch {}
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    try { window.localStorage.removeItem('feature.runReport') } catch {}
  })

  it('real fetch ON + non-OK → falls back to sample with flag', async () => {
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (url: any) => {
      const href = String(url)
      if (href.includes('/report')) {
        return { ok: false, json: async () => ({}) } as any
      }
      if (href.includes('/fixtures/reports/report.v1.example.json')) {
        return { ok: true, json: async () => SAMPLE } as any
      }
      return { ok: false, json: async () => ({}) } as any
    })

    const { fallback } = await fetchRunReportEnhanced({ sessionId: 'sandbox', org: 'local' })
    expect(fallback).toBe(true)

    fetchSpy.mockRestore()
  })

  it('real fetch ON + malformed schema → falls back to sample with flag', async () => {
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (url: any) => {
      const href = String(url)
      if (href.includes('/report')) {
        return { ok: true, json: async () => ({ wrong: 1 }) } as any
      }
      if (href.includes('/fixtures/reports/report.v1.example.json')) {
        return { ok: true, json: async () => SAMPLE } as any
      }
      return { ok: false, json: async () => ({}) } as any
    })

    const { fallback } = await fetchRunReportEnhanced({ sessionId: 'sandbox', org: 'local' })
    expect(fallback).toBe(true)

    fetchSpy.mockRestore()
  })

  it('flag OFF → uses fixture path with no fallback', async () => {
    try { window.localStorage.removeItem('feature.runReport') } catch {}
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (url: any) => {
      const href = String(url)
      if (href.includes('/fixtures/reports/report.v1.example.json')) {
        return { ok: true, json: async () => SAMPLE } as any
      }
      return { ok: false, json: async () => ({}) } as any
    })

    const { fallback } = await fetchRunReportEnhanced({ sessionId: 'sandbox', org: 'local' })
    expect(fallback).toBe(false)

    fetchSpy.mockRestore()
  })

  it('real fetch ON + timeout → falls back to sample with flag', async () => {
    try { window.localStorage.setItem('feature.runReport', '1') } catch {}
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (url: any, opts: any) => {
      const href = String(url)
      if (href.includes('/report')) {
        // never resolve, simulate hang until abort
        return await new Promise((_resolve, _reject) => {
          const signal = opts?.signal
          if (signal) {
            signal.addEventListener('abort', () => {
              _reject(new DOMException('Aborted', 'AbortError') as any)
            })
          }
        })
      }
      if (href.includes('/fixtures/reports/report.v1.example.json')) {
        return { ok: true, json: async () => SAMPLE } as any
      }
      return { ok: false, json: async () => ({}) } as any
    })

    const { report, fallback } = await fetchRunReportEnhanced({ sessionId: 'sandbox', org: 'local' })
    expect(report.seed).toBe(1234)
    expect(fallback).toBe(true)

    fetchSpy.mockRestore()
  })
})
