// src/poc/adapters/StreamAdapter.ts
// POC: Client-side SSE simulator for stream panels

export type TokenCallback = (token: string) => void
export type DoneCallback = () => void
export type StopFunction = () => void

// POC: Simulate token streaming (no real SSE)
export function simulateTokens(
  onToken: TokenCallback,
  onDone: DoneCallback
): StopFunction {
  const total = 10 + Math.floor(Math.random() * 40) // 10-50 tokens
  let i = 0
  let stopped = false

  function tick() {
    if (stopped) return
    if (i++ >= total) {
      onDone()
      return
    }
    onToken('▌' + Math.random().toString(36).slice(2, 6))
    setTimeout(tick, 50 + Math.random() * 100) // 50-150ms cadence
  }

  tick()

  return () => {
    stopped = true
    onDone()
  }
}

// POC: Engine GET adapter (no auth)
export async function getJSON(edge: string, path: string) {
  const url = edge.replace(/\/$/, '') + path
  const t0 = performance.now()
  
  try {
    const r = await fetch(url, { cache: 'no-store' })
    const ms = Math.round(performance.now() - t0)
    const text = await r.text()
    
    try {
      const json = JSON.parse(text)
      return {
        ok: r.ok,
        status: r.status,
        ms,
        json,
        headers: Object.fromEntries(r.headers.entries())
      }
    } catch {
      return {
        ok: r.ok,
        status: r.status,
        ms,
        error: 'Invalid JSON',
        body: text.slice(0, 512),
        headers: Object.fromEntries(r.headers.entries())
      }
    }
  } catch (e) {
    const ms = Math.round(performance.now() - t0)
    return {
      ok: false,
      status: 0,
      ms,
      error: String(e),
      headers: {}
    }
  }
}
