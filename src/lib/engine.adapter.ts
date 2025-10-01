// src/lib/engine.adapter.ts
import { getGatewayBaseUrl } from './config'

export type EngineMode = 'fixtures' | 'live'

export function getDefaultEngineMode(): EngineMode {
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.('feature.engineModeDefault')
    if (raw === 'live') return 'live'
  } catch {}
  return 'fixtures'
}

export function toggleEngineMode(m: EngineMode): EngineMode {
  return m === 'fixtures' ? 'live' : 'fixtures'
}

// ————————————————————————————————————————————————————————————
// Draft Flows adapter (audit-focused)
// Tracks last response status, important headers, and cached ETag.
// On 304, callers must avoid mutating any model/state.
// ————————————————————————————————————————————————————————————

export type AuditInfo = {
  lastStatus: number | null
  lastHeaders: Record<string, string> | null
  cachedEtag: string | null
}

let __cachedEtag: string | null = null
let __lastStatus: number | null = null
let __lastHeaders: Record<string, string> | null = null

export function getAuditInfo(): AuditInfo {
  return { lastStatus: __lastStatus, lastHeaders: __lastHeaders, cachedEtag: __cachedEtag }
}

function normaliseHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    h.forEach((v, k) => { out[k] = v })
  } catch {}
  return out
}

export async function fetchDraftFlows(): Promise<{ data?: unknown; status: number }> {
  const base = getGatewayBaseUrl()
  const urlStr = (() => {
    if (typeof base === 'string' && base.trim().length > 0) {
      const u = new URL('/draft-flows', base)
      return u.toString()
    }
    return '/draft-flows'
  })()

  const headers: Record<string, string> = { 'Accept': 'application/json' }
  if (__cachedEtag) headers['If-None-Match'] = __cachedEtag

  const res = await fetch(urlStr, { method: 'GET', headers, cache: 'no-store' as RequestCache })
  __lastStatus = res.status
  __lastHeaders = normaliseHeaders(res.headers)

  if (res.status === 304) {
    // Not modified: do not mutate cached data or model
    return { status: 304 }
  }
  if (res.ok) {
    try { __cachedEtag = res.headers.get('ETag') } catch {}
    try {
      const json = await res.json()
      return { data: json, status: res.status }
    } catch {
      return { status: res.status }
    }
  }
  return { status: res.status }
}
