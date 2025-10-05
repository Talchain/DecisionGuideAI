// src/lib/pocEngine.ts
// POC: Engine integration helpers (no auth, no external deps)

import { getEdgeBase } from './pocFlags'

export interface FlowResult {
  ok: boolean
  ms: number
  data?: any
  error?: string
  url?: string
  status?: number
}

export async function fetchFlow(params: { edge: string; template: string; seed: number }): Promise<FlowResult> {
  const base = (params.edge || '/engine').replace(/\/$/, '')
  const url = `${base}/draft-flows?template=${encodeURIComponent(params.template)}&seed=${params.seed}`
  const t0 = performance.now()
  
  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store' })
    const ms = Math.round(performance.now() - t0)
    const data = await r.json().catch(() => ({}))
    
    return {
      ok: r.ok,
      ms,
      data,
      url,
      status: r.status
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

// POC: Parse hash query params for overrides
export function getHashParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  const match = hash.match(new RegExp(`[?#&]${name}=([^&]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

export interface SSECallbacks {
  onToken: (token: string) => void
  onDone: () => void
  onError: (error: string) => void
}

export function openSSE(path: string, callbacks: SSECallbacks): () => void {
  const edge = getEdgeBase()
  const url = `${edge.replace(/\/$/, '')}${path}`
  
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
