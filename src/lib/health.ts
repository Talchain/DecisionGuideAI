// src/lib/health.ts
export type Health = { status: 'ok' | 'degraded' | 'down'; p95_ms: number; version?: string; replay?: { lastStatus?: string } }

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
    return { status: 'degraded', p95_ms: 0 }
  }
}
