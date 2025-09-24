// src/lib/runReport.ts
// Tiny data seam to fetch a Run Report v1.
// If the real report flag is ON, fetch from the Edge Gateway; otherwise fall back to a local mock.
// No PII; model-led facts only.
import { isRealReportEnabled } from '../flags'
import { getDefaults } from './session'

export type RunReportStep = {
  id: string
  type: string
  status: string
  attempts: number
  durationMs: number
  outcome?: string
  errorCode?: string
}

export type RunReport = {
  seed: number
  orgId: string
  userId: string
  route: string
  traceId: string
  startedAt: string
  finishedAt: string
  totals: Record<string, number>
  steps: RunReportStep[]
  confidence?: {
    identifiability?: number | string
    linearity?: number | string
    calibration?: number | string
    diversity?: number | string
  }
}

export async function fetchRunReport(_args?: { sessionId: string; org: string; seed?: string | number; budget?: number; model?: string }): Promise<RunReport> {
  const { sessionId, org } = getDefaults(_args)
  // Real source first (if enabled), then fallback to mock fixture
  const useReal = isRealReportEnabled()
  if (useReal) {
    try {
      // Edge Gateway base URL
      let base = 'http://localhost:3001'
      try {
        const env = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL
        if (typeof env === 'string' && env.length > 0) base = env
      } catch {}
      const u = new URL('/report', base)
      u.searchParams.set('sessionId', sessionId)
      u.searchParams.set('org', org)
      if (_args?.seed != null && String(_args.seed).length > 0) u.searchParams.set('seed', String(_args.seed))
      if (typeof _args?.budget === 'number') u.searchParams.set('budget', String(_args.budget))
      if (typeof _args?.model === 'string' && _args.model.length > 0) u.searchParams.set('model', _args.model)
      const res = await fetch(u.toString(), { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
      if (res.ok) {
        const json = (await res.json()) as RunReport
        return json
      }
    } catch (_e) {
      // swallow and fall through to mock
    }
  }
  // Fallback to mock JSON via browser fetch if available
  try {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch('/fixtures/reports/report.v1.example.json', { cache: 'no-store' })
      if (res.ok) return (await res.json()) as RunReport
    }
  } catch {}
  // Fallback for tests or non-browser contexts: read JSON from filesystem using project root
  try {
    const fs = await import('fs/promises')
    const path = await import('node:path')
    const filePath = path.resolve(process.cwd?.() ?? '.', 'src/fixtures/reports/report.v1.example.json')
    const text = await fs.readFile(filePath, 'utf8')
    return JSON.parse(text) as RunReport
  } catch (_e) {
    // If all fallbacks fail, surface a minimal error to the caller to show a calm hint
    throw new Error('REPORT_UNAVAILABLE')
  }
}
