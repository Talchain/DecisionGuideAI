// src/lib/runReport.ts
// Tiny data seam to fetch a Run Report v1.
// If the real report flag is ON, fetch from the Edge Gateway; otherwise fall back to a local mock.
// No PII; model-led facts only.
import { isRealReportEnabled, isRunReportEnabled } from '../flags'
import { getGatewayBaseUrl } from './config'
import { validateReportV1 } from './reportSchema'
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
      const base = getGatewayBaseUrl()
      const urlStr = (() => {
        if (typeof base === 'string' && base.trim().length > 0) {
          const u = new URL('/report', base)
          u.searchParams.set('sessionId', sessionId)
          u.searchParams.set('org', org)
          if (_args?.seed != null && String(_args.seed).length > 0) u.searchParams.set('seed', String(_args.seed))
          if (typeof _args?.budget === 'number') u.searchParams.set('budget', String(_args.budget))
          if (typeof _args?.model === 'string' && _args.model.length > 0) u.searchParams.set('model', _args.model)
          return u.toString()
        }
        const qs = new URLSearchParams()
        qs.set('sessionId', sessionId)
        qs.set('org', org)
        if (_args?.seed != null && String(_args.seed).length > 0) qs.set('seed', String(_args.seed))
        if (typeof _args?.budget === 'number') qs.set('budget', String(_args.budget))
        if (typeof _args?.model === 'string' && _args.model.length > 0) qs.set('model', _args.model)
        return `/report?${qs.toString()}`
      })()
      const res = await fetch(urlStr, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
      if (res.ok) {
        const json = (await res.json()) as RunReport
        return json
      }
    } catch (_e) {
      // swallow and fall through to mock
    }
  }
  // Fallback to fixture helper to ensure deterministic sample
  return await fetchFixtureReport()
}

// Minimal schema presence guard the UI depends on
// moved to reportSchema.ts

async function fetchFixtureReport(): Promise<RunReport> {
  // Try global fetch to the static fixture (works in dev server and tests when mocked)
  try {
    if (typeof (globalThis as any).fetch === 'function') {
      const ac = new AbortController()
      const MODE = (import.meta as any)?.env?.MODE
      const IS_VITEST = !!(import.meta as any)?.vitest
      const TIMEOUT_MS = (MODE === 'test' || IS_VITEST) ? 150 : 3000
      const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
      const res = await (globalThis as any).fetch('/fixtures/reports/report.v1.example.json', { cache: 'no-store', signal: ac.signal })
      clearTimeout(timer)
      if (res && res.ok) return (await res.json()) as RunReport
    }
  } catch {}
  // Last-resort minimal sample (ensures UI does not crash in tests)
  return {
    seed: 1234,
    orgId: 'local',
    userId: 'tester',
    route: 'critique',
    traceId: 't',
    startedAt: new Date(0).toISOString(),
    finishedAt: new Date(0).toISOString(),
    totals: {},
    steps: [],
  }
}

export async function fetchRunReportEnhanced(_args?: { sessionId: string; org: string; seed?: string | number; budget?: number; model?: string }): Promise<{ report: RunReport; fallback: boolean }> {
  const { sessionId, org } = getDefaults(_args)
  // Enhanced fetch is controlled by Run Report feature flag
  const useReal = isRunReportEnabled()
  if (useReal) {
    try {
      const base = getGatewayBaseUrl()
      const urlStr = (() => {
        if (typeof base === 'string' && base.trim().length > 0) {
          const u = new URL('/report', base)
          u.searchParams.set('sessionId', sessionId)
          u.searchParams.set('org', org)
          if (_args?.seed != null && String(_args.seed).length > 0) u.searchParams.set('seed', String(_args.seed))
          if (typeof _args?.budget === 'number') u.searchParams.set('budget', String(_args.budget))
          if (typeof _args?.model === 'string' && _args?.model.length > 0) u.searchParams.set('model', _args.model)
          return u.toString()
        }
        const qs = new URLSearchParams()
        qs.set('sessionId', sessionId)
        qs.set('org', org)
        if (_args?.seed != null && String(_args.seed).length > 0) qs.set('seed', String(_args.seed))
        if (typeof _args?.budget === 'number') qs.set('budget', String(_args.budget))
        if (typeof _args?.model === 'string' && _args?.model.length > 0) qs.set('model', _args.model)
        return `/report?${qs.toString()}`
      })()
      const ac = new AbortController()
      const MODE = (import.meta as any)?.env?.MODE
      const TIMEOUT_MS = MODE === 'test' ? 100 : 3000
      const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
      const res = await fetch(urlStr, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: ac.signal })
      clearTimeout(timer)
      if (res.ok) {
        try {
          const json = await res.json()
          const v = validateReportV1(json)
          if (v.ok) {
            return { report: v.data as unknown as RunReport, fallback: false }
          }
        } catch {}
        const sample = await fetchFixtureReport()
        return { report: sample, fallback: true }
      }
      // Non-OK → fallback
      const sample = await fetchFixtureReport()
      return { report: sample, fallback: true }
    } catch {
      const sample = await fetchFixtureReport()
      return { report: sample, fallback: true }
    }
  }
  // Flag OFF → just use fixture, no note
  const sample = await fetchFixtureReport()
  return { report: sample, fallback: false }
}
