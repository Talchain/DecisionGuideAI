// src/lib/health.ts
// ⚠ A16 AUDIT — 'unreachable' IS A DISTINCT STATUS FROM 'degraded'. A server
// that answers "I'm degraded" and a `fetch()` that never got an answer at all
// are different facts; before this fix `fetchHealth`'s catch collapsed both
// into 'degraded', so a DOWN NETWORK read on screen as "Engine running in
// degraded mode" — an engine the UI could not even reach.
export type Health = { status: 'ok' | 'degraded' | 'down' | 'unreachable'; p95_ms: number; version?: string; replay?: { lastStatus?: string } }

export function parseHealth(data: any): Health {
  try {
    if (!data || typeof data !== 'object') return { status: 'degraded', p95_ms: 0 }
    const statusRaw = String(data?.status ?? 'ok').toLowerCase()
    const status = (statusRaw === 'ok' || statusRaw === 'degraded' || statusRaw === 'down') ? statusRaw : 'ok'
    const p95 = Number(data?.p95_ms)
    const p95_ms = Number.isFinite(p95) && p95 >= 0 ? p95 : 0
    const version = typeof data?.version === 'string' ? data.version : undefined
    const replay = (data && typeof data === 'object' && data.replay && typeof data.replay === 'object') ? { lastStatus: typeof (data.replay as any).lastStatus === 'string' ? (data.replay as any).lastStatus : undefined } : undefined
    return { status, p95_ms, version, replay }
  } catch {
    return { status: 'degraded', p95_ms: 0 }
  }
}

export async function fetchHealth(url: string = '/health'): Promise<Health> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('not ok')
    const data: any = await res.json().catch(() => ({}))
    return parseHealth(data)
  } catch {
    // A16: the fetch itself failed (network error, or the health endpoint
    // did not answer with 2xx) — the UI never heard from the engine at all,
    // which is a different fact from the engine reporting its own degraded
    // status. Never invent 'degraded' for a response that was never received.
    return { status: 'unreachable', p95_ms: 0 }
  }
}
