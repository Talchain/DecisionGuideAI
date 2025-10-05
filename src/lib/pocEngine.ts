// src/lib/pocEngine.ts
// POC: Engine integration helpers (no auth, no external deps)

// POC: Parse hash query params for overrides
export function getHashParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  const match = hash.match(new RegExp(`[?#&]${name}=([^&]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

// POC: Unified edge resolver (single source of truth)
export function resolveEdge(input?: string): string {
  const fromHash = getHashParam('edge')
  const base = (input || fromHash || '/engine').replace(/\/$/, '')
  return base
}

export interface FlowResult {
  ok: boolean
  ms: number
  data?: any
  error?: string
  url?: string
  status?: number
  headers?: Record<string, string>
}

export async function fetchFlow(params: { edge: string; template: string; seed: number }): Promise<FlowResult> {
  const base = resolveEdge(params.edge)
  const url = `${base}/draft-flows?template=${encodeURIComponent(params.template)}&seed=${params.seed}`
  const t0 = performance.now()
  
  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store' })
    const ms = Math.round(performance.now() - t0)
    const data = await r.json().catch(() => ({}))
    
    // Capture selected response headers
    const headers: Record<string, string> = {}
    const headerKeys = ['etag', 'cache-control', 'content-length', 'vary', 'content-type']
    headerKeys.forEach(key => {
      const val = r.headers.get(key)
      if (val) headers[key] = val
    })
    
    return {
      ok: r.ok,
      ms,
      data,
      url,
      status: r.status,
      headers
    }
  } catch (e: any) {
    const ms = Math.round(performance.now() - t0)
    return {
      ok: false,
      ms,
      error: String(e?.message || e),
      url
    }
  }
}

export interface SSECallbacks {
  onToken: (token: string) => void
  onDone: () => void
  onError: (error: string) => void
}

// POC: SSE with explicit edge + path (prevents double /engine)
export function openSSE(
  opts: { edge?: string; path: string },
  callbacks: SSECallbacks
): () => void {
  const base = resolveEdge(opts.edge)
  const path = opts.path.startsWith('/') ? opts.path : `/${opts.path}`
  const url = `${base}${path}`
  
  let stopped = false
  let eventSource: EventSource | null = null
  
  try {
    eventSource = new EventSource(url)
    
    eventSource.onmessage = (event) => {
      if (stopped) return
      try {
        const data = JSON.parse(event.data)
        if (data.token) {
          callbacks.onToken(data.token)
        }
        if (data.done) {
          callbacks.onDone()
          eventSource?.close()
        }
      } catch {
        callbacks.onToken(event.data)
      }
    }
    
    eventSource.onerror = () => {
      if (stopped) return
      callbacks.onError('SSE connection failed')
      eventSource?.close()
    }
  } catch (e) {
    callbacks.onError(String(e))
  }
  
  return () => {
    stopped = true
    eventSource?.close()
  }
}

// POC: Load fixture data for fallbacks
export async function loadFixture(path: string): Promise<any> {
  try {
    const response = await fetch(`/fixtures/${path}`)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
